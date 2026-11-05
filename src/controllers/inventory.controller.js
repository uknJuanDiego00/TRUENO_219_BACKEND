const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const InventoryService = require('../services/inventory.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, createError, parsePagination } = require('../utils/helpers');

/**
 * @route GET /api/inventory
 */
const getInventory = asyncHandler(async (req, res) => {
  const { search, lowStock } = req.query;
  const filter = { user: req.user._id };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
  }

  if (lowStock === 'true') {
    filter.$expr = { $lte: ['$stock', '$minStock'] };
  }

  const products = await Product.find(filter).sort({ name: 1 });

  const summary = products.reduce(
    (acc, p) => {
      acc.totalStoreUnits += p.stock || 0;
      acc.totalWarehouseUnits += p.warehouseStock || 0;
      acc.totalValuation += (p.stock || 0) * (p.buyPrice || 0);
      acc.totalRetailValuation += (p.stock || 0) * (p.sellPrice || 0);
      return acc;
    },
    { totalStoreUnits: 0, totalWarehouseUnits: 0, totalValuation: 0, totalRetailValuation: 0 }
  );

  return ApiResponse.success(res, {
    summary,
    products,
  });
});

/**
 * @route POST /api/inventory/movements
 */
const createMovement = asyncHandler(async (req, res) => {
  const { productId, quantity, type, targetStock, reason, reference } = req.body;

  if (!productId || !quantity || !type) {
    throw createError('productId, quantity y type son requeridos', 400);
  }

  const result = await InventoryService.adjustStock({
    productId,
    quantity: Number(quantity),
    type,
    targetStock: targetStock || 'stock',
    reason,
    reference,
    userId: req.user._id,
  });

  return ApiResponse.success(res, result, 'Movimiento de inventario registrado exitosamente', 201);
});

/**
 * @route GET /api/inventory/movements
 */
const getMovements = asyncHandler(async (req, res) => {
  const { productId, type } = req.query;
  const filter = { user: req.user._id };

  if (productId) filter.product = productId;
  if (type) filter.type = type;

  const { page, limit, skip } = parsePagination(req.query, 50);
  const total = await InventoryMovement.countDocuments(filter);
  const movements = await InventoryMovement.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return ApiResponse.paginated(res, movements, { page, limit, total });
});

/**
 * @route POST /api/inventory/transfer
 */
const transferStock = asyncHandler(async (req, res) => {
  const { productId, quantity, from, to, reason } = req.body;

  if (!productId || !quantity || !from || !to) {
    throw createError('productId, quantity, from y to son obligatorios', 400);
  }

  const result = await InventoryService.transferStock({
    productId,
    quantity: Number(quantity),
    from,
    to,
    reason,
    userId: req.user._id,
  });

  return ApiResponse.success(res, result, 'Transferencia de stock realizada exitosamente');
});

module.exports = {
  getInventory,
  createMovement,
  getMovements,
  transferStock,
};

