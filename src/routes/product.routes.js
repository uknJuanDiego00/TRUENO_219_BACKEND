const express = require('express');
const router = express.Router();
const {
  getProducts,
  getLowStockProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustProductStock,
  transferProductStock,
} = require('../controllers/product.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', getProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/adjust-stock', adjustProductStock);
router.post('/:id/transfer-stock', transferProductStock);

module.exports = router;
