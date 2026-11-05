const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const Debt = require('../models/Debt');
const SaleService = require('../services/sale.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, createError, parsePagination } = require('../utils/helpers');

/**
 * @route GET /api/sales
 */
const getSales = asyncHandler(async (req, res) => {
  const { status, paymentMethod, startDate, endDate, clientId, all } = req.query;
  const filter = { user: req.user._id };

  if (status) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  if (clientId) {
    if (mongoose.isValidObjectId(clientId)) {
      filter.$or = [{ clientRef: clientId }, { clientId: Number(clientId) || -1 }];
    } else {
      filter.clientId = Number(clientId);
    }
  }

  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate);
  }

  if (all === 'true' || req.query.limit === 'all') {
    const sales = await Sale.find(filter).sort({ date: -1 });
    return ApiResponse.success(res, sales);
  }

  const { page, limit, skip } = parsePagination(req.query, 50);
  const total = await Sale.countDocuments(filter);
  const sales = await Sale.find(filter).sort({ date: -1 }).skip(skip).limit(limit);

  return ApiResponse.paginated(res, sales, { page, limit, total });
});

/**
 * @route GET /api/sales/:id
 */
const getSaleById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else if (!isNaN(Number(id))) {
    query.originalId = Number(id);
  } else {
    throw createError('ID de venta inválido', 400);
  }

  const sale = await Sale.findOne(query).populate('debt');
  if (!sale) {
    throw createError('Venta no encontrada', 404);
  }

  return ApiResponse.success(res, sale);
});

/**
 * @route POST /api/sales
 */
const createSale = asyncHandler(async (req, res) => {
  const result = await SaleService.createSale(req.body, req.user._id);
  return ApiResponse.success(res, result, 'Venta registrada exitosamente', 201);
});

/**
 * @route POST /api/sales/:id/cancel
 */
const cancelSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else {
    query.originalId = Number(id);
  }

  const sale = await Sale.findOne(query);
  if (!sale) {
    throw createError('Venta no encontrada', 404);
  }

  if (sale.status === 'anulada') {
    throw createError('Esta venta ya se encuentra anulada', 400);
  }

  // Restore inventory
  for (const item of sale.items) {
    const product = await Product.findOne({
      $or: [{ _id: item.productRef }, { originalId: item.productId }],
      user: req.user._id,
    });

    if (product) {
      const prev = product.stock;
      product.stock += item.qty;
      product.totalSold = Math.max(0, (product.totalSold || 0) - item.qty);
      await product.save();

      await InventoryMovement.create({
        product: product._id,
        productOriginalId: product.originalId,
        productName: product.name,
        type: 'devolucion',
        quantity: item.qty,
        previousStock: prev,
        newStock: product.stock,
        previousWarehouseStock: product.warehouseStock,
        newWarehouseStock: product.warehouseStock,
        reason: `Anulación de venta #${sale.originalId}`,
        reference: String(sale._id),
        user: req.user._id,
      });
    }
  }

  // Mark debt as cancelled/paid if exists
  if (sale.debt) {
    await Debt.findByIdAndUpdate(sale.debt, { status: 'pagada', balance: 0 });
  }

  sale.status = 'anulada';
  await sale.save();

  return ApiResponse.success(res, sale, 'Venta anulada y stock restaurado exitosamente');
});

module.exports = {
  getSales,
  getSaleById,
  createSale,
  cancelSale,
};

