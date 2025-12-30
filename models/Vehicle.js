const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    vehicleNumber: {
        type: String,
        required: [true, 'Vehicle number is required'],
        unique: true,
        uppercase: true,
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Vehicle type is required'],
        enum: ['Car', 'Van', 'Bus', 'SUV'],
        default: 'Car'
    },
    status: {
        type: String,
        enum: ['available', 'busy', 'maintenance'],
        default: 'available'
    },
    currentDriver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    currentRide: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride',
        default: null
    },
    totalMileage: {
        type: Number,
        default: 0
    },
    monthlyMileage: {
        type: Number,
        default: 0
    },
    lastMileageReset: {
        type: Date,
        default: Date.now
    },
    totalRides: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
vehicleSchema.pre('save', function () {
    this.updatedAt = Date.now();
});


// Add mileage method
vehicleSchema.methods.addMileage = async function(distance) {
    this.totalMileage += distance;
    this.monthlyMileage += distance;
    this.totalRides += 1;
    await this.save();
};

// Reset monthly mileage
vehicleSchema.methods.resetMonthlyMileage = async function() {
    this.monthlyMileage = 0;
    this.lastMileageReset = Date.now();
    await this.save();
};

module.exports = mongoose.model('Vehicle', vehicleSchema);