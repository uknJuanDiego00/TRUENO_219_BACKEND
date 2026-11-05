const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acceso no autorizado. Inicia sesión para continuar.',
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'El usuario ya no existe en el sistema.',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Esta cuenta ha sido desactivada.',
        });
      }

      req.user = user;
      next();
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado. Vuelve a iniciar sesión.',
      });
    }
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'No cuentas con los permisos requeridos para esta operación.',
      });
    }
    next();
  };
};

module.exports = { protect, authorize };

