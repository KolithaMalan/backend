const trackingService = require('../services/trackingService');
const Ride = require('../models/Ride');

// @desc    Get all vehicles with tracking data
// @route   GET /api/tracking/vehicles
// @access  Private (Admin, PM)
const getAllVehiclesTracking = async (req, res) => {
    try {
        const { status, type, online } = req.query;
        
        let vehicles = await trackingService.getAllVehiclesWithTracking();

        // Apply filters
        if (status) {
            vehicles = vehicles.filter(v => v.status === status);
        }

        if (type) {
            vehicles = vehicles.filter(v => v.type === type);
        }

        if (online !== undefined) {
            const isOnline = online === 'true';
            vehicles = vehicles.filter(v => 
                v.hasTracking && v.tracking?.isOnline === isOnline
            );
        }

        res.status(200).json({
            success: true,
            count: vehicles.length,
            vehicles
        });
    } catch (error) {
        console.error('Get all vehicles tracking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tracking data',
            error: error.message
        });
    }
};

// @desc    Get single vehicle tracking
// @route   GET /api/tracking/vehicles/:id
// @access  Private (Admin, PM)
const getVehicleTracking = async (req, res) => {
    try {
        const vehicle = await trackingService.getVehicleTracking(req.params.id);

        res.status(200).json({
            success: true,
            vehicle
        });
    } catch (error) {
        console.error('Get vehicle tracking error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch vehicle tracking',
            error: error.message
        });
    }
};

// @desc    Get active rides with tracking
// @route   GET /api/tracking/active-rides
// @access  Private (Admin, PM)
const getActiveRidesTracking = async (req, res) => {
    try {
        const rides = await trackingService.getActiveRideVehicles();

        // Calculate ETA for each ride if destination coordinates are available
        const ridesWithETA = rides.map(ride => {
            let eta = null;
            
            if (ride.tracking && ride.destinationLocation?.coordinates) {
                eta = trackingService.calculateETA(
                    ride.tracking.latitude,
                    ride.tracking.longitude,
                    ride.destinationLocation.coordinates.lat,
                    ride.destinationLocation.coordinates.lng,
                    ride.tracking.speed
                );
            }

            return {
                ...ride,
                eta
            };
        });

        res.status(200).json({
            success: true,
            count: ridesWithETA.length,
            rides: ridesWithETA
        });
    } catch (error) {
        console.error('Get active rides tracking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch active rides tracking',
            error: error.message
        });
    }
};

// @desc    Get tracking statistics
// @route   GET /api/tracking/stats
// @access  Private (Admin, PM)
const getTrackingStats = async (req, res) => {
    try {
        const stats = await trackingService.getTrackingStats();

        // Also get active rides count
        const activeRidesCount = await Ride.countDocuments({
            status: { $in: ['assigned', 'in_progress'] }
        });

        res.status(200).json({
            success: true,
            stats: {
                ...stats,
                activeRides: activeRidesCount
            }
        });
    } catch (error) {
        console.error('Get tracking stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tracking statistics',
            error: error.message
        });
    }
};

// @desc    Get raw tracking data (for debugging)
// @route   GET /api/tracking/raw
// @access  Private (Admin only)
const getRawTrackingData = async (req, res) => {
    try {
        const data = await trackingService.fetchFromAPI();

        res.status(200).json({
            success: true,
            count: Array.isArray(data) ? data.length : 0,
            data
        });
    } catch (error) {
        console.error('Get raw tracking data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch raw tracking data',
            error: error.message
        });
    }
};

// @desc    Calculate ETA for a specific ride
// @route   GET /api/tracking/rides/:id/eta
// @access  Private (Admin, PM, Driver)
const getRideETA = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id)
            .populate('assignedVehicle', 'vehicleNumber');

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        if (!ride.assignedVehicle) {
            return res.status(400).json({
                success: false,
                message: 'No vehicle assigned to this ride'
            });
        }

        const vehicleWithTracking = await trackingService.getVehicleTracking(ride.assignedVehicle._id);

        if (!vehicleWithTracking.hasTracking) {
            return res.status(400).json({
                success: false,
                message: 'No tracking data available for this vehicle'
            });
        }

        const destCoords = ride.destinationLocation?.coordinates;
        if (!destCoords) {
            return res.status(400).json({
                success: false,
                message: 'Destination coordinates not available'
            });
        }

        const eta = trackingService.calculateETA(
            vehicleWithTracking.tracking.latitude,
            vehicleWithTracking.tracking.longitude,
            destCoords.lat,
            destCoords.lng,
            vehicleWithTracking.tracking.speed
        );

        res.status(200).json({
            success: true,
            rideId: ride.rideId,
            vehicle: vehicleWithTracking.tracking,
            destination: destCoords,
            eta
        });
    } catch (error) {
        console.error('Get ride ETA error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to calculate ETA',
            error: error.message
        });
    }
};

module.exports = {
    getAllVehiclesTracking,
    getVehicleTracking,
    getActiveRidesTracking,
    getTrackingStats,
    getRawTrackingData,
    getRideETA
};