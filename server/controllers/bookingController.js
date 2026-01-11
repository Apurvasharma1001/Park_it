const Booking = require('../models/Booking');
const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private/Customer
exports.createBooking = async (req, res) => {
  try {
    const { parkingLotId, hours } = req.body;

    if (!parkingLotId || !hours) {
      return res.status(400).json({ message: 'Please provide parking lot ID and hours' });
    }

    const parkingLot = await ParkingLot.findById(parkingLotId);
    if (!parkingLot || !parkingLot.isActive) {
      return res.status(404).json({ message: 'Parking lot not found or inactive' });
    }

    // Use unified service to find available slots
    const slotAvailabilityService = require('../services/slotAvailabilityService');

    // Refresh slot status to get latest availability with YOLO verification
    try {
      console.log('[BOOKING] Refreshing slot status with real-time detection...');
      await slotAvailabilityService.refreshSlotStatus(parkingLotId);
    } catch (error) {
      console.error('Failed to refresh slot status:', error.message);
      // Continue with database query as fallback
    }

    // Atomically find and mark a slot as occupied
    const availableSlot = await ParkingSlot.findOneAndUpdate({
      parkingLot: parkingLotId,
      isOccupied: false,
    }, {
      isOccupied: true,
      lastUpdated: new Date(),
      source: 'booking'
    }, { new: true });

    if (!availableSlot) {
      return res.status(400).json({ message: 'No available slots at this parking lot' });
    }

    // YOLO OPTIMIZATION: Double-check if vehicle is already parked in selected slot
    // This prevents booking slots that have vehicles but weren't detected in the refresh
    if (parkingLot.cameraEnabled && parkingLot.detectionMethod === 'yolo') {
      try {
        console.log(`[BOOKING] YOLO verification for slot ${availableSlot.slotNumber}...`);

        // Get fresh detection for this specific slot
        const slotStatus = await slotAvailabilityService.getSlotStatus(parkingLotId);
        const slotInfo = slotStatus.slots.find(s => s.slot_number === availableSlot.slotNumber);

        if (slotInfo && slotInfo.status === 'occupied') {
          // Vehicle detected in slot! Rollback booking
          console.log(`[BOOKING] ⚠️ Vehicle detected in slot ${availableSlot.slotNumber}, canceling booking`);

          availableSlot.isOccupied = true; // Keep as occupied (vehicle is there)
          availableSlot.source = 'camera'; // Update source to camera
          await availableSlot.save();

          return res.status(409).json({
            message: 'This slot is currently occupied by a vehicle. Please select another slot.',
            slotNumber: availableSlot.slotNumber,
            detectedVehicle: true,
            vehicleMetadata: slotInfo.vehicle_metadata
          });
        }

        console.log(`[BOOKING] ✅ Slot ${availableSlot.slotNumber} verified vacant by YOLO`);
      } catch (verificationError) {
        console.error('[BOOKING] YOLO verification failed:', verificationError.message);
        // Continue with booking if verification fails (fallback to database state)
      }
    }

    // Calculate price and times
    const startTime = new Date();
    const durationHours = parseFloat(hours);
    const totalPrice = parkingLot.pricePerHour * durationHours;
    const scheduledEndTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

    // Create booking
    const booking = await Booking.create({
      customer: req.user._id,
      parkingLot: parkingLotId,
      parkingSlot: availableSlot._id,
      startTime,
      scheduledEndTime, // Store when they are supposed to leave
      totalPrice,
      status: 'ACTIVE',
    });

    // Populate references
    await booking.populate('parkingLot', 'name address pricePerHour location');
    await booking.populate('parkingSlot', 'slotNumber');
    await booking.populate('customer', 'name email');

    res.status(201).json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user bookings
// @route   GET /api/bookings
// @access  Private
exports.getBookings = async (req, res) => {
  try {
    let query = {};

    // Customers see their own bookings, owners see bookings for their lots
    if (req.user.role === 'CUSTOMER') {
      query.customer = req.user._id;
    } else if (req.user.role === 'OWNER') {
      const ownerParkingLots = await ParkingLot.find({ owner: req.user._id });
      query.parkingLot = { $in: ownerParkingLots.map((lot) => lot._id) };
    }

    const bookings = await Booking.find(query)
      .populate('parkingLot', 'name address pricePerHour location')
      .populate('parkingSlot', 'slotNumber')
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('parkingLot', 'name address pricePerHour location')
      .populate('parkingSlot', 'slotNumber')
      .populate('customer', 'name email');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check authorization
    if (req.user.role === 'CUSTOMER' && booking.customer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.user.role === 'OWNER') {
      const parkingLot = await ParkingLot.findById(booking.parkingLot._id);
      if (parkingLot.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private/Customer
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to cancel this booking' });
    }

    if (booking.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Only active bookings can be cancelled' });
    }

    booking.status = 'CANCELLED';
    booking.endTime = new Date();
    await booking.save();

    // Free up the slot
    const slot = await ParkingSlot.findById(booking.parkingSlot);
    if (slot) {
      slot.isOccupied = false;
      slot.lastUpdated = new Date();
      await slot.save();
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Complete booking (exit parking)
// @route   PUT /api/bookings/:id/complete
// @access  Private
exports.completeBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('parkingLot');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Only active bookings can be completed' });
    }

    // Authorization check
    if (req.user.role === 'CUSTOMER' && booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to complete this booking' });
    }

    const actualEndTime = new Date();
    let finalPrice = booking.totalPrice;
    let message = 'Booking completed successfully';

    // Check for overstay
    if (actualEndTime > booking.scheduledEndTime) {
      const overstayMs = actualEndTime - booking.scheduledEndTime;
      const overstayHours = Math.ceil(overstayMs / (1000 * 60 * 60)); // Round up to next hour

      // Calculate penalty (Standard rate for now)
      const penalty = overstayHours * booking.parkingLot.pricePerHour;
      finalPrice += penalty;

      message = `Booking completed with overstay. Added ₹${penalty.toFixed(2)} for ${overstayHours} extra hours.`;
    }

    booking.status = 'COMPLETED';
    booking.endTime = actualEndTime;
    booking.totalPrice = finalPrice;
    await booking.save();

    // Free up the slot
    const slot = await ParkingSlot.findById(booking.parkingSlot);
    if (slot) {
      slot.isOccupied = false;
      slot.lastUpdated = new Date();
      await slot.save();
    }

    res.json({ ...booking.toObject(), message });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


