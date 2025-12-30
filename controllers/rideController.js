const Ride = require('../models/Ride');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const config = require('../config/config');
const { calculateDistance, isWithinBookingWindow, isTodayOrFuture, generateId } = require('../utils/helpers');
const {
    notifyRideCreated,
    notifyPMApproved,
    notifyRideAssigned,
    notifyRideReassigned,
    notifyAdminApproved,
    notifyRideRejected,
    notifyRideCompleted,
   notifyPMAboutAdminApproval // ✅ NEW
} = require('../services/notificationService');

// @desc    Create new ride request
// @route   POST /api/rides
// @access  Private (All authenticated users)
const createRide = async (req, res) => {
    try {
        console.log('=== CREATE RIDE REQUEST ===');
        console.log('User:', req.user?.email, '| Role:', req.user?.role);
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const {
            rideType,
            pickupLocation,
            destinationLocation,
            scheduledDate,
            scheduledTime
        } = req.body;
        
        // ... rest of the code

        const requester = req.user;

        // Validate booking window (within 14 days)
        if (!isWithinBookingWindow(scheduledDate)) {
            return res.status(400).json({
                success: false,
                message: 'Booking must be within 14 days from today'
            });
        }

        // Validate date is today or future
        if (!isTodayOrFuture(scheduledDate)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot book rides for past dates'
            });
        }

        // Check pending rides limit for regular users (max 3)
        if (requester.role === 'user') {
            const pendingRides = await Ride.countDocuments({
                requester: requester._id,
                status: { 
                    $in: ['pending', 'awaiting_pm', 'awaiting_admin', 'pm_approved', 'approved', 'assigned'] 
                }
            });

            if (pendingRides >= config.MAX_PENDING_RIDES_USER) {
                return res.status(400).json({
                    success: false,
                    message: `You can only have ${config.MAX_PENDING_RIDES_USER} pending ride requests at a time`
                });
            }
        }

// Calculate distance
let baseDistance;

// If distance is provided from frontend (Google Maps road distance), use it
if (req.body.distance && !isNaN(req.body.distance)) {
    baseDistance = parseFloat(req.body.distance);
    console.log('Using provided distance from Google Maps:', baseDistance);
} else {
    // Fallback to straight-line calculation
    console.log('Calculating straight-line distance as fallback');
    baseDistance = calculateDistance(
        pickupLocation.coordinates.lat,
        pickupLocation.coordinates.lng,
        destinationLocation.coordinates.lat,
        destinationLocation.coordinates.lng
    );
}

// For return trips, multiply distance by 2
const calculatedDistance = rideType === 'return' ? baseDistance * 2 : baseDistance;



console.log(`Base distance: ${baseDistance} km, Calculated distance (${rideType}): ${calculatedDistance} km`);
// Determine approval flow based on distance and requester role
// Determine approval flow based on distance and requester role
let status;
let requiresPMApproval = false;
let isPMApproved = false;

if (requester.role === 'project_manager') {
    // PM's rides go directly to admin for assignment (no approval needed)
    status = 'approved';
    isPMApproved = true;
} else {
    // For User, Driver, and Admin roles
    if (calculatedDistance > config.PM_APPROVAL_THRESHOLD_KM) {
        // ✅ NEW FLOW: Long distance rides go to BOTH PM and Admin
        status = 'awaiting_admin';
        requiresPMApproval = true;
    } else {
        // Short distance rides go to Admin only
        status = 'awaiting_admin';
    }
}

        // Generate unique ride ID
        let rideId = generateId(6);
        let existingRide = await Ride.findOne({ rideId });
        while (existingRide) {
            rideId = generateId(6);
            existingRide = await Ride.findOne({ rideId });
        }

        // Create ride
        const ride = await Ride.create({
            rideId,
            requester: requester._id,
            requesterRole: requester.role,
            rideType,
            pickupLocation,
            destinationLocation,
            distance: baseDistance,
            calculatedDistance,
            scheduledDate,
            scheduledTime,
            status,
            requiresPMApproval,
            isPMApproved
        });

        // Populate requester info
        await ride.populate('requester', 'name email phone');

        // Send notifications
        await notifyRideCreated(ride, requester);

        res.status(201).json({
            success: true,
            message: 'Ride request created successfully',
            ride
        });
    } catch (error) {
        console.error('Create ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error creating ride',
            error: error.message
        });
    }
};

