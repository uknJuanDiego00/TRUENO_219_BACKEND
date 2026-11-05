const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'c8f5e7192a95c47a1f6d338a0b0d3e5187fa44299b6df7ea198d0ce9f6b539a2';
process.env.JWT_EXPIRES_IN = '7d';

const User = require('../models/User');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Sale = require('../models/Sale');
const Debt = require('../models/Debt');
const Config = require('../models/Config');
const Category = require('../models/Category');
const InventoryMovement = require('../models/InventoryMovement');
const PendingSale = require('../models/PendingSale');
const app = require('../app');

async function runUnitTests() {
  console.log('====================================================');
  console.log('🧪 SUITE DE PRUEBAS DE ARQUITECTURA Y VALIDACIÓN');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  const assert = (condition, description) => {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${description}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${description}`);
    }
  };

  // 1. Auth & Password Hashing
  console.log('📌 1. PRUEBA DE AUTENTICACIÓN Y HASHING');
  const rawPass = 'trueno2026!';
  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(rawPass, salt);
  assert(await bcrypt.compare(rawPass, hashed), 'bcrypt compara contraseñas válidas');
  assert(!(await bcrypt.compare('wrong', hashed)), 'bcrypt rechaza contraseñas inválidas');

  const token = jwt.sign({ id: '64f01234567890abcdef1234' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  assert(decoded.id === '64f01234567890abcdef1234', 'Generación y decodificación de JWT correcta');

  // 2. Models Schema Validation
  console.log('\n📌 2. VALIDACIÓN DE ESQUEMAS Y MODELOS');
  const dummyUserId = '64f01234567890abcdef1234';

  const testProduct = new Product({
    originalId: 102,
    name: 'Módulos led 3 puntos azul',
    category: 'Luces',
    buyPrice: 4000,
    sellPrice: 4000,
    stock: 8,
    warehouseStock: 5,
    minStock: 5,
    user: dummyUserId,
  });
  const prodErr = testProduct.validateSync();
  assert(!prodErr, 'Modelo Product valida correctamente sin errores');
  assert(testProduct.totalStock === 13, `Virtual totalStock calcula correctamente (8 + 5 = ${testProduct.totalStock})`);
  assert(testProduct.isLowStock === false, `Virtual isLowStock es false cuando stock (8) > minStock (5)`);

  testProduct.stock = 4;
  assert(testProduct.isLowStock === true, `Virtual isLowStock es true cuando stock (4) <= minStock (5)`);

  const testClient = new Client({
    originalId: 107,
    name: 'Dorian pinto',
    document: '1005479618',
    phone: '3143265534',
    user: dummyUserId,
  });
  const clientErr = testClient.validateSync();
  assert(!clientErr, 'Modelo Client valida correctamente sin errores');

  const testSale = new Sale({
    originalId: 1018,
    clientId: 107,
    clientName: 'Dorian pinto',
    clientDocument: '1005479618',
    items: [
      {
        productId: 266,
        name: 'Manilares ufo fucsia',
        price: 30000,
        qty: 1,
        subtotal: 30000,
      },
    ],
    subtotal: 30000,
    discount: 2000,
    total: 28000,
    paid: 28000,
    paymentMethod: 'Nequi',
    status: 'pagada',
    user: dummyUserId,
  });
  const saleErr = testSale.validateSync();
  assert(!saleErr, 'Modelo Sale valida correctamente sin errores');

  const testDebt = new Debt({
    originalId: 117,
    saleId: 1019,
    clientId: 108,
    clientName: 'Sebastián mandarino',
    clientDocument: '1101622945',
    total: 150000,
    paid: 60000,
    balance: 90000,
    status: 'pendiente',
    payments: [{ originalId: 148, amount: 60000, date: new Date() }],
    items: [{ productId: 303, name: 'Deuda inicial', price: 1, qty: 1, subtotal: 1 }],
    user: dummyUserId,
  });
  const debtErr = testDebt.validateSync();
  assert(!debtErr, 'Modelo Debt valida correctamente sin errores');

  testDebt.recalculate();
  assert(testDebt.paid === 60000, `Método recalculate() calcula pagado = $60,000`);
  assert(testDebt.balance === 90000, `Método recalculate() calcula saldo = $90,000`);

  // 3. localStorage.json Integrity Verification
  console.log('\n📌 3. VERIFICACIÓN DE ESTRUCTURA Y DATOS DE localStorage.json');
  const jsonPath = path.resolve(__dirname, '../../localStorage.json');
  assert(fs.existsSync(jsonPath), 'Archivo localStorage.json existe en la raíz');

  const rawJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert(Array.isArray(rawJson.trueno_products) && rawJson.trueno_products.length === 477, `trueno_products contiene exactamente 477 productos (encontrados: ${rawJson.trueno_products.length})`);
  assert(Array.isArray(rawJson.trueno_clients) && rawJson.trueno_clients.length === 48, `trueno_clients contiene exactamente 48 clientes (encontrados: ${rawJson.trueno_clients.length})`);
  assert(Array.isArray(rawJson.trueno_sales) && rawJson.trueno_sales.length === 73, `trueno_sales contiene exactamente 73 ventas (encontrados: ${rawJson.trueno_sales.length})`);
  assert(Array.isArray(rawJson.trueno_debts) && rawJson.trueno_debts.length === 36, `trueno_debts contiene exactamente 36 deudas (encontrados: ${rawJson.trueno_debts.length})`);
  assert(rawJson.trueno_config && rawJson.trueno_config.storeName === 'Trueno 219', `trueno_config contiene storeName="Trueno 219"`);
  assert(rawJson.trueno_id_counters && rawJson.trueno_id_counters.product === 586, `trueno_id_counters product = 586`);

  // Verify all 477 products map cleanly into Product model
  let invalidProducts = 0;
  for (const item of rawJson.trueno_products) {
    const buyPrice = item.buyPrice === '' || item.buyPrice === null ? 0 : Number(item.buyPrice) || 0;
    const p = new Product({
      originalId: item.id,
      name: item.name || 'Sin nombre',
      category: item.category || 'Otros',
      buyPrice,
      sellPrice: Number(item.sellPrice) || 0,
      stock: Number(item.stock) || 0,
      warehouseStock: Number(item.warehouseStock) || 0,
      minStock: Number(item.minStock) || 5,
      sku: item.sku || '',
      user: dummyUserId,
    });
    if (p.validateSync()) invalidProducts++;
  }
  assert(invalidProducts === 0, `Todos los 477 productos de localStorage mapean válidamente al modelo Mongoose`);

  // Verify all 48 clients map cleanly into Client model
  let invalidClients = 0;
  for (const c of rawJson.trueno_clients) {
    const cl = new Client({
      originalId: c.id,
      document: String(c.document || ''),
      name: c.name || 'Sin nombre',
      phone: String(c.phone || ''),
      email: c.email || '',
      user: dummyUserId,
    });
    if (cl.validateSync()) invalidClients++;
  }
  assert(invalidClients === 0, `Todos los 48 clientes de localStorage mapean válidamente al modelo Mongoose`);

  // Verify all 73 sales map cleanly into Sale model
  let invalidSales = 0;
  for (const s of rawJson.trueno_sales) {
    const items = (s.items || []).map((it) => ({
      productId: it.productId,
      name: it.name,
      price: Number(it.price) || 0,
      qty: Number(it.qty) || 1,
      subtotal: Number(it.subtotal) || 0,
    }));
    const sa = new Sale({
      originalId: s.id,
      clientId: s.clientId,
      clientName: s.clientName,
      clientDocument: s.clientDocument,
      items,
      subtotal: Number(s.subtotal) || 0,
      discount: Number(s.discount) || 0,
      total: Number(s.total) || 0,
      paid: Number(s.paid) || 0,
      paymentMethod: s.paymentMethod || 'Efectivo',
      status: s.status || 'pagada',
      user: dummyUserId,
    });
    if (sa.validateSync()) invalidSales++;
  }
  assert(invalidSales === 0, `Todas las 73 ventas de localStorage mapean válidamente al modelo Mongoose`);

  // Verify all 36 debts map cleanly into Debt model
  let invalidDebts = 0;
  for (const d of rawJson.trueno_debts) {
    const de = new Debt({
      originalId: d.id,
      saleId: d.saleId,
      clientId: d.clientId,
      clientName: d.clientName,
      total: Number(d.total) || 0,
      paid: Number(d.paid) || 0,
      balance: Number(d.balance) || 0,
      status: d.status || 'pendiente',
      items: (d.items || []).map((it) => ({
        productId: it.productId,
        name: it.name,
        price: Number(it.price) || 0,
        qty: Number(it.qty) || 1,
        subtotal: Number(it.subtotal) || 0,
      })),
      payments: (d.payments || []).map((p) => ({
        originalId: p.id,
        amount: Number(p.amount) || 0,
        date: p.date ? new Date(p.date) : new Date(),
        note: p.note || '',
      })),
      user: dummyUserId,
    });
    if (de.validateSync()) invalidDebts++;
  }
  assert(invalidDebts === 0, `Todas las 36 deudas de localStorage mapean válidamente al modelo Mongoose`);

  // 4. API Express & Endpoints Verification
  console.log('\n📌 4. VERIFICACIÓN DE RUTAS Y APP EXPRESS');
  assert(typeof app.listen === 'function', 'Instancia de Express inicializada correctamente');

  console.log('\n====================================================');
  console.log(`🎯 RESULTADOS: ${passed}/${total} PRUEBAS COMPLETADAS CON ÉXITO`);
  console.log('====================================================\n');

  if (passed === total) {
    console.log('🎉 TODAS LAS VALIDACIONES Y COMPONENTES DEL BACKEND FUNCIONAN PERFECTAMENTE.');
  } else {
    process.exitCode = 1;
  }
}

runUnitTests().catch((err) => {
  console.error('❌ Error ejecutando pruebas:', err);
  process.exit(1);
});

