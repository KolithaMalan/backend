const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

// Send email
const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to,
            subject,
            html,
            text
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`❌ Email error to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};

// Email Templates
const emailTemplates = {
    // Ride created notification to Admin
    // ✅ NEW: Long distance ride notification to Admin (dual approval system)
rideCreatedForAdminLongDistance: (ride, user) => ({
    subject: `⚠️ Long Distance Ride #${ride.rideId} - Dual Approval Available`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); border-radius: 10px;">
            <div style="background: white; padding: 30px; border-radius: 8px;">
                <h1 style="color: #1a5f2a; margin-bottom: 20px;">⚠️ Long Distance Ride Request</h1>

                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                    <p style="color: #e65100; margin: 0; font-weight: bold;">
                        🚨 This ride exceeds 15km. You can approve it with a note, or wait for PM approval.
                    </p>
                </div>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                    <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                    <p><strong>Requester:</strong> ${user.name} (${user.email})</p>
                    <p><strong>Type:</strong> ${ride.rideType === 'one_way' ? 'One-Way' : 'Return Trip'}</p>
                    <p><strong>Distance:</strong> <span style="color: #d32f2f; font-weight: bold;">${ride.calculatedDistance} km</span></p>
                    <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                    <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                </div>
                
                <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #1a5f2a; margin-top: 0;">📍 Pickup Location</h4>
                    <p style="margin: 0;">${ride.pickupLocation.address}</p>
                </div>
                
                <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <h4 style="color: #c62828; margin-top: 0;">📍 Destination</h4>
                    <p style="margin: 0;">${ride.destinationLocation.address}</p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.ADMIN_DASHBOARD_URL}" style="background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                        Go to Dashboard
                    </a>
                </div>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">
                    This is an automated message from RideManager System
                </p>
            </div>
        </div>
    `
}),

    // Ride created notification to PM (>15km)
    rideCreatedForPM: (ride, user) => ({
        subject: `⚠️ Long Distance Ride Request #${ride.rideId} - Approval Required`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #1565c0; margin-bottom: 20px;">⚠️ Long Distance Ride Request</h1>
                    
                    <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                        <p style="color: #e65100; margin: 0; font-weight: bold;">
                            🚨 This ride exceeds the 15km threshold and requires your approval.
                        </p>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Requester:</strong> ${user.name} (${user.email})</p>
                        <p><strong>Type:</strong> ${ride.rideType === 'one_way' ? 'One-Way' : 'Return Trip'}</p>
                        <p><strong>Distance:</strong> <span style="color: #d32f2f; font-weight: bold;">${ride.calculatedDistance} km</span></p>
                        <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                    </div>
                    
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: #1a5f2a; margin-top: 0;">📍 Pickup Location</h4>
                        <p style="margin: 0;">${ride.pickupLocation.address}</p>
                    </div>
                    
                    <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: #c62828; margin-top: 0;">📍 Destination</h4>
                        <p style="margin: 0;">${ride.destinationLocation.address}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.ADMIN_DASHBOARD_URL}" style="background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Review & Approve
                        </a>
                    </div>
                </div>
            </div>
        `
    }),

    // PM approved notification to Admin
    pmApprovedNotifyAdmin: (ride, user, pm) => ({
        subject: `✅ PM Approved Ride #${ride.rideId} - Assign Driver & Vehicle`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #1a5f2a; margin-bottom: 20px;">✅ PM Approved - Ready for Assignment</h1>
                    
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
                        <p style="color: #2e7d32; margin: 0; font-weight: bold;">
                            Project Manager ${pm.name} has approved this ride. Please assign a driver and vehicle.
                        </p>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Requester:</strong> ${user.name}</p>
                        <p><strong>Distance:</strong> ${ride.calculatedDistance} km</p>
                        <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                    </div>
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.ADMIN_DASHBOARD_URL}" style="background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Assign Driver & Vehicle
                        </a>
                    </div>
                </div>
            </div>
        `
    }),

    // PM approved notification to User
    pmApprovedNotifyUser: (ride, user) => ({
        subject: `✅ Your Ride Request #${ride.rideId} - PM Approved`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #1a5f2a; margin-bottom: 20px;">✅ Ride Request Approved</h1>
                    
                    <p>Dear ${user.name},</p>
                    <p>Good news! Your ride request has been approved by the Project Manager. The admin will now assign a driver and vehicle for your trip.</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                        <p><strong>From:</strong> ${ride.pickupLocation.address}</p>
                        <p><strong>To:</strong> ${ride.destinationLocation.address}</p>
                    </div>
                    
                    <p style="color: #666;">You will receive another notification once a driver and vehicle are assigned.</p>
                </div>
            </div>
        `
    }),

    // Ride assigned notification to User
    rideAssignedToUser: (ride, user, driver, vehicle) => ({
        subject: `🚗 Driver Assigned for Ride #${ride.rideId}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #1a5f2a; margin-bottom: 20px;">🚗 Driver & Vehicle Assigned</h1>
                    
                    <p>Dear ${user.name},</p>
                    <p>Your ride has been assigned a driver and vehicle. Here are the details:</p>
                    
                    <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #1565c0; margin-top: 0;">👤 Driver Details</h3>
                        <p><strong>Name:</strong> ${driver.name}</p>
                        <p><strong>Phone:</strong> ${driver.phone}</p>
                        <p><strong>Vehicle:</strong> ${vehicle.vehicleNumber} (${vehicle.type})</p>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">🗓️ Ride Details</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                        <p><strong>From:</strong> ${ride.pickupLocation.address}</p>
                        <p><strong>To:</strong> ${ride.destinationLocation.address}</p>
                    </div>
                    
                    <p style="color: #666;">Please be ready at the pickup location at the scheduled time.</p>
                </div>
            </div>
        `
    }),

    // Ride assigned notification to Driver
    rideAssignedToDriver: (ride, user, driver, vehicle) => ({
        subject: `📋 New Ride Assignment #${ride.rideId}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #7b1fa2; margin-bottom: 20px;">📋 New Ride Assignment</h1>
                    
                    <p>Dear ${driver.name},</p>
                    <p>You have been assigned a new ride. Please review the details below:</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Customer:</strong> ${user.name}</p>
                        <p><strong>Phone:</strong> ${user.phone}</p>
                        <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                        <p><strong>Vehicle:</strong> ${vehicle.vehicleNumber}</p>
                    </div>
                    
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h4 style="color: #1a5f2a; margin-top: 0;">📍 Pickup</h4>
                        <p style="margin: 0;">${ride.pickupLocation.address}</p>
                    </div>
                    
                    <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: #c62828; margin-top: 0;">📍 Destination</h4>
                        <p style="margin: 0;">${ride.destinationLocation.address}</p>
                    </div>
                    
                    <p><strong>Distance:</strong> ${ride.calculatedDistance} km</p>
                </div>
            </div>
        `
    }),

    // Ride reassigned notification
    rideReassigned: (ride, user, newDriver, newVehicle, isOldDriver = false) => ({
        subject: `🔄 Ride #${ride.rideId} - ${isOldDriver ? 'Reassigned to Another Driver' : 'Assignment Updated'}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #ff9800 0%, #ffa726 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #e65100; margin-bottom: 20px;">🔄 Ride Assignment Updated</h1>
                    
                    ${isOldDriver ? `
                        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="color: #e65100; margin: 0;">
                                This ride has been reassigned to another driver. You are no longer assigned to this ride.
                            </p>
                        </div>
                    ` : `
                        <p>The driver/vehicle for your ride has been updated. New details below:</p>
                        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #1565c0; margin-top: 0;">👤 New Driver</h3>
                            <p><strong>Name:</strong> ${newDriver.name}</p>
                            <p><strong>Phone:</strong> ${newDriver.phone}</p>
                            <p><strong>Vehicle:</strong> ${newVehicle.vehicleNumber}</p>
                        </div>
                    `}
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                    </div>
                </div>
            </div>
        `
    }),

    // Ride rejected notification
    rideRejected: (ride, user, rejectedBy) => ({
        subject: `❌ Ride Request #${ride.rideId} - Rejected`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #c62828 0%, #d32f2f 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #c62828; margin-bottom: 20px;">❌ Ride Request Rejected</h1>
                    
                    <p>Dear ${user.name},</p>
                    <p>We regret to inform you that your ride request has been rejected.</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                        <p><strong>From:</strong> ${ride.pickupLocation.address}</p>
                        <p><strong>To:</strong> ${ride.destinationLocation.address}</p>
                    </div>
                    
                    ${ride.rejectedBy.reason ? `
                        <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="color: #c62828; margin: 0;"><strong>Reason:</strong> ${ride.rejectedBy.reason}</p>
                        </div>
                    ` : ''}
                    
                    <p style="color: #666;">You can submit a new ride request if needed.</p>
                </div>
            </div>
        `
    }),

    // Ride completed notification
    rideCompleted: (ride, user, driver, vehicle) => ({
        subject: `✅ Ride #${ride.rideId} - Completed Successfully`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #1a5f2a; margin-bottom: 20px;">✅ Ride Completed</h1>
                    
                    <p>Dear ${user.name},</p>
                    <p>Your ride has been completed successfully. Thank you for using RideManager!</p>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #333; margin-top: 0;">Trip Summary</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Driver:</strong> ${driver.name}</p>
                        <p><strong>Vehicle:</strong> ${vehicle.vehicleNumber}</p>
                        <p><strong>Distance Traveled:</strong> ${ride.actualDistance || ride.calculatedDistance} km</p>
                    </div>
                </div>
            </div>
        `
    })
};

module.exports = { sendEmail, emailTemplates };