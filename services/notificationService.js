const { sendEmail, emailTemplates } = require('./emailService');
const { sendSMS, smsTemplates } = require('./smsService');
const Notification = require('../models/Notification');
const User = require('../models/User');
const config = require('../config/config');

// Get hardcoded users
const getAdmin = async () => {
    return await User.findOne({ email: config.HARDCODED_USERS.ADMIN.email });
};

const getProjectManager = async () => {
    return await User.findOne({ email: config.HARDCODED_USERS.PROJECT_MANAGER.email });
};

// Notify when ride is created
// Notify when ride is created
// Notify when ride is created
const notifyRideCreated = async (ride, requester) => {
    try {
        const distance = ride.calculatedDistance;
        const admin = await getAdmin();
        
        if (distance > config.PM_APPROVAL_THRESHOLD_KM) {
            // ✅ NEW: Notify BOTH PM and Admin for long distance rides
            const pm = await getProjectManager();
            
            // Notify Project Manager
            if (pm) {
                const emailTemplate = emailTemplates.rideCreatedForPM(ride, requester);
                await sendEmail({
                    to: pm.email,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html
                });
                
                await sendSMS({
                    to: pm.phone,
                    message: smsTemplates.rideCreatedForPM(ride, requester)
                });

                await Notification.create({
                    recipient: pm._id,
                    type: 'ride_created',
                    title: 'Long Distance Ride Request',
                    message: `New ride request #${ride.rideId} (${distance}km) requires your approval`,
                    ride: ride._id,
                    emailSent: true,
                    smsSent: true
                });
            }
            
            // ✅ ALSO notify Admin for long distance rides
            if (admin) {
                const emailTemplate = emailTemplates.rideCreatedForAdminLongDistance(ride, requester);
                await sendEmail({
                    to: admin.email,
                    subject: `⚠️ Long Distance Ride #${ride.rideId} - Dual Approval Available`,
                    html: emailTemplate.html
                });
                
                await sendSMS({
                    to: admin.phone,
                    message: `⚠️ RideManager: Long distance ride #${ride.rideId} (${distance}km) from ${requester.name}. You can approve with note OR wait for PM approval.`
                });

                await Notification.create({
                    recipient: admin._id,
                    type: 'ride_created',
                    title: 'Long Distance Ride - Dual Approval',
                    message: `Ride #${ride.rideId} (${distance}km) can be approved by you (with note) or PM.`,
                    ride: ride._id,
                    emailSent: true,
                    smsSent: true
                });
            }
        } else {
            // Notify Admin only for short distance rides
            if (admin) {
                const emailTemplate = emailTemplates.rideCreatedForAdmin(ride, requester);
                await sendEmail({
                    to: admin.email,
                    subject: emailTemplate.subject,
                    html: emailTemplate.html
                });
                
                await sendSMS({
                    to: admin.phone,
                    message: smsTemplates.rideCreatedForAdmin(ride, requester)
                });

                await Notification.create({
                    recipient: admin._id,
                    type: 'ride_created',
                    title: 'New Ride Request',
                    message: `New ride request #${ride.rideId} (${distance}km) awaiting approval`,
                    ride: ride._id,
                    emailSent: true,
                    smsSent: true
                });
            }
        }

        console.log('✅ Ride created notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride created notifications:', error);
    }
};

// Notify when PM approves ride
const notifyPMApproved = async (ride, pm) => {
    try {
        const requester = await User.findById(ride.requester);
        const admin = await getAdmin();

        // Notify Admin
        if (admin) {
            const emailTemplate = emailTemplates.pmApprovedNotifyAdmin(ride, requester, pm);
            await sendEmail({
                to: admin.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html
            });
            
            await sendSMS({
                to: admin.phone,
                message: smsTemplates.pmApprovedNotifyAdmin(ride)
            });

            await Notification.create({
                recipient: admin._id,
                type: 'ride_approved',
                title: 'PM Approved - Assign Driver',
                message: `Ride #${ride.rideId} approved by PM. Please assign driver & vehicle.`,
                ride: ride._id,
                emailSent: true,
                smsSent: true
            });
        }

        // Notify User
        if (requester) {
            const emailTemplate = emailTemplates.pmApprovedNotifyUser(ride, requester);
            await sendEmail({
                to: requester.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html
            });
            
            await sendSMS({
                to: requester.phone,
                message: smsTemplates.pmApprovedNotifyUser(ride)
            });

            await Notification.create({
                recipient: requester._id,
                type: 'ride_approved',
                title: 'Ride Approved by PM',
                message: `Your ride #${ride.rideId} has been approved. Driver assignment pending.`,
                ride: ride._id,
                emailSent: true,
                smsSent: true
            });
        }

        console.log('✅ PM approval notifications sent');
    } catch (error) {
        console.error('❌ Error sending PM approval notifications:', error);
    }
};

