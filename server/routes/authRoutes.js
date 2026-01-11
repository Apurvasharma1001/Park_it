const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/forgotpassword', require('../controllers/authController').forgotPassword);
router.put('/resetpassword/:resettoken', require('../controllers/authController').resetPassword);
router.get('/me', protect, getMe);

module.exports = router;


