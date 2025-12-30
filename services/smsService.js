const twilio = require('twilio');

// Initialize Twilio client
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// Format phone number for Sri Lanka
const formatPhoneNumber = (phone) => {
    // Remove leading 0 and add country code
    if (phone.startsWith('0')) {
        return '+94' + phone.substring(1);
    }
    if (!phone.startsWith('+')) {
        return '+94' + phone;
    }
    return phone;
};

// Send SMS
const sendSMS = async ({ to, message }) => {
    try {
        const formattedNumber = formatPhoneNumber(to);
        
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: formattedNumber
        });

        console.log(`✅ SMS sent to ${formattedNumber}: ${result.sid}`);
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error(`❌ SMS error to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};

// SMS Templates
const smsTemplates = {
    // New ride request for Admin
    rideCreatedForAdmin: (ride, user) => 
        `🚗 RideManager: New ride request #${ride.rideId} from ${user.name}. Distance: ${ride.calculatedDistance}km. Date: ${new Date(ride.scheduledDate).toLocaleDateString()}. Login to assign.`,

    // New ride request for PM (>15km)
    rideCreatedForPM: (ride, user) => 
        `⚠️ RideManager: Long distance ride #${ride.rideId} (${ride.calculatedDistance}km) from ${user.name} requires your approval. Date: ${new Date(ride.scheduledDate).toLocaleDateString()}.`,

    // PM approved - notify Admin
    pmApprovedNotifyAdmin: (ride) => 
        `✅ RideManager: PM approved ride #${ride.rideId}. Please assign driver & vehicle. Distance: ${ride.calculatedDistance}km.`,

    // PM approved - notify User
    pmApprovedNotifyUser: (ride) => 
        `✅ RideManager: Your ride #${ride.rideId} has been approved by Project Manager. A driver will be assigned soon.`,

    // Ride assigned - notify User
    rideAssignedToUser: (ride, driver, vehicle) => 
        `🚗 RideManager: Driver ${driver.name} (${driver.phone}) with vehicle ${vehicle.vehicleNumber} assigned for your ride #${ride.rideId} on ${new Date(ride.scheduledDate).toLocaleDateString()} at ${ride.scheduledTime}.`,

    // Ride assigned - notify Driver
    rideAssignedToDriver: (ride, user, vehicle) => 
        `📋 RideManager: New assignment - Ride #${ride.rideId}. Customer: ${user.name} (${user.phone}). Vehicle: ${vehicle.vehicleNumber}. Date: ${new Date(ride.scheduledDate).toLocaleDateString()} at ${ride.scheduledTime}. Distance: ${ride.calculatedDistance}km.`,

    // Ride reassigned - notify old driver
    rideReassignedOldDriver: (ride) => 
        `🔄 RideManager: Ride #${ride.rideId} has been reassigned to another driver. You are no longer assigned to this ride.`,

    // Ride reassigned - notify new driver
    rideReassignedNewDriver: (ride, user, vehicle) => 
        `📋 RideManager: Reassigned - Ride #${ride.rideId}. Customer: ${user.name} (${user.phone}). Vehicle: ${vehicle.vehicleNumber}. Date: ${new Date(ride.scheduledDate).toLocaleDateString()}.`,

    // Ride reassigned - notify user
    rideReassignedToUser: (ride, driver, vehicle) => 
        `🔄 RideManager: Your ride #${ride.rideId} driver updated. New driver: ${driver.name} (${driver.phone}), Vehicle: ${vehicle.vehicleNumber}.`,

    // Ride rejected
    rideRejected: (ride) => 
        `❌ RideManager: Your ride request #${ride.rideId} has been rejected. Please submit a new request if needed.`,

    // Ride completed
    rideCompleted: (ride) => 
        `✅ RideManager: Ride #${ride.rideId} completed successfully. Distance: ${ride.actualDistance || ride.calculatedDistance}km. Thank you!`
};

module.exports = { sendSMS, smsTemplates };