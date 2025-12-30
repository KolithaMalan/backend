const express = require('express');
const router = express.Router();
const {
    createRide,
    getRides,
    getRide,
    getRidesAwaitingPM,
    getRidesAwaitingAdmin,
    getRidesReadyForAssignment,
    pmApproveRide,
    pmRejectRide,
    adminApproveRide,
    adminRejectRide,
    assignDriverAndVehicle,
    reassignDriverAndVehicle,
    startRide,
    completeRide,
    cancelRide,
    getMyRideStats,
    getDriverAssignedRides,
    getDriverDailyRides,
    getAvailableDrivers,
    getAvailableVehicles
} = require('../controllers/rideController');
const { protect } = require('../middleware/authMiddleware');
const { authorize, isAdmin, isProjectManager, isDriver } = require('../middleware/roleMiddleware');
const { validateRideRequest, handleValidationErrors } = require('../utils/validators');

// All routes require authentication
router.use(protect);

// General ride routes
router.post('/', validateRideRequest, handleValidationErrors, createRide);
router.get('/', getRides);
router.get('/my-stats', getMyRideStats);

// PM specific routes
router.get('/awaiting-pm', authorize('project_manager'), getRidesAwaitingPM);
router.put('/:id/pm-approve', authorize('project_manager'), pmApproveRide);
router.put('/:id/pm-reject', authorize('project_manager'), pmRejectRide);

// Admin specific routes
router.get('/awaiting-admin', authorize('admin'), getRidesAwaitingAdmin);
router.get('/ready-for-assignment', authorize('admin'), getRidesReadyForAssignment);
router.put('/:id/admin-approve', authorize('admin'), adminApproveRide);
router.put('/:id/admin-reject', authorize('admin'), adminRejectRide);
router.put('/:id/assign', authorize('admin'), assignDriverAndVehicle);
router.put('/:id/reassign', authorize('admin'), reassignDriverAndVehicle);

// Admin helper routes
router.get('/available-drivers', authorize('admin'), getAvailableDrivers);
router.get('/available-vehicles', authorize('admin'), getAvailableVehicles);

// Driver specific routes
router.get('/driver/assigned', authorize('driver'), getDriverAssignedRides);
router.get('/driver/daily', authorize('driver'), getDriverDailyRides);
router.put('/:id/start', authorize('driver'), startRide);
router.put('/:id/complete', authorize('driver'), completeRide);

// User routes
router.put('/:id/cancel', cancelRide);

// Get single ride (must be last due to :id param)
router.get('/:id', getRide);

module.exports = router;