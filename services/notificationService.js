const { sendSMS, smsTemplates } = require('./smsService');
const Notification = require('../models/Notification');
const User = require('../models/User');
const config = require('../config/config');
const { sendEmail, emailTemplates, isEmailConfigured } = require('./emailService');

// Get hardcoded users
const getAdmin = async () => {
    return await User.findOne({ email: config.HARDCODED_USERS.ADMIN.email });
};

const getProjectManager = async () => {
    return await User.findOne({ email: config.HARDCODED_USERS.PROJECT_MANAGER.email });
};

// ✅ 1. Notify when ride is created
const notifyRideCreated = async (ride, requester) => {
    try {
        const distance = ride.calculatedDistance;
        const admin = await getAdmin();
        
        if (distance > config.PM_APPROVAL_THRESHOLD_KM) {
            // Long distance: Notify BOTH PM and Admin
            const pm = await getProjectManager();
            
            if (!pm) {
                console.error('❌ Project Manager user not found!');
            }
            
            // Notify Project Manager
            if (pm) {
                console.log(`📧 Sending PM notification to ${pm.email}...`);
                
                if (isEmailConfigured()) {
                    const emailTemplate = emailTemplates.rideCreatedForPM(ride, requester);
                    sendEmail({
                        to: pm.email,
                        subject: emailTemplate.subject,
                        html: emailTemplate.html
                    }).then(result => {
                        if (result.success) {
                            console.log(`✅ PM email sent successfully`);
                        } else {
                            console.error(`❌ PM email failed:`, result.error);
                        }
                    });
                }
                
                console.log(`📱 Sending PM SMS to ${pm.phone}...`);
                sendSMS({
                    to: pm.phone,
                    message: smsTemplates.rideCreatedForPM(ride, requester)
                }).then(result => {
                    if (result.success) {
                        console.log(`✅ PM SMS sent successfully`);
                    } else {
                        console.error(`❌ PM SMS failed:`, result.error);
                    }
                });

                await Notification.create({
                    recipient: pm._id,
                    type: 'ride_created',
                    title: 'Long Distance Ride Request',
                    message: `New ride request #${ride.rideId} (${distance}km) requires your approval`,
                    ride: ride._id,
                    emailSent: isEmailConfigured(),
                    smsSent: true
                });

                console.log(`✅ PM notified for long distance ride #${ride.rideId}`);
            }
            
            // Notify Admin
            if (admin) {
                console.log(`📧 Sending Admin notification to ${admin.email}...`);
                
                if (isEmailConfigured()) {
                    const emailTemplate = emailTemplates.rideCreatedForAdminLongDistance(ride, requester);
                    sendEmail({
                        to: admin.email,
                        subject: emailTemplate.subject,
                        html: emailTemplate.html
                    }).then(result => {
                        if (result.success) {
                            console.log(`✅ Admin email sent successfully`);
                        } else {
                            console.error(`❌ Admin email failed:`, result.error);
                        }
                    });
                }
                
                console.log(`📱 Sending Admin SMS to ${admin.phone}...`);
                sendSMS({
                    to: admin.phone,
                    message: smsTemplates.rideCreatedForAdminLongDistance(ride, requester)
                }).then(result => {
                    if (result.success) {
                        console.log(`✅ Admin SMS sent successfully`);
                    } else {
                        console.error(`❌ Admin SMS failed:`, result.error);
                    }
                });

                await Notification.create({
                    recipient: admin._id,
                    type: 'ride_created',
                    title: 'Long Distance Ride - Dual Approval',
                    message: `Ride #${ride.rideId} (${distance}km) can be approved by you (with note) or PM.`,
                    ride: ride._id,
                    emailSent: isEmailConfigured(),
                    smsSent: true
                });

                console.log(`✅ Admin notified for long distance ride #${ride.rideId}`);
            }
            
        } else {
            // Regular ride - Admin only
            if (admin) {
                if (isEmailConfigured()) {
                    const emailTemplate = emailTemplates.rideCreatedForAdmin(ride, requester);
                    sendEmail({
                        to: admin.email,
                        subject: emailTemplate.subject,
                        html: emailTemplate.html
                    }).then(result => {
                        if (result.success) {
                            console.log(`✅ Admin email sent successfully`);
                        }
                    });
                }
                
                sendSMS({
                    to: admin.phone,
                    message: smsTemplates.rideCreatedForAdmin(ride, requester)
                });

                await Notification.create({
                    recipient: admin._id,
                    type: 'ride_created',
                    title: 'New Ride Request',
                    message: `New ride request #${ride.rideId} (${distance}km) awaiting approval`,
                    ride: ride._id,
                    emailSent: isEmailConfigured(),
                    smsSent: true
                });

                console.log(`✅ Admin notified for regular ride #${ride.rideId}`);
            }
        }

        console.log('✅ Ride created notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride created notifications:', error);
    }
};

