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
   * Process and register a new sale.
   *
   * Campos esperados en saleData:
   *   items[]        – productos con { productId, productRef?, name, price, qty, subtotal? }
   *   clientId?      – ID numérico del cliente (originalId en MongoDB)
   *   clientRef?     – ObjectId _id del cliente en MongoDB
   *   clientName?    – nombre visible
   *   clientDocument?– cédula/NIT
   *   subtotal?      – suma de items (si no viene, se calcula aquí)
   *   laborCost?     – mano de obra adicional
   *   discount?      – descuento en pesos
   *   baseTotal?     – subtotal + laborCost - discount (si no viene, se calcula)
   *   interestRate?  – porcentaje de interés (solo crédito)
   *   interestAmount?– monto del interés (si no viene, se calcula)
   *   total          – total final OBLIGATORIO
   *   paid?          – abono recibido (0 si es crédito sin abono)
   *   paymentMethod  – OBLIGATORIO: 'Efectivo' | 'Nequi' | 'Crédito' | 'Transferencia' | 'Otro'
   *   dueDate?       – fecha de vencimiento para créditos
   */
  static async createSale(saleData, userId) {
    const {
      clientId,
      clientRef,
      clientName,
      clientDocument,
      items,
      laborCost = 0,
      discount = 0,
      total,
      baseTotal: baseTotalIn,
      interestRate = 0,
      interestAmount: interestAmountIn,
      paid = 0,
      paymentMethod = 'Efectivo',
      dueDate,
    } = saleData;

    // ── Validaciones básicas ──────────────────────────────────────────────────
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw createError('La venta debe incluir al menos un producto', 400);
    }

    const numTotal = Number(total);
    if (isNaN(numTotal) || numTotal < 0) {
      throw createError('El campo total debe ser un número válido mayor o igual a 0', 400);
    }

    const allowedMethods = ['Efectivo', 'Nequi', 'Crédito', 'Transferencia', 'Otro'];
    if (!allowedMethods.includes(paymentMethod)) {
      throw createError(
        `Método de pago inválido: '${paymentMethod}'. Valores permitidos: ${allowedMethods.join(', ')}`,
        400
      );
    }

    // ── ID secuencial ─────────────────────────────────────────────────────────
    const nextSaleId = await Config.getNextSequence(userId, 'sale');

    // ── Buscar cliente (si se proporcionó) ────────────────────────────────────
    let clientDoc = null;
    if (clientRef && mongoose.isValidObjectId(clientRef)) {
      // Preferir búsqueda por ObjectId (más preciso)
      clientDoc = await Client.findOne({ _id: clientRef, user: userId });
    }
    if (!clientDoc && clientId) {
      const numericId = Number(clientId);
      const orConditions = [];
      if (!isNaN(numericId)) orConditions.push({ originalId: numericId });
      if (mongoose.isValidObjectId(String(clientId))) orConditions.push({ _id: clientId });
      if (orConditions.length > 0) {
        clientDoc = await Client.findOne({ $or: orConditions, user: userId });
      }
    }

    // Si se pasó un clientId pero no se encontró, loguear advertencia (no bloquear)
    if ((clientId || clientRef) && !clientDoc) {
      console.warn(`[SaleService] Cliente con id=${clientId} / ref=${clientRef} no encontrado. Se registra sin cliente.`);
    }

    // ── Validar items y calcular subtotales ───────────────────────────────────
    const processedItems = [];
    const stockUpdates = [];
    let computedSubtotal = 0;

    for (const item of items) {
      // Validar cantidad
      const qtyRequested = Number(item.qty);
      if (!Number.isInteger(qtyRequested) || qtyRequested <= 0) {
        throw createError(
          `Cantidad inválida para '${item.name || 'producto desconocido'}': debe ser un número entero positivo`,
          400
        );
      }

      // Buscar producto en MongoDB
      let product = null;
      if (item.productRef && mongoose.isValidObjectId(item.productRef)) {
        product = await Product.findOne({ _id: item.productRef, user: userId });
      }
      if (!product && item.productId) {
        const numProdId = Number(item.productId);
        const orConds = [];
        if (!isNaN(numProdId)) orConds.push({ originalId: numProdId });
        if (mongoose.isValidObjectId(String(item.productId))) orConds.push({ _id: item.productId });
        if (orConds.length > 0) {
          product = await Product.findOne({ $or: orConds, user: userId });
        }
      }

      if (!product) {
        throw createError(
          `Producto no encontrado: '${item.name || item.productId}'. Verifica que el producto exista en el inventario.`,
          404
        );
      }

      // Validar precio
      const itemPrice = Number(item.price);
      if (isNaN(itemPrice) || itemPrice < 0) {
        throw createError(`Precio inválido para '${product.name}': ${item.price}`, 400);
      }

      // Verificar stock
      if (product.stock < qtyRequested) {
        throw createError(
          `Stock insuficiente para '${product.name}'. Disponible en tienda: ${product.stock}, solicitado: ${qtyRequested}`,
          400
        );
      }

      const itemSubtotal = Number(item.subtotal) || (itemPrice * qtyRequested);
      computedSubtotal += itemSubtotal;

      processedItems.push({
        productId: product.originalId ?? 0,
        productRef: product._id,
        name: product.name,
        price: itemPrice || product.sellPrice,
        qty: qtyRequested,
        subtotal: itemSubtotal,
      });

      stockUpdates.push({ product, qty: qtyRequested });
    }

    // ── Calcular/verificar totales ────────────────────────────────────────────
    // Si subtotal no vino del frontend, usamos el calculado
    const subtotalFinal = Number(saleData.subtotal) >= 0 ? Number(saleData.subtotal) : computedSubtotal;

    const numLaborCost = Math.max(0, Number(laborCost) || 0);
    const numDiscount = Math.max(0, Number(discount) || 0);
    const numInterestRate = Math.max(0, Math.min(100, Number(interestRate) || 0));

    // baseTotal = subtotal + laborCost - discount (antes de interés)
    const baseTotalFinal = Number(baseTotalIn) >= 0
      ? Number(baseTotalIn)
      : Math.max(0, subtotalFinal + numLaborCost - numDiscount);

    // interestAmount calculado si no viene
    const interestAmountFinal = Number(interestAmountIn) >= 0
      ? Number(interestAmountIn)
      : (numInterestRate > 0 ? Math.round(baseTotalFinal * numInterestRate / 100) : 0);

    const numPaid = Math.max(0, Number(paid) || 0);

    // ── Determinar estado ─────────────────────────────────────────────────────
    const isCredit = paymentMethod === 'Crédito' || numPaid < numTotal;
    const saleStatus = isCredit ? 'pendiente' : 'pagada';

    // ── Crear la venta ────────────────────────────────────────────────────────
    const sale = new Sale({
      originalId: nextSaleId,
      clientId: clientDoc ? clientDoc.originalId : (Number(clientId) || null),
      clientRef: clientDoc ? clientDoc._id : null,
      clientName: clientName || (clientDoc ? clientDoc.name : 'Consumidor Final'),
      clientDocument: clientDocument || (clientDoc ? clientDoc.document : ''),
      items: processedItems,
      subtotal: subtotalFinal,
      laborCost: numLaborCost,
      discount: numDiscount,
      total: numTotal,
      baseTotal: baseTotalFinal,
      interestRate: numInterestRate,
      interestAmount: interestAmountFinal,
      paid: numPaid,
      paymentMethod,
      status: saleStatus,
      date: new Date(),
      user: userId,
    });

    // ── Crear deuda si aplica ─────────────────────────────────────────────────
    let debtRecord = null;
    if (isCredit) {
      const balance = Math.max(0, numTotal - numPaid);
      const nextDebtId = await Config.getNextSequence(userId, 'debt');

      const initialPayments = [];
      if (numPaid > 0) {
        const nextPaymentId = await Config.getNextSequence(userId, 'payment');
        initialPayments.push({
          originalId: nextPaymentId,
          amount: numPaid,
          date: new Date(),
          note: 'Abono inicial al momento de la venta',
          paymentMethod: 'Efectivo',
        });
      }

      debtRecord = new Debt({
        originalId: nextDebtId,
        saleId: sale.originalId,
        saleRef: sale._id,
        clientId: clientDoc ? clientDoc.originalId : (Number(clientId) || null),
        clientRef: clientDoc ? clientDoc._id : null,
        clientName: sale.clientName,
        clientDocument: sale.clientDocument,
        total: numTotal,
        baseTotal: baseTotalFinal,
        interestRate: numInterestRate,
        interestAmount: interestAmountFinal,
        paid: numPaid,
        balance,
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

    // ── Descontar stock y registrar movimientos de inventario ─────────────────
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

    // ── Actualizar totalBought del cliente ────────────────────────────────────
    if (clientDoc) {
      clientDoc.totalBought = (clientDoc.totalBought || 0) + numTotal;
      await clientDoc.save();
    }

    return { sale, debt: debtRecord };
  }
}

module.exports = SaleService;

