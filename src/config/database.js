
require('dotenv').config();

const mongoose = require('mongoose');

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || typeof uri !== 'string') {
    throw new Error('La variable MONGODB_URI no está configurada.');
  }

  const cleanUri = uri.trim();

  if (
    !cleanUri.startsWith('mongodb://') &&
    !cleanUri.startsWith('mongodb+srv://')
  ) {
    throw new Error(
      'MONGODB_URI debe comenzar con mongodb:// o mongodb+srv://'
    );
  }

  return cleanUri;
};

const connectDB = async () => {
  try {
    const mongoUri = getMongoUri();

    // No mostrar la cadena de conexión ni las credenciales.
    console.log('📡 Conectando a MongoDB Atlas...');

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ MongoDB Atlas conectado correctamente.');
    console.log(`📦 Host: ${conn.connection.host}`);
    console.log(`📂 Base de datos: ${conn.connection.name}`);

    mongoose.connection.on('error', (error) => {
      console.error('❌ Error de MongoDB:', error.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ Conexión con MongoDB desconectada.');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconectado.');
    });

    return conn;
  } catch (error) {
    console.error('❌ Error de conexión con MongoDB:', error.message);

    if (error.reason?.servers) {
      for (const [address, server] of error.reason.servers) {
        console.error(
          `Servidor ${address}:`,
          server.error?.message || server.type
        );
      }
    }

    throw error;
  }
};

module.exports = connectDB;
