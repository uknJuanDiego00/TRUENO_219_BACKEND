const mongoose = require('mongoose');

const configSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      default: 'Trueno 219',
      trim: true,
    },
    lowStockThreshold: {
      type: Number,
      default: 2,
      min: 0,
    },
    currency: {
      type: String,
      default: 'COP',
      trim: true,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    idCounters: {
      product: { type: Number, default: 0 },
      client: { type: Number, default: 0 },
      sale: { type: Number, default: 0 },
      debt: { type: Number, default: 0 },
      payment: { type: Number, default: 0 },
      pending_sale: { type: Number, default: 0 },
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
    collection: 'configs',
  }
);

configSchema.statics.getNextSequence = async function (userId, sequenceName) {
  const updateField = `idCounters.${sequenceName}`;
  const config = await this.findOneAndUpdate(
    { user: userId },
    { $inc: { [updateField]: 1 } },
    { new: true, upsert: true }
  );
  return config.idCounters[sequenceName];
};

module.exports = mongoose.model('Config', configSchema);
