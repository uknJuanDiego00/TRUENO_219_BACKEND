const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    productId: {
      type: Number,
      required: true,
    },
    productRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    originalId: {
      type: Number,
      required: true,
      index: true,
    },
    clientId: {
      type: Number,
      default: null,
    },
    clientRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },
    clientName: {
      type: String,
      default: 'Consumidor Final',
      trim: true,
    },
    clientDocument: {
      type: String,
      default: '',
      trim: true,
    },
    items: {
      type: [saleItemSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Una venta debe contener al menos un producto.',
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    laborCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    baseTotal: {
      type: Number,
      default: 0,
    },
    interestRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    interestAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['Efectivo', 'Nequi', 'Crédito', 'Transferencia', 'Otro'],
      default: 'Efectivo',
    },
    status: {
      type: String,
      enum: ['pagada', 'pendiente', 'anulada'],
      default: 'pagada',
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    debt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Debt',
      default: null,
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
    collection: 'sales',
  }
);

saleSchema.index({ originalId: 1, user: 1 }, { unique: true });
saleSchema.index({ date: -1, user: 1 });
saleSchema.index({ status: 1, user: 1 });
saleSchema.index({ clientId: 1, user: 1 });

module.exports = mongoose.model('Sale', saleSchema);
