const nodemailer = require('nodemailer');

// Try to load SendGrid (optional fallback)
let sgMail;
try {
    sgMail = require('@sendgrid/mail');
} catch (e) {
    console.log('ℹ️ SendGrid not available, using Nodemailer only');
}

// Create Nodemailer transporter (Gmail SMTP)
let nodemailerTransporter = null;

const getNodemailerTransporter = () => {
    if (nodemailerTransporter) return nodemailerTransporter;

    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_FROM;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD;

    if (!smtpUser || !smtpPass) {
        return null;
    }

    nodemailerTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });

    console.log(`✅ Nodemailer transporter created (${process.env.SMTP_HOST || 'smtp.gmail.com'})`);
    return nodemailerTransporter;
};

// Initialize SendGrid with API key (fallback)
const initializeSendGrid = () => {
    if (!sgMail) return false;
    if (process.env.SENDGRID_API_KEY) {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        console.log('✅ SendGrid initialized with API key');
        return true;
    }
    return false;
};

// Check if email is properly configured (any method)
const isEmailConfigured = () => {
    if (process.env.DISABLE_EMAIL === 'true') {
        console.log('⚠️ Email is disabled via DISABLE_EMAIL env variable');
        return false;
    }

    // Check Nodemailer (Gmail SMTP) config
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_FROM;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD;
    if (smtpUser && smtpPass) {
        return true;
    }

    // Check SendGrid config
    if (process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM) {
        return true;
    }

    console.warn('⚠️ Email not configured. Set SMTP_USER + SMTP_PASS (or EMAIL_APP_PASSWORD) for Gmail SMTP, or SENDGRID_API_KEY for SendGrid.');
    return false;
};

// Send email via Nodemailer (Gmail SMTP) — primary method
const sendViaNodemailer = async ({ to, subject, html, text }) => {
    const transporter = getNodemailerTransporter();
    if (!transporter) {
        throw new Error('Nodemailer not configured. Set SMTP_USER and SMTP_PASS (or EMAIL_APP_PASSWORD) environment variables.');
    }

    const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;
    const fromName = process.env.EMAIL_FROM_NAME || 'RideManager';

    const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to,
        subject,
        html,
        text: text || subject,
    };

    console.log(`📧 Sending email to ${to} via Nodemailer (SMTP)...`);

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`   Message ID: ${info.messageId}`);

    return {
        success: true,
        messageId: info.messageId,
        response: info.response,
    };
};

// Send email via SendGrid — fallback method
const sendViaSendGrid = async ({ to, subject, html, text }) => {
    if (!sgMail || !process.env.SENDGRID_API_KEY) {
        throw new Error('SendGrid not configured');
    }

    initializeSendGrid();

    const msg = {
        to,
        from: {
            email: process.env.EMAIL_FROM,
            name: process.env.EMAIL_FROM_NAME || 'RideManager',
        },
        subject,
        html,
        text: text || subject,
    };

    console.log(`📧 Sending email to ${to} via SendGrid API...`);

    const sendPromise = sgMail.send(msg);
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email send timeout after 15s')), 15000)
    );

    const result = await Promise.race([sendPromise, timeoutPromise]);

    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`   Status: ${result[0].statusCode}`);

    return {
        success: true,
        statusCode: result[0].statusCode,
        response: result[0].body,
    };
};

// Main sendEmail function — tries Nodemailer first, falls back to SendGrid
const sendEmail = async ({ to, subject, html, text }) => {
    // Check configuration first
    if (!isEmailConfigured()) {
        const errorMsg = 'Email service not configured. Please set SMTP_USER and SMTP_PASS (or EMAIL_APP_PASSWORD) in your .env file.';
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
    }

    // Try Nodemailer (Gmail SMTP) first
    const smtpUser = process.env.SMTP_USER || process.env.EMAIL_FROM;
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_APP_PASSWORD;

    if (smtpUser && smtpPass) {
        try {
            return await sendViaNodemailer({ to, subject, html, text });
        } catch (nodemailerError) {
            console.error(`❌ Nodemailer failed: ${nodemailerError.message}`);

            // If SendGrid is also configured, try it as fallback
            if (process.env.SENDGRID_API_KEY) {
                console.log('🔄 Falling back to SendGrid...');
                try {
                    return await sendViaSendGrid({ to, subject, html, text });
                } catch (sendGridError) {
                    console.error(`❌ SendGrid fallback also failed: ${sendGridError.message}`);
                    throw new Error(`Email failed via both SMTP and SendGrid. SMTP error: ${nodemailerError.message}`);
                }
            }

            throw nodemailerError;
        }
    }

    // Try SendGrid if Nodemailer is not configured
    if (process.env.SENDGRID_API_KEY) {
        try {
            return await sendViaSendGrid({ to, subject, html, text });
        } catch (sendGridError) {
            console.error(`❌ SendGrid failed: ${sendGridError.message}`);
            if (sendGridError.response) {
                console.error(`   Status: ${sendGridError.response.statusCode}`);
                console.error(`   Body:`, sendGridError.response.body);
            }
            throw sendGridError;
        }
    }

    throw new Error('No email transport available. Configure SMTP or SendGrid.');
};

// Email Templates
const emailTemplates = {
    // ✅ Ride created notification to Admin (SHORT distance - ≤15km)
    rideCreatedForAdmin: (ride, user) => ({
        subject: `🚗 New Ride Request #${ride.rideId} - Approval Required`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #1a5f2a; margin-bottom: 20px;">🚗 New Ride Request</h1>
                    
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #4caf50;">
                        <p style="color: #2e7d32; margin: 0; font-weight: bold;">
                            A new ride request has been submitted and requires your approval.
                        </p>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Requester:</strong> ${user.name} (${user.email})</p>
                        <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
                        <p><strong>Type:</strong> ${ride.rideType === 'one_way' ? 'One-Way' : 'Return Trip'}</p>
                        <p><strong>Distance:</strong> ${ride.calculatedDistance} km</p>
                        <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                    </div>
                    
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h4 style="color: #1a5f2a; margin-top: 0;">📍 Pickup Location</h4>
                        <p style="margin: 0;">${ride.pickupLocation.address}</p>
                    </div>
                    
                    <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: #c62828; margin-top: 0;">📍 Destination</h4>
                        <p style="margin: 0;">${ride.destinationLocation.address}</p>
                    </div>
                    
                    ${ride.purpose ? `
                        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h4 style="color: #e65100; margin-top: 0;">📝 Purpose</h4>
                            <p style="margin: 0;">${ride.purpose}</p>
                        </div>
                    ` : ''}
                    
                    <div style="text-align: center; margin-top: 30px;">
                        <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://your-app.vercel.app'}/admin/rides" 
                           style="background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                            Review & Assign Driver
                        </a>
                    </div>
                    
                    <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">
                        This is an automated message from RideManager System
                    </p>
                </div>
            </div>
        `
    }),

    // ✅ Long distance ride notification to Admin (dual approval system)
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
                        <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://your-app.vercel.app'}/admin/rides" 
                           style="background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
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
                        <a href="${process.env.ADMIN_DASHBOARD_URL || 'https://your-app.vercel.app'}/pm/rides" 
                           style="background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
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
                            Plant Manager ${pm.name} has approved this ride. Please assign a driver and vehicle.
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
                    <p>Good news! Your ride request has been approved by the Plant Manager. The admin will now assign a driver and vehicle for your trip.</p>
                    
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
                    
                    ${ride.rejectedBy?.reason ? `
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

module.exports = { sendEmail, emailTemplates, isEmailConfigured };
