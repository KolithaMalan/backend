const axios = require('axios');
const Vehicle = require('../models/Vehicle');

class TrackingService {
    constructor() {
        this.apiKey = process.env.ORONLANKA_API_KEY;
        this.apiUrl = process.env.ORONLANKA_API_URL || 'https://api.oronlanka.com/api/server/monitor';
        this.cache = {
            data: null,
            timestamp: null,
            ttl: 10000 // 10 seconds cache
        };
    }

    /**
     * Fetch real-time data from oronlanka.com API
     */
    async fetchFromAPI() {
        try {
            // Check cache first
            if (this.cache.data && this.cache.timestamp) {
                const age = Date.now() - this.cache.timestamp;
                if (age < this.cache.ttl) {
                    return this.cache.data;
                }
            }

            const response = await axios.post(this.apiUrl, {
                api_key: this.apiKey
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 second timeout
            });

            // Update cache
            this.cache.data = response.data;
            this.cache.timestamp = Date.now();

            return response.data;
        } catch (error) {
            console.error('Tracking API Error:', error.message);
            
            // Return cached data if available
            if (this.cache.data) {
                console.log('Returning cached tracking data');
                return this.cache.data;
            }
            
            throw new Error('Failed to fetch tracking data: ' + error.message);
        }
    }

    /**
     * Normalize vehicle number for comparison
     * Removes spaces, hyphens, converts to uppercase
     */
    normalizeVehicleNumber(vehicleNumber) {
        if (!vehicleNumber) return '';
        return vehicleNumber
            .toUpperCase()
            .replace(/[\s\-]/g, '')
            .trim();
    }

    /**
     * Get all vehicles with their tracking data
     */
    async getAllVehiclesWithTracking() {
        try {
            // Fetch tracking data from API
            const trackingData = await this.fetchFromAPI();
            
            // Fetch all vehicles from database
            const vehicles = await Vehicle.find({ isActive: true })
                .populate('currentDriver', 'name email phone')
                .populate('currentRide', 'rideId status pickupLocation destinationLocation requester')
                .lean();

            // Create a map of normalized vehicle numbers to tracking data
            const trackingMap = new Map();
            if (Array.isArray(trackingData)) {
                trackingData.forEach(device => {
                    const normalizedNumber = this.normalizeVehicleNumber(device.vehicle);
                    trackingMap.set(normalizedNumber, device);
                });
            }

            // Merge tracking data with vehicle data
            const vehiclesWithTracking = vehicles.map(vehicle => {
                const normalizedNumber = this.normalizeVehicleNumber(vehicle.vehicleNumber);
                const tracking = trackingMap.get(normalizedNumber);

                return {
                    ...vehicle,
                    tracking: tracking ? {
                        deviceId: tracking.id,
                        terminalId: tracking.terminal_id,
                        latitude: parseFloat(tracking.latitude) || null,
                        longitude: parseFloat(tracking.longitude) || null,
                        speed: tracking.speed || 0,
                        heading: tracking.rotation || 0,
                        isOnline: tracking.status === 'online',
                        ignitionOn: tracking.acc === 1,
                        lastUpdate: tracking.last_message,
                        stopTime: tracking.stop_time,
                        speedLimit: tracking.speed_limit,
                        subscriptionExpiry: tracking.expire
                    } : null,
                    hasTracking: !!tracking
                };
            });

            return vehiclesWithTracking;
        } catch (error) {
            console.error('Get vehicles with tracking error:', error);
            throw error;
        }
    }

    /**
     * Get single vehicle tracking data
     */
    async getVehicleTracking(vehicleId) {
        try {
            const vehicle = await Vehicle.findById(vehicleId)
                .populate('currentDriver', 'name email phone')
                .populate({
                    path: 'currentRide',
                    populate: {
                        path: 'requester',
                        select: 'name email phone department'
                    }
                })
                .lean();

            if (!vehicle) {
                throw new Error('Vehicle not found');
            }

            const trackingData = await this.fetchFromAPI();
            const normalizedNumber = this.normalizeVehicleNumber(vehicle.vehicleNumber);

            let tracking = null;
            if (Array.isArray(trackingData)) {
                const device = trackingData.find(d => 
                    this.normalizeVehicleNumber(d.vehicle) === normalizedNumber
                );
                
                if (device) {
                    tracking = {
                        deviceId: device.id,
                        terminalId: device.terminal_id,
                        latitude: parseFloat(device.latitude) || null,
                        longitude: parseFloat(device.longitude) || null,
                        speed: device.speed || 0,
                        heading: device.rotation || 0,
                        isOnline: device.status === 'online',
                        ignitionOn: device.acc === 1,
                        lastUpdate: device.last_message,
                        stopTime: device.stop_time,
                        speedLimit: device.speed_limit,
                        subscriptionExpiry: device.expire
                    };
                }
            }

            return {
                ...vehicle,
                tracking,
                hasTracking: !!tracking
            };
        } catch (error) {
            console.error('Get vehicle tracking error:', error);
            throw error;
        }
    }

    /**
     * Get vehicles with active rides
     */
    async getActiveRideVehicles() {
        try {
            const Ride = require('../models/Ride');
            
            // Get active rides
            const activeRides = await Ride.find({
                status: { $in: ['assigned', 'in_progress'] }
            })
            .populate('assignedDriver', 'name email phone')
            .populate('assignedVehicle', 'vehicleNumber type')
            .populate('requester', 'name email phone department')
            .lean();

            if (activeRides.length === 0) {
                return [];
            }

            // Get tracking data
            const trackingData = await this.fetchFromAPI();
            const trackingMap = new Map();
            
            if (Array.isArray(trackingData)) {
                trackingData.forEach(device => {
                    const normalizedNumber = this.normalizeVehicleNumber(device.vehicle);
                    trackingMap.set(normalizedNumber, device);
                });
            }

            // Merge ride data with tracking
            const ridesWithTracking = activeRides.map(ride => {
                let tracking = null;
                
                if (ride.assignedVehicle) {
                    const normalizedNumber = this.normalizeVehicleNumber(ride.assignedVehicle.vehicleNumber);
                    const device = trackingMap.get(normalizedNumber);
                    
                    if (device) {
                        tracking = {
                            latitude: parseFloat(device.latitude) || null,
                            longitude: parseFloat(device.longitude) || null,
                            speed: device.speed || 0,
                            heading: device.rotation || 0,
                            isOnline: device.status === 'online',
                            ignitionOn: device.acc === 1,
                            lastUpdate: device.last_message
                        };
                    }
                }

                return {
                    ...ride,
                    tracking,
                    hasTracking: !!tracking
                };
            });

            return ridesWithTracking;
        } catch (error) {
            console.error('Get active ride vehicles error:', error);
            throw error;
        }
    }

    /**
     * Get tracking statistics
     */
    async getTrackingStats() {
        try {
            const trackingData = await this.fetchFromAPI();
            const vehicles = await Vehicle.find({ isActive: true }).lean();

            let stats = {
                totalDevices: 0,
                onlineDevices: 0,
                offlineDevices: 0,
                movingVehicles: 0,
                stoppedVehicles: 0,
                linkedVehicles: 0,
                unlinkedVehicles: 0
            };

            if (Array.isArray(trackingData)) {
                stats.totalDevices = trackingData.length;
                stats.onlineDevices = trackingData.filter(d => d.status === 'online').length;
                stats.offlineDevices = trackingData.filter(d => d.status === 'offline').length;
                stats.movingVehicles = trackingData.filter(d => d.speed > 0 && d.status === 'online').length;
                stats.stoppedVehicles = trackingData.filter(d => d.speed === 0 && d.status === 'online').length;

                // Check how many DB vehicles are linked to tracking devices
                const trackingNumbers = new Set(
                    trackingData.map(d => this.normalizeVehicleNumber(d.vehicle))
                );

                vehicles.forEach(v => {
                    const normalized = this.normalizeVehicleNumber(v.vehicleNumber);
                    if (trackingNumbers.has(normalized)) {
                        stats.linkedVehicles++;
                    } else {
                        stats.unlinkedVehicles++;
                    }
                });
            }

            return stats;
        } catch (error) {
            console.error('Get tracking stats error:', error);
            throw error;
        }
    }

    /**
     * Calculate ETA based on current position, speed, and destination
     * Uses Haversine formula for distance calculation
     */
    calculateETA(currentLat, currentLng, destLat, destLng, currentSpeed) {
        if (!currentLat || !currentLng || !destLat || !destLng) {
            return null;
        }

        // Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(destLat - currentLat);
        const dLng = this.toRad(destLng - currentLng);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(currentLat)) * Math.cos(this.toRad(destLat)) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        // Use actual speed or assume average of 30 km/h if stopped
        const speed = currentSpeed > 0 ? currentSpeed : 30;
        const hours = distance / speed;
        const minutes = Math.round(hours * 60);

        return {
            distance: Math.round(distance * 10) / 10,
            minutes: minutes,
            estimatedArrival: new Date(Date.now() + minutes * 60 * 1000)
        };
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }
}

// Export singleton instance
module.exports = new TrackingService();