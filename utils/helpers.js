// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of Earth in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

const toRad = (value) => {
    return (value * Math.PI) / 180;
};

// Format date for display
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

// Format time for display
const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes} ${ampm}`;
};

// Check if date is within booking window (14 days)
const isWithinBookingWindow = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);
    
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 14);
    
    return bookingDate >= today && bookingDate <= maxDate;
};

// Check if date is today or future
const isTodayOrFuture = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate >= today;
};

// Generate random ID
const generateId = (length = 6) => {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
};

// Get start and end of month
const getMonthRange = (date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
};

// Get start and end of day
const getDayRange = (date = new Date()) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
};

module.exports = {
    calculateDistance,
    formatDate,
    formatTime,
    isWithinBookingWindow,
    isTodayOrFuture,
    generateId,
    getMonthRange,
    getDayRange
};