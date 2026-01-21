const axios = require('axios');

// Notify.lk API Configuration
const NOTIFY_CONFIG = {
    baseUrl: 'https://app.notify.lk/api/v1/send',
    userId: process.env.NOTIFY_USER_ID,
    apiKey: process.env.NOTIFY_API_KEY,
    senderId: process.env.NOTIFY_SENDER_ID || 'SobaRides'
};

// Format phone number for Sri Lanka
const formatPhoneNumber = (phone) => {
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }
    
    if (cleaned.startsWith('0')) {
        cleaned = '94' + cleaned.substring(1);
    }
    
    if (!cleaned.startsWith('94')) {
        cleaned = '94' + cleaned;
    }
    
    return cleaned;
};

// Send SMS using Notify.lk
const sendSMS = async ({ to, message }) => {
    try {
        // ✅ Check if SMS is configured
        if (!NOTIFY_CONFIG.userId || !NOTIFY_CONFIG.apiKey) {
            console.warn('⚠️ SMS not configured - skipping SMS to:', to);
            return { success: false, error: 'SMS not configured' };
        }

        const formattedNumber = formatPhoneNumber(to);
        
        // ✅ Add timeout to axios
        const response = await axios.post(NOTIFY_CONFIG.baseUrl, null, {
            params: {
                user_id: NOTIFY_CONFIG.userId,
                api_key: NOTIFY_CONFIG.apiKey,
                sender_id: NOTIFY_CONFIG.senderId,
                to: formattedNumber,
                message: message
            },
            timeout: 10000 // ✅ 10 second timeout
        });

        if (response.data.status === 'success' || response.data.status === '1') {
            console.log(`✅ SMS sent to ${formattedNumber}: ${JSON.stringify(response.data)}`);
            return { 
                success: true, 
                messageId: response.data.message_id || response.data.request_id,
                data: response.data 
            };
        } else {
            console.error(`❌ SMS failed to ${formattedNumber}:`, response.data);
            return { 
                success: false, 
                error: response.data.message || 'Unknown error' 
            };
        }
    } catch (error) {
        // ✅ Better error logging
        if (error.response) {
            console.error(`❌ SMS API error to ${to}:`, {
                status: error.response.status,
                data: error.response.data
            });
        } else if (error.request) {
            console.error(`❌ SMS network error to ${to}:`, error.message);
        } else {
            console.error(`❌ SMS error to ${to}:`, error.message);
        }
        
        return { 
            success: false, 
            error: error.response?.data?.message || error.message 
        };
    }
};


// Check SMS Balance
const checkBalance = async () => {
    try {
        const response = await axios.get('https://app.notify.lk/api/v1/balance', {
            params: {
                user_id: NOTIFY_CONFIG.userId,
                api_key: NOTIFY_CONFIG.apiKey
            }
        });
        
        console.log(`💰 SMS Balance: ${response.data.balance}`);
        return response.data;
    } catch (error) {
        console.error('❌ Balance check error:', error.message);
        return null;
    }
};


    // SMS Templates (No Emojis - Clean Format)
const smsTemplates = {
    // New ride request for Admin (short distance)
    rideCreatedForAdmin: (ride, user) => 
        `RideManager: New ride #${ride.rideId} from ${user.name}. Distance: ${ride.calculatedDistance}km. Date: ${new Date(ride.scheduledDate).toLocaleDateString()}. Please assign driver.`,

    // New ride request for PM (>15km)
    rideCreatedForPM: (ride, user) => 
        `RideManager: Long distance ride #${ride.rideId} (${ride.calculatedDistance}km) from ${user.name} requires your approval. Date: ${new Date(ride.scheduledDate).toLocaleDateString()}.`,

    // Long distance ride for Admin (dual approval)
    rideCreatedForAdminLongDistance: (ride, user) => 
        `RideManager: Long distance ride #${ride.rideId} (${ride.calculatedDistance}km) from ${user.name}. You can approve with note OR wait for PM approval.`,

    // PM approved - notify Admin
    pmApprovedNotifyAdmin: (ride) => 
        `RideManager: PM approved ride #${ride.rideId}. Please assign driver & vehicle. Distance: ${ride.calculatedDistance}km.`,

    // PM approved - notify User
    pmApprovedNotifyUser: (ride) => 
        `RideManager: Your ride #${ride.rideId} has been approved by Plant Manager. Driver will be assigned soon.`,

    // Ride assigned - notify User
    rideAssignedToUser: (ride, driver, vehicle) => 
        `RideManager: Driver ${driver.name} (${driver.phone}) with vehicle ${vehicle.vehicleNumber} assigned for your ride #${ride.rideId} on ${new Date(ride.scheduledDate).toLocaleDateString()} at ${ride.scheduledTime}.`,

    // Ride assigned - notify Driver
    rideAssignedToDriver: (ride, user, vehicle) => 
        `RideManager: New assignment - Ride #${ride.rideId}. Customer: ${user.name} (${user.phone}). Vehicle: ${vehicle.vehicleNumber}. Date: ${new Date(ride.scheduledDate).toLocaleDateString()} at ${ride.scheduledTime}. Distance: ${ride.calculatedDistance}km.`,

    // Ride reassigned - notify old driver
    rideReassignedOldDriver: (ride) => 
        `RideManager: Ride #${ride.rideId} has been reassigned to another driver. You are no longer assigned to this ride.`,

    // Ride reassigned - notify new driver
    rideReassignedNewDriver: (ride, user, vehicle) => 
        `RideManager: Reassigned - Ride #${ride.rideId}. Customer: ${user.name} (${user.phone}). Vehicle: ${vehicle.vehicleNumber}. Date: ${new Date(ride.scheduledDate).toLocaleDateString()}.`,

    // Ride reassigned - notify user
    rideReassignedToUser: (ride, driver, vehicle) => 
        `RideManager: Your ride #${ride.rideId} driver updated. New driver: ${driver.name} (${driver.phone}), Vehicle: ${vehicle.vehicleNumber}.`,

    // Ride rejected
    rideRejected: (ride, reason = '') => {
        const reasonText = reason 
            ? `Reason: ${reason.substring(0, 100)}${reason.length > 100 ? '...' : ''}` 
            : 'Please contact admin for details.';
        return `RideManager: Your ride #${ride.rideId} has been rejected. ${reasonText} Submit a new request if needed.`;
    },

    // Ride completed
    rideCompleted: (ride) => 
        `RideManager: Ride #${ride.rideId} completed successfully. Distance: ${ride.actualDistance || ride.calculatedDistance}km. Thank you!`
};

module.exports = { sendSMS, checkBalance, smsTemplates };
