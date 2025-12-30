const { body, validationResult } = require('express-validator');

// Password validation - at least 8 chars, 2 special chars, uppercase and lowercase
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?].*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;

// Validate registration
const validateRegister = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^0\d{9}$/).withMessage('Please provide a valid Sri Lankan phone number (e.g., 0771234567)'),
    
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .custom((value) => {
            const specialChars = value.match(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/g);
            if (!specialChars || specialChars.length < 2) {
                throw new Error('Password must contain at least 2 special characters');
            }
            return true;
        })
];

// Validate login
const validateLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required')
];

// Validate ride request
const validateRideRequest = [
    body('rideType')
        .notEmpty().withMessage('Ride type is required')
        .isIn(['one_way', 'return']).withMessage('Ride type must be one_way or return'),
    
    body('pickupLocation.address')
        .notEmpty().withMessage('Pickup address is required'),
    
    body('pickupLocation.coordinates.lat')
        .notEmpty().withMessage('Pickup latitude is required')
        .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    
    body('pickupLocation.coordinates.lng')
        .notEmpty().withMessage('Pickup longitude is required')
        .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    
    body('destinationLocation.address')
        .notEmpty().withMessage('Destination address is required'),
    
    body('destinationLocation.coordinates.lat')
        .notEmpty().withMessage('Destination latitude is required')
        .isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    
    body('destinationLocation.coordinates.lng')
        .notEmpty().withMessage('Destination longitude is required')
        .isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    
    body('scheduledDate')
        .notEmpty().withMessage('Scheduled date is required')
        .isISO8601().withMessage('Invalid date format'),
    
    body('scheduledTime')
        .notEmpty().withMessage('Scheduled time is required')
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)')
];

// Validate create user (by admin)
const validateCreateUser = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^0\d{9}$/).withMessage('Please provide a valid Sri Lankan phone number'),
    
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    
    body('role')
        .notEmpty().withMessage('Role is required')
        .isIn(['user', 'driver', 'admin']).withMessage('Invalid role')
];

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

module.exports = {
    validateRegister,
    validateLogin,
    validateRideRequest,
    validateCreateUser,
    handleValidationErrors
};