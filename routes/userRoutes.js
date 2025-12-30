const express = require('express');
const router = express.Router();
const {
    getUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    getDrivers,
    getAvailableDrivers,
    getDriverStats,
    resetUserPassword,
    getUserCounts
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { authorize, isAdmin } = require('../middleware/roleMiddleware');
const { validateCreateUser, handleValidationErrors } = require('../utils/validators');

// All routes require authentication
router.use(protect);

// Admin only routes
router.get('/', authorize('admin'), getUsers);
router.get('/counts', authorize('admin'), getUserCounts);
router.get('/drivers', authorize('admin', 'project_manager'), getDrivers);
router.get('/drivers/available', authorize('admin'), getAvailableDrivers);
router.post('/', authorize('admin'), validateCreateUser, handleValidationErrors, createUser);

// Get driver stats (Admin and PM)
router.get('/drivers/:id/stats', authorize('admin', 'project_manager'), getDriverStats);

// Single user operations
router.get('/:id', authorize('admin'), getUser);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);
router.put('/:id/reset-password', authorize('admin'), resetUserPassword);

module.exports = router;