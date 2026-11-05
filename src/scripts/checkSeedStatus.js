require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Sale = require('../models/Sale');
const Debt = require('../models/Debt');
const Category = require('../models/Category');
const Config = require('../models/Config');
const InventoryMovement = require('../models/InventoryMovement');

const checkStatus = async () => {
  console.log('====================================================');
  console.log('🔍 VERIFICACIÓN DE ESTADO DE LA BASE DE DATOS MONGODB');
  console.log('====================================================');

  await connectDB();

  const [
    usersCount,
    productsCount,
    clientsCount,
    salesCount,
    debtsCount,
    categoriesCount,
    configsCount,
    movementsCount,
  ] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments(),
    Client.countDocuments(),
    Sale.countDocuments(),
    Debt.countDocuments(),
    Category.countDocuments(),
    Config.countDocuments(),
    InventoryMovement.countDocuments(),
  ]);

  console.log('\n📊 CONTEO DE DOCUMENTOS EN COLECCIONES:');
  console.log(`  👤 Usuarios:                ${usersCount}`);
  console.log(`  🏷️ Categorías:              ${categoriesCount}`);
  console.log(`  📦 Productos:               ${productsCount}`);
  console.log(`  👥 Clientes:                ${clientsCount}`);
  console.log(`  💳 Ventas:                  ${salesCount}`);
  console.log(`  📋 Deudas:                  ${debtsCount}`);
  console.log(`  ⚙️ Configuraciones:         ${configsCount}`);
  console.log(`  🔄 Movimientos Inventario:  ${movementsCount}`);

  // Check sample relationships
  const sampleSale = await Sale.findOne({ clientRef: { $ne: null } }).populate('clientRef');
  if (sampleSale) {
    console.log('\n🔗 Integridad de Referencias (Venta -> Cliente):');
    console.log(`  Venta #${sampleSale.originalId} asociada a cliente: ${sampleSale.clientRef.name} (Doc: ${sampleSale.clientRef.document})`);
  }

  const sampleDebt = await Debt.findOne({ saleRef: { $ne: null } }).populate('saleRef');
  if (sampleDebt) {
    console.log('\n🔗 Integridad de Referencias (Deuda -> Venta):');
    console.log(`  Deuda #${sampleDebt.originalId} asociada a venta #${sampleDebt.saleRef.originalId} (Total: $${sampleDebt.total}, Saldo: $${sampleDebt.balance})`);
  }

  console.log('\n====================================================');
  await mongoose.disconnect();
};

checkStatus().catch((err) => {
  console.error('❌ Error verificando estado:', err.message);
  process.exit(1);
});

