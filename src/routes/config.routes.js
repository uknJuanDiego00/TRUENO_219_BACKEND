const express = require('express');
const router = express.Router();
const { getConfig, updateConfig } = require('../controllers/config.controller');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', getConfig);
router.put('/', updateConfig);
router.patch('/', updateConfig);

module.exports = router;
