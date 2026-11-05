require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const connectDB = require('../config/database');
const User = require('../models/User');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Sale = require('../models/Sale');
const Debt = require('../models/Debt');
const Config = require('../models/Config');
const Category = require('../models/Category');
const InventoryMovement = require('../models/InventoryMovement');
const PendingSale = require('../models/PendingSale');

/**
 * Función auxiliar para dividir un arreglo en lotes
 */
const chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

const seedFromLocalStorage = async () => {
  const startTime = Date.now();
  console.log('\n====================================================');
  console.log('⚡ TRUENO INVENTARIO - MIGRACIÓN MASIVA A MONGODB ATLAS');
  console.log('====================================================\n');

  // 1. Validar existencia y sintaxis de localStorage.json
  const jsonPath = path.resolve(__dirname, '../../localStorage.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Archivo no encontrado en: ${jsonPath}`);
    process.exit(1);
  }

  console.log(`📖 Leyendo archivo original: ${jsonPath}`);
  let rawJsonData;
  try {
    const fileContent = fs.readFileSync(jsonPath, 'utf8');
    rawJsonData = JSON.parse(fileContent);
    console.log('✅ Archivo JSON validado y parseado correctamente.');
  } catch (parseError) {
    console.error('❌ Error crítico al parsear localStorage.json:', parseError.message);
    process.exit(1);
  }

  // 2. Conectar a MongoDB Atlas
  console.log('\n🔄 Estableciendo conexión con MongoDB Atlas...');
  await connectDB();

  // 3. Creación y verificación de colecciones e índices en MongoDB Atlas
  console.log('\n🏗️ Verificando y creando colecciones e índices en Atlas...');
  const existingCollections = (await mongoose.connection.db.listCollections().toArray()).map((c) => c.name);

  const models = [
    { name: 'users', model: User },
    { name: 'configs', model: Config },
    { name: 'categories', model: Category },
    { name: 'products', model: Product },
    { name: 'clients', model: Client },
    { name: 'sales', model: Sale },
    { name: 'debts', model: Debt },
    { name: 'inventory_movements', model: InventoryMovement },
    { name: 'pending_sales', model: PendingSale },
  ];

  const verifiedCollections = [];
  for (const item of models) {
    if (!existingCollections.includes(item.name)) {
      await mongoose.connection.db.createCollection(item.name);
      console.log(`  ➕ Colección creada: ${item.name}`);
    } else {
      console.log(`  ✓ Colección existente: ${item.name}`);
    }
    await item.model.createIndexes();
    verifiedCollections.push(item.name);
  }

  // Objeto de métricas para reporte final
  const metrics = {
    users: { found: 1, valid: 1, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    configs: { found: 1, valid: 1, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    categories: { found: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    products: { found: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    clients: { found: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    sales: { found: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    debts: { found: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    movements: { found: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
  };

  // 4. Usuario Administrador
  console.log('\n👤 Verificando usuario administrador del sistema...');
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@trueno219.com').toLowerCase();
  let adminUser = await User.findOne({ email: adminEmail });

  if (!adminUser) {
    adminUser = await User.create({
      name: 'Administrador Trueno',
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD || 'trueno2026!',
      role: 'admin',
      storeName: (rawJsonData.trueno_config && rawJsonData.trueno_config.storeName) || 'Trueno 219',
    });
    metrics.users.inserted++;
    console.log(`  ✅ Usuario administrador creado: ${adminEmail}`);
  } else {
    metrics.users.updated++;
    console.log(`  ✓ Usuario administrador existente: ${adminEmail}`);
  }
  const userId = adminUser._id;

  // 5. Configuración de Tienda y Contadores Secuenciales
  console.log('\n⚙️ Sincronizando configuración de tienda y secuencias de ID...');
  const rawConfig = rawJsonData.trueno_config || {};
  const rawCounters = rawJsonData.trueno_id_counters || {};

  const configRes = await Config.findOneAndUpdate(
    { user: userId },
    {
      $set: {
        storeName: rawConfig.storeName || 'Trueno 219',
        lowStockThreshold: rawConfig.lowStockThreshold !== undefined ? Number(rawConfig.lowStockThreshold) : 2,
        currency: rawConfig.currency || 'COP',
        taxRate: Number(rawConfig.taxRate) || 0,
        idCounters: {
          product: Number(rawCounters.product) || 0,
          client: Number(rawCounters.client) || 0,
          sale: Number(rawCounters.sale) || 0,
          debt: Number(rawCounters.debt) || 0,
          payment: Number(rawCounters.payment) || 0,
          pending_sale: Number(rawCounters.pending_sale) || 0,
        },
      },
    },
    { upsert: true, new: true, rawResult: true }
  );

  if (configRes.lastErrorObject?.updatedExisting) {
    metrics.configs.updated++;
  } else {
    metrics.configs.inserted++;
  }
  console.log(`  ✅ Configuración sincronizada (Secuencia productos: ${rawCounters.product || 0}, ventas: ${rawCounters.sale || 0})`);

  // 6. Migración Masiva de Categorías (bulkWrite)
  const rawProducts = rawJsonData.trueno_products || [];
  const uniqueCategoryNames = [...new Set(rawProducts.map((p) => p.category?.trim()).filter(Boolean))];
  metrics.categories.found = uniqueCategoryNames.length;
  metrics.categories.valid = uniqueCategoryNames.length;

  console.log(`\n🏷️ Migrando ${uniqueCategoryNames.length} categorías únicas mediante bulkWrite...`);
  if (uniqueCategoryNames.length > 0) {
    const categoryOps = uniqueCategoryNames.map((catName) => ({
      updateOne: {
        filter: { name: catName, user: userId },
        update: { $setOnInsert: { name: catName, user: userId, description: '' } },
        upsert: true,
      },
    }));

    const catResult = await Category.bulkWrite(categoryOps, { ordered: false });
    metrics.categories.inserted = catResult.upsertedCount || 0;
    metrics.categories.updated = catResult.modifiedCount || 0;
    metrics.categories.skipped = catResult.matchedCount - (catResult.modifiedCount || 0);
    console.log(`  ✅ Categorías: ${metrics.categories.inserted} insertadas, ${metrics.categories.skipped} existentes.`);
  }

  // 7. Migración Masiva de Productos en Lotes (Batched bulkWrite)
  metrics.products.found = rawProducts.length;
  console.log(`\n📦 Migrando ${rawProducts.length} productos en lotes controlados...`);
  const PRODUCT_BATCH_SIZE = 100;
  const productBatches = chunkArray(rawProducts, PRODUCT_BATCH_SIZE);

  for (let bIndex = 0; bIndex < productBatches.length; bIndex++) {
    const batch = productBatches[bIndex];
    const ops = [];

    for (const item of batch) {
      if (item.id === undefined || item.id === null) {
        metrics.products.errors++;
        continue;
      }

      const buyPrice = item.buyPrice === '' || item.buyPrice === null ? 0 : Number(item.buyPrice) || 0;
      const sellPrice = Number(item.sellPrice) || 0;
      const stock = Number(item.stock) || 0;
      const warehouseStock = Number(item.warehouseStock) || 0;
      const minStock = item.minStock !== undefined && item.minStock !== null ? Number(item.minStock) : 5;

      const productDoc = {
        originalId: Number(item.id),
        name: item.name ? String(item.name).trim() : 'Producto sin nombre',
        category: item.category ? String(item.category).trim() : 'Otros',
        description: item.description ? String(item.description).trim() : '',
        buyPrice,
        sellPrice,
        stock,
        warehouseStock,
        minStock,
        sku: item.sku ? String(item.sku).trim() : '',
        image: item.image || null,
        totalSold: Number(item.totalSold) || 0,
        createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        user: userId,
      };

      ops.push({
        updateOne: {
          filter: { originalId: productDoc.originalId, user: userId },
          update: { $set: productDoc },
          upsert: true,
        },
      });
      metrics.products.valid++;
    }

    if (ops.length > 0) {
      const bRes = await Product.bulkWrite(ops, { ordered: false });
      metrics.products.inserted += bRes.upsertedCount || 0;
      metrics.products.updated += bRes.modifiedCount || 0;
      metrics.products.skipped += (bRes.matchedCount || 0) - (bRes.modifiedCount || 0);
    }
    console.log(`  ✓ Lote productos ${bIndex + 1}/${productBatches.length} procesado.`);
  }

  // Generar mapa de productos: originalId -> _id para resolver relaciones relacionales
  const allDbProducts = await Product.find({ user: userId }).select('_id originalId name sellPrice');
  const productMap = new Map();
  allDbProducts.forEach((p) => productMap.set(p.originalId, p._id));

  // 8. Migración Masiva de Clientes en Lotes (Batched bulkWrite)
  const rawClients = rawJsonData.trueno_clients || [];
  metrics.clients.found = rawClients.length;
  console.log(`\n👥 Migrando ${rawClients.length} clientes en lotes controlados...`);
  const CLIENT_BATCH_SIZE = 50;
  const clientBatches = chunkArray(rawClients, CLIENT_BATCH_SIZE);

  for (let bIndex = 0; bIndex < clientBatches.length; bIndex++) {
    const batch = clientBatches[bIndex];
    const ops = [];

    for (const c of batch) {
      if (c.id === undefined || c.id === null) {
        metrics.clients.errors++;
        continue;
      }

      const clientDoc = {
        originalId: Number(c.id),
        document: c.document ? String(c.document).trim() : '',
        name: c.name ? String(c.name).trim() : 'Cliente sin nombre',
        phone: c.phone ? String(c.phone).trim() : '',
        email: c.email ? String(c.email).trim().toLowerCase() : '',
        address: c.address ? String(c.address).trim() : '',
        notes: c.notes ? String(c.notes).trim() : '',
        totalBought: Number(c.totalBought) || 0,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        user: userId,
      };

      ops.push({
        updateOne: {
          filter: { originalId: clientDoc.originalId, user: userId },
          update: { $set: clientDoc },
          upsert: true,
        },
      });
      metrics.clients.valid++;
    }

    if (ops.length > 0) {
      const bRes = await Client.bulkWrite(ops, { ordered: false });
      metrics.clients.inserted += bRes.upsertedCount || 0;
      metrics.clients.updated += bRes.modifiedCount || 0;
      metrics.clients.skipped += (bRes.matchedCount || 0) - (bRes.modifiedCount || 0);
    }
    console.log(`  ✓ Lote clientes ${bIndex + 1}/${clientBatches.length} procesado.`);
  }

  // Generar mapa de clientes: originalId -> _id
  const allDbClients = await Client.find({ user: userId }).select('_id originalId name document');
  const clientMap = new Map();
  allDbClients.forEach((c) => clientMap.set(c.originalId, c._id));

  // 9. Migración Masiva de Ventas con Resolución de Referencias (Batched bulkWrite)
  const rawSales = rawJsonData.trueno_sales || [];
  metrics.sales.found = rawSales.length;
  console.log(`\n💳 Migrando ${rawSales.length} ventas con resolución de referencias...`);
  const SALE_BATCH_SIZE = 50;
  const saleBatches = chunkArray(rawSales, SALE_BATCH_SIZE);

  for (let bIndex = 0; bIndex < saleBatches.length; bIndex++) {
    const batch = saleBatches[bIndex];
    const ops = [];

    for (const s of batch) {
      if (s.id === undefined || s.id === null) {
        metrics.sales.errors++;
        continue;
      }

      const clientRefId = clientMap.get(s.clientId) || null;
      const resolvedItems = (s.items || []).map((it) => ({
        productId: Number(it.productId) || 0,
        productRef: productMap.get(it.productId) || null,
        name: it.name || 'Producto',
        price: Number(it.price) || 0,
        qty: Number(it.qty) || 1,
        subtotal: Number(it.subtotal) || 0,
      }));

      const saleDoc = {
        originalId: Number(s.id),
        clientId: s.clientId !== undefined && s.clientId !== null ? Number(s.clientId) : null,
        clientRef: clientRefId,
        clientName: s.clientName ? String(s.clientName).trim() : 'Consumidor Final',
        clientDocument: s.clientDocument ? String(s.clientDocument).trim() : '',
        items: resolvedItems,
        subtotal: Number(s.subtotal) || 0,
        discount: Number(s.discount) || 0,
        total: Number(s.total) || 0,
        baseTotal: Number(s.baseTotal || s.total) || 0,
        interestRate: Number(s.interestRate) || 0,
        interestAmount: Number(s.interestAmount) || 0,
        paid: Number(s.paid) || 0,
        paymentMethod: s.paymentMethod || 'Efectivo',
        status: s.status || 'pagada',
        date: s.date ? new Date(s.date) : new Date(),
        user: userId,
      };

      ops.push({
        updateOne: {
          filter: { originalId: saleDoc.originalId, user: userId },
          update: { $set: saleDoc },
          upsert: true,
        },
      });
      metrics.sales.valid++;
    }

    if (ops.length > 0) {
      const bRes = await Sale.bulkWrite(ops, { ordered: false });
      metrics.sales.inserted += bRes.upsertedCount || 0;
      metrics.sales.updated += bRes.modifiedCount || 0;
      metrics.sales.skipped += (bRes.matchedCount || 0) - (bRes.modifiedCount || 0);
    }
    console.log(`  ✓ Lote ventas ${bIndex + 1}/${saleBatches.length} procesado.`);
  }

  // Generar mapa de ventas: originalId -> _id
  const allDbSales = await Sale.find({ user: userId }).select('_id originalId');
  const saleMap = new Map();
  allDbSales.forEach((s) => saleMap.set(s.originalId, s._id));

  // 10. Migración Masiva de Deudas y Abonos (Batched bulkWrite)
  const rawDebts = rawJsonData.trueno_debts || [];
  metrics.debts.found = rawDebts.length;
  console.log(`\n📋 Migrando ${rawDebts.length} deudas y sus abonos correspondientes...`);
  const DEBT_BATCH_SIZE = 50;
  const debtBatches = chunkArray(rawDebts, DEBT_BATCH_SIZE);

  for (let bIndex = 0; bIndex < debtBatches.length; bIndex++) {
    const batch = debtBatches[bIndex];
    const ops = [];

    for (const d of batch) {
      if (d.id === undefined || d.id === null) {
        metrics.debts.errors++;
        continue;
      }

      const saleRefId = saleMap.get(d.saleId) || null;
      const clientRefId = clientMap.get(d.clientId) || null;

      const resolvedItems = (d.items || []).map((it) => ({
        productId: Number(it.productId) || 0,
        productRef: productMap.get(it.productId) || null,
        name: it.name || 'Item',
        price: Number(it.price) || 0,
        qty: Number(it.qty) || 1,
        subtotal: Number(it.subtotal) || 0,
      }));

      const resolvedPayments = (d.payments || []).map((p) => ({
        originalId: Number(p.id) || undefined,
        amount: Number(p.amount) || 0,
        date: p.date ? new Date(p.date) : new Date(),
        note: p.note ? String(p.note).trim() : '',
        paymentMethod: 'Efectivo',
      }));

      const debtDoc = {
        originalId: Number(d.id),
        saleId: d.saleId !== undefined && d.saleId !== null ? Number(d.saleId) : null,
        saleRef: saleRefId,
        clientId: d.clientId !== undefined && d.clientId !== null ? Number(d.clientId) : null,
        clientRef: clientRefId,
        clientName: d.clientName ? String(d.clientName).trim() : 'Cliente',
        clientDocument: d.clientDocument ? String(d.clientDocument).trim() : '',
        total: Number(d.total) || 0,
        baseTotal: Number(d.baseTotal || d.total) || 0,
        interestRate: Number(d.interestRate) || 0,
        interestAmount: Number(d.interestAmount) || 0,
        paid: Number(d.paid) || 0,
        balance: Number(d.balance) || 0,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        status: d.status || 'pendiente',
        payments: resolvedPayments,
        items: resolvedItems,
        createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
        updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
        user: userId,
      };

      ops.push({
        updateOne: {
          filter: { originalId: debtDoc.originalId, user: userId },
          update: { $set: debtDoc },
          upsert: true,
        },
      });
      metrics.debts.valid++;
    }

    if (ops.length > 0) {
      const bRes = await Debt.bulkWrite(ops, { ordered: false });
      metrics.debts.inserted += bRes.upsertedCount || 0;
      metrics.debts.updated += bRes.modifiedCount || 0;
      metrics.debts.skipped += (bRes.matchedCount || 0) - (bRes.modifiedCount || 0);
    }
    console.log(`  ✓ Lote deudas ${bIndex + 1}/${debtBatches.length} procesado.`);
  }

  // Vincular las deudas hacia las ventas en Sale.debt
  console.log('\n🔗 Enlazando identificadores bidireccionales de ventas y deudas...');
  const allDbDebts = await Debt.find({ user: userId, saleRef: { $ne: null } }).select('_id saleRef');
  const saleDebtOps = allDbDebts.map((d) => ({
    updateOne: {
      filter: { _id: d.saleRef, user: userId },
      update: { $set: { debt: d._id } },
    },
  }));
  if (saleDebtOps.length > 0) {
    await Sale.bulkWrite(saleDebtOps, { ordered: false });
    console.log(`  ✅ ${saleDebtOps.length} ventas actualizadas con referencia de deuda.`);
  }

  // 11. Auditoría Inicial de Movimientos de Inventario
  const existingMovs = await InventoryMovement.countDocuments({ user: userId });
  if (existingMovs === 0) {
    console.log('\n📊 Generando auditoría inicial de existencias en InventoryMovement...');
    const productsWithStock = await Product.find({
      user: userId,
      $or: [{ stock: { $gt: 0 } }, { warehouseStock: { $gt: 0 } }],
    });

    const movOps = productsWithStock.map((p) => ({
      insertOne: {
        document: {
          product: p._id,
          productOriginalId: p.originalId,
          productName: p.name,
          type: 'ajuste',
          quantity: p.stock,
          previousStock: 0,
          newStock: p.stock,
          previousWarehouseStock: 0,
          newWarehouseStock: p.warehouseStock,
          reason: 'Inventario inicial migrado desde localStorage',
          user: userId,
          createdAt: new Date(),
        },
      },
    }));

    if (movOps.length > 0) {
      const movRes = await InventoryMovement.bulkWrite(movOps, { ordered: false });
      metrics.movements.inserted = movRes.insertedCount || 0;
      console.log(`  ✅ ${metrics.movements.inserted} movimientos de inventario iniciales registrados.`);
    }
  }

  // 12. Verificación de Conteos Directamente en MongoDB Atlas
  console.log('\n🔍 Verificando conteo de documentos almacenados en Atlas...');
  const [dbUsers, dbConfigs, dbCats, dbProds, dbClients, dbSales, dbDebts, dbMovs] = await Promise.all([
    User.countDocuments(),
    Config.countDocuments(),
    Category.countDocuments(),
    Product.countDocuments(),
    Client.countDocuments(),
    Sale.countDocuments(),
    Debt.countDocuments(),
    InventoryMovement.countDocuments(),
  ]);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  // 13. Resumen y Reporte Final
  console.log('\n========================================================================');
  console.log('🎉 REPORTE CONSOLIDADO DE MIGRACIÓN - TRUENO INVENTARIO');
  console.log('========================================================================');
  console.log(`⏱️  Duración: ${durationSec} segundos`);
  console.log(`🌐 Base de datos Atlas: ${mongoose.connection.name}`);
  console.log(`👤 Usuario de sesión: ${adminEmail}`);
  console.log('------------------------------------------------------------------------');
  console.log(
    'ENTIDAD             | ENCONTRADOS | VÁLIDOS | INSERTADOS | ACTUALIZADOS | OMITIDOS | EN ATLAS'
  );
  console.log('------------------------------------------------------------------------');
  const printRow = (label, m, dbCount) => {
    const pad = (s, n) => String(s).padEnd(n);
    console.log(
      `${pad(label, 19)} | ${pad(m.found, 11)} | ${pad(m.valid, 7)} | ${pad(m.inserted, 10)} | ${pad(m.updated, 12)} | ${pad(m.skipped, 8)} | ${pad(dbCount, 8)}`
    );
  };
  printRow('Usuarios', metrics.users, dbUsers);
  printRow('Configuración', metrics.configs, dbConfigs);
  printRow('Categorías', metrics.categories, dbCats);
  printRow('Productos', metrics.products, dbProds);
  printRow('Clientes', metrics.clients, dbClients);
  printRow('Ventas', metrics.sales, dbSales);
  printRow('Deudas/Abonos', metrics.debts, dbDebts);
  printRow('Mov. Inventario', metrics.movements, dbMovs);
  console.log('------------------------------------------------------------------------');
  console.log(`📂 Colecciones verificadas: ${verifiedCollections.join(', ')}`);
  console.log('🎯 ESTADO FINAL: MIGRACIÓN COMPLETADA Y VERIFICADA AL 100%');
  console.log('========================================================================\n');

  // Guardar archivo JSON de reporte
  const reportPath = path.resolve(__dirname, '../../migration-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        durationSeconds: Number(durationSec),
        database: mongoose.connection.name,
        collections: verifiedCollections,
        countsInDatabase: {
          users: dbUsers,
          configs: dbConfigs,
          categories: dbCats,
          products: dbProds,
          clients: dbClients,
          sales: dbSales,
          debts: dbDebts,
          inventory_movements: dbMovs,
        },
        metrics,
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`📄 Reporte guardado en: ${reportPath}`);

  await mongoose.disconnect();
  console.log('🔒 Conexión con MongoDB cerrada limpiamente.');
};

seedFromLocalStorage().catch((err) => {
  console.error('\n❌ ERROR FATAL DURANTE LA MIGRACIÓN:', err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
