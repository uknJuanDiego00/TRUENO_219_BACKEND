require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

// Configuración de DNS pública para evitar errores ECONNREFUSED en Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignorar si no es soportado
}

/**
 * Normaliza y valida la URI de conexión a MongoDB
 */
const getCleanMongoUri = () => {
  let uri = process.env.MONGODB_URI;

  if (!uri || typeof uri !== 'string') {
    throw new Error('MONGODB_URI no está definida o está vacía en las variables de entorno (.env)');
  }

  uri = uri.trim();

  // Limpiar si el usuario copió accidentalmente "MONGODB_URI=" al pegar
  if (uri.startsWith('MONGODB_URI=')) {
    uri = uri.replace(/^MONGODB_URI=/, '').trim();
  }

  // Quitar comillas si las hay
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error(
      `Esquema inválido en MONGODB_URI. La cadena debe comenzar con "mongodb://" o "mongodb+srv://". Recibido: "${uri.substring(0, 15)}..."`
    );
  }

  return uri;
};

const connectDB = async () => {
  try {
    const mongoUri = getCleanMongoUri();

    // Máscara para no exponer contraseñas en los logs
    const maskedUri = mongoUri.replace(/:([^@]+)@/, ':****@');
    console.log(`📡 Conectando a MongoDB Atlas: ${maskedUri}`);

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 15,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
    });

    console.log(`✅ Conexión establecida con MongoDB Atlas`);
    console.log(`📦 Host: ${conn.connection.host}`);
    console.log(`📂 Base de datos: ${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ Error en tiempo de ejecución de MongoDB:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ Conexión con MongoDB perdida. Reintentando automáticamente...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconectado exitosamente');
    });

    return conn;
  } catch (error) {
    console.error('❌ Error de conexión con MongoDB:', error.message);
    throw error;
  }
};

module.exports = connectDB;
