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

// ✅ CRITICAL: Specific routes MUST come before :id routes

// ✅ Collection routes - Admin + PM have full access
router.get('/', authorize('admin', 'project_manager'), getVehicles);
router.post('/', authorize('admin', 'project_manager'), createVehicle); // ✅ PM can create

// ✅ Specific static routes
router.get('/available', authorize('admin', 'project_manager'), getAvailableVehicles);
router.get('/counts', authorize('admin', 'project_manager'), getVehicleCounts);
router.get('/mileage-summary', authorize('admin', 'project_manager'), getVehicleMileageSummary);
router.post('/reset-monthly-mileage', authorize('admin', 'project_manager'), resetMonthlyMileage); // ✅ PM can reset

// ✅ Routes with :id parameters (must come after static routes)
router.get('/:id/stats', authorize('admin', 'project_manager'), getVehicleStats);
router.put('/:id/maintenance', authorize('admin', 'project_manager'), setMaintenance); // ✅ PM can set maintenance

// ✅ Single resource routes - PM can edit/delete
router.get('/:id', authorize('admin', 'project_manager'), getVehicle);
router.put('/:id', authorize('admin', 'project_manager'), updateVehicle); // ✅ PM can update
router.delete('/:id', authorize('admin', 'project_manager'), deleteVehicle); // ✅ PM can delete

module.exports = router;
