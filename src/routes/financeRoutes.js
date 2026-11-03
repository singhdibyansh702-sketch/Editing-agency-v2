const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All finance management routes are strictly ADMIN ONLY
router.use(authenticate, requireAdmin);

router.get('/overview', financeController.getFinancialOverview);
router.get('/ledger', financeController.getLedger);
router.post('/record-payment', financeController.recordPayment);

module.exports = router;

