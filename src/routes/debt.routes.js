const express = require('express');
const router = express.Router();
const {
  getDebts,
  getDebtSummary,
  getDebtById,
  createDebt,
  addPayment,
} = require('../controllers/debt.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', getDebts);
router.get('/summary', getDebtSummary);
router.get('/:id', getDebtById);
router.post('/', createDebt);
router.post('/:id/payments', addPayment);

module.exports = router;
