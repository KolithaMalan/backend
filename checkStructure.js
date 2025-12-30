const fs = require('fs');
const path = require('path');

console.log('\n🔍 Checking RideManager Backend Structure...\n');

const requiredFiles = [
  // Config
  'config/db.js',
  'config/config.js',
  
  // Models
  'models/User.js',
  'models/Ride.js',
  'models/Vehicle.js',
  'models/Notification.js',
  
  // Controllers
  'controllers/authController.js',
  'controllers/rideController.js',
  'controllers/userController.js',
  'controllers/vehicleController.js',
  'controllers/reportController.js',
  'controllers/notificationController.js',
  
  // Routes
  'routes/authRoutes.js',
  'routes/rideRoutes.js',
  'routes/userRoutes.js',
  'routes/vehicleRoutes.js',
  'routes/reportRoutes.js',
  'routes/notificationRoutes.js',
  
  // Middleware
  'middleware/authMiddleware.js',
  'middleware/roleMiddleware.js',
  
  // Services
  'services/emailService.js',
  'services/smsService.js',
  'services/notificationService.js',
  
  // Utils
  'utils/validators.js',
  'utils/helpers.js',
  
  // Seeders
  'seeders/seedData.js',
  
  // Root files
  'server.js',
  'package.json',
  '.env',
];

let missingFiles = [];
let existingFiles = [];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    existingFiles.push(file);
    console.log(`✅ ${file}`);
  } else {
    missingFiles.push(file);
    console.log(`❌ ${file} - MISSING`);
  }
});

console.log('\n' + '═'.repeat(60));
console.log(`\n📊 Summary:`);
console.log(`   ✅ Found: ${existingFiles.length} files`);
console.log(`   ❌ Missing: ${missingFiles.length} files`);

if (missingFiles.length > 0) {
  console.log(`\n⚠️  Please create the missing files before starting the server.\n`);
  console.log('Missing files:');
  missingFiles.forEach(f => console.log(`   - ${f}`));
} else {
  console.log(`\n🎉 All files are in place! You can start the server.\n`);
}