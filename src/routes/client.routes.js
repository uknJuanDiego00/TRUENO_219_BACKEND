const express = require('express');
const router = express.Router();
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientSales,
  getClientDebts,
} = require('../controllers/client.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', createClient);
router.put('/:id', updateClient);
router.patch('/:id', updateClient);
router.delete('/:id', deleteClient);
router.get('/:id/sales', getClientSales);
router.get('/:id/debts', getClientDebts);

module.exports = router;
