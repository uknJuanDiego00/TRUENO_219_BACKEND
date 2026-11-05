const mongoose = require('mongoose');
const PendingSale = require('../models/PendingSale');
const Config = require('../models/Config');
const SaleService = require('../services/sale.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, createError } = require('../utils/helpers');

/**
 * @route GET /api/pending-sales
 */
const getPendingSales = asyncHandler(async (req, res) => {
  const pending = await PendingSale.find({ user: req.user._id }).sort({ createdAt: -1 });
  return ApiResponse.success(res, pending);
});

/**
 * @route POST /api/pending-sales
 */
const createPendingSale = asyncHandler(async (req, res) => {
  const { clientId, clientName, clientDocument, items, subtotal, discount, notes } = req.body;

  const nextId = await Config.getNextSequence(req.user._id, 'pending_sale');

  const pending = await PendingSale.create({
    originalId: nextId,
    clientId,
    clientName: clientName || '',
    clientDocument: clientDocument || '',
    items: items || [],
    subtotal: Number(subtotal) || 0,
    discount: Number(discount) || 0,
    notes: notes || '',
    user: req.user._id,
  });

  return ApiResponse.success(res, pending, 'Venta en espera guardada exitosamente', 201);
});

/**
 * @route PATCH / PUT /api/pending-sales/:id
 */
const updatePendingSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else {
    query.originalId = Number(id);
  }

  const updated = await PendingSale.findOneAndUpdate(query, req.body, { new: true });
  if (!updated) {
    throw createError('Venta en espera no encontrada', 404);
  }

  return ApiResponse.success(res, updated, 'Venta en espera actualizada');
});

/**
 * @route DELETE /api/pending-sales/:id
 */
const deletePendingSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else {
    query.originalId = Number(id);
  }

  const deleted = await PendingSale.findOneAndDelete(query);
  if (!deleted) {
    throw createError('Venta en espera no encontrada', 404);
  }

  return ApiResponse.success(res, null, 'Venta en espera eliminada exitosamente');
});

/**
 * @route POST /api/pending-sales/:id/confirm
 */
const confirmPendingSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, paid } = req.body;

  const query = { user: req.user._id };
  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else {
    query.originalId = Number(id);
  }

  const pending = await PendingSale.findOne(query);
  if (!pending) {
    throw createError('Venta en espera no encontrada', 404);
  }

  const total = Math.max(0, (pending.subtotal || 0) - (pending.discount || 0));

  const saleResult = await SaleService.createSale(
    {
      clientId: pending.clientId,
      clientName: pending.clientName,
      clientDocument: pending.clientDocument,
      items: pending.items,
      subtotal: pending.subtotal,
      discount: pending.discount,
      total,
      paid: paid !== undefined ? Number(paid) : total,
      paymentMethod: paymentMethod || 'Efectivo',
    },
    req.user._id
  );

  // Remove pending sale once confirmed
  await PendingSale.findByIdAndDelete(pending._id);

  return ApiResponse.success(res, saleResult, 'Venta en espera confirmada y procesada exitosamente');
});

module.exports = {
  getPendingSales,
  createPendingSale,
  updatePendingSale,
  deletePendingSale,
  confirmPendingSale,
};

