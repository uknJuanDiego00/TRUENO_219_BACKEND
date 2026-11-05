const Debt = require('../models/Debt');
const Sale = require('../models/Sale');
const Config = require('../models/Config');
const { createError } = require('../utils/helpers');

class DebtService {
  /**
   * Add a payment (abono) to a debt
   */
  static async addPayment({ debtId, amount, note, paymentMethod = 'Efectivo', userId }) {
    const paymentAmount = Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      throw createError('El monto del abono debe ser mayor a 0', 400);
    }

    const debt = await Debt.findOne({
      $or: [{ _id: debtId }, { originalId: Number(debtId) || -1 }],
      user: userId,
    });

    if (!debt) {
      throw createError('Deuda no encontrada', 404);
    }

    if (debt.status === 'pagada' || debt.balance <= 0) {
      throw createError('Esta deuda ya se encuentra totalmente saldada', 400);
    }

    if (paymentAmount > debt.balance) {
      throw createError(`El abono ($${paymentAmount}) no puede superar el saldo pendiente ($${debt.balance})`, 400);
    }

    const nextPaymentId = await Config.getNextSequence(userId, 'payment');

    const newPayment = {
      originalId: nextPaymentId,
      amount: paymentAmount,
      date: new Date(),
      note: note || '',
      paymentMethod,
    };

    debt.payments.push(newPayment);
    debt.paid = (debt.paid || 0) + paymentAmount;
    debt.balance = Math.max(0, debt.total - debt.paid);

    if (debt.balance <= 0) {
      debt.status = 'pagada';
    }

    await debt.save();

    // If linked to a sale, update sale paid and status
    if (debt.saleRef || debt.saleId) {
      const sale = await Sale.findOne({
        $or: [{ _id: debt.saleRef }, { originalId: debt.saleId }],
        user: userId,
      });

      if (sale) {
        sale.paid = (sale.paid || 0) + paymentAmount;
        if (sale.paid >= sale.total) {
          sale.status = 'pagada';
        }
        await sale.save();
      }
    }

    return { debt, payment: newPayment };
  }
}

module.exports = DebtService;

