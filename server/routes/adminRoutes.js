const express = require('express');
const router = express.Router();
const {
  getCustomers,
  getOwners,
  getBookings,
  getParkingLots,
  getStats,
  getCustomerById,
  getOwnerById,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Admin routes - require authentication and ADMIN role
// Dashboard stats
router.get('/stats', protect, authorize('ADMIN'), getStats);

// Customers
router.get('/customers', protect, authorize('ADMIN'), getCustomers);
router.get('/customers/:id', protect, authorize('ADMIN'), getCustomerById);

// Owners
router.get('/owners', protect, authorize('ADMIN'), getOwners);
router.get('/owners/:id', protect, authorize('ADMIN'), getOwnerById);

// Bookings
router.get('/bookings', protect, authorize('ADMIN'), getBookings);

// Parking Lots
router.get('/parking-lots', protect, authorize('ADMIN'), getParkingLots);

module.exports = router;

