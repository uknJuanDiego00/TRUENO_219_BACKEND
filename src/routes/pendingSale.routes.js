const express = require('express');
const router = express.Router();
const {
  getPendingSales,
  createPendingSale,
  updatePendingSale,
  deletePendingSale,
  confirmPendingSale,
} = require('../controllers/pendingSale.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', getPendingSales);
router.post('/', createPendingSale);
router.patch('/:id', updatePendingSale);
router.put('/:id', updatePendingSale);
router.delete('/:id', deletePendingSale);
router.post('/:id/confirm', confirmPendingSale);

module.exports = router;

