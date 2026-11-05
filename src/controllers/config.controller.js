const Config = require('../models/Config');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, createError } = require('../utils/helpers');

/**
 * @route GET /api/config
 */
const getConfig = asyncHandler(async (req, res) => {
  let config = await Config.findOne({ user: req.user._id });
  if (!config) {
    config = await Config.create({
      user: req.user._id,
      storeName: 'Trueno 219',
      lowStockThreshold: 2,
      currency: 'COP',
      taxRate: 0,
    });
  }

  return ApiResponse.success(res, config);
});

/**
 * @route PUT /api/config
 */
const updateConfig = asyncHandler(async (req, res) => {
  const allowed = ['storeName', 'lowStockThreshold', 'currency', 'taxRate'];
  const updateData = {};

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  const config = await Config.findOneAndUpdate(
    { user: req.user._id },
    { $set: updateData },
    { new: true, upsert: true, runValidators: true }
  );

  return ApiResponse.success(res, config, 'Configuración actualizada exitosamente');
});

module.exports = {
  getConfig,
  updateConfig,
};

