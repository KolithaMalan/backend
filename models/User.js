const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [/^0\d{9}$/, 'Please provide a valid Sri Lankan phone number']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false
    },
    role: {
        type: String,
        enum: ['user', 'driver', 'admin', 'project_manager'],
        default: 'user'
    },
    status: {
        type: String,
        enum: ['available', 'busy', 'offline'],
        default: 'available'
    },
    isOnline: {
        type: Boolean,
        default: false
    },
    assignedVehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        default: null
    },
    currentRide: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride',
        default: null
    },
    totalRides: {
        type: Number,
        default: 0
    },
    totalDistance: {
        type: Number,
        default: 0
    },
    isHardcoded: {
        type: Boolean,
        default: false
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

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// Update timestamp on save
userSchema.pre('save', function () {
    this.updatedAt = Date.now();
});


// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function() {
    return jwt.sign(
        { 
            id: this._id, 
            role: this.role,
            email: this.email 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

// Get public profile
userSchema.methods.getPublicProfile = function() {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        phone: this.phone,
        role: this.role,
        status: this.status,
        isOnline: this.isOnline,
        totalRides: this.totalRides,
        totalDistance: this.totalDistance
    };
};

module.exports = mongoose.model('User', userSchema);