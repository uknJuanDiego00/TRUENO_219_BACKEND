const mongoose = require('mongoose');

const debtPaymentSchema = new mongoose.Schema(
  {
    originalId: {
      type: Number,
    },
    amount: {
      type: Number,
      required: [true, 'El monto del abono es obligatorio'],
      min: [1, 'El abono debe ser mayor a 0'],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['Efectivo', 'Nequi', 'Transferencia', 'Otro'],
      default: 'Efectivo',
    },
  },
  { _id: true, timestamps: true }
);

const debtItemSchema = new mongoose.Schema(
  {
    productId: {
      type: Number,
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
    },
    qty: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotal: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const debtSchema = new mongoose.Schema(
  {
    originalId: {
      type: Number,
      required: true,
      index: true,
    },
    saleId: {
      type: Number,
    },
    saleRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
    },
    clientId: {
      type: Number,
    },
    clientRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
    },
    clientName: {
      type: String,
      required: [true, 'El nombre del cliente es obligatorio'],
      trim: true,
    },
    clientDocument: {
      type: String,
      default: '',
      trim: true,
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
    balance: {
      type: Number,
      required: true,
      min: 0,
    },
    dueDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pendiente', 'pagada', 'vencida'],
      default: 'pendiente',
      index: true,
    },
    payments: [debtPaymentSchema],
    items: [debtItemSchema],
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'debts',
  }
);

debtSchema.index({ originalId: 1, user: 1 }, { unique: true });
debtSchema.index({ status: 1, user: 1 });
debtSchema.index({ clientId: 1, user: 1 });
debtSchema.index({ dueDate: 1, user: 1 });

debtSchema.methods.recalculate = function () {
  const sumPaid = (this.payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
  this.paid = sumPaid;
  this.balance = Math.max(0, this.total - this.paid);

  if (this.balance <= 0) {
    this.status = 'pagada';
  } else if (this.dueDate && new Date() > new Date(this.dueDate)) {
    this.status = 'vencida';
  } else {
    this.status = 'pendiente';
  }
};

module.exports = mongoose.model('Debt', debtSchema);
