const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const userRoutes = require('./routes/userRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Import database connection
const connectDB = require('./config/db');

// Initialize express app
const app = express();

// Connect to MongoDB
connectDB();

// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? [process.env.FRONTEND_URL, 'https://vehicle-managment.vercel.app']
        : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie Parser
app.use(cookieParser());

// Logging Middleware (only in development)
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Request timestamp middleware
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString();
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'RideManager API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to RideManager API',
        version: '1.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                logout: 'POST /api/auth/logout',
                profile: 'GET /api/auth/me'
            },
            rides: {
                create: 'POST /api/rides',
                getAll: 'GET /api/rides',
                getOne: 'GET /api/rides/:id',
                awaitingPM: 'GET /api/rides/awaiting-pm',
                awaitingAdmin: 'GET /api/rides/awaiting-admin',
                readyForAssignment: 'GET /api/rides/ready-for-assignment'
            },
            users: {
                getAll: 'GET /api/users',
                getDrivers: 'GET /api/users/drivers',
                create: 'POST /api/users'
            },
            vehicles: {
                getAll: 'GET /api/vehicles',
                getAvailable: 'GET /api/vehicles/available',
                create: 'POST /api/vehicles'
            },
            reports: {
                dashboard: 'GET /api/reports/dashboard-stats',
                monthlyRides: 'GET /api/reports/monthly-rides',
                driverPerformance: 'GET /api/reports/driver-performance',
                vehicleUsage: 'GET /api/reports/vehicle-usage'
            }
        }
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});


// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Error:', err);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            errors: messages
        });
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(400).json({
            success: false,
            message: `${field} already exists`
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }

    // Mongoose Cast Error (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format'
        });
    }

    // Default error
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚗 RideManager API Server                          ║
║                                                       ║
║   ✅ Server running on port ${PORT}                     ║
║   📍 Environment: ${process.env.NODE_ENV || 'development'}                    ║
║   🔗 API URL: http://localhost:${PORT}/api              ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.error(`❌ Unhandled Rejection: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error(`❌ Uncaught Exception: ${err.message}`);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('💤 Process terminated');
        mongoose.connection.close(false, () => {
            process.exit(0);
        });
    });
});

module.exports = app;