// Notify when ride is assigned
const notifyRideAssigned = async (ride, driver, vehicle) => {
    try {
        const requester = await User.findById(ride.requester);
        const pm = await getProjectManager();

        // Notify User (Email + SMS)
        if (requester) {
            const emailTemplate = emailTemplates.rideAssignedToUser(ride, requester, driver, vehicle);
            await sendEmail({
                to: requester.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html
            });
            
            await sendSMS({
                to: requester.phone,
                message: smsTemplates.rideAssignedToUser(ride, driver, vehicle)
            });

            await Notification.create({
                recipient: requester._id,
                type: 'ride_assigned',
                title: 'Driver Assigned',
                message: `Driver ${driver.name} with vehicle ${vehicle.vehicleNumber} assigned for your ride.`,
                ride: ride._id,
                emailSent: true,
                smsSent: true
            });
        }

        // Notify Driver (SMS only)
        await sendSMS({
            to: driver.phone,
            message: smsTemplates.rideAssignedToDriver(ride, requester, vehicle)
        });

        // Also send email to driver
        const driverEmailTemplate = emailTemplates.rideAssignedToDriver(ride, requester, driver, vehicle);
        await sendEmail({
            to: driver.email,
            subject: driverEmailTemplate.subject,
            html: driverEmailTemplate.html
        });

        await Notification.create({
            recipient: driver._id,
            type: 'ride_assigned',
            title: 'New Ride Assignment',
            message: `You have been assigned ride #${ride.rideId}`,
            ride: ride._id,
            emailSent: true,
            smsSent: true
        });

        // Notify PM (if it was a long distance ride)
        if (ride.requiresPMApproval && pm) {
            await sendEmail({
                to: pm.email,
                subject: `🚗 Ride #${ride.rideId} - Driver Assigned`,
                html: `<p>Ride #${ride.rideId} has been assigned to driver ${driver.name} with vehicle ${vehicle.vehicleNumber}.</p>`
            });
            
            await sendSMS({
                to: pm.phone,
                message: `RideManager: Ride #${ride.rideId} assigned to ${driver.name} (${vehicle.vehicleNumber}).`
            });
        }

        console.log('✅ Ride assignment notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride assignment notifications:', error);
    }
};

// Notify when ride is reassigned
const notifyRideReassigned = async (ride, newDriver, newVehicle, oldDriver) => {
    try {
        const requester = await User.findById(ride.requester);

        // Notify User
        if (requester) {
            const emailTemplate = emailTemplates.rideReassigned(ride, requester, newDriver, newVehicle, false);
            await sendEmail({
                to: requester.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html
            });
            
            await sendSMS({
                to: requester.phone,
                message: smsTemplates.rideReassignedToUser(ride, newDriver, newVehicle)
            });
        }

        // Notify New Driver
        await sendSMS({
            to: newDriver.phone,
            message: smsTemplates.rideReassignedNewDriver(ride, requester, newVehicle)
        });

        // Notify Old Driver
        if (oldDriver) {
            const oldDriverEmailTemplate = emailTemplates.rideReassigned(ride, requester, newDriver, newVehicle, true);
            await sendEmail({
                to: oldDriver.email,
                subject: oldDriverEmailTemplate.subject,
                html: oldDriverEmailTemplate.html
            });
            
            await sendSMS({
                to: oldDriver.phone,
                message: smsTemplates.rideReassignedOldDriver(ride)
            });
        }

        console.log('✅ Ride reassignment notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride reassignment notifications:', error);
    }
};

// Notify when ride is rejected
const notifyRideRejected = async (ride, rejectedByUser) => {
    try {
        const requester = await User.findById(ride.requester);

        if (requester) {
            const emailTemplate = emailTemplates.rideRejected(ride, requester, rejectedByUser);
            await sendEmail({
                to: requester.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html
            });
            
            await sendSMS({
                to: requester.phone,
                message: smsTemplates.rideRejected(ride)
            });

            await Notification.create({
                recipient: requester._id,
                type: 'ride_rejected',
                title: 'Ride Rejected',
                message: `Your ride request #${ride.rideId} has been rejected.`,
                ride: ride._id,
                emailSent: true,
                smsSent: true
            });
        }

        console.log('✅ Ride rejection notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride rejection notifications:', error);
    }
};

// Notify when ride is completed
const notifyRideCompleted = async (ride) => {
    try {
        const requester = await User.findById(ride.requester);
        const driver = await User.findById(ride.assignedDriver);
        const Vehicle = require('../models/Vehicle');
        const vehicle = await Vehicle.findById(ride.assignedVehicle);

        if (requester) {
            const emailTemplate = emailTemplates.rideCompleted(ride, requester, driver, vehicle);
            await sendEmail({
                to: requester.email,
                subject: emailTemplate.subject,
                html: emailTemplate.html
            });
            
            await sendSMS({
                to: requester.phone,
                message: smsTemplates.rideCompleted(ride)
            });

            await Notification.create({
                recipient: requester._id,
                type: 'ride_completed',
                title: 'Ride Completed',
                message: `Your ride #${ride.rideId} has been completed successfully.`,
                ride: ride._id,
                emailSent: true,
                smsSent: true
            });
        }

        console.log('✅ Ride completion notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride completion notifications:', error);
    }
};


// ✅ NEW: Notify PM when Admin approves with note (for long distance rides)
const notifyPMAboutAdminApproval = async (ride, admin, note) => {
    try {
        const pm = await getProjectManager();
        const requester = await User.findById(ride.requester);
        
        if (!pm) return;

        // Email Template
        const emailHTML = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%); border-radius: 10px;">
                <div style="background: white; padding: 30px; border-radius: 8px;">
                    <h1 style="color: #1565c0; margin-bottom: 20px;">✅ Admin Approved Long Distance Ride</h1>
                    
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #1976d2;">
                        <p style="color: #0d47a1; margin: 0; font-weight: bold;">
                            Admin ${admin.name} has approved this long-distance ride with the following note:
                        </p>
                    </div>
                    
                    <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                        <h4 style="color: #e65100; margin-top: 0;">📝 Admin's Approval Note:</h4>
                        <p style="color: #333; font-style: italic; margin: 0;">"${note}"</p>
                    </div>
                    
                    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                        <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                        <p><strong>Requester:</strong> ${requester.name} (${requester.email})</p>
                        <p><strong>Type:</strong> ${ride.rideType === 'one_way' ? 'One-Way' : 'Return Trip'}</p>
                        <p><strong>Distance:</strong> <span style="color: #d32f2f; font-weight: bold;">${ride.calculatedDistance} km</span></p>
                        <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                    </div>
                    
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h4 style="color: #1a5f2a; margin-top: 0;">📍 From</h4>
                        <p style="margin: 0;">${ride.pickupLocation.address}</p>
                    </div>
                    
                    <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="color: #c62828; margin-top: 0;">📍 To</h4>
                        <p style="margin: 0;">${ride.destinationLocation.address}</p>
                    </div>
                    
                    <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-top: 20px;">
                        <p style="color: #2e7d32; margin: 0; font-weight: bold;">
                            ✅ This ride has been approved and is now ready for driver & vehicle assignment.
                        </p>
                    </div>
                    
                    <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">
                        This is an automated notification from RideManager System
                    </p>
                </div>
            </div>
        `;

        // Send Email
        await sendEmail({
            to: pm.email,
            subject: `✅ Admin Approved Ride #${ride.rideId} (${ride.calculatedDistance}km) with Note`,
            html: emailHTML
        });
        
        // Send SMS (shorter version)
        const smsMessage = `✅ RideManager: Admin approved ride #${ride.rideId} (${ride.calculatedDistance}km). Reason: "${note.substring(0, 100)}${note.length > 100 ? '...' : ''}". Driver assignment in progress.`;
        await sendSMS({
            to: pm.phone,
            message: smsMessage
        });

        console.log('✅ PM notified about admin approval with note');
    } catch (error) {
        console.error('❌ Error notifying PM about admin approval:', error);
    }
};

module.exports = {
    notifyRideCreated,
    notifyPMApproved,
    notifyRideAssigned,
    notifyRideReassigned,
    notifyRideRejected,
    notifyRideCompleted,
    notifyPMAboutAdminApproval // NEW
};