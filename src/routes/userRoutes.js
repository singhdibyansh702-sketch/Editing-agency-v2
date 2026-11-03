const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All user management routes require ADMIN
router.use(authenticate, requireAdmin);

// Clients
router.get('/clients', userController.getClients);
router.get('/clients/:id', userController.getClientById);
router.post('/clients', userController.createClient);
router.put('/clients/:id', userController.updateClient);

// Editors
router.get('/editors', userController.getEditors);
router.get('/editors/:id', userController.getEditorById);
router.post('/editors', userController.createEditor);
router.put('/editors/:id', userController.updateEditor);

// User status toggle
router.patch('/:id/toggle-status', userController.toggleUserStatus);

module.exports = router;

