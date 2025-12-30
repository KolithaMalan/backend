const Ride = require('../models/Ride');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const { getMonthRange, getDayRange } = require('../utils/helpers');

// @desc    Get dashboard statistics
// @route   GET /api/reports/dashboard-stats
// @access  Private (Admin, PM)
const getDashboardStats = async (req, res) => {
    try {
        const { role } = req.user;
        const today = new Date();
        const { start: monthStart, end: monthEnd } = getMonthRange(today);
        const { start: dayStart, end: dayEnd } = getDayRange(today);

        // Ride counts
        const pendingApprovals = await Ride.countDocuments({
            status: { $in: ['awaiting_admin', 'awaiting_pm'] }
        });

        const liveRides = await Ride.countDocuments({
            status: 'in_progress'
        });

        const activeRides = await Ride.countDocuments({
            status: { $in: ['assigned', 'in_progress'] }
        });

        const completedToday = await Ride.countDocuments({
            status: 'completed',
            endTime: { $gte: dayStart, $lte: dayEnd }
        });

        // Driver stats
        const totalDrivers = await User.countDocuments({ role: 'driver' });
        const availableDrivers = await User.countDocuments({ role: 'driver', status: 'available' });

        // Vehicle stats
        const totalVehicles = await Vehicle.countDocuments({ isActive: true });
        const availableVehicles = await Vehicle.countDocuments({ isActive: true, status: 'available' });
        const activeVehiclesCount = await Vehicle.countDocuments({ isActive: true, status: { $ne: 'maintenance' } });

        // Monthly mileage
        const mileageResult = await Vehicle.aggregate([
            { $match: { isActive: true } },
            { $group: { _id: null, total: { $sum: '$monthlyMileage' } } }
        ]);
        const monthlyMileage = mileageResult.length > 0 ? mileageResult[0].total : 0;

        // PM specific stats
        let pmStats = {};
        if (role === 'project_manager') {
            const awaitingPM = await Ride.countDocuments({ status: 'awaiting_pm' });
            const approvedToday = await Ride.countDocuments({
                'approvedBy.pm.approvedAt': { $gte: dayStart, $lte: dayEnd }
            });
            const longDistanceRides = await Ride.countDocuments({
                requiresPMApproval: true
            });
            const totalProcessed = await Ride.countDocuments({
                'approvedBy.pm.user': req.user._id
            });

            pmStats = {
                awaitingPM,
                approvedToday,
                longDistanceRides,
                totalProcessed
            };
        }

        res.status(200).json({
            success: true,
            stats: {
                pendingApprovals,
                liveRides,
                activeRides,
                completedToday,
                drivers: {
                    total: totalDrivers,
                    available: availableDrivers
                },
                vehicles: {
                    total: totalVehicles,
                    available: availableVehicles,
                    active: activeVehiclesCount
                },
                monthlyMileage: Math.round(monthlyMileage * 10) / 10,
                ...pmStats
            }
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get monthly ride report
// @route   GET /api/reports/monthly-rides
// @access  Private (Admin, PM)
const getMonthlyRideReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        
        const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

        // Get all rides for the month
        const rides = await Ride.find({
            createdAt: { $gte: startDate, $lte: endDate }
        })
            .populate('requester', 'name email')
            .populate('assignedDriver', 'name')
            .populate('assignedVehicle', 'vehicleNumber')
            .sort({ createdAt: -1 });

        // Statistics
        const totalRides = rides.length;
        const completedRides = rides.filter(r => r.status === 'completed').length;
        const cancelledRides = rides.filter(r => r.status === 'cancelled').length;
        const rejectedRides = rides.filter(r => r.status === 'rejected').length;

        // Distance stats
        const totalDistance = rides
            .filter(r => r.status === 'completed')
            .reduce((sum, r) => sum + (r.actualDistance || r.calculatedDistance), 0);

        // Rides by type
        const oneWayRides = rides.filter(r => r.rideType === 'one_way').length;
        const returnRides = rides.filter(r => r.rideType === 'return').length;

        // Long distance rides
        const longDistanceRides = rides.filter(r => r.requiresPMApproval).length;

        // Daily breakdown
        const dailyBreakdown = [];
        for (let day = 1; day <= endDate.getDate(); day++) {
            const dayRides = rides.filter(r => {
                const rideDate = new Date(r.createdAt);
                return rideDate.getDate() === day;
            });
            dailyBreakdown.push({
                day,
                date: new Date(targetYear, targetMonth, day).toISOString().split('T')[0],
                total: dayRides.length,
                completed: dayRides.filter(r => r.status === 'completed').length
            });
        }

        res.status(200).json({
            success: true,
            report: {
                period: {
                    month: targetMonth + 1,
                    year: targetYear,
                    monthName: startDate.toLocaleString('default', { month: 'long' })
                },
                summary: {
                    totalRides,
                    completedRides,
                    cancelledRides,
                    rejectedRides,
                    completionRate: totalRides > 0 ? ((completedRides / totalRides) * 100).toFixed(1) : 0,
                    totalDistance: Math.round(totalDistance * 10) / 10,
                    averageDistance: completedRides > 0 
                        ? Math.round((totalDistance / completedRides) * 10) / 10 
                        : 0
                },
                byType: {
                    oneWay: oneWayRides,
                    return: returnRides
                },
                longDistanceRides,
                dailyBreakdown,
                rides
            }
        });
    } catch (error) {
        console.error('Monthly report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get driver performance report
// @route   GET /api/reports/driver-performance
// @access  Private (Admin, PM)
const getDriverPerformanceReport = async (req, res) => {
    try {
        const { month, year, driverId } = req.query;
        
        const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

        let driverQuery = { role: 'driver' };
        if (driverId) {
            driverQuery._id = driverId;
        }

        const drivers = await User.find(driverQuery).select('name email phone status totalRides totalDistance');

        const driverPerformance = await Promise.all(drivers.map(async (driver) => {
            // Get rides for the month
            const monthlyRides = await Ride.find({
                assignedDriver: driver._id,
                endTime: { $gte: startDate, $lte: endDate },
                status: 'completed'
            });

            const completedRides = monthlyRides.length;
            const totalDistance = monthlyRides.reduce((sum, r) => sum + (r.actualDistance || 0), 0);

            // Calculate average ride distance
            const avgDistance = completedRides > 0 ? totalDistance / completedRides : 0;

            // Get active rides
            const activeRides = await Ride.countDocuments({
                assignedDriver: driver._id,
                status: { $in: ['assigned', 'in_progress'] }
            });

            return {
                driver: {
                    id: driver._id,
                    name: driver.name,
                    email: driver.email,
                    phone: driver.phone,
                    status: driver.status
                },
                monthly: {
                    completedRides,
                    totalDistance: Math.round(totalDistance * 10) / 10,
                    avgDistance: Math.round(avgDistance * 10) / 10
                },
                overall: {
                    totalRides: driver.totalRides,
                    totalDistance: Math.round(driver.totalDistance * 10) / 10
                },
                activeRides
            };
        }));

        // Sort by completed rides (descending)
        driverPerformance.sort((a, b) => b.monthly.completedRides - a.monthly.completedRides);

        res.status(200).json({
            success: true,
            report: {
                period: {
                    month: targetMonth + 1,
                    year: targetYear,
                    monthName: startDate.toLocaleString('default', { month: 'long' })
                },
                totalDrivers: drivers.length,
                performance: driverPerformance
            }
        });
    } catch (error) {
        console.error('Driver performance report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get vehicle usage report
// @route   GET /api/reports/vehicle-usage
// @access  Private (Admin, PM)
const getVehicleUsageReport = async (req, res) => {
    try {
        const { month, year, vehicleId } = req.query;
        
        const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

        let vehicleQuery = { isActive: true };
        if (vehicleId) {
            vehicleQuery._id = vehicleId;
        }

        const vehicles = await Vehicle.find(vehicleQuery)
            .select('vehicleNumber type status totalMileage monthlyMileage totalRides');

        const vehicleUsage = await Promise.all(vehicles.map(async (vehicle) => {
            // Get rides for the month
            const monthlyRides = await Ride.find({
                assignedVehicle: vehicle._id,
                endTime: { $gte: startDate, $lte: endDate },
                status: 'completed'
            });

            const completedRides = monthlyRides.length;
            const monthlyDistance = monthlyRides.reduce((sum, r) => sum + (r.actualDistance || 0), 0);

            // Get active rides
            const activeRides = await Ride.countDocuments({
                assignedVehicle: vehicle._id,
                status: { $in: ['assigned', 'in_progress'] }
            });

            return {
                vehicle: {
                    id: vehicle._id,
                    vehicleNumber: vehicle.vehicleNumber,
                    type: vehicle.type,
                    status: vehicle.status
                },
                monthly: {
                    rides: completedRides,
                    distance: Math.round(monthlyDistance * 10) / 10,
                    recordedMileage: vehicle.monthlyMileage
                },
                overall: {
                    totalRides: vehicle.totalRides,
                    totalMileage: Math.round(vehicle.totalMileage * 10) / 10
                },
                activeRides
            };
        }));

        // Sort by monthly distance (descending)
        vehicleUsage.sort((a, b) => b.monthly.distance - a.monthly.distance);

        // Calculate totals
        const totals = vehicleUsage.reduce((acc, v) => {
            acc.monthlyRides += v.monthly.rides;
            acc.monthlyDistance += v.monthly.distance;
            acc.totalMileage += v.overall.totalMileage;
            return acc;
        }, { monthlyRides: 0, monthlyDistance: 0, totalMileage: 0 });

        res.status(200).json({
            success: true,
            report: {
                period: {
                    month: targetMonth + 1,
                    year: targetYear,
                    monthName: startDate.toLocaleString('default', { month: 'long' })
                },
                totalVehicles: vehicles.length,
                totals: {
                    monthlyRides: totals.monthlyRides,
                    monthlyDistance: Math.round(totals.monthlyDistance * 10) / 10,
                    totalMileage: Math.round(totals.totalMileage * 10) / 10
                },
                vehicles: vehicleUsage
            }
        });
    } catch (error) {
        console.error('Vehicle usage report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get ride history
// @route   GET /api/reports/ride-history
// @access  Private (Admin, PM)
const getRideHistory = async (req, res) => {
    try {
        const { 
            startDate, 
            endDate, 
            status, 
            driverId, 
            vehicleId,
            requesterId,
            page = 1, 
            limit = 20 
        } = req.query;

        let query = {};

        // Date range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Filters
        if (status) query.status = status;
        if (driverId) query.assignedDriver = driverId;
        if (vehicleId) query.assignedVehicle = vehicleId;
        if (requesterId) query.requester = requesterId;

        const skip = (page - 1) * limit;

        const rides = await Ride.find(query)
            .populate('requester', 'name email')
            .populate('assignedDriver', 'name')
            .populate('assignedVehicle', 'vehicleNumber')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Ride.countDocuments(query);

        res.status(200).json({
            success: true,
            count: rides.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            rides
        });
    } catch (error) {
        console.error('Ride history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Export report data (for PDF/Excel generation on frontend)
// @route   GET /api/reports/export/:type
// @access  Private (Admin, PM)
const exportReport = async (req, res) => {
    try {
        const { type } = req.params;
        const { month, year, format = 'json' } = req.query;

        const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

        let data = {};

        switch (type) {
            case 'rides':
                const rides = await Ride.find({
                    endTime: { $gte: startDate, $lte: endDate },
                    status: 'completed'
                })
                    .populate('requester', 'name email phone')
                    .populate('assignedDriver', 'name')
                    .populate('assignedVehicle', 'vehicleNumber')
                    .sort({ endTime: -1 });

                data = {
                    type: 'Monthly Rides Report',
                    period: `${startDate.toLocaleString('default', { month: 'long' })} ${targetYear}`,
                    generatedAt: new Date().toISOString(),
                    totalRecords: rides.length,
                    records: rides.map(r => ({
                        rideId: r.rideId,
                        requester: r.requester?.name,
                        requesterEmail: r.requester?.email,
                        driver: r.assignedDriver?.name,
                        vehicle: r.assignedVehicle?.vehicleNumber,
                        rideType: r.rideType,
                        pickup: r.pickupLocation.address,
                        destination: r.destinationLocation.address,
                        distance: r.actualDistance || r.calculatedDistance,
                        scheduledDate: r.scheduledDate,
                        scheduledTime: r.scheduledTime,
                        completedAt: r.endTime,
                        status: r.status
                    }))
                };
                break;

            case 'drivers':
                const drivers = await User.find({ role: 'driver' });
                const driverData = await Promise.all(drivers.map(async (d) => {
                    const monthlyRides = await Ride.countDocuments({
                        assignedDriver: d._id,
                        endTime: { $gte: startDate, $lte: endDate },
                        status: 'completed'
                    });

                    const distanceResult = await Ride.aggregate([
                        { 
                            $match: { 
                                assignedDriver: d._id, 
                                endTime: { $gte: startDate, $lte: endDate },
                                status: 'completed' 
                            } 
                        },
                        { $group: { _id: null, total: { $sum: '$actualDistance' } } }
                    ]);

                    return {
                        name: d.name,
                        email: d.email,
                        phone: d.phone,
                        status: d.status,
                        monthlyRides,
                        monthlyDistance: distanceResult.length > 0 ? distanceResult[0].total : 0,
                        totalRides: d.totalRides,
                        totalDistance: d.totalDistance
                    };
                }));

                data = {
                    type: 'Driver Performance Report',
                    period: `${startDate.toLocaleString('default', { month: 'long' })} ${targetYear}`,
                    generatedAt: new Date().toISOString(),
                    totalRecords: driverData.length,
                    records: driverData
                };
                break;

            case 'vehicles':
                const vehicles = await Vehicle.find({ isActive: true });
                const vehicleData = await Promise.all(vehicles.map(async (v) => {
                    const monthlyRides = await Ride.countDocuments({
                        assignedVehicle: v._id,
                        endTime: { $gte: startDate, $lte: endDate },
                        status: 'completed'
                    });

                    const distanceResult = await Ride.aggregate([
                        { 
                            $match: { 
                                assignedVehicle: v._id, 
                                endTime: { $gte: startDate, $lte: endDate },
                                status: 'completed' 
                            } 
                        },
                        { $group: { _id: null, total: { $sum: '$actualDistance' } } }
                    ]);

                    return {
                        vehicleNumber: v.vehicleNumber,
                        type: v.type,
                        status: v.status,
                        monthlyRides,
                        monthlyDistance: distanceResult.length > 0 ? distanceResult[0].total : 0,
                        totalMileage: v.totalMileage,
                        totalRides: v.totalRides
                    };
                }));

                data = {
                    type: 'Vehicle Usage Report',
                    period: `${startDate.toLocaleString('default', { month: 'long' })} ${targetYear}`,
                    generatedAt: new Date().toISOString(),
                    totalRecords: vehicleData.length,
                    records: vehicleData
                };
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid report type. Use: rides, drivers, or vehicles'
                });
        }

        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Export report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get user's personal ride history
// @route   GET /api/reports/my-history
// @access  Private
const getMyRideHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const userId = req.user._id;
        const userRole = req.user.role;

        let query = {};

        if (userRole === 'driver') {
            query.assignedDriver = userId;
        } else {
            query.requester = userId;
        }

        if (status) {
            query.status = status;
        }

        const skip = (page - 1) * limit;

        const rides = await Ride.find(query)
            .populate('requester', 'name email')
            .populate('assignedDriver', 'name phone')
            .populate('assignedVehicle', 'vehicleNumber type')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Ride.countDocuments(query);

        res.status(200).json({
            success: true,
            count: rides.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            rides
        });
    } catch (error) {
        console.error('My history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardStats,
    getMonthlyRideReport,
    getDriverPerformanceReport,
    getVehicleUsageReport,
    getRideHistory,
    exportReport,
    getMyRideHistory
};