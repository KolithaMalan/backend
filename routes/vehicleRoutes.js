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

// ✅ All routes require authentication
router.use(protect);

// ✅ CRITICAL: Specific routes MUST come before /:id routes
// Otherwise "counts" will be treated as an ID!

// Collection routes (no ID)
router.get('/', authorize('admin', 'project_manager'), getVehicles);
router.post('/', authorize('admin'), createVehicle);

// Specific static routes (exact match required)
router.get('/available', authorize('admin'), getAvailableVehicles);
router.get('/counts', authorize('admin', 'project_manager'), getVehicleCounts);
router.get('/mileage-summary', authorize('admin', 'project_manager'), getVehicleMileageSummary);
router.post('/reset-monthly-mileage', authorize('admin'), resetMonthlyMileage);

// ✅ IMPORTANT: /:id/stats MUST come before /:id
router.get('/:id/stats', authorize('admin', 'project_manager'), getVehicleStats);
router.put('/:id/maintenance', authorize('admin'), setMaintenance);

// ✅ Single resource routes (these catch everything else)
router.get('/:id', authorize('admin', 'project_manager'), getVehicle);
router.put('/:id', authorize('admin'), updateVehicle);
router.delete('/:id', authorize('admin'), deleteVehicle);

module.exports = router;