// @desc    Get all rides (with filters based on role)
// @route   GET /api/rides
// @access  Private
const getRides = async (req, res) => {
    try {
        const { status, startDate, endDate, page = 1, limit = 10 } = req.query;
        const user = req.user;

        let query = {};

        // Role-based filtering
        switch (user.role) {
            case 'user':
                // Users see only their own rides
                query.requester = user._id;
                break;
            case 'driver':
                // Drivers see rides assigned to them
                query.assignedDriver = user._id;
                break;
            case 'admin':
                // Admin sees all rides
                break;
            case 'project_manager':
                // PM sees rides awaiting their approval + their own rides
                query.$or = [
                    { status: 'awaiting_pm' },
                    { requester: user._id },
                    { requiresPMApproval: true }
                ];
                break;
        }

        // Status filter
        if (status) {
            if (Array.isArray(status)) {
                query.status = { $in: status };
            } else {
                query.status = status;
            }
        }

        // Date range filter
        if (startDate || endDate) {
            query.scheduledDate = {};
            if (startDate) query.scheduledDate.$gte = new Date(startDate);
            if (endDate) query.scheduledDate.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;

        const rides = await Ride.find(query)
            .populate('requester', 'name email phone')
            .populate('assignedDriver', 'name email phone status')
            .populate('assignedVehicle', 'vehicleNumber type status')
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
        console.error('Get rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching rides',
            error: error.message
        });
    }
};

// @desc    Get single ride by ID
// @route   GET /api/rides/:id
// @access  Private
const getRide = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id)
            .populate('requester', 'name email phone')
            .populate('assignedDriver', 'name email phone status')
            .populate('assignedVehicle', 'vehicleNumber type status')
            .populate('approvedBy.pm.user', 'name')
            .populate('approvedBy.admin.user', 'name')
            .populate('rejectedBy.user', 'name');

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        res.status(200).json({
            success: true,
            ride
        });
    } catch (error) {
        console.error('Get ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error fetching ride',
            error: error.message
        });
    }
};


