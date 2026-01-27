const express = require('express');
const router = express.Router();
const {
    getAllVehiclesTracking,
    getVehicleTracking,
    getActiveRidesTracking,
    getTrackingStats,
    getRawTrackingData,
    getRideETA
} = require('../controllers/trackingController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(protect);

// Get tracking statistics
router.get('/stats', authorize('admin', 'project_manager'), getTrackingStats);

// Get all vehicles with tracking data
router.get('/vehicles', authorize('admin', 'project_manager'), getAllVehiclesTracking);

// Get active rides with tracking
router.get('/active-rides', authorize('admin', 'project_manager'), getActiveRidesTracking);

// Get raw tracking data (admin only - for debugging)
router.get('/raw', authorize('admin'), getRawTrackingData);

// Get single vehicle tracking
router.get('/vehicles/:id', authorize('admin', 'project_manager'), getVehicleTracking);

// Get ETA for a specific ride
router.get('/rides/:id/eta', authorize('admin', 'project_manager', 'driver'), getRideETA);

module.exports = router;