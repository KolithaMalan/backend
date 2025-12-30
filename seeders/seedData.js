const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const config = require('../config/config');
require('dotenv').config();

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);


        console.log('🔌 Connected to MongoDB');

        // Clear existing data (optional - comment out if you want to keep existing data)
        // await User.deleteMany({});
        // await Vehicle.deleteMany({});
        // console.log('🗑️ Cleared existing data');

        // Seed Project Manager
        const existingPM = await User.findOne({ email: config.HARDCODED_USERS.PROJECT_MANAGER.email });
        if (!existingPM) {
            await User.create({
                name: config.HARDCODED_USERS.PROJECT_MANAGER.name,
                email: config.HARDCODED_USERS.PROJECT_MANAGER.email,
                phone: config.HARDCODED_USERS.PROJECT_MANAGER.phone,
                password: config.HARDCODED_USERS.PROJECT_MANAGER.password,
                role: 'project_manager',
                isHardcoded: true,
                status: 'available'
            });
            console.log('✅ Project Manager created');
        } else {
            console.log('ℹ️ Project Manager already exists');
        }

        // Seed Admin
        const existingAdmin = await User.findOne({ email: config.HARDCODED_USERS.ADMIN.email });
        if (!existingAdmin) {
            await User.create({
                name: config.HARDCODED_USERS.ADMIN.name,
                email: config.HARDCODED_USERS.ADMIN.email,
                phone: config.HARDCODED_USERS.ADMIN.phone,
                password: config.HARDCODED_USERS.ADMIN.password,
                role: 'admin',
                isHardcoded: true,
                status: 'available'
            });
            console.log('✅ Admin created');
        } else {
            console.log('ℹ️ Admin already exists');
        }

        // Seed Drivers
        for (const driverData of config.INITIAL_DRIVERS) {
            const existingDriver = await User.findOne({ email: driverData.email });
            if (!existingDriver) {
                await User.create({
                    name: driverData.name,
                    email: driverData.email,
                    phone: driverData.phone,
                    password: driverData.password,
                    role: 'driver',
                    status: 'available'
                });
                console.log(`✅ ${driverData.name} created`);
            } else {
                console.log(`ℹ️ ${driverData.name} already exists`);
            }
        }

        // Seed Vehicles
        for (const vehicleData of config.INITIAL_VEHICLES) {
            const existingVehicle = await Vehicle.findOne({ vehicleNumber: vehicleData.vehicleNumber });
            if (!existingVehicle) {
                await Vehicle.create({
                    vehicleNumber: vehicleData.vehicleNumber,
                    type: vehicleData.type,
                    status: vehicleData.status,
                    isActive: true
                });
                console.log(`✅ Vehicle ${vehicleData.vehicleNumber} created`);
            } else {
                console.log(`ℹ️ Vehicle ${vehicleData.vehicleNumber} already exists`);
            }
        }

        console.log('\n🎉 Database seeding completed!');
        console.log('\n📋 Login Credentials:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Project Manager:');
        console.log(`  Email: ${config.HARDCODED_USERS.PROJECT_MANAGER.email}`);
        console.log(`  Password: ${config.HARDCODED_USERS.PROJECT_MANAGER.password}`);
        console.log('\nAdmin:');
        console.log(`  Email: ${config.HARDCODED_USERS.ADMIN.email}`);
        console.log(`  Password: ${config.HARDCODED_USERS.ADMIN.password}`);
        console.log('\nDrivers:');
        config.INITIAL_DRIVERS.forEach(d => {
            console.log(`  ${d.name}: ${d.email} / ${d.password}`);
        });
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
};

// Run seeder
seedDatabase();