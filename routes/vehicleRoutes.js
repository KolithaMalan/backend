const express = require('express');
const router = express.Router();
const {
    getVehicles,
    getVehicle,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getAvailableVehicles,
    getVehicleStats,
    getVehicleMileageSummary,
    resetMonthlyMileage,
    getVehicleCounts,
    setMaintenance
} = require('../controllers/vehicleController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(protect);

// Get routes (Admin and PM can view)
router.get('/', authorize('admin', 'project_manager'), getVehicles);
router.get('/available', authorize('admin'), getAvailableVehicles);
router.get('/counts', authorize('admin', 'project_manager'), getVehicleCounts);
router.get('/mileage-summary', authorize('admin', 'project_manager'), getVehicleMileageSummary);

// Admin only routes
router.post('/', authorize('admin'), createVehicle);
router.post('/reset-monthly-mileage', authorize('admin'), resetMonthlyMileage);

// Single vehicle operations
router.get('/:id', authorize('admin', 'project_manager'), getVehicle);
router.get('/:id/stats', authorize('admin', 'project_manager'), getVehicleStats);
router.put('/:id', authorize('admin'), updateVehicle);
router.delete('/:id', authorize('admin'), deleteVehicle);
router.put('/:id/maintenance', authorize('admin'), setMaintenance);

module.exports = router;