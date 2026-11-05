const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    originalId: {
      type: Number,
      required: true,
      index: true,
    },
    document: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'El nombre del cliente es obligatorio'],
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    totalBought: {
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
    collection: 'clients',
  }
);

clientSchema.index({ document: 1, user: 1 });
clientSchema.index({ name: 1, user: 1 });
clientSchema.index({ originalId: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Client', clientSchema);
