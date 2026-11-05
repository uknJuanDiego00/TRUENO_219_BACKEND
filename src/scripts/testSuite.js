const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

process.env.JWT_SECRET = 'test_jwt_secret_super_secure_key_1234567890';
process.env.JWT_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';

const User = require('../models/User');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Sale = require('../models/Sale');
const Debt = require('../models/Debt');
const Config = require('../models/Config');
const Category = require('../models/Category');
const InventoryMovement = require('../models/InventoryMovement');
const SaleService = require('../services/sale.service');
const DebtService = require('../services/debt.service');
const InventoryService = require('../services/inventory.service');
const DashboardService = require('../services/dashboard.service');

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 SUITE COMPLETA DE PRUEBAS DE INTEGRACIÓN - TRUENO');
  console.log('====================================================\n');

  let mongod;
  try {
    console.log('🚀 Iniciando instancia MongoDB en memoria...');
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB en memoria para pruebas.\n');

    let passedTests = 0;
    let totalTests = 0;

    const assert = (condition, description) => {
      totalTests++;
      if (condition) {
        console.log(`  ✅ [PASS] ${description}`);
        passedTests++;
      } else {
        console.error(`  ❌ [FAIL] ${description}`);
      }
    };

    // 1. Test User Registration & Password Hashing
    console.log('📌 1. PRUEBA DE REGISTRO Y AUTENTICACIÓN');
    const user = await User.create({
      name: 'Test Admin',
      email: 'admin@truenotest.com',
      password: 'password123',
      role: 'admin',
    });
    assert(user._id !== undefined, 'Usuario creado con _id');
    assert(user.password !== 'password123', 'Contraseña encriptada con bcrypt');
    const isMatch = await user.comparePassword('password123');
    assert(isMatch === true, 'Verificación de contraseña correcta');
    const isWrong = await user.comparePassword('wrongpassword');
    assert(isWrong === false, 'Rechazo de contraseña incorrecta');

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    assert(decoded.id === String(user._id), 'Token JWT generado y verificado correctamente');

    // 2. Test Configuration and Counters
    console.log('\n📌 2. PRUEBA DE CONFIGURACIÓN Y CONTADORES SECUENCIALES');
    await Config.create({
      user: user._id,
      storeName: 'Trueno 219',
      lowStockThreshold: 2,
      currency: 'COP',
      taxRate: 0,
      idCounters: { product: 100, sale: 1000, debt: 50, payment: 10, client: 20 },
    });

    const nextProdId = await Config.getNextSequence(user._id, 'product');
    assert(nextProdId === 101, `Contador secuencial de producto incrementa a 101 (actual: ${nextProdId})`);

    // 3. Test LocalStorage Migration
    console.log('\n📌 3. PRUEBA DE MIGRACIÓN COMPLETA DESDE localStorage.json');
    const jsonPath = path.resolve(__dirname, '../../localStorage.json');
    const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Products
    const productMap = new Map();
    for (const item of rawData.trueno_products) {
      const p = await Product.create({
        originalId: item.id,
        name: item.name,
        category: item.category,
        description: item.description || '',
        buyPrice: Number(item.buyPrice) || 0,
        sellPrice: Number(item.sellPrice) || 0,
        stock: Number(item.stock) || 0,
        warehouseStock: Number(item.warehouseStock) || 0,
        minStock: item.minStock || 5,
        sku: item.sku || '',
        user: user._id,
      });
      productMap.set(item.id, p._id);
    }
    const countProducts = await Product.countDocuments({ user: user._id });
    assert(countProducts === 477, `477 productos migrados exitosamente (total: ${countProducts})`);

    // Clients
    const clientMap = new Map();
    for (const item of rawData.trueno_clients) {
      const c = await Client.create({
        originalId: item.id,
        document: item.document || '',
        name: item.name,
        phone: item.phone || '',
        email: item.email || '',
        totalBought: item.totalBought || 0,
        user: user._id,
      });
      clientMap.set(item.id, c._id);
    }
    const countClients = await Client.countDocuments({ user: user._id });
    assert(countClients === 48, `48 clientes migrados exitosamente (total: ${countClients})`);

    // Sales
    const saleMap = new Map();
    for (const s of rawData.trueno_sales) {
      const sale = await Sale.create({
        originalId: s.id,
        clientId: s.clientId,
        clientRef: clientMap.get(s.clientId) || null,
        clientName: s.clientName,
        clientDocument: s.clientDocument,
        items: (s.items || []).map((it) => ({
          productId: it.productId,
          productRef: productMap.get(it.productId) || null,
          name: it.name,
          price: it.price,
          qty: it.qty,
          subtotal: it.subtotal,
        })),
        subtotal: s.subtotal,
        discount: s.discount || 0,
        total: s.total,
        paid: s.paid || 0,
        paymentMethod: s.paymentMethod,
        status: s.status,
        date: s.date,
        user: user._id,
      });
      saleMap.set(s.id, sale._id);
    }
    const countSales = await Sale.countDocuments({ user: user._id });
    assert(countSales === 73, `73 ventas migradas exitosamente (total: ${countSales})`);

    // Debts
    for (const d of rawData.trueno_debts) {
      await Debt.create({
        originalId: d.id,
        saleId: d.saleId,
        saleRef: saleMap.get(d.saleId) || null,
        clientId: d.clientId,
        clientRef: clientMap.get(d.clientId) || null,
        clientName: d.clientName,
        total: d.total,
        paid: d.paid || 0,
        balance: d.balance,
        status: d.status,
        payments: (d.payments || []).map((p) => ({
          originalId: p.id,
          amount: p.amount,
          date: p.date,
          note: p.note,
        })),
        user: user._id,
      });
    }
    const countDebts = await Debt.countDocuments({ user: user._id });
    assert(countDebts === 36, `36 deudas migradas exitosamente (total: ${countDebts})`);

    // 4. Test New Sale Creation & Stock Deductions
    console.log('\n📌 4. PRUEBA DE CREACIÓN DE VENTA CON DESCUENTO DE STOCK');
    const testProduct = await Product.findOne({ stock: { $gt: 5 }, user: user._id });
    const initialStock = testProduct.stock;
    const saleResult = await SaleService.createSale(
      {
        clientId: 107,
        items: [{ productId: testProduct.originalId, qty: 2, price: testProduct.sellPrice, subtotal: testProduct.sellPrice * 2 }],
        subtotal: testProduct.sellPrice * 2,
        total: testProduct.sellPrice * 2,
        paid: testProduct.sellPrice * 2,
        paymentMethod: 'Nequi',
      },
      user._id
    );

    const updatedProduct = await Product.findById(testProduct._id);
    assert(updatedProduct.stock === initialStock - 2, `Stock deducido correctamente: ${initialStock} -> ${updatedProduct.stock}`);
    assert(saleResult.sale.status === 'pagada', 'Estado de venta con pago completo es "pagada"');

    const movement = await InventoryMovement.findOne({ reference: String(saleResult.sale._id) });
    assert(movement !== null && movement.type === 'venta', 'Movimiento de inventario por venta registrado automáticamente');

    // 5. Test Credit Sale & Debt Creation
    console.log('\n📌 5. PRUEBA DE VENTA A CRÉDITO Y GENERACIÓN DE DEUDA');
    const creditSale = await SaleService.createSale(
      {
        clientName: 'Cliente Crédito Test',
        items: [{ productId: testProduct.originalId, qty: 1, price: 50000, subtotal: 50000 }],
        subtotal: 50000,
        total: 50000,
        paid: 10000,
        paymentMethod: 'Crédito',
      },
      user._id
    );
    assert(creditSale.sale.status === 'pendiente', 'Estado de venta a crédito es "pendiente"');
    assert(creditSale.debt !== null, 'Deuda vinculada creada automáticamente');
    assert(creditSale.debt.balance === 40000, `Saldo pendiente calculado correctamente: $${creditSale.debt.balance}`);

    // 6. Test Debt Payment (Abono)
    console.log('\n📌 6. PRUEBA DE ABONO A DEUDA Y ACTUALIZACIÓN DE SALDO');
    const paymentResult = await DebtService.addPayment({
      debtId: creditSale.debt._id,
      amount: 40000,
      note: 'Pago total del saldo',
      userId: user._id,
    });
    assert(paymentResult.debt.balance === 0, 'Saldo de la deuda llega a $0');
    assert(paymentResult.debt.status === 'pagada', 'Estado de la deuda cambia a "pagada"');

    const updatedSale = await Sale.findById(creditSale.sale._id);
    assert(updatedSale.status === 'pagada', 'Estado de la venta vinculada se actualiza a "pagada"');

    // 7. Test Inventory Transfer (Tienda <-> Bodega)
    console.log('\n📌 7. PRUEBA DE TRANSFERENCIA DE INVENTARIO TIENDA <-> BODEGA');
    const prodForTransfer = await Product.create({
      originalId: 9999,
      name: 'Producto Transferencia Test',
      category: 'Accesorios',
      sellPrice: 10000,
      stock: 10,
      warehouseStock: 5,
      user: user._id,
    });

    await InventoryService.transferStock({
      productId: prodForTransfer._id,
      quantity: 3,
      from: 'warehouse',
      to: 'store',
      userId: user._id,
    });

    const transferredProd = await Product.findById(prodForTransfer._id);
    assert(transferredProd.stock === 13, `Stock de tienda aumentó de 10 a 13 (actual: ${transferredProd.stock})`);
    assert(transferredProd.warehouseStock === 2, `Stock de bodega disminuyó de 5 a 2 (actual: ${transferredProd.warehouseStock})`);

    // 8. Test Dashboard Metrics
    console.log('\n📌 8. PRUEBA DE SERVICIO DE DASHBOARD Y MÉTRICAS');
    const dashboard = await DashboardService.getSummary(user._id);
    assert(dashboard.products.total >= 478, `Total productos en dashboard: ${dashboard.products.total}`);
    assert(dashboard.sales.totalCount >= 75, `Total ventas en dashboard: ${dashboard.sales.totalCount}`);
    assert(dashboard.topSelling.length > 0, `Top productos más vendidos generado: ${dashboard.topSelling.length} items`);

    console.log('\n====================================================');
    console.log(`🎯 RESULTADOS FINALES: ${passedTests}/${totalTests} PRUEBAS PASADAS`);
    console.log('====================================================\n');

    if (passedTests === totalTests) {
      console.log('🎉 TODAS LAS PRUEBAS DE INTEGRACIÓN PASARON SATISFACTORIAMENTE.');
    } else {
      console.error('⚠️ ALGUNAS PRUEBAS FALLARON.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ Error no controlado durante las pruebas:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runTestSuite();

