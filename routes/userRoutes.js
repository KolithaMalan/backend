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
const { authorize } = require('../middleware/roleMiddleware');
const { validateCreateUser, handleValidationErrors } = require('../utils/validators');

// ✅ All routes require authentication
router.use(protect);

// ✅ UPDATED: Admin + PM have FULL access to all user operations
router.get('/', authorize('admin', 'project_manager'), getUsers);
router.get('/counts', authorize('admin', 'project_manager'), getUserCounts);
router.get('/drivers', authorize('admin', 'project_manager'), getDrivers);
router.get('/drivers/available', authorize('admin', 'project_manager'), getAvailableDrivers);
router.get('/drivers/:id/stats', authorize('admin', 'project_manager'), getDriverStats);

// ✅ UPDATED: PM can now CREATE users
router.post('/', authorize('admin', 'project_manager'), validateCreateUser, handleValidationErrors, createUser);

// ✅ UPDATED: PM can now view/edit/delete individual users
router.get('/:id', authorize('admin', 'project_manager'), getUser);
router.put('/:id', authorize('admin', 'project_manager'), updateUser);
router.delete('/:id', authorize('admin', 'project_manager'), deleteUser);
router.put('/:id/reset-password', authorize('admin', 'project_manager'), resetUserPassword);

module.exports = router;
