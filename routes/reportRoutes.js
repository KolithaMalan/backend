const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getMonthlyRideReport,
    getDriverPerformanceReport,
    getVehicleUsageReport,
    getRideHistory,
    exportReport,
    getMyRideHistory
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(protect);

// Personal history (all authenticated users)
router.get('/my-history', getMyRideHistory);

// Dashboard stats (Admin and PM)
router.get('/dashboard-stats', authorize('admin', 'project_manager'), getDashboardStats);

// Reports (Admin and PM only)
router.get('/monthly-rides', authorize('admin', 'project_manager'), getMonthlyRideReport);
router.get('/driver-performance', authorize('admin', 'project_manager'), getDriverPerformanceReport);
router.get('/vehicle-usage', authorize('admin', 'project_manager'), getVehicleUsageReport);
router.get('/ride-history', authorize('admin', 'project_manager'), getRideHistory);

// Export reports
router.get('/export/:type', authorize('admin', 'project_manager'), exportReport);

module.exports = router;