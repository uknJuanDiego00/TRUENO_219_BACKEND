const mongoose = require('mongoose');

const pendingSaleItemSchema = new mongoose.Schema(
  {
    productId: { type: Number },
    productRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
  },
  { _id: false }
);

const pendingSaleSchema = new mongoose.Schema(
  {
    originalId: { type: Number, index: true },
    clientId: { type: Number },
    clientRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    clientName: { type: String, default: '' },
    clientDocument: { type: String, default: '' },
    items: [pendingSaleItemSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'pending_sales',
  }
);

pendingSaleSchema.index({ originalId: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('PendingSale', pendingSaleSchema);
