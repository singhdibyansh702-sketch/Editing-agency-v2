const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.use(authenticate, requireAdmin);

router.get('/', auditController.getAuditLogs);

module.exports = router;

