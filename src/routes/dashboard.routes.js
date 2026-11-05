const express = require('express');
const router = express.Router();
const {
  getSummary,
  getTopProducts,
  getSalesByPeriod,
} = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/summary', getSummary);
router.get('/top-products', getTopProducts);
router.get('/sales-by-period', getSalesByPeriod);

module.exports = router;
