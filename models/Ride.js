const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    rideId: String,
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requesterRole: String,
    rideType: String,
    pickupLocation: {
        address: String,
        coordinates: { lat: Number, lng: Number }
    },
    destinationLocation: {
        address: String,
        coordinates: { lat: Number, lng: Number }
    },
    distance: Number,
    calculatedDistance: Number,
    scheduledDate: Date,
    scheduledTime: String,
    status: {
        type: String,
        default: 'pending'
    },
    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    previousDriver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    previousVehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    startMileage: { type: Number, default: null },
    endMileage: { type: Number, default: null },
    actualDistance: { type: Number, default: null },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    approvedBy: {
        pm: {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            approvedAt: { type: Date, default: null }
        },
        admin: {
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            approvedAt: { type: Date, default: null },
            note: { type: String, default: null } // ✅ NEW: Admin approval note
        }
    },
    rejectedBy: {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        rejectedAt: { type: Date, default: null },
        reason: { type: String, default: null }
    },
    requiresPMApproval: { type: Boolean, default: false },
    isPMApproved: { type: Boolean, default: false },
    isAdminApproved: { type: Boolean, default: false },
    notes: { type: String, default: '' }
}, { timestamps: true });

// Generate rideId
rideSchema.pre('save', function() {
    if (this.isNew && !this.rideId) {
        this.rideId = Math.random().toString(36).substring(2, 8);
    }
});

module.exports = mongoose.model('Ride', rideSchema);