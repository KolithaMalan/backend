module.exports = {
    // Ride distance threshold for PM approval
    PM_APPROVAL_THRESHOLD_KM: 15,

    // Maximum pending rides per user
    MAX_PENDING_RIDES_USER: 3,

    // Booking window (in days)
    MAX_ADVANCE_BOOKING_DAYS: 14,

    // Roles
    ROLES: {
        USER: 'user',
        DRIVER: 'driver',
        ADMIN: 'admin',
        PROJECT_MANAGER: 'project_manager'
    },

    // Ride statuses
    RIDE_STATUS: {
        PENDING: 'pending',
        AWAITING_PM: 'awaiting_pm',
        AWAITING_ADMIN: 'awaiting_admin',
        PM_APPROVED: 'pm_approved',
        APPROVED: 'approved',
        ASSIGNED: 'assigned',
        IN_PROGRESS: 'in_progress',
        COMPLETED: 'completed',
        REJECTED: 'rejected',
        CANCELLED: 'cancelled'
    },

    // Vehicle statuses
    VEHICLE_STATUS: {
        AVAILABLE: 'available',
        BUSY: 'busy',
        MAINTENANCE: 'maintenance'
    },

    // Driver statuses
    DRIVER_STATUS: {
        AVAILABLE: 'available',
        BUSY: 'busy',
        OFFLINE: 'offline'
    },

    // Ride types
    RIDE_TYPE: {
        ONE_WAY: 'one_way',
        RETURN: 'return'
    },

    // Hardcoded credentials
    HARDCODED_USERS: {
        PROJECT_MANAGER: {
            name: 'Amal Fernando',
            email: 'amal.fernando@ltl.lk',
            phone: '0750569545',
            password: 'Amal#$#321',
            role: 'project_manager'
        },
        ADMIN: {
            name: 'Kolitha Malan',
            email: 'koliyxmalan121@gmail.com',
            phone: '0778561467',
            password: 'Nithya123@#',
            role: 'admin'
        }   
    },

    // Initial Vehicles
    // abilashini ,  heshani
    INITIAL_VEHICLES: [
        { vehicleNumber: 'NB-1985', type: 'Car', status: 'available' },
        { vehicleNumber: 'PA-4473', type: 'Car', status: 'available' },
        { vehicleNumber: 'NC-3888', type: 'Car', status: 'available' },
        { vehicleNumber: 'KH-5330', type: 'Car', status: 'available' }
    ],

    // Initial Drivers (placeholders)
    INITIAL_DRIVERS: [
        { name: 'Driver 1', email: 'driver1@ridemanager.com', phone: '0771111111', password: 'Driver1@#' },
        { name: 'Driver 2', email: 'driver2@ridemanager.com', phone: '0772222222', password: 'Driver2@#' },
        { name: 'Driver 3', email: 'driver3@ridemanager.com', phone: '0773333333', password: 'Driver3@#' },
        { name: 'Driver 4', email: 'driver4@ridemanager.com', phone: '0774444444', password: 'Driver4@#' }
    ]
};
