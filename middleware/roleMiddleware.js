// Check if user has required role(s)
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Role '${req.user.role}' is not authorized to access this resource`
            });
        }

        next();
    };
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin only.'
        });
    }
};

// Check if user is project manager
const isProjectManager = (req, res, next) => {
    if (req.user && req.user.role === 'project_manager') {
        next();
    } else {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Project Manager only.'
        });
    }
};

// Check if user is driver
const isDriver = (req, res, next) => {
    if (req.user && req.user.role === 'driver') {
        next();
    } else {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Driver only.'
        });
    }
};

// Check if user is admin or project manager
const isAdminOrPM = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'project_manager')) {
        next();
    } else {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin or Project Manager only.'
        });
    }
};

module.exports = {
    authorize,
    isAdmin,
    isProjectManager,
    isDriver,
    isAdminOrPM
};