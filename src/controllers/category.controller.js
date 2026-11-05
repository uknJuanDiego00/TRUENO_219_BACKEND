const Category = require('../models/Category');
const Product = require('../models/Product');
const ApiResponse = require('../utils/apiResponse');
const { asyncHandler, createError } = require('../utils/helpers');

/**
 * @route GET /api/categories
 */
const getCategories = asyncHandler(async (req, res) => {
  // Combine custom Category documents and categories in Products
  const [storedCats, productCats] = await Promise.all([
    Category.find({ user: req.user._id }).sort({ name: 1 }),
    Product.distinct('category', { user: req.user._id }),
  ]);

  const catNames = new Set(storedCats.map((c) => c.name));
  for (const pc of productCats) {
    if (pc && pc.trim()) catNames.add(pc.trim());
  }

  const result = Array.from(catNames).sort();
  return ApiResponse.success(res, result);
});

/**
 * @route POST /api/categories
 */
const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    throw createError('El nombre de la categoría es obligatorio', 400);
  }

  const existing = await Category.findOne({
    name: name.trim(),
    user: req.user._id,
  });

  if (existing) {
    throw createError('La categoría ya existe', 400);
  }

  const category = await Category.create({
    name: name.trim(),
    description: description || '',
    user: req.user._id,
  });

  return ApiResponse.success(res, category, 'Categoría creada exitosamente', 201);
});

/**
 * @route DELETE /api/categories/:name
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const { name } = req.params;
  await Category.findOneAndDelete({ name, user: req.user._id });
  return ApiResponse.success(res, null, 'Categoría eliminada exitosamente');
});

module.exports = {
  getCategories,
  createCategory,
  deleteCategory,
};

