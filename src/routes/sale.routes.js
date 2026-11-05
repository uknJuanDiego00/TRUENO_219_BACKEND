const express = require('express');
const router = express.Router();
const {
  getSales,
  getSaleById,
  createSale,
  cancelSale,
} = require('../controllers/sale.controller');
const { protect } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { createSaleSchema } = require('../validators/sale.validators');

router.use(protect);

router.get('/', getSales);
router.get('/:id', getSaleById);
router.post('/', validate(createSaleSchema), createSale);
router.post('/:id/cancel', cancelSale);

module.exports = router;