// ✅ 2. Notify when PM approves ride
const notifyPMApproved = async (ride, pm) => {
    try {
        const requester = await User.findById(ride.requester);
        const admin = await getAdmin();

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

            console.log(`✅ Admin notified of PM approval for ride #${ride.rideId}`);
        }

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
                message: `Your ride #${ride.rideId} has been approved by Plant Manager. Driver assignment pending.`,
                ride: ride._id,
                emailSent: true,
                smsSent: true
            });

            console.log(`✅ User notified of PM approval for ride #${ride.rideId}`);
        }

        console.log('✅ PM approval notifications sent');
    } catch (error) {
        console.error('❌ Error sending PM approval notifications:', error);
    }
};

// ✅ 3. Notify when Admin approves long distance ride (with note)
const notifyAdminApproved = async (ride, admin, approvalNote) => {
    try {
        const requester = await User.findById(ride.requester);
        const pm = await getProjectManager();

        if (pm && ride.calculatedDistance > config.PM_APPROVAL_THRESHOLD_KM) {
            const emailHTML = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1565c0 0%, #1976d2 100%); border-radius: 10px;">
                    <div style="background: white; padding: 30px; border-radius: 8px;">
                        <h1 style="color: #1565c0; margin-bottom: 20px;">Admin Approved Long Distance Ride</h1>
                        
                        <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #1976d2;">
                            <p style="color: #0d47a1; margin: 0; font-weight: bold;">
                                Admin ${admin.name} has approved this long-distance ride with the following note:
                            </p>
                        </div>
                        
                        <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                            <h4 style="color: #e65100; margin-top: 0;">Admin's Approval Note:</h4>
                            <p style="color: #333; font-style: italic; margin: 0;">"${approvalNote}"</p>
                        </div>
                        
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                            <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                            <p><strong>Requester:</strong> ${requester.name}</p>
                            <p><strong>Distance:</strong> <span style="color: #d32f2f; font-weight: bold;">${ride.calculatedDistance} km</span></p>
                            <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                            <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                        </div>
                        
                        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <h4 style="color: #1a5f2a; margin-top: 0;">From</h4>
                            <p style="margin: 0;">${ride.pickupLocation.address}</p>
                        </div>
                        
                        <div style="background: #ffebee; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h4 style="color: #c62828; margin-top: 0;">To</h4>
                            <p style="margin: 0;">${ride.destinationLocation.address}</p>
                        </div>
                    </div>
                </div>
            `;

            await sendEmail({
                to: pm.email,
                subject: `Admin Approved Ride #${ride.rideId} (${ride.calculatedDistance}km) with Note`,
                html: emailHTML
            });
            
            const smsMessage = `RideManager: Admin approved ride #${ride.rideId} (${ride.calculatedDistance}km). Note: "${approvalNote.substring(0, 80)}${approvalNote.length > 80 ? '...' : ''}". Driver assignment in progress.`;
            await sendSMS({
                to: pm.phone,
                message: smsMessage
            });

            console.log(`✅ PM notified of Admin approval with note for ride #${ride.rideId}`);
        }

        if (requester) {
            const emailHTML = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a5f2a 0%, #2e7d32 100%); border-radius: 10px;">
                    <div style="background: white; padding: 30px; border-radius: 8px;">
                        <h1 style="color: #1a5f2a; margin-bottom: 20px;">Ride Request Approved</h1>
                        
                        <p>Dear ${requester.name},</p>
                        <p>Your ride request has been approved by the Admin. A driver and vehicle will be assigned soon.</p>
                        
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                            <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                            <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                            <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                            <p><strong>From:</strong> ${ride.pickupLocation.address}</p>
                            <p><strong>To:</strong> ${ride.destinationLocation.address}</p>
                        </div>
                    </div>
                </div>
            `;

            await sendEmail({
                to: requester.email,
                subject: `Ride Request #${ride.rideId} - Approved`,
                html: emailHTML
            });
            
            await sendSMS({
                to: requester.phone,
                message: `RideManager: Your ride #${ride.rideId} has been approved by Admin. Driver will be assigned soon.`
            });

            console.log(`✅ User notified of Admin approval for ride #${ride.rideId}`);
        }

        console.log('✅ Admin approval notifications sent');
    } catch (error) {
        console.error('❌ Error sending admin approval notifications:', error);
    }
};

// ✅ 4. Notify when ride is assigned
const notifyRideAssigned = async (ride, driver, vehicle) => {
    try {
        const requester = await User.findById(ride.requester);

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

            console.log(`✅ User notified of ride assignment for ride #${ride.rideId}`);
        }

        const driverEmailTemplate = emailTemplates.rideAssignedToDriver(ride, requester, driver, vehicle);
        await sendEmail({
            to: driver.email,
            subject: driverEmailTemplate.subject,
            html: driverEmailTemplate.html
        });
        
        await sendSMS({
            to: driver.phone,
            message: smsTemplates.rideAssignedToDriver(ride, requester, vehicle)
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

        console.log(`✅ Driver notified of ride assignment for ride #${ride.rideId}`);
        console.log('✅ Ride assignment notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride assignment notifications:', error);
    }
};

// ✅ 5. Notify when ride is reassigned
const notifyRideReassigned = async (ride, newDriver, newVehicle, oldDriver) => {
    try {
        const requester = await User.findById(ride.requester);

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

            console.log(`✅ User notified of ride reassignment for ride #${ride.rideId}`);
        }

        const newDriverEmailTemplate = emailTemplates.rideAssignedToDriver(ride, requester, newDriver, newVehicle);
        await sendEmail({
            to: newDriver.email,
            subject: `New Ride Assignment #${ride.rideId} (Reassigned)`,
            html: newDriverEmailTemplate.html
        });
        
        await sendSMS({
            to: newDriver.phone,
            message: smsTemplates.rideReassignedNewDriver(ride, requester, newVehicle)
        });

        console.log(`✅ New driver notified of ride reassignment for ride #${ride.rideId}`);

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

            console.log(`✅ Old driver notified of ride reassignment for ride #${ride.rideId}`);
        }

        console.log('✅ Ride reassignment notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride reassignment notifications:', error);
    }
};

// ✅ 6. Notify when ride is rejected (with required reason)
const notifyRideRejected = async (ride, rejectedByUser, reason = '') => {
    try {
        const requester = await User.findById(ride.requester);

        if (requester) {
            const emailHTML = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #c62828 0%, #d32f2f 100%); border-radius: 10px;">
                    <div style="background: white; padding: 30px; border-radius: 8px;">
                        <h1 style="color: #c62828; margin-bottom: 20px;">❌ Ride Request Rejected</h1>
                        
                        <p>Dear ${requester.name},</p>
                        <p>We regret to inform you that your ride request has been rejected by ${rejectedByUser.name} (${rejectedByUser.role === 'admin' ? 'Administrator' : 'Project Manager'}).</p>
                        
                        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #333; margin-top: 0;">Ride Details</h3>
                            <p><strong>Ride ID:</strong> #${ride.rideId}</p>
                            <p><strong>Date:</strong> ${new Date(ride.scheduledDate).toLocaleDateString()}</p>
                            <p><strong>Time:</strong> ${ride.scheduledTime}</p>
                            <p><strong>From:</strong> ${ride.pickupLocation?.address || 'N/A'}</p>
                            <p><strong>To:</strong> ${ride.destinationLocation?.address || 'N/A'}</p>
                            <p><strong>Distance:</strong> ${ride.calculatedDistance} km</p>
                        </div>
                        
                        <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #c62828;">
                            <h4 style="color: #c62828; margin-top: 0;">📋 Rejection Reason</h4>
                            <p style="color: #333; margin: 0; font-size: 15px;">${reason || 'No reason provided'}</p>
                        </div>
                        
                        <div style="background: #fff3e0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <p style="color: #e65100; margin: 0;">
                                <strong>What to do next?</strong><br>
                                You can submit a new ride request with updated details if needed. 
                                If you have questions, please contact the administrator.
                            </p>
                        </div>
                        
                        <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">
                            This is an automated message from RideManager System
                        </p>
                    </div>
                </div>
            `;

            await sendEmail({
                to: requester.email,
                subject: `❌ Ride Request #${ride.rideId} - Rejected`,
                html: emailHTML
            });
            
            const smsMessage = `RideManager: Your ride #${ride.rideId} has been rejected. Reason: ${reason ? reason.substring(0, 100) : 'Not specified'}${reason && reason.length > 100 ? '...' : ''}. Submit a new request if needed.`;
            
            await sendSMS({
                to: requester.phone,
                message: smsMessage
            });

            await Notification.create({
                recipient: requester._id,
                type: 'ride_rejected',
                title: 'Ride Rejected',
                message: `Your ride request #${ride.rideId} has been rejected. Reason: ${reason || 'Not specified'}`,
                ride: ride._id,
                emailSent: true,
                smsSent: true
            });

            console.log(`✅ User notified of ride rejection for ride #${ride.rideId} with reason`);
        }

        console.log('✅ Ride rejection notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride rejection notifications:', error);
    }
};

// ✅ 7. Notify when ride is completed
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

            console.log(`✅ User notified of ride completion for ride #${ride.rideId}`);
        }

        console.log('✅ Ride completion notifications sent');
    } catch (error) {
        console.error('❌ Error sending ride completion notifications:', error);
    }
};

// ✅ Export all functions
module.exports = {
    notifyRideCreated,
    notifyPMApproved,
    notifyAdminApproved,
    notifyRideAssigned,
    notifyRideReassigned,
    notifyRideRejected,
    notifyRideCompleted
};
