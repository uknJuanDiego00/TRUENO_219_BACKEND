require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Validate required environment variables
    const requiredEnv = ['MONGODB_URI', 'JWT_SECRET'];
    const missing = requiredEnv.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      console.warn(`⚠️ Advertencia: Faltan variables de entorno requeridas: ${missing.join(', ')}`);
      console.warn('⚠️ Asegúrate de configurar tu archivo .env copiando .env.example');
    }

    // Connect to database
    if (process.env.MONGODB_URI) {
      await connectDB();
    } else {
      console.warn('⚠️ No se ha definido MONGODB_URI. Conexión a MongoDB omitida.');
    }

    const server = app.listen(PORT, () => {
      console.log('====================================================');
      console.log(`⚡ TRUENO INVENTARIO BACKEND`);
      console.log(`🚀 Servidor ejecutándose en el puerto: ${PORT}`);
      console.log(`🌐 URL base: http://localhost:${PORT}/api`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📦 Modo: ${process.env.NODE_ENV || 'development'}`);
      console.log('====================================================');
    });

    const shutdown = () => {
      console.log('\n🛑 Cerrando servidor HTTP y conexiones...');
      server.close(() => {
        console.log('👋 Servidor detenido limpiamente.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();

