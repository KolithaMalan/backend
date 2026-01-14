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
    
    return Math.round(distance * 10) / 10;
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

/**
 * Parse date string safely (handles timezone issues)
 * ✅ NEW HELPER FUNCTION
 */
const parseDate = (dateInput) => {
    if (!dateInput) return null;
    
    // If it's already a Date object
    if (dateInput instanceof Date) {
        return dateInput;
    }
    
    // If it's a string like "2025-01-15" (YYYY-MM-DD format)
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        // Parse as local date to avoid timezone shift
        const [year, month, day] = dateInput.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
    }
    
    // For other formats, use default parsing
    return new Date(dateInput);
};

/**
 * Check if date is within booking window (14 days)
 * ✅ FIXED: Uses safe date parsing
 */
const isWithinBookingWindow = (date) => {
    try {
        // Get today at midnight (local time)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Parse the booking date safely
        const bookingDate = parseDate(date);
        bookingDate.setHours(0, 0, 0, 0);
        
        // Calculate max date (14 days from today)
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 14);
        maxDate.setHours(23, 59, 59, 999);
        
        const result = bookingDate >= today && bookingDate <= maxDate;
        
        // Debug logging
        console.log('📅 isWithinBookingWindow:', {
            input: date,
            bookingDate: bookingDate.toDateString(),
            today: today.toDateString(),
            maxDate: maxDate.toDateString(),
            isValidStart: bookingDate >= today,
            isValidEnd: bookingDate <= maxDate,
            result: result
        });
        
        return result;
    } catch (error) {
        console.error('❌ isWithinBookingWindow error:', error);
        return false;
    }
};

/**
 * Check if date is today or future
 * ✅ FIXED: Uses safe date parsing
 */
const isTodayOrFuture = (date) => {
    try {
        // Get today at midnight (local time)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Parse the check date safely
        const checkDate = parseDate(date);
        checkDate.setHours(0, 0, 0, 0);
        
        const result = checkDate >= today;
        
        // Debug logging
        console.log('📅 isTodayOrFuture:', {
            input: date,
            checkDate: checkDate.toDateString(),
            today: today.toDateString(),
            result: result
        });
        
        return result;
    } catch (error) {
        console.error('❌ isTodayOrFuture error:', error);
        return false;
    }
};

// Generate random ID
const generateId = (length = 6) => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
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
    parseDate,
    isWithinBookingWindow,
    isTodayOrFuture,
    generateId,
    getMonthRange,
    getDayRange
};
