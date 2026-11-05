const mongoose = require('mongoose');
const Client = require('../models/Client');
const Sale = require('../models/Sale');
const Debt = require('../models/Debt');
const Config = require('../models/Config');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, createError, parsePagination } = require('../utils/helpers');

/**
 * @route GET /api/clients
 */
const getClients = asyncHandler(async (req, res) => {
  const { search, all } = req.query;
  const filter = { user: req.user._id };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { document: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  if (all === 'true' || req.query.limit === 'all') {
    const clients = await Client.find(filter).sort({ name: 1 });
    return ApiResponse.success(res, clients);
  }

  const { page, limit, skip } = parsePagination(req.query, 100);
  const total = await Client.countDocuments(filter);
  const clients = await Client.find(filter).sort({ name: 1 }).skip(skip).limit(limit);

  return ApiResponse.paginated(res, clients, { page, limit, total });
});

/**
 * @route GET /api/clients/:id
 */
const getClientById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else if (!isNaN(Number(id))) {
    query.originalId = Number(id);
  } else {
    throw createError('ID de cliente inválido', 400);
  }

  const client = await Client.findOne(query);
  if (!client) {
    throw createError('Cliente no encontrado', 404);
  }

  return ApiResponse.success(res, client);
});

/**
 * @route POST /api/clients
 */
const createClient = asyncHandler(async (req, res) => {
  const { document, name, phone, email, address, notes } = req.body;

  const nextId = await Config.getNextSequence(req.user._id, 'client');

  const client = await Client.create({
    originalId: nextId,
    document: document || '',
    name,
    phone: phone || '',
    email: email || '',
    address: address || '',
    notes: notes || '',
    user: req.user._id,
  });

  return ApiResponse.success(res, client, 'Cliente creado exitosamente', 201);
});

/**
 * @route PUT /api/clients/:id
 */
const updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else if (!isNaN(Number(id))) {
    query.originalId = Number(id);
  } else {
    throw createError('ID de cliente inválido', 400);
  }

  const allowedUpdates = ['document', 'name', 'phone', 'email', 'address', 'notes'];
  const updateData = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  const client = await Client.findOneAndUpdate(query, updateData, {
    new: true,
    runValidators: true,
  });

  if (!client) {
    throw createError('Cliente no encontrado', 404);
  }

  return ApiResponse.success(res, client, 'Cliente actualizado exitosamente');
});

/**
 * @route DELETE /api/clients/:id
 */
const deleteClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else if (!isNaN(Number(id))) {
    query.originalId = Number(id);
  } else {
    throw createError('ID de cliente inválido', 400);
  }

  const client = await Client.findOneAndDelete(query);
  if (!client) {
    throw createError('Cliente no encontrado', 404);
  }

  return ApiResponse.success(res, null, 'Cliente eliminado exitosamente');
});

/**
 * @route GET /api/clients/:id/sales
 */
const getClientSales = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const clientQuery = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    clientQuery._id = id;
  } else {
    clientQuery.originalId = Number(id);
  }

  const client = await Client.findOne(clientQuery);
  if (!client) {
    throw createError('Cliente no encontrado', 404);
  }

  const sales = await Sale.find({
    $or: [{ clientRef: client._id }, { clientId: client.originalId }],
    user: req.user._id,
  }).sort({ date: -1 });

  return ApiResponse.success(res, sales);
});

/**
 * @route GET /api/clients/:id/debts
 */
const getClientDebts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const clientQuery = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    clientQuery._id = id;
  } else {
    clientQuery.originalId = Number(id);
  }

  const client = await Client.findOne(clientQuery);
  if (!client) {
    throw createError('Cliente no encontrado', 404);
  }

  const debts = await Debt.find({
    $or: [{ clientRef: client._id }, { clientId: client.originalId }],
    user: req.user._id,
  }).sort({ createdAt: -1 });

  return ApiResponse.success(res, debts);
});

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientSales,
  getClientDebts,
};

