const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: [
            'ride_created',
            'ride_approved',
            'ride_rejected',
            'ride_assigned',
            'ride_reassigned',
            'ride_started',
            'ride_completed',
            'ride_cancelled',
            'driver_changed',
            'vehicle_changed'
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    ride: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride',
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    smsSent: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Notification', notificationSchema);