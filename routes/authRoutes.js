const express = require('express');
const router = express.Router();
const {
    register,
    login,
    logout,
    getMe,
    updateProfile,
    changePassword
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { 
    validateRegister, 
    validateLogin, 
    handleValidationErrors 
} = require('../utils/validators');

// Public routes
router.post('/register', validateRegister, handleValidationErrors, register);
router.post('/login', validateLogin, handleValidationErrors, login);

// Protected routes
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

module.exports = router;