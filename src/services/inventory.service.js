const Product = require('../models/Product');
const InventoryMovement = require('../models/InventoryMovement');
const { createError } = require('../utils/helpers');

class InventoryService {
  /**
   * Adjust stock of a product (positive for entry, negative for exit)
   */
  static async adjustStock({ productId, quantity, type, targetStock = 'stock', reason, reference, userId, session }) {
    const product = await Product.findOne({ _id: productId, user: userId }).session(session);
    if (!product) {
      throw createError('Producto no encontrado', 404);
    }

    const prevStock = product.stock;
    const prevWarehouseStock = product.warehouseStock;

    if (targetStock === 'warehouseStock') {
      const newWarehouse = prevWarehouseStock + quantity;
      if (newWarehouse < 0) {
        throw createError(`Stock de bodega insuficiente para '${product.name}'. Disponible: ${prevWarehouseStock}`, 400);
      }
      product.warehouseStock = newWarehouse;
    } else {
      const newStoreStock = prevStock + quantity;
      if (newStoreStock < 0) {
        throw createError(`Stock de tienda insuficiente para '${product.name}'. Disponible: ${prevStock}`, 400);
      }
      product.stock = newStoreStock;
    }

    await product.save({ session });

    const movement = new InventoryMovement({
      product: product._id,
      productOriginalId: product.originalId,
      productName: product.name,
      type,
      quantity,
      targetStock,
      previousStock: prevStock,
      newStock: product.stock,
      previousWarehouseStock: prevWarehouseStock,
      newWarehouseStock: product.warehouseStock,
      reason: reason || '',
      reference: reference || '',
      user: userId,
    });

    await movement.save({ session });

    return { product, movement };
  }

  /**
   * Transfer items between store and warehouse
   */
  static async transferStock({ productId, quantity, from, to, reason, userId }) {
    if (quantity <= 0) {
      throw createError('La cantidad a transferir debe ser mayor a 0', 400);
    }

    const product = await Product.findOne({ _id: productId, user: userId });
    if (!product) {
      throw createError('Producto no encontrado', 404);
    }

    const prevStock = product.stock;
    const prevWarehouseStock = product.warehouseStock;

    if (from === 'warehouse' && to === 'store') {
      if (product.warehouseStock < quantity) {
        throw createError(`Stock en bodega insuficiente (${product.warehouseStock}) para transferir ${quantity}`, 400);
      }
      product.warehouseStock -= quantity;
      product.stock += quantity;
    } else if (from === 'store' && to === 'warehouse') {
      if (product.stock < quantity) {
        throw createError(`Stock en tienda insuficiente (${product.stock}) para transferir ${quantity}`, 400);
      }
      product.stock -= quantity;
      product.warehouseStock += quantity;
    } else {
      throw createError('Ubicaciones de origen y destino no válidas', 400);
    }

    await product.save();

    const movement = await InventoryMovement.create({
      product: product._id,
      productOriginalId: product.originalId,
      productName: product.name,
      type: 'transferencia_bodega',
      quantity,
      previousStock: prevStock,
      newStock: product.stock,
      previousWarehouseStock: prevWarehouseStock,
      newWarehouseStock: product.warehouseStock,
      reason: reason || `Transferencia de ${from} a ${to}`,
      user: userId,
    });

    return { product, movement };
  }
}

module.exports = InventoryService;