// @route   GET /api/rides/awaiting-pm
// @access  Private (PM only)
// @desc    Get rides awaiting PM approval
// @route   GET /api/rides/awaiting-pm
// @access  Private (PM only)
// @desc    Get rides awaiting PM approval
// @route   GET /api/rides/awaiting-pm
// @access  Private (PM only)
const getRidesAwaitingPM = async (req, res) => {
    try {
        // ✅ NEW: PM sees long-distance rides with status awaiting_admin that aren't approved yet
        const rides = await Ride.find({ 
            status: 'awaiting_admin',
            requiresPMApproval: true,
            isPMApproved: false, // Not yet approved by PM
            isAdminApproved: false // Not yet approved by Admin
        })
            .populate('requester', 'name email phone')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: rides.length,
            rides
        });
    } catch (error) {
        console.error('Get PM rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get rides awaiting Admin approval
// @route   GET /api/rides/awaiting-admin
// @access  Private (Admin only)
const getRidesAwaitingAdmin = async (req, res) => {
    try {
        const rides = await Ride.find({ status: 'awaiting_admin' })
            .populate('requester', 'name email phone')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: rides.length,
            rides
        });
    } catch (error) {
        console.error('Get admin rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get approved rides ready for assignment
// @route   GET /api/rides/ready-for-assignment
// @access  Private (Admin only)
const getRidesReadyForAssignment = async (req, res) => {
    try {
        const rides = await Ride.find({ 
            status: { $in: ['approved', 'pm_approved'] }
        })
            .populate('requester', 'name email phone')
            .sort({ scheduledDate: 1, scheduledTime: 1 });

        res.status(200).json({
            success: true,
            count: rides.length,
            rides
        });
    } catch (error) {
        console.error('Get assignment rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    PM approve ride
// @route   PUT /api/rides/:id/pm-approve
// @access  Private (PM only)
// @desc    PM approve ride
// @route   PUT /api/rides/:id/pm-approve
// @access  Private (PM only)
const pmApproveRide = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // ✅ Allow PM to approve if status is awaiting_admin (new dual approval system)
        if (ride.status !== 'awaiting_admin' && ride.status !== 'awaiting_pm') {
            return res.status(400).json({
                success: false,
                message: 'This ride is not awaiting PM approval'
            });
        }

        // Must be a long-distance ride
        if (!ride.requiresPMApproval) {
            return res.status(400).json({
                success: false,
                message: 'This ride does not require PM approval'
            });
        }

        // ✅ Update ride status - goes directly to assignment (no admin approval needed)
        ride.status = 'approved';
        ride.isPMApproved = true;
        ride.approvedBy.pm.user = req.user._id;
        ride.approvedBy.pm.approvedAt = new Date();
        await ride.save();

        // Populate for response
        await ride.populate('requester', 'name email phone');

        // Send notifications
        await notifyPMApproved(ride, req.user);

        res.status(200).json({
            success: true,
            message: 'Ride approved successfully. Admin can now assign driver and vehicle.',
            ride
        });
    } catch (error) {
        console.error('PM approve error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    PM reject ride
// @route   PUT /api/rides/:id/pm-reject
// @access  Private (PM only)
const pmRejectRide = async (req, res) => {
    try {
        const { reason } = req.body;
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // ✅ UPDATED: Allow PM to reject if status is awaiting_admin AND requires PM approval
        if (ride.status !== 'awaiting_pm' && ride.status !== 'awaiting_admin') {
            return res.status(400).json({
                success: false,
                message: 'This ride cannot be rejected at this stage'
            });
        }

        // ✅ Check if PM approval is required
        if (!ride.requiresPMApproval) {
            return res.status(400).json({
                success: false,
                message: 'This ride does not require PM approval'
            });
        }

        // ✅ Update ride status
        ride.status = 'rejected';
        ride.rejectedBy.user = req.user._id;
        ride.rejectedBy.role = 'project_manager'; // ✅ ADD ROLE
        ride.rejectedBy.rejectedAt = new Date();
        ride.rejectedBy.reason = reason || null;
        await ride.save();

        // ✅ Populate for notifications
        await ride.populate('requester', 'name email phone');

        // ✅ Notify requester about rejection
        await notifyRideRejected(ride, req.user);

        // ✅ NEW: Notify Admin that PM rejected the ride
        const admin = await User.findOne({ email: config.HARDCODED_USERS.ADMIN.email });
        if (admin) {
            const { sendEmail, emailTemplates } = require('../services/emailService');
            const { sendSMS } = require('../services/smsService');
            
            // Email to Admin
            await sendEmail({
                to: admin.email,
                subject: `PM Rejected Ride #${ride.rideId}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #c62828;">PM Rejected Ride Request</h2>
                        <p>Project Manager ${req.user.name} has rejected ride request #${ride.rideId}.</p>
                        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Ride ID:</strong> ${ride.rideId}</p>
                            <p><strong>Requester:</strong> ${ride.requester.name}</p>
                            <p><strong>Distance:</strong> ${ride.calculatedDistance} km</p>
                            <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                        </div>
                    </div>
                `
            });
            
            // SMS to Admin
            await sendSMS({
                to: admin.phone,
                message: `RideManager: PM rejected ride #${ride.rideId} (${ride.calculatedDistance}km). ${reason ? 'Reason: ' + reason.substring(0, 80) : ''}`
            });

            console.log(`✅ Admin notified of PM rejection for ride #${ride.rideId}`);
        }

        res.status(200).json({
            success: true,
            message: 'Ride rejected successfully. Requester and Admin have been notified.',
            ride
        });
    } catch (error) {
        console.error('PM reject error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Admin approve ride
// @route   PUT /api/rides/:id/admin-approve
// @access  Private (Admin only)
const adminApproveRide = async (req, res) => {
    try {
        const { note } = req.body;
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        if (ride.status !== 'awaiting_admin') {
            return res.status(400).json({
                success: false,
                message: 'This ride is not awaiting admin approval'
            });
        }

        // ✅ Check if note is required for long-distance rides
        if (ride.requiresPMApproval) {
            // Long distance ride - note is REQUIRED
            if (!note || note.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Approval note is required for long-distance rides (>15km)'
                });
            }
            
            // Save the note
            ride.approvedBy.admin.note = note.trim();
        }

        // Approve the ride
        ride.status = 'approved';
        ride.isAdminApproved = true;
        ride.approvedBy.admin.user = req.user._id;
        ride.approvedBy.admin.approvedAt = new Date();
        await ride.save();

        await ride.populate('requester', 'name email phone');

        // ✅ Send notifications (PM + User for long distance, User only for regular)
        await notifyAdminApproved(ride, req.user, note || 'No note provided');

        res.status(200).json({
            success: true,
            message: 'Ride approved. You can now assign driver and vehicle.',
            ride
        });
    } catch (error) {
        console.error('Admin approve error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Admin reject ride
// @route   PUT /api/rides/:id/admin-reject
// @access  Private (Admin only)
const adminRejectRide = async (req, res) => {
    try {
        const { reason } = req.body;
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        if (!['awaiting_admin', 'approved', 'pm_approved'].includes(ride.status)) {
            return res.status(400).json({
                success: false,
                message: 'This ride cannot be rejected at this stage'
            });
        }

        ride.status = 'rejected';
        ride.rejectedBy.user = req.user._id;
        ride.rejectedBy.role = 'admin'; // ✅ ADD ROLE
        ride.rejectedBy.rejectedAt = new Date();
        ride.rejectedBy.reason = reason || null;
        await ride.save();

        // ✅ Populate for notifications
        await ride.populate('requester', 'name email phone');

        // Send rejection notification to requester
        await notifyRideRejected(ride, req.user);

        // ✅ NEW: If it was a long-distance ride, notify PM
        if (ride.requiresPMApproval) {
            const pm = await User.findOne({ email: config.HARDCODED_USERS.PROJECT_MANAGER.email });
            if (pm) {
                const { sendEmail } = require('../services/emailService');
                const { sendSMS } = require('../services/smsService');
                
                await sendEmail({
                    to: pm.email,
                    subject: `Admin Rejected Ride #${ride.rideId}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #c62828;">Admin Rejected Long Distance Ride</h2>
                            <p>Admin ${req.user.name} has rejected ride request #${ride.rideId}.</p>
                            <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Ride ID:</strong> ${ride.rideId}</p>
                                <p><strong>Requester:</strong> ${ride.requester.name}</p>
                                <p><strong>Distance:</strong> ${ride.calculatedDistance} km</p>
                                <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                                ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                            </div>
                        </div>
                    `
                });
                
                await sendSMS({
                    to: pm.phone,
                    message: `RideManager: Admin rejected ride #${ride.rideId} (${ride.calculatedDistance}km). ${reason ? 'Reason: ' + reason.substring(0, 80) : ''}`
                });

                console.log(`✅ PM notified of Admin rejection for ride #${ride.rideId}`);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Ride rejected',
            ride
        });
    } catch (error) {
        console.error('Admin reject error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Assign driver and vehicle to ride
// @route   PUT /api/rides/:id/assign
// @access  Private (Admin only)
const assignDriverAndVehicle = async (req, res) => {
    try {
        const { driverId, vehicleId } = req.body;

        const ride = await Ride.findById(req.params.id);
        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        if (!['approved', 'pm_approved'].includes(ride.status)) {
            return res.status(400).json({
                success: false,
                message: 'Ride must be approved before assignment'
            });
        }

        // Get driver
        const driver = await User.findById(driverId);
        if (!driver || driver.role !== 'driver') {
            return res.status(400).json({
                success: false,
                message: 'Invalid driver selected'
            });
        }

        // Get vehicle
        const vehicle = await Vehicle.findById(vehicleId);
        if (!vehicle) {
            return res.status(400).json({
                success: false,
                message: 'Invalid vehicle selected'
            });
        }

        // Check if driver is available at that time
        const conflictingRide = await Ride.findOne({
            assignedDriver: driverId,
            scheduledDate: ride.scheduledDate,
            scheduledTime: ride.scheduledTime,
            status: { $in: ['assigned', 'in_progress'] },
            _id: { $ne: ride._id }
        });

        if (conflictingRide) {
            return res.status(400).json({
                success: false,
                message: `Driver is already assigned to another ride at this time (Ride #${conflictingRide.rideId})`
            });
        }

        // Check if vehicle is available at that time
        const vehicleConflict = await Ride.findOne({
            assignedVehicle: vehicleId,
            scheduledDate: ride.scheduledDate,
            scheduledTime: ride.scheduledTime,
            status: { $in: ['assigned', 'in_progress'] },
            _id: { $ne: ride._id }
        });

        if (vehicleConflict) {
            return res.status(400).json({
                success: false,
                message: `Vehicle is already assigned to another ride at this time (Ride #${vehicleConflict.rideId})`
            });
        }

        // Update ride
        ride.assignedDriver = driverId;
        ride.assignedVehicle = vehicleId;
        ride.status = 'assigned';
        await ride.save();

        // Update driver status to busy
        driver.status = 'busy';
        driver.currentRide = ride._id;
        driver.assignedVehicle = vehicleId;
        await driver.save();

        // Update vehicle status to busy
        vehicle.status = 'busy';
        vehicle.currentDriver = driverId;
        vehicle.currentRide = ride._id;
        await vehicle.save();

        // Populate for response
        await ride.populate('requester', 'name email phone');
        await ride.populate('assignedDriver', 'name email phone');
        await ride.populate('assignedVehicle', 'vehicleNumber type');

        // Send notifications
        await notifyRideAssigned(ride, driver, vehicle);

        res.status(200).json({
            success: true,
            message: 'Driver and vehicle assigned successfully',
            ride
        });
    } catch (error) {
        console.error('Assign error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Reassign driver and vehicle (change assignment)
// @route   PUT /api/rides/:id/reassign
// @access  Private (Admin only)
const reassignDriverAndVehicle = async (req, res) => {
    try {
        const { driverId, vehicleId } = req.body;

        const ride = await Ride.findById(req.params.id)
            .populate('assignedDriver', 'name email phone')
            .populate('assignedVehicle', 'vehicleNumber');

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        if (ride.status !== 'assigned') {
            return res.status(400).json({
                success: false,
                message: 'Only assigned rides can be reassigned'
            });
        }

        // Store old driver and vehicle info
        const oldDriver = ride.assignedDriver;
        const oldVehicle = ride.assignedVehicle;

        // Get new driver
        const newDriver = await User.findById(driverId);
        if (!newDriver || newDriver.role !== 'driver') {
            return res.status(400).json({
                success: false,
                message: 'Invalid driver selected'
            });
        }

        // Get new vehicle
        const newVehicle = await Vehicle.findById(vehicleId);
        if (!newVehicle) {
            return res.status(400).json({
                success: false,
                message: 'Invalid vehicle selected'
            });
        }

        // Check conflicts for new driver (if different)
        if (driverId !== oldDriver._id.toString()) {
            const driverConflict = await Ride.findOne({
                assignedDriver: driverId,
                scheduledDate: ride.scheduledDate,
                scheduledTime: ride.scheduledTime,
                status: { $in: ['assigned', 'in_progress'] },
                _id: { $ne: ride._id }
            });

            if (driverConflict) {
                return res.status(400).json({
                    success: false,
                    message: `New driver is already assigned to another ride at this time`
                });
            }
        }

        // Check conflicts for new vehicle (if different)
        if (vehicleId !== oldVehicle._id.toString()) {
            const vehicleConflict = await Ride.findOne({
                assignedVehicle: vehicleId,
                scheduledDate: ride.scheduledDate,
                scheduledTime: ride.scheduledTime,
                status: { $in: ['assigned', 'in_progress'] },
                _id: { $ne: ride._id }
            });

            if (vehicleConflict) {
                return res.status(400).json({
                    success: false,
                    message: `New vehicle is already assigned to another ride at this time`
                });
            }
        }

        // Release old driver (if different)
        if (oldDriver && driverId !== oldDriver._id.toString()) {
            const oldDriverDoc = await User.findById(oldDriver._id);
            if (oldDriverDoc) {
                // Check if old driver has other active rides
                const otherRides = await Ride.countDocuments({
                    assignedDriver: oldDriver._id,
                    status: { $in: ['assigned', 'in_progress'] },
                    _id: { $ne: ride._id }
                });

                if (otherRides === 0) {
                    oldDriverDoc.status = 'available';
                    oldDriverDoc.currentRide = null;
                    oldDriverDoc.assignedVehicle = null;
                }
                await oldDriverDoc.save();
            }
        }

        // Release old vehicle (if different)
        if (oldVehicle && vehicleId !== oldVehicle._id.toString()) {
            const oldVehicleDoc = await Vehicle.findById(oldVehicle._id);
            if (oldVehicleDoc) {
                // Check if old vehicle has other active rides
                const otherRides = await Ride.countDocuments({
                    assignedVehicle: oldVehicle._id,
                    status: { $in: ['assigned', 'in_progress'] },
                    _id: { $ne: ride._id }
                });

                if (otherRides === 0) {
                    oldVehicleDoc.status = 'available';
                    oldVehicleDoc.currentDriver = null;
                    oldVehicleDoc.currentRide = null;
                }
                await oldVehicleDoc.save();
            }
        }

        // Store previous assignment info
        ride.previousDriver = oldDriver._id;
        ride.previousVehicle = oldVehicle._id;

        // Update ride with new assignment
        ride.assignedDriver = driverId;
        ride.assignedVehicle = vehicleId;
        await ride.save();

        // Update new driver status
        newDriver.status = 'busy';
        newDriver.currentRide = ride._id;
        newDriver.assignedVehicle = vehicleId;
        await newDriver.save();

        // Update new vehicle status
        newVehicle.status = 'busy';
        newVehicle.currentDriver = driverId;
        newVehicle.currentRide = ride._id;
        await newVehicle.save();

        // Populate for response
        await ride.populate('requester', 'name email phone');
        await ride.populate('assignedDriver', 'name email phone');
        await ride.populate('assignedVehicle', 'vehicleNumber type');

        // Send notifications (to requester, new driver, and old driver)
        await notifyRideReassigned(ride, newDriver, newVehicle, oldDriver);

        res.status(200).json({
            success: true,
            message: 'Ride reassigned successfully. All parties have been notified.',
            ride
        });
    } catch (error) {
        console.error('Reassign error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Start ride (Driver action)
// @route   PUT /api/rides/:id/start
// @access  Private (Driver only)
const startRide = async (req, res) => {
    try {
        const { startMileage } = req.body;

        if (!startMileage && startMileage !== 0) {
            return res.status(400).json({
                success: false,
                message: 'Start mileage is required'
            });
        }

        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // Check if driver is assigned to this ride
        if (ride.assignedDriver.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this ride'
            });
        }

        if (ride.status !== 'assigned') {
            return res.status(400).json({
                success: false,
                message: 'Ride cannot be started at this stage'
            });
        }

        ride.status = 'in_progress';
        ride.startMileage = parseFloat(startMileage);
        ride.startTime = new Date();
        await ride.save();

        // Populate for response
        await ride.populate('requester', 'name email phone');
        await ride.populate('assignedVehicle', 'vehicleNumber type');

        res.status(200).json({
            success: true,
            message: 'Ride started successfully',
            ride
        });
    } catch (error) {
        console.error('Start ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Complete ride (Driver action)
// @route   PUT /api/rides/:id/complete
// @access  Private (Driver only)
const completeRide = async (req, res) => {
    try {
        const { endMileage } = req.body;

        if (!endMileage && endMileage !== 0) {
            return res.status(400).json({
                success: false,
                message: 'End mileage is required'
            });
        }

        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // Check if driver is assigned to this ride
        if (ride.assignedDriver.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this ride'
            });
        }

        if (ride.status !== 'in_progress') {
            return res.status(400).json({
                success: false,
                message: 'Ride must be in progress to complete'
            });
        }

        // Validate end mileage is greater than start mileage
        if (parseFloat(endMileage) < ride.startMileage) {
            return res.status(400).json({
                success: false,
                message: 'End mileage cannot be less than start mileage'
            });
        }

        // Calculate actual distance
        const actualDistance = parseFloat(endMileage) - ride.startMileage;

        ride.status = 'completed';
        ride.endMileage = parseFloat(endMileage);
        ride.actualDistance = actualDistance;
        ride.endTime = new Date();
        await ride.save();

        // Update vehicle mileage
        const vehicle = await Vehicle.findById(ride.assignedVehicle);
        if (vehicle) {
            await vehicle.addMileage(actualDistance);
            
            // Check if vehicle has other active rides
            const otherRides = await Ride.countDocuments({
                assignedVehicle: vehicle._id,
                status: { $in: ['assigned', 'in_progress'] },
                _id: { $ne: ride._id }
            });

            if (otherRides === 0) {
                vehicle.status = 'available';
                vehicle.currentDriver = null;
                vehicle.currentRide = null;
                await vehicle.save();
            }
        }

        // Update driver status
        const driver = await User.findById(ride.assignedDriver);
        if (driver) {
            driver.totalRides += 1;
            driver.totalDistance += actualDistance;

            // Check if driver has other active rides
            const otherRides = await Ride.countDocuments({
                assignedDriver: driver._id,
                status: { $in: ['assigned', 'in_progress'] },
                _id: { $ne: ride._id }
            });

            if (otherRides === 0) {
                driver.status = 'available';
                driver.currentRide = null;
                driver.assignedVehicle = null;
            }
            await driver.save();
        }

        // Update requester stats
        const requester = await User.findById(ride.requester);
        if (requester) {
            requester.totalRides += 1;
            requester.totalDistance += actualDistance;
            await requester.save();
        }

        // Populate for response
        await ride.populate('requester', 'name email phone');
        await ride.populate('assignedDriver', 'name email phone');
        await ride.populate('assignedVehicle', 'vehicleNumber type');

        // Send completion notification
        await notifyRideCompleted(ride);

        res.status(200).json({
            success: true,
            message: 'Ride completed successfully',
            ride,
            actualDistance
        });
    } catch (error) {
        console.error('Complete ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Cancel ride (User action - before approval only)
// @route   PUT /api/rides/:id/cancel
// @access  Private
const cancelRide = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // Check if user owns this ride or is admin
        if (ride.requester.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this ride'
            });
        }

        // Can only cancel before approval
        const cancellableStatuses = ['pending', 'awaiting_pm', 'awaiting_admin'];
        if (!cancellableStatuses.includes(ride.status)) {
            return res.status(400).json({
                success: false,
                message: 'Ride can only be cancelled before it is approved'
            });
        }

        ride.status = 'cancelled';
        await ride.save();

        res.status(200).json({
            success: true,
            message: 'Ride cancelled successfully',
            ride
        });
    } catch (error) {
        console.error('Cancel ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get user's ride statistics
// @route   GET /api/rides/my-stats
// @access  Private
const getMyRideStats = async (req, res) => {
    try {
        const userId = req.user._id;

        const totalRides = await Ride.countDocuments({ requester: userId });
        const completedRides = await Ride.countDocuments({ 
            requester: userId, 
            status: 'completed' 
        });
        const pendingRides = await Ride.countDocuments({ 
            requester: userId, 
            status: { $in: ['pending', 'awaiting_pm', 'awaiting_admin', 'approved', 'assigned'] }
        });

        // Calculate total distance
        const distanceResult = await Ride.aggregate([
            { $match: { requester: userId, status: 'completed' } },
            { $group: { _id: null, totalDistance: { $sum: '$actualDistance' } } }
        ]);

        const totalDistance = distanceResult.length > 0 ? distanceResult[0].totalDistance : 0;

        res.status(200).json({
            success: true,
            stats: {
                totalRides,
                completedRides,
                pendingRides,
                totalDistance: Math.round(totalDistance * 10) / 10
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get driver's assigned rides
// @route   GET /api/rides/driver/assigned
// @access  Private (Driver only)
const getDriverAssignedRides = async (req, res) => {
    try {
        const rides = await Ride.find({
            assignedDriver: req.user._id,
            status: { $in: ['assigned', 'in_progress'] }
        })
            .populate('requester', 'name email phone')
            .populate('assignedVehicle', 'vehicleNumber type')
            .sort({ scheduledDate: 1, scheduledTime: 1 });

        res.status(200).json({
            success: true,
            count: rides.length,
            rides
        });
    } catch (error) {
        console.error('Get driver rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get driver's daily rides
// @route   GET /api/rides/driver/daily
// @access  Private (Driver only)
const getDriverDailyRides = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const rides = await Ride.find({
            assignedDriver: req.user._id,
            scheduledDate: { $gte: today, $lt: tomorrow }
        })
            .populate('requester', 'name email phone')
            .populate('assignedVehicle', 'vehicleNumber type')
            .sort({ scheduledTime: 1 });

        // Get stats
        const activeRides = rides.filter(r => ['assigned', 'in_progress'].includes(r.status)).length;
        const completedRides = rides.filter(r => r.status === 'completed').length;

        res.status(200).json({
            success: true,
            count: rides.length,
            stats: {
                active: activeRides,
                completed: completedRides
            },
            rides
        });
    } catch (error) {
        console.error('Get daily rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Get available drivers for a specific date/time
// @route   GET /api/rides/available-drivers
// @access  Private (Admin only)
const getAvailableDrivers = async (req, res) => {
    try {
        const { date, time, excludeRideId } = req.query;

        if (!date || !time) {
            return res.status(400).json({
                success: false,
                message: 'Date and time are required'
            });
        }

        // Get all drivers
        const allDrivers = await User.find({ role: 'driver' }).select('name email phone status');

        // Find busy drivers at that time
        const busyDriverQuery = {
            scheduledDate: new Date(date),
            scheduledTime: time,
            status: { $in: ['assigned', 'in_progress'] }
        };

        if (excludeRideId) {
            busyDriverQuery._id = { $ne: excludeRideId };
        }

        const busyRides = await Ride.find(busyDriverQuery).select('assignedDriver');
        const busyDriverIds = busyRides.map(r => r.assignedDriver?.toString()).filter(Boolean);

        // Filter available drivers
        const availableDrivers = allDrivers.map(driver => ({
            ...driver.toObject(),
            isAvailable: !busyDriverIds.includes(driver._id.toString())
        }));

        res.status(200).json({
            success: true,
            drivers: availableDrivers
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

// @desc    Get available vehicles for a specific date/time
// @route   GET /api/rides/available-vehicles
// @access  Private (Admin only)
const getAvailableVehicles = async (req, res) => {
    try {
        const { date, time, excludeRideId } = req.query;

        if (!date || !time) {
            return res.status(400).json({
                success: false,
                message: 'Date and time are required'
            });
        }

        // Get all active vehicles
        const allVehicles = await Vehicle.find({ isActive: true }).select('vehicleNumber type status');

        // Find busy vehicles at that time
        const busyVehicleQuery = {
            scheduledDate: new Date(date),
            scheduledTime: time,
            status: { $in: ['assigned', 'in_progress'] }
        };

        if (excludeRideId) {
            busyVehicleQuery._id = { $ne: excludeRideId };
        }

        const busyRides = await Ride.find(busyVehicleQuery).select('assignedVehicle');
        const busyVehicleIds = busyRides.map(r => r.assignedVehicle?.toString()).filter(Boolean);

        // Filter available vehicles
        const availableVehicles = allVehicles.map(vehicle => ({
            ...vehicle.toObject(),
            isAvailable: !busyVehicleIds.includes(vehicle._id.toString()) && vehicle.status !== 'maintenance'
        }));

        res.status(200).json({
            success: true,
            vehicles: availableVehicles
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

module.exports = {
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
};