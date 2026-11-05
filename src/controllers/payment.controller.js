const Debt = require('../models/Debt');
const DebtService = require('../services/debt.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, createError } = require('../utils/helpers');

/**
 * @route GET /api/payments
 */
const getPayments = asyncHandler(async (req, res) => {
  const { clientId, startDate, endDate } = req.query;

  const debts = await Debt.find({ user: req.user._id });

  let allPayments = [];
  for (const debt of debts) {
    if (clientId && String(debt.clientId) !== String(clientId) && String(debt.clientRef) !== String(clientId)) {
      continue;
    }

    for (const payment of debt.payments || []) {
      allPayments.push({
        id: payment._id,
        originalId: payment.originalId,
        debtId: debt.originalId || debt._id,
        debtRef: debt._id,
        clientId: debt.clientId,
        clientRef: debt.clientRef,
        clientName: debt.clientName,
        clientDocument: debt.clientDocument,
        amount: payment.amount,
        date: payment.date,
        note: payment.note,
        paymentMethod: payment.paymentMethod || 'Efectivo',
      });
    }
  }

  // Filter by date if provided
  if (startDate) {
    const start = new Date(startDate);
    allPayments = allPayments.filter((p) => new Date(p.date) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    allPayments = allPayments.filter((p) => new Date(p.date) <= end);
  }

  // Sort descending by date
  allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));

  return ApiResponse.success(res, allPayments);
});

/**
 * @route POST /api/payments
 */
const createPayment = asyncHandler(async (req, res) => {
  const { debtId, amount, note, paymentMethod } = req.body;

  if (!debtId || !amount) {
    throw createError('debtId y amount son requeridos', 400);
  }

  const result = await DebtService.addPayment({
    debtId,
    amount,
    note,
    paymentMethod,
    userId: req.user._id,
  });

  return ApiResponse.success(res, result, 'Abono registrado exitosamente', 201);
});

module.exports = {
  getPayments,
  createPayment,
};

