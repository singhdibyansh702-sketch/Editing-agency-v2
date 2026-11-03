const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/inspect', videoController.inspectVideo);

module.exports = router;

