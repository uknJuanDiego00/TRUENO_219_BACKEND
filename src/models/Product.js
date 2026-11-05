const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    originalId: {
      type: Number,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'El nombre del producto es obligatorio'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'La categoría es obligatoria'],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    buyPrice: {
      type: Number,
      default: 0,
      min: [0, 'El precio de compra no puede ser negativo'],
    },
    sellPrice: {
      type: Number,
      required: [true, 'El precio de venta es obligatorio'],
      min: [0, 'El precio de venta no puede ser negativo'],
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, 'El stock no puede ser negativo'],
    },
    warehouseStock: {
      type: Number,
      default: 0,
      min: [0, 'El stock de bodega no puede ser negativo'],
    },
    minStock: {
      type: Number,
      default: 5,
      min: [0, 'El stock mínimo no puede ser negativo'],
    },
    sku: {
      type: String,
      default: '',
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    totalSold: {
      type: Number,
      default: 0,
      min: 0,
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
    collection: 'products',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

productSchema.index({ name: 1, user: 1 });
productSchema.index({ category: 1, user: 1 });
productSchema.index({ originalId: 1, user: 1 }, { unique: true });

productSchema.virtual('totalStock').get(function () {
  return (this.stock || 0) + (this.warehouseStock || 0);
});

productSchema.virtual('isLowStock').get(function () {
  return (this.stock || 0) <= (this.minStock || 0);
});

module.exports = mongoose.model('Product', productSchema);
