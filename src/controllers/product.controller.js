const mongoose = require('mongoose');
const Product = require('../models/Product');
const Config = require('../models/Config');
const InventoryService = require('../services/inventory.service');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, createError, parsePagination } = require('../utils/helpers');

/**
 * @route GET /api/products
 */
const getProducts = asyncHandler(async (req, res) => {
  const { search, category, lowStock, all } = req.query;
  const filter = { user: req.user._id };

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (lowStock === 'true') {
    filter.$expr = { $lte: ['$stock', '$minStock'] };
  }

  // If frontend asks for all items or does not specify pagination page
  if (all === 'true' || req.query.limit === 'all' || !req.query.page) {
    const products = await Product.find(filter).sort({ name: 1 });
    return ApiResponse.success(res, products);
  }

  const { page, limit, skip } = parsePagination(req.query, 100);
  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit);

  return ApiResponse.paginated(res, products, { page, limit, total });
});

/**
 * @route GET /api/products/low-stock
 */
const getLowStockProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    user: req.user._id,
    $expr: { $lte: ['$stock', '$minStock'] },
  }).sort({ stock: 1 });

  return ApiResponse.success(res, products);
});

/**
 * @route GET /api/products/:id
 */
const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else if (!isNaN(Number(id))) {
    query.originalId = Number(id);
  } else {
    throw createError('ID de producto inválido', 400);
  }

  const product = await Product.findOne(query);
  if (!product) {
    throw createError('Producto no encontrado', 404);
  }

  return ApiResponse.success(res, product);
});

/**
 * @route POST /api/products
 */
const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    description,
    buyPrice,
    buy_price,
    sellPrice,
    sell_price,
    stock,
    warehouseStock,
    warehouse_stock,
    minStock,
    min_stock,
    sku,
    image,
    image_url,
  } = req.body;

  const nextId = await Config.getNextSequence(req.user._id, 'product');

  const bPrice = buyPrice !== undefined ? buyPrice : buy_price;
  const sPrice = sellPrice !== undefined ? sellPrice : sell_price;
  const wStock = warehouseStock !== undefined ? warehouseStock : warehouse_stock;
  const mStock = minStock !== undefined ? minStock : min_stock;
  const img = image !== undefined ? image : image_url;

  const product = await Product.create({
    originalId: nextId,
    name,
    category,
    description: description || '',
    buyPrice: Number(bPrice) || 0,
    sellPrice: Number(sPrice) || 0,
    stock: Number(stock) || 0,
    warehouseStock: Number(wStock) || 0,
    minStock: mStock !== undefined && mStock !== null ? Number(mStock) : 5,
    sku: sku || '',
    image: img || null,
    user: req.user._id,
  });

  return ApiResponse.success(res, product, 'Producto creado exitosamente', 201);
});

/**
 * @route PUT / PATCH /api/products/:id
 */
const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else if (!isNaN(Number(id))) {
    query.originalId = Number(id);
  } else {
    throw createError('ID de producto inválido', 400);
  }

  const updateData = {};
  if (req.body.name !== undefined) updateData.name = req.body.name;
  if (req.body.category !== undefined) updateData.category = req.body.category;
  if (req.body.description !== undefined) updateData.description = req.body.description;
  if (req.body.buyPrice !== undefined || req.body.buy_price !== undefined) {
    updateData.buyPrice = Number(req.body.buyPrice ?? req.body.buy_price) || 0;
  }
  if (req.body.sellPrice !== undefined || req.body.sell_price !== undefined) {
    updateData.sellPrice = Number(req.body.sellPrice ?? req.body.sell_price) || 0;
  }
  if (req.body.stock !== undefined) updateData.stock = Number(req.body.stock);
  if (req.body.warehouseStock !== undefined || req.body.warehouse_stock !== undefined) {
    updateData.warehouseStock = Number(req.body.warehouseStock ?? req.body.warehouse_stock) || 0;
  }
  if (req.body.minStock !== undefined || req.body.min_stock !== undefined) {
    updateData.minStock = Number(req.body.minStock ?? req.body.min_stock) || 0;
  }
  if (req.body.sku !== undefined) updateData.sku = req.body.sku;
  if (req.body.image !== undefined || req.body.image_url !== undefined) {
    updateData.image = req.body.image ?? req.body.image_url;
  }

  const product = await Product.findOneAndUpdate(query, updateData, {
    new: true,
    runValidators: true,
  });

  if (!product) {
    throw createError('Producto no encontrado', 404);
  }

  return ApiResponse.success(res, product, 'Producto actualizado exitosamente');
});

/**
 * @route DELETE /api/products/:id
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = { user: req.user._id };

  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else if (!isNaN(Number(id))) {
    query.originalId = Number(id);
  } else {
    throw createError('ID de producto inválido', 400);
  }

  const product = await Product.findOneAndDelete(query);
  if (!product) {
    throw createError('Producto no encontrado', 404);
  }

  return ApiResponse.success(res, null, 'Producto eliminado exitosamente');
});

/**
 * @route POST /api/products/:id/adjust-stock
 */
const adjustProductStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { delta, location = 'store', notes } = req.body;

  const targetStock = location === 'warehouse' ? 'warehouseStock' : 'stock';
  const query = { user: req.user._id };
  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else {
    query.originalId = Number(id);
  }

  const product = await Product.findOne(query);
  if (!product) {
    throw createError('Producto no encontrado', 404);
  }

  const result = await InventoryService.adjustStock({
    productId: product._id,
    quantity: Number(delta),
    type: Number(delta) >= 0 ? 'entrada' : 'salida',
    targetStock,
    reason: notes || 'Ajuste manual de stock',
    userId: req.user._id,
  });

  return ApiResponse.success(res, result.product, 'Stock ajustado exitosamente');
});

/**
 * @route POST /api/products/:id/transfer-stock
 */
const transferProductStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { from, to, quantity, notes } = req.body;

  const query = { user: req.user._id };
  if (mongoose.isValidObjectId(id)) {
    query._id = id;
  } else {
    query.originalId = Number(id);
  }

  const product = await Product.findOne(query);
  if (!product) {
    throw createError('Producto no encontrado', 404);
  }

  const result = await InventoryService.transferStock({
    productId: product._id,
    quantity: Number(quantity),
    from,
    to,
    reason: notes,
    userId: req.user._id,
  });

  return ApiResponse.success(res, result.product, 'Transferencia realizada exitosamente');
});

module.exports = {
  getProducts,
  getLowStockProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustProductStock,
  transferProductStock,
};
