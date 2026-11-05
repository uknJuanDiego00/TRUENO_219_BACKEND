const mongoose = require('mongoose');
const Debt = require('../models/Debt');
const Config = require('../models/Config');
const DebtService = require('../services/debt.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, createError, parsePagination } = require('../utils/helpers');

/**
 * @route GET /api/debts
 */
const getDebts = asyncHandler(async (req, res) => {
  const { status, clientId, search, all } = req.query;
  const filter = { user: req.user._id };

  if (status) filter.status = status;

  if (clientId) {
    if (mongoose.isValidObjectId(clientId)) {
      filter.$or = [{ clientRef: clientId }, { clientId: Number(clientId) || -1 }];
    } else {
      filter.clientId = Number(clientId);
    }
  }

  if (search) {
    filter.$or = [
      { clientName: { $regex: search, $options: 'i' } },
      { clientDocument: { $regex: search, $options: 'i' } },
    ];
  }

  // Update overdue statuses
  const now = new Date();
  await Debt.updateMany(
    {
      user: req.user._id,
      status: 'pendiente',
      dueDate: { $lt: now },
    },
    { $set: { status: 'vencida' } }
  );

  if (all === 'true' || req.query.limit === 'all' || !req.query.page) {
    const debts = await Debt.find(filter).sort({ createdAt: -1 });
    return ApiResponse.success(res, debts);
  }

  const { page, limit, skip } = parsePagination(req.query, 50);
  const total = await Debt.countDocuments(filter);
  const debts = await Debt.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

  return ApiResponse.paginated(res, debts, { page, limit, total });
});

/**
 * @route GET /api/debts/summary
 */
const getDebtSummary = asyncHandler(async (req, res) => {
  const debts = await Debt.find({ user: req.user._id });

  let totalDebt = 0;
  let totalPaid = 0;
  let totalBalance = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let paidCount = 0;

  const now = new Date();

  for (const d of debts) {
    totalDebt += d.total || 0;
    totalPaid += d.paid || 0;
    totalBalance += d.balance || 0;

    if (d.status === 'pagada' || d.balance <= 0) {
      paidCount++;
    } else if (d.dueDate && new Date(d.dueDate) < now) {
      overdueCount++;
    } else {
      pendingCount++;
    }
  }

  return ApiResponse.success(res, {
    totalDebt,
    totalPaid,
    totalBalance,
    totalCount: debts.length,
    pendingCount,
    overdueCount,
    paidCount,
  });
});

/**
 * @route GET /api/debts/:id
 */
const getDebtById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else if (!isNaN(Number(id))) {
    query.originalId = Number(id);
  } else {
    throw createError('ID de deuda inválido', 400);
  }

  const debt = await Debt.findOne(query);
  if (!debt) {
    throw createError('Deuda no encontrada', 404);
  }

  return ApiResponse.success(res, debt);
});

/**
 * @route POST /api/debts
 */
const createDebt = asyncHandler(async (req, res) => {
  const {
    clientId,
    clientName,
    clientDocument,
    total,
    baseTotal,
    interestRate = 0,
    dueDate,
    items = [],
  } = req.body;

  if (!clientName || !total) {
    throw createError('Nombre de cliente y total son obligatorios', 400);
  }

  const nextId = await Config.getNextSequence(req.user._id, 'debt');
  const debtTotal = Number(total);

  const debt = await Debt.create({
    originalId: nextId,
    clientId: clientId || null,
    clientName,
    clientDocument: clientDocument || '',
    total: debtTotal,
    baseTotal: Number(baseTotal || debtTotal),
    interestRate: Number(interestRate),
    paid: 0,
    balance: debtTotal,
    dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'pendiente',
    items: items || [],
    payments: [],
    user: req.user._id,
  });

  return ApiResponse.success(res, debt, 'Deuda registrada exitosamente', 201);
});

/**
 * @route POST /api/debts/:id/payments
 */
const addPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, note, paymentMethod } = req.body;

  const result = await DebtService.addPayment({
    debtId: id,
    amount,
    note,
    paymentMethod,
    userId: req.user._id,
  });

  return ApiResponse.success(res, result, 'Abono registrado exitosamente', 201);
});

module.exports = {
  getDebts,
  getDebtSummary,
  getDebtById,
  createDebt,
  addPayment,
};
