const User = require('../models/User');
const Config = require('../models/Config');
const { generateToken, asyncHandler, createError } = require('../utils/helpers');
const ApiResponse = require('../utils/apiResponse');

/**
 * @route POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { name, full_name, email, password, storeName, role } = req.body;
  const userName = name || full_name;

  if (!userName || !email || !password) {
    throw createError('Nombre, correo y contraseña son obligatorios', 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw createError('El correo electrónico ya está registrado', 400);
  }

  const user = await User.create({
    name: userName,
    email: email.toLowerCase(),
    password,
    storeName: storeName || 'Trueno 219',
    role: role || 'admin',
  });

  // Initialize user config with default store preferences
  await Config.create({
    user: user._id,
    storeName: user.storeName,
    lowStockThreshold: 2,
    currency: 'COP',
    taxRate: 0,
    idCounters: {
      product: 0,
      client: 0,
      sale: 0,
      debt: 0,
      payment: 0,
      pending_sale: 0,
    },
  });

  const token = generateToken(user._id);

  return ApiResponse.success(
    res,
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeName: user.storeName,
      },
      token,
    },
    'Usuario registrado exitosamente',
    201
  );
});

/**
 * @route POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw createError('Ingresa correo y contraseña', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    throw createError('Credenciales incorrectas', 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw createError('Credenciales incorrectas', 401);
  }

  if (!user.isActive) {
    throw createError('Cuenta desactivada. Contacta al administrador', 403);
  }

  const token = generateToken(user._id);

  return ApiResponse.success(
    res,
    {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        storeName: user.storeName,
      },
      token,
    },
    'Inicio de sesión exitoso'
  );
});

/**
 * @route GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const config = await Config.findOne({ user: req.user._id });

  return ApiResponse.success(res, {
    user,
    config,
  });
});

/**
 * @route POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  return ApiResponse.success(res, null, 'Sesión cerrada exitosamente');
});

module.exports = {
  register,
  login,
  getMe,
  logout,
};
