const express = require('express');
const router = express.Router();
const {
  createBooking,
  getBookings,
  getBooking,
  cancelBooking,
  completeBooking,
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('CUSTOMER'), createBooking);
router.get('/', protect, getBookings);
router.get('/:id', protect, getBooking);
router.put('/:id/cancel', protect, authorize('CUSTOMER'), cancelBooking);
router.put('/:id/complete', protect, completeBooking);

module.exports = router;


