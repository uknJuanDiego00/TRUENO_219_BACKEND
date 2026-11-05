const express = require('express');
const router = express.Router();
const {
  getInventory,
  createMovement,
  getMovements,
  transferStock,
} = require('../controllers/inventory.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', getInventory);
router.post('/movements', createMovement);
router.get('/movements', getMovements);
router.post('/transfer', transferStock);

module.exports = router;

