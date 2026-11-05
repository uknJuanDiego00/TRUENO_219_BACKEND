const mongoose = require('mongoose');

const inventoryMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productOriginalId: {
      type: Number,
    },
    productName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['entrada', 'salida', 'ajuste', 'venta', 'devolucion', 'transferencia_bodega'],
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    targetStock: {
      type: String,
      enum: ['stock', 'warehouseStock'],
      default: 'stock',
    },
    previousStock: {
      type: Number,
      default: 0,
    },
    newStock: {
      type: Number,
      default: 0,
    },
    previousWarehouseStock: {
      type: Number,
      default: 0,
    },
    newWarehouseStock: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    reference: {
      type: String,
      default: '',
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'inventory_movements',
  }
);

inventoryMovementSchema.index({ createdAt: -1, user: 1 });

module.exports = mongoose.model('InventoryMovement', inventoryMovementSchema);
