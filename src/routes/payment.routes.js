const express = require('express');
const router = express.Router();
const { getPayments, createPayment } = require('../controllers/payment.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', getPayments);
router.post('/', createPayment);

module.exports = router;

