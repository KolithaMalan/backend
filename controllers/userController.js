const User = require('../models/User');
const Ride = require('../models/Ride');
const bcrypt = require('bcryptjs');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin only)
const getUsers = async (req, res) => {
    try {
        const { role, status, search, page = 1, limit = 10 } = req.query;

        let query = {};

        // Filter by role
        if (role) {
            query.role = role;
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Search by name or email
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            count: users.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            users
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin only)
const getUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Create new user (by Admin)
// @route   POST /api/users
// @access  Private (Admin only)
const createUser = async (req, res) => {
    try {
        const { name, email, phone, password, role } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Check phone
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return res.status(400).json({
                success: false,
                message: 'User with this phone number already exists'
            });
        }

        // Validate role
        if (!['user', 'driver', 'admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Allowed roles: user, driver, admin'
            });
        }

        // Create user
        const user = await User.create({
            name,
            email,
            phone,
            password,
            role
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin only)
const updateUser = async (req, res) => {
    try {
        const { name, email, phone, role, status } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent updating hardcoded users' core info
        if (user.isHardcoded) {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify system users'
            });
        }

        // Check if email is taken by another user
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use'
                });
            }
            user.email = email;
        }

        // Check if phone is taken by another user
        if (phone && phone !== user.phone) {
            const existingPhone = await User.findOne({ phone });
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already in use'
                });
            }
            user.phone = phone;
        }

        if (name) user.name = name;
        if (role) user.role = role;
        if (status) user.status = status;

        await user.save();

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            user: user.getPublicProfile()
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent deleting hardcoded users
        if (user.isHardcoded) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete system users'
            });
        }

        // Check if user has active rides
        const activeRides = await Ride.countDocuments({
            $or: [
                { requester: user._id },
                { assignedDriver: user._id }
            ],
            status: { $in: ['pending', 'awaiting_pm', 'awaiting_admin', 'approved', 'assigned', 'in_progress'] }
        });

        if (activeRides > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete user with active rides'
            });
        }

        await User.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get all drivers
// @route   GET /api/users/drivers
// @access  Private (Admin only)
const getDrivers = async (req, res) => {
    try {
        const drivers = await User.find({ role: 'driver' })
            .select('-password')
            .populate('assignedVehicle', 'vehicleNumber type')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers
        });
    } catch (error) {
        console.error('Get drivers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get available drivers
// @route   GET /api/users/drivers/available
// @access  Private (Admin only)
const getAvailableDrivers = async (req, res) => {
    try {
        const drivers = await User.find({ 
            role: 'driver',
            status: 'available'
        })
            .select('-password')
            .sort({ name: 1 });

        res.status(200).json({
            success: true,
            count: drivers.length,
            drivers
        });
    } catch (error) {
        console.error('Get available drivers error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get driver statistics
// @route   GET /api/users/drivers/:id/stats
// @access  Private (Admin, PM)
const getDriverStats = async (req, res) => {
    try {
        const driver = await User.findById(req.params.id);

        if (!driver || driver.role !== 'driver') {
            return res.status(404).json({
                success: false,
                message: 'Driver not found'
            });
        }

        // Get ride statistics
        const totalRides = await Ride.countDocuments({ 
            assignedDriver: driver._id 
        });

        const completedRides = await Ride.countDocuments({ 
            assignedDriver: driver._id,
            status: 'completed'
        });

        const activeRides = await Ride.countDocuments({ 
            assignedDriver: driver._id,
            status: { $in: ['assigned', 'in_progress'] }
        });

        // Get total distance
        const distanceResult = await Ride.aggregate([
            { $match: { assignedDriver: driver._id, status: 'completed' } },
            { $group: { _id: null, totalDistance: { $sum: '$actualDistance' } } }
        ]);

        const totalDistance = distanceResult.length > 0 ? distanceResult[0].totalDistance : 0;

        // Get monthly rides
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const monthlyRides = await Ride.countDocuments({
            assignedDriver: driver._id,
            status: 'completed',
            endTime: { $gte: startOfMonth }
        });

        res.status(200).json({
            success: true,
            driver: {
                id: driver._id,
                name: driver.name,
                email: driver.email,
                phone: driver.phone,
                status: driver.status
            },
            stats: {
                totalRides,
                completedRides,
                activeRides,
                totalDistance: Math.round(totalDistance * 10) / 10,
                monthlyRides
            }
        });
    } catch (error) {
        console.error('Get driver stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Reset user password (by Admin)
// @route   PUT /api/users/:id/reset-password
// @access  Private (Admin only)
const resetUserPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get user counts by role
// @route   GET /api/users/counts
// @access  Private (Admin only)
const getUserCounts = async (req, res) => {
    try {
        const counts = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            total: 0,
            users: 0,
            drivers: 0,
            admins: 0,
            projectManagers: 0
        };

        counts.forEach(item => {
            result.total += item.count;
            switch (item._id) {
                case 'user':
                    result.users = item.count;
                    break;
                case 'driver':
                    result.drivers = item.count;
                    break;
                case 'admin':
                    result.admins = item.count;
                    break;
                case 'project_manager':
                    result.projectManagers = item.count;
                    break;
            }
        });

        // Get available drivers count
        const availableDrivers = await User.countDocuments({
            role: 'driver',
            status: 'available'
        });

        result.availableDrivers = availableDrivers;

        res.status(200).json({
            success: true,
            counts: result
        });
    } catch (error) {
        console.error('Get user counts error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
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
};