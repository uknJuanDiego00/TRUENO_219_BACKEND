const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Debt = require('../models/Debt');
const Config = require('../models/Config');
const InventoryMovement = require('../models/InventoryMovement');
const { createError } = require('../utils/helpers');

class SaleService {
  /**
   * Process and register a new sale
   */
  static async createSale(saleData, userId) {
    const {
      clientId,
      clientName,
      clientDocument,
      items,
      subtotal,
      discount = 0,
      total,
      baseTotal,
      interestRate = 0,
      interestAmount = 0,
      paid = 0,
      paymentMethod = 'Efectivo',
      dueDate,
    } = saleData;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw createError('La venta debe incluir al menos un producto', 400);
    }

    // Determine next sequential ID
    const nextSaleId = await Config.getNextSequence(userId, 'sale');

    // Validate client if provided
    let clientDoc = null;
    if (clientId) {
      clientDoc = await Client.findOne({
        $or: [{ _id: mongoose.isValidObjectId(clientId) ? clientId : null }, { originalId: clientId }],
        user: userId,
      });
    }

    // Verify stock and build items list
    const processedItems = [];
    const stockUpdates = [];

    for (const item of items) {
      let product = null;
      if (item.productRef && mongoose.isValidObjectId(item.productRef)) {
        product = await Product.findOne({ _id: item.productRef, user: userId });
      } else if (item.productId) {
        product = await Product.findOne({
          $or: [{ originalId: item.productId }, { _id: mongoose.isValidObjectId(item.productId) ? item.productId : null }],
          user: userId,
        });
      }

      if (!product) {
        throw createError(`Producto no encontrado (ID: ${item.productId || item.name})`, 404);
      }

      const qtyRequested = Number(item.qty);
      if (qtyRequested <= 0) {
        throw createError(`Cantidad inválida para '${product.name}'`, 400);
      }

      if (product.stock < qtyRequested) {
        throw createError(`Stock insuficiente para '${product.name}'. Disponible en tienda: ${product.stock}`, 400);
      }

      processedItems.push({
        productId: product.originalId || 0,
        productRef: product._id,
        name: product.name,
        price: Number(item.price || product.sellPrice),
        qty: qtyRequested,
        subtotal: Number(item.subtotal || item.price * qtyRequested),
      });

      stockUpdates.push({
        product,
        qty: qtyRequested,
      });
    }

    // Calculate status
    const isCredit = paymentMethod === 'Crédito' || Number(paid) < Number(total);
    const saleStatus = isCredit ? 'pendiente' : 'pagada';

    // Create Sale
    const sale = new Sale({
      originalId: nextSaleId,
      clientId: clientDoc ? clientDoc.originalId : clientId || null,
      clientRef: clientDoc ? clientDoc._id : null,
      clientName: clientName || (clientDoc ? clientDoc.name : 'Consumidor Final'),
      clientDocument: clientDocument || (clientDoc ? clientDoc.document : ''),
      items: processedItems,
      subtotal: Number(subtotal),
      discount: Number(discount) || 0,
      total: Number(total),
      baseTotal: Number(baseTotal || total),
      interestRate: Number(interestRate) || 0,
      interestAmount: Number(interestAmount) || 0,
      paid: Number(paid) || 0,
      paymentMethod,
      status: saleStatus,
      date: new Date(),
      user: userId,
    });

    // If credit or unpaid balance, create Debt
    let debtRecord = null;
    if (isCredit) {
      const balance = Number(total) - Number(paid);
      const nextDebtId = await Config.getNextSequence(userId, 'debt');

      const initialPayments = [];
      if (Number(paid) > 0) {
        const nextPaymentId = await Config.getNextSequence(userId, 'payment');
        initialPayments.push({
          originalId: nextPaymentId,
          amount: Number(paid),
          date: new Date(),
          note: 'Abono inicial al momento de la venta',
        });
      }

      debtRecord = new Debt({
        originalId: nextDebtId,
        saleId: sale.originalId,
        saleRef: sale._id,
        clientId: clientDoc ? clientDoc.originalId : clientId || null,
        clientRef: clientDoc ? clientDoc._id : null,
        clientName: sale.clientName,
        clientDocument: sale.clientDocument,
        total: Number(total),
        baseTotal: Number(baseTotal || total),
        interestRate: Number(interestRate) || 0,
        interestAmount: Number(interestAmount) || 0,
        paid: Number(paid) || 0,
        balance,
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
        status: balance <= 0 ? 'pagada' : 'pendiente',
        payments: initialPayments,
        items: processedItems.map((i) => ({
          productId: i.productId,
          productRef: i.productRef,
          name: i.name,
          price: i.price,
          qty: i.qty,
          subtotal: i.subtotal,
        })),
        user: userId,
      });

      await debtRecord.save();
      sale.debt = debtRecord._id;
    }

    await sale.save();

    // Deduct stock and log movements
    for (const update of stockUpdates) {
      const prev = update.product.stock;
      update.product.stock -= update.qty;
      update.product.totalSold = (update.product.totalSold || 0) + update.qty;
      await update.product.save();

      await InventoryMovement.create({
        product: update.product._id,
        productOriginalId: update.product.originalId,
        productName: update.product.name,
        type: 'venta',
        quantity: -update.qty,
        previousStock: prev,
        newStock: update.product.stock,
        previousWarehouseStock: update.product.warehouseStock,
        newWarehouseStock: update.product.warehouseStock,
        reason: `Venta #${sale.originalId}`,
        reference: String(sale._id),
        user: userId,
      });
    }

    // Update client totalBought
    if (clientDoc) {
      clientDoc.totalBought = (clientDoc.totalBought || 0) + Number(total);
      await clientDoc.save();
    }

    return { sale, debt: debtRecord };
  }
}

module.exports = SaleService;

