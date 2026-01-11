const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const slotAvailabilityService = require('../services/slotAvailabilityService');
const opencvService = require('../services/opencvService');

// @desc    Create a new parking lot
// @route   POST /api/parking-lots
// @access  Private/Owner
exports.createParkingLot = async (req, res) => {
  try {
    const { name, latitude, longitude, address, pricePerHour, totalSlots, cameraImageUrl } = req.body;

    if (!name || !latitude || !longitude || !address || !pricePerHour || !totalSlots) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const parkingLot = await ParkingLot.create({
      owner: req.user._id,
      name,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      address,
      pricePerHour: parseFloat(pricePerHour),
      totalSlots: parseInt(totalSlots),
      cameraImageUrl: cameraImageUrl || '',
    });

    // Create parking slots
    const slots = [];
    for (let i = 1; i <= totalSlots; i++) {
      const slot = await ParkingSlot.create({
        parkingLot: parkingLot._id,
        slotNumber: i,
        isOccupied: false,
      });
      slots.push(slot);
    }

    res.status(201).json({
      ...parkingLot.toObject(),
      slots: slots.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all parking lots (for customers - nearby)
// @route   GET /api/parking-lots
// @access  Private
exports.getParkingLots = async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 10000 } = req.query; // maxDistance in meters

    let query = { isActive: true };

    // If coordinates provided, find nearby parking lots
    if (latitude && longitude) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(maxDistance),
        },
      };
    }

    const parkingLots = await ParkingLot.find(query).populate('owner', 'name email');

    // Get availability for each parking lot using unified service
    const parkingLotsWithAvailability = await Promise.all(
      parkingLots.map(async (lot) => {
        try {
          const status = await slotAvailabilityService.getSlotStatus(lot._id);
          return {
            ...lot.toObject(),
            totalSlots: status.total_slots,
            occupiedSlots: status.occupied_slots,
            availableSlots: status.vacant_slots,
            cameraEnabled: status.camera_enabled,
          };
        } catch (error) {
          // Fallback to manual counting if service fails
          console.error(`Failed to get slot status for lot ${lot._id}:`, error.message);
        const totalSlots = await ParkingSlot.countDocuments({ parkingLot: lot._id });
        const occupiedSlots = await ParkingSlot.countDocuments({
          parkingLot: lot._id,
          isOccupied: true,
        });
        const availableSlots = totalSlots - occupiedSlots;
        return {
          ...lot.toObject(),
          totalSlots,
          occupiedSlots,
          availableSlots,
            cameraEnabled: lot.cameraEnabled || false,
        };
        }
      })
    );

    res.json(parkingLotsWithAvailability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get parking lots by owner
// @route   GET /api/parking-lots/owner
// @access  Private/Owner
exports.getOwnerParkingLots = async (req, res) => {
  try {
    const parkingLots = await ParkingLot.find({ owner: req.user._id });

    const parkingLotsWithAvailability = await Promise.all(
      parkingLots.map(async (lot) => {
        try {
          const status = await slotAvailabilityService.getSlotStatus(lot._id);
          const slots = await ParkingSlot.find({ parkingLot: lot._id }).sort({ slotNumber: 1 });
          
          return {
            ...lot.toObject(),
            slots: slots,
            totalSlots: status.total_slots,
            occupiedSlots: status.occupied_slots,
            availableSlots: status.vacant_slots,
            cameraEnabled: status.camera_enabled,
          };
        } catch (error) {
          // Fallback to manual counting
          console.error(`Failed to get slot status for lot ${lot._id}:`, error.message);
        const slots = await ParkingSlot.find({ parkingLot: lot._id }).sort({ slotNumber: 1 });
        const totalSlots = slots.length;
        const occupiedSlots = slots.filter((s) => s.isOccupied).length;
        const availableSlots = totalSlots - occupiedSlots;

        return {
          ...lot.toObject(),
          slots: slots,
          totalSlots,
          occupiedSlots,
          availableSlots,
            cameraEnabled: lot.cameraEnabled || false,
        };
        }
      })
    );

    res.json(parkingLotsWithAvailability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single parking lot
// @route   GET /api/parking-lots/:id
// @access  Private
exports.getParkingLot = async (req, res) => {
  try {
    const parkingLot = await ParkingLot.findById(req.params.id).populate('owner', 'name email');

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    // Use unified service to get slot status
    try {
      const status = await slotAvailabilityService.getSlotStatus(parkingLot._id);
      const slots = await ParkingSlot.find({ parkingLot: parkingLot._id }).sort({ slotNumber: 1 });
      
      res.json({
        ...parkingLot.toObject(),
        slots: slots,
        totalSlots: status.total_slots,
        occupiedSlots: status.occupied_slots,
        availableSlots: status.vacant_slots,
        cameraEnabled: status.camera_enabled,
        slotStatus: status.slots, // Unified slot status
      });
    } catch (error) {
      // Fallback to manual counting
      console.error(`Failed to get slot status:`, error.message);
      const slots = await ParkingSlot.find({ parkingLot: parkingLot._id }).sort({ slotNumber: 1 });
    const totalSlots = slots.length;
    const occupiedSlots = slots.filter((s) => s.isOccupied).length;
    const availableSlots = totalSlots - occupiedSlots;

    res.json({
      ...parkingLot.toObject(),
      slots: slots,
      totalSlots,
      occupiedSlots,
      availableSlots,
        cameraEnabled: parkingLot.cameraEnabled || false,
    });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update parking lot
// @route   PUT /api/parking-lots/:id
// @access  Private/Owner
exports.updateParkingLot = async (req, res) => {
  try {
    let parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    // Check ownership
    if (parkingLot.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this parking lot' });
    }

    const { name, latitude, longitude, address, pricePerHour, totalSlots, cameraImageUrl, isActive } = req.body;

    if (name) parkingLot.name = name;
    if (address) parkingLot.address = address;
    if (pricePerHour) parkingLot.pricePerHour = parseFloat(pricePerHour);
    if (cameraImageUrl !== undefined) parkingLot.cameraImageUrl = cameraImageUrl;
    if (isActive !== undefined) parkingLot.isActive = isActive;

    if (latitude && longitude) {
      parkingLot.location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      };
    }

    // Handle slot count changes
    if (totalSlots) {
      const currentSlotCount = await ParkingSlot.countDocuments({ parkingLot: parkingLot._id });
      const newSlotCount = parseInt(totalSlots);

      if (newSlotCount > currentSlotCount) {
        // Add new slots
        for (let i = currentSlotCount + 1; i <= newSlotCount; i++) {
          await ParkingSlot.create({
            parkingLot: parkingLot._id,
            slotNumber: i,
            isOccupied: false,
          });
        }
      } else if (newSlotCount < currentSlotCount) {
        // Remove extra slots (only if not occupied)
        const slotsToRemove = await ParkingSlot.find({
          parkingLot: parkingLot._id,
          slotNumber: { $gt: newSlotCount },
        });

        for (const slot of slotsToRemove) {
          if (!slot.isOccupied) {
            await ParkingSlot.findByIdAndDelete(slot._id);
          }
        }
      }

      parkingLot.totalSlots = newSlotCount;
    }

    await parkingLot.save();

    res.json(parkingLot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete parking lot
// @route   DELETE /api/parking-lots/:id
// @access  Private/Owner
exports.deleteParkingLot = async (req, res) => {
  try {
    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    // Check ownership
    if (parkingLot.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this parking lot' });
    }

    // Delete associated slots and bookings
    await ParkingSlot.deleteMany({ parkingLot: parkingLot._id });
    await Booking.deleteMany({ parkingLot: parkingLot._id });
    await ParkingLot.findByIdAndDelete(req.params.id);

    res.json({ message: 'Parking lot deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update slot occupancy (for camera integration)
// @route   PUT /api/parking-lots/:id/slots/:slotId/occupancy
// @access  Private/Owner
exports.updateSlotOccupancy = async (req, res) => {
  try {
    const { isOccupied, detectionMetadata } = req.body;
    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    if (parkingLot.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const slot = await ParkingSlot.findOne({
      _id: req.params.slotId,
      parkingLot: parkingLot._id,
    });

    if (!slot) {
      return res.status(404).json({ message: 'Parking slot not found' });
    }

    slot.isOccupied = isOccupied !== undefined ? isOccupied : slot.isOccupied;
    slot.source = 'manual'; // Manual updates are always manual source
    slot.lastUpdated = new Date();

    if (detectionMetadata) {
      slot.detectionMetadata = {
        ...slot.detectionMetadata,
        ...detectionMetadata,
        timestamp: new Date(),
      };
    }

    await slot.save();

    res.json(slot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get available camera sources
// @route   GET /api/parking-lots/cameras
// @access  Private/Owner
exports.getCameras = async (req, res) => {
  try {
    const serviceAvailable = await opencvService.healthCheck();
    if (!serviceAvailable) {
      return res.status(503).json({ 
        message: 'OpenCV detection service is not available. Please ensure the Python service is running.' 
      });
    }

    const cameras = await opencvService.listCameras();
    res.json(cameras);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Test camera connection
// @route   POST /api/parking-lots/test-camera
// @access  Private/Owner
exports.testCamera = async (req, res) => {
  try {
    const { source } = req.body;

    if (!source) {
      return res.status(400).json({ message: 'Camera source is required' });
    }

    const serviceAvailable = await opencvService.healthCheck();
    if (!serviceAvailable) {
      return res.status(503).json({ 
        message: 'OpenCV detection service is not available. Please ensure the Python service is running.' 
      });
    }

    const result = await opencvService.testCamera(source);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Enable camera detection for parking lot
// @route   POST /api/parking-lots/:id/enable-camera
// @access  Private/Owner
exports.enableCamera = async (req, res) => {
  try {
    const { cameraImageUrl, cameraSource, cameraSourceType, threshold } = req.body;
    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    if (parkingLot.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this parking lot' });
    }

    // Use cameraSource if provided, otherwise fall back to cameraImageUrl
    const source = cameraSource || cameraImageUrl;
    
    if (!source) {
      return res.status(400).json({ message: 'cameraSource or cameraImageUrl is required' });
    }

    // Check if OpenCV service is available
    const serviceAvailable = await opencvService.healthCheck();
    if (!serviceAvailable) {
      return res.status(503).json({ 
        message: 'OpenCV detection service is not available. Please ensure the Python service is running.' 
      });
    }

    // Test camera connection if it's a camera source
    if (cameraSourceType === 'webcam' || source.startsWith('camera://')) {
      const testResult = await opencvService.testCamera(source);
      if (!testResult.success) {
        return res.status(400).json({ 
          message: `Camera connection failed: ${testResult.message}` 
        });
      }
    }

    parkingLot.cameraEnabled = true;
    parkingLot.cameraImageUrl = cameraImageUrl || source; // Keep for backward compatibility
    parkingLot.cameraSource = source;
    parkingLot.cameraSourceType = cameraSourceType || 'file';
    
    if (threshold !== undefined) {
      parkingLot.cameraThreshold = Math.max(0, Math.min(1, parseFloat(threshold)));
    }

    await parkingLot.save();

    res.json({
      message: 'Camera detection enabled successfully',
      parkingLot: {
        _id: parkingLot._id,
        cameraEnabled: parkingLot.cameraEnabled,
        cameraImageUrl: parkingLot.cameraImageUrl,
        cameraSource: parkingLot.cameraSource,
        cameraSourceType: parkingLot.cameraSourceType,
        cameraThreshold: parkingLot.cameraThreshold,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Disable camera detection for parking lot
// @route   POST /api/parking-lots/:id/disable-camera
// @access  Private/Owner
exports.disableCamera = async (req, res) => {
  try {
    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    if (parkingLot.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this parking lot' });
    }

    parkingLot.cameraEnabled = false;
    await parkingLot.save();

    res.json({
      message: 'Camera detection disabled successfully',
      parkingLot: {
        _id: parkingLot._id,
        cameraEnabled: parkingLot.cameraEnabled,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Define slot regions for camera detection
// @route   POST /api/parking-lots/:id/define-slots
// @access  Private/Owner
exports.defineSlots = async (req, res) => {
  try {
    const { slots } = req.body; // Array of slot definitions with coordinates
    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    if (parkingLot.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this parking lot' });
    }

    // Allow defining slots even if camera is not enabled yet (coordinates can be stored for later use)

    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ message: 'slots array is required' });
    }

    // Update slots with coordinates
    const updatedSlots = [];
    for (const slotData of slots) {
      const slot = await ParkingSlot.findOne({
        _id: slotData.slot_id,
        parkingLot: parkingLot._id,
      });

      if (slot) {
        slot.coordinates = slotData.coordinates;
        slot.imageWidth = slotData.image_width;
        slot.imageHeight = slotData.image_height;
        slot.source = 'camera';
        await slot.save();
        updatedSlots.push(slot);
      }
    }

    res.json({
      message: `Successfully defined ${updatedSlots.length} slot regions`,
      slots: updatedSlots.map(slot => ({
        _id: slot._id,
        slotNumber: slot.slotNumber,
        coordinates: slot.coordinates,
        imageWidth: slot.imageWidth,
        imageHeight: slot.imageHeight,
      })),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get unified slot status (abstracts camera/manual source)
// @route   GET /api/parking-lots/:id/slot-status
// @access  Private
exports.getSlotStatus = async (req, res) => {
  try {
    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    const status = await slotAvailabilityService.getSlotStatus(req.params.id);

    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Refresh slot status (trigger detection if camera enabled)
// @route   POST /api/parking-lots/:id/refresh-slots
// @access  Private/Owner
exports.refreshSlots = async (req, res) => {
  try {
    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    if (parkingLot.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to refresh this parking lot' });
    }

    const status = await slotAvailabilityService.refreshSlotStatus(req.params.id);

    res.json({
      message: 'Slot status refreshed successfully',
      ...status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


