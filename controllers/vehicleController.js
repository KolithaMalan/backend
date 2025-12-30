const Vehicle = require('../models/Vehicle');
const Ride = require('../models/Ride');
const { getMonthRange } = require('../utils/helpers');

// @desc    Get all vehicles
// @route   GET /api/vehicles
// @access  Private (Admin only)
const getVehicles = async (req, res) => {
    try {
        const { status, type, search } = req.query;

        let query = { isActive: true };

        if (status) {
            query.status = status;
        }

        if (type) {
            query.type = type;
        }

        if (search) {
            query.vehicleNumber = { $regex: search, $options: 'i' };
        }

        const vehicles = await Vehicle.find(query)
            .populate('currentDriver', 'name email phone')
            .sort({ vehicleNumber: 1 });

        res.status(200).json({
            success: true,
            count: vehicles.length,
            vehicles
        });
    } catch (error) {
        console.error('Get vehicles error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get single vehicle
// @route   GET /api/vehicles/:id
// @access  Private (Admin only)
const getVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id)
            .populate('currentDriver', 'name email phone')
            .populate('currentRide');

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        res.status(200).json({
            success: true,
            vehicle
        });
    } catch (error) {
        console.error('Get vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Create new vehicle
// @route   POST /api/vehicles
// @access  Private (Admin only)
const createVehicle = async (req, res) => {
    try {
        const { vehicleNumber, type } = req.body;

        // Check if vehicle exists
        const existingVehicle = await Vehicle.findOne({ 
            vehicleNumber: vehicleNumber.toUpperCase() 
        });

        if (existingVehicle) {
            return res.status(400).json({
                success: false,
                message: 'Vehicle with this number already exists'
            });
        }

        const vehicle = await Vehicle.create({
            vehicleNumber: vehicleNumber.toUpperCase(),
            type: type || 'Car',
            status: 'available'
        });

        res.status(201).json({
            success: true,
            message: 'Vehicle created successfully',
            vehicle
        });
    } catch (error) {
        console.error('Create vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Update vehicle
// @route   PUT /api/vehicles/:id
// @access  Private (Admin only)
const updateVehicle = async (req, res) => {
    try {
        const { vehicleNumber, type, status } = req.body;

        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        // Check if new vehicle number is taken
        if (vehicleNumber && vehicleNumber.toUpperCase() !== vehicle.vehicleNumber) {
            const existingVehicle = await Vehicle.findOne({ 
                vehicleNumber: vehicleNumber.toUpperCase() 
            });
            if (existingVehicle) {
                return res.status(400).json({
                    success: false,
                    message: 'Vehicle number already exists'
                });
            }
            vehicle.vehicleNumber = vehicleNumber.toUpperCase();
        }

        if (type) vehicle.type = type;
        
        // Status change validation
        if (status) {
            if (status === 'available' && vehicle.status === 'busy') {
                // Check if vehicle has active rides
                const activeRides = await Ride.countDocuments({
                    assignedVehicle: vehicle._id,
                    status: { $in: ['assigned', 'in_progress'] }
                });

                if (activeRides > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot set status to available while vehicle has active rides'
                    });
                }
            }
            vehicle.status = status;
        }

        await vehicle.save();

        res.status(200).json({
            success: true,
            message: 'Vehicle updated successfully',
            vehicle
        });
    } catch (error) {
        console.error('Update vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Delete vehicle (soft delete)
// @route   DELETE /api/vehicles/:id
// @access  Private (Admin only)
const deleteVehicle = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        // Check if vehicle has active rides
        const activeRides = await Ride.countDocuments({
            assignedVehicle: vehicle._id,
            status: { $in: ['assigned', 'in_progress'] }
        });

        if (activeRides > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete vehicle with active rides'
            });
        }

        // Soft delete
        vehicle.isActive = false;
        await vehicle.save();

        res.status(200).json({
            success: true,
            message: 'Vehicle deleted successfully'
        });
    } catch (error) {
        console.error('Delete vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get available vehicles
// @route   GET /api/vehicles/available
// @access  Private (Admin only)
const getAvailableVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find({
            isActive: true,
            status: 'available'
        }).sort({ vehicleNumber: 1 });

        res.status(200).json({
            success: true,
            count: vehicles.length,
            vehicles
        });
    } catch (error) {
        console.error('Get available vehicles error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get vehicle statistics
// @route   GET /api/vehicles/:id/stats
// @access  Private (Admin, PM)
const getVehicleStats = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        // Get ride statistics
        const totalRides = await Ride.countDocuments({ 
            assignedVehicle: vehicle._id 
        });

        const completedRides = await Ride.countDocuments({ 
            assignedVehicle: vehicle._id,
            status: 'completed'
        });

        // Get monthly stats
        const { start, end } = getMonthRange();

        const monthlyRides = await Ride.countDocuments({
            assignedVehicle: vehicle._id,
            status: 'completed',
            endTime: { $gte: start, $lte: end }
        });

        const monthlyDistanceResult = await Ride.aggregate([
            { 
                $match: { 
                    assignedVehicle: vehicle._id, 
                    status: 'completed',
                    endTime: { $gte: start, $lte: end }
                } 
            },
            { $group: { _id: null, distance: { $sum: '$actualDistance' } } }
        ]);

        const monthlyDistance = monthlyDistanceResult.length > 0 
            ? monthlyDistanceResult[0].distance 
            : 0;

        res.status(200).json({
            success: true,
            vehicle: {
                id: vehicle._id,
                vehicleNumber: vehicle.vehicleNumber,
                type: vehicle.type,
                status: vehicle.status
            },
            stats: {
                totalRides,
                completedRides,
                totalMileage: vehicle.totalMileage,
                monthlyMileage: vehicle.monthlyMileage,
                monthlyRides,
                calculatedMonthlyDistance: Math.round(monthlyDistance * 10) / 10
            }
        });
    } catch (error) {
        console.error('Get vehicle stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get all vehicles mileage summary
// @route   GET /api/vehicles/mileage-summary
// @access  Private (Admin, PM)
const getVehicleMileageSummary = async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ isActive: true })
            .select('vehicleNumber type totalMileage monthlyMileage totalRides status')
            .sort({ vehicleNumber: 1 });

        // Calculate totals
        const totals = vehicles.reduce((acc, v) => {
            acc.totalMileage += v.totalMileage;
            acc.monthlyMileage += v.monthlyMileage;
            acc.totalRides += v.totalRides;
            return acc;
        }, { totalMileage: 0, monthlyMileage: 0, totalRides: 0 });

        // Get active vehicles count
        const activeVehicles = vehicles.filter(v => v.status !== 'maintenance').length;

        res.status(200).json({
            success: true,
            summary: {
                totalVehicles: vehicles.length,
                activeVehicles,
                totalMileage: Math.round(totals.totalMileage * 10) / 10,
                monthlyMileage: Math.round(totals.monthlyMileage * 10) / 10,
                totalRides: totals.totalRides
            },
            vehicles
        });
    } catch (error) {
        console.error('Get mileage summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Reset monthly mileage for all vehicles
// @route   POST /api/vehicles/reset-monthly-mileage
// @access  Private (Admin only)
const resetMonthlyMileage = async (req, res) => {
    try {
        await Vehicle.updateMany(
            { isActive: true },
            { 
                monthlyMileage: 0,
                lastMileageReset: new Date()
            }
        );

        res.status(200).json({
            success: true,
            message: 'Monthly mileage reset for all vehicles'
        });
    } catch (error) {
        console.error('Reset mileage error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get vehicle counts
// @route   GET /api/vehicles/counts
// @access  Private (Admin only)
const getVehicleCounts = async (req, res) => {
    try {
        const total = await Vehicle.countDocuments({ isActive: true });
        const available = await Vehicle.countDocuments({ isActive: true, status: 'available' });
        const busy = await Vehicle.countDocuments({ isActive: true, status: 'busy' });
        const maintenance = await Vehicle.countDocuments({ isActive: true, status: 'maintenance' });

        res.status(200).json({
            success: true,
            counts: {
                total,
                available,
                busy,
                maintenance
            }
        });
    } catch (error) {
        console.error('Get vehicle counts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Set vehicle to maintenance
// @route   PUT /api/vehicles/:id/maintenance
// @access  Private (Admin only)
const setMaintenance = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);

        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: 'Vehicle not found'
            });
        }

        // Check for active rides
        const activeRides = await Ride.countDocuments({
            assignedVehicle: vehicle._id,
            status: { $in: ['assigned', 'in_progress'] }
        });

        if (activeRides > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot set maintenance status while vehicle has active rides'
            });
        }

        vehicle.status = 'maintenance';
        vehicle.currentDriver = null;
        vehicle.currentRide = null;
        await vehicle.save();

        res.status(200).json({
            success: true,
            message: 'Vehicle set to maintenance',
            vehicle
        });
    } catch (error) {
        console.error('Set maintenance error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
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
};