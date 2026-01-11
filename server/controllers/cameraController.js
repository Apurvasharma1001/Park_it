/**
 * Camera Controller - Handles live camera feed processing
 */
const ParkingLot = require('../models/ParkingLot');
const ParkingSlot = require('../models/ParkingSlot');
const slotAvailabilityService = require('../services/slotAvailabilityService');
const opencvService = require('../services/opencvService');
const fs = require('fs').promises;
const path = require('path');

// @desc    Process frame from camera for occupancy detection
// @route   POST /api/parking-lots/:id/process-frame
// @access  Private/Owner
exports.processFrame = async (req, res) => {
  try {
    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    if (parkingLot.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (!parkingLot.cameraEnabled) {
      return res.status(400).json({ message: 'Camera detection is not enabled for this parking lot' });
    }

    const { imageData } = req.body; // Base64 image data

    if (!imageData) {
      return res.status(400).json({ message: 'imageData is required (base64 encoded image)' });
    }

    // Save image temporarily
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const tempDir = path.join(__dirname, '../temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, `frame_${Date.now()}_${parkingLot._id}.jpg`);
    await fs.writeFile(tempFilePath, buffer);

    try {
      // Get slots with coordinates
      const slots = await ParkingSlot.find({
        parkingLot: parkingLot._id,
        coordinates: { $exists: true, $ne: null }
      }).sort({ slotNumber: 1 });

      if (slots.length === 0) {
        return res.status(400).json({ message: 'No slots with coordinates defined' });
      }

      // Prepare slots data for OpenCV service
      const slotsData = slots.map(slot => ({
        slotId: slot._id.toString(),
        slotNumber: slot.slotNumber,
        coordinates: slot.coordinates,
        imageWidth: slot.imageWidth,
        imageHeight: slot.imageHeight,
      }));

      // Call OpenCV service for detection (opencvService handles the mapping)
      const detectionResults = await opencvService.detectOccupancy(
        tempFilePath,
        slotsData,
        parkingLot.cameraThreshold
      );

      // Update slots in database
      const updatedSlots = [];
      const slotMap = new Map(slots.map(s => [s._id.toString(), s]));

      for (const result of detectionResults) {
        // Try to find slot by slot_id (MongoDB ID) first, then by slot_number
        let slot = slotMap.get(result.slot_id);
        if (!slot && result.slot_number) {
          slot = Array.from(slotMap.values()).find(s => s.slotNumber === result.slot_number);
        }
        if (!slot) {
          console.warn(`Slot not found for result: slot_id=${result.slot_id}, slot_number=${result.slot_number}`);
          continue;
        }

        const isOccupied = result.status === 'occupied';
        const previousStatus = slot.isOccupied;

        if (previousStatus !== isOccupied || slot.source !== 'camera') {
          slot.isOccupied = isOccupied;
          slot.source = 'camera';
          slot.lastUpdated = new Date();
          slot.detectionMetadata = {
            confidence: result.confidence,
            timestamp: new Date(),
            occupancyRatio: result.occupancy_ratio,
            whitePixelCount: result.white_pixel_count,
          };
          await slot.save();
        }

        updatedSlots.push({
          slot_id: slot._id.toString(),
          slot_number: slot.slotNumber,
          status: result.status,
          confidence: result.confidence,
          occupancy_ratio: result.occupancy_ratio, // Pass metrics to frontend
          white_pixel_count: result.white_pixel_count
        });
      }

      // Clean up temp file
      await fs.unlink(tempFilePath).catch(() => { });

      res.json({
        success: true,
        slots: updatedSlots.sort((a, b) => a.slot_number - b.slot_number),
        timestamp: new Date(),
      });
    } catch (error) {
      // Clean up temp file on error
      await fs.unlink(tempFilePath).catch(() => { });
      throw error;
    }
  } catch (error) {
    console.error('Process frame error:', error);
    res.status(500).json({ message: error.message || 'Failed to process frame' });
  }
};

// @desc    Verify if a specific slot is occupied (YOLO pre-booking check)
// @route   POST /api/parking-lots/:id/verify-slot
// @access  Public (for booking verification)
exports.verifySlotOccupancy = async (req, res) => {
  try {
    const { slotNumber } = req.body;

    if (!slotNumber) {
      return res.status(400).json({ message: 'slotNumber is required' });
    }

    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    // If YOLO detection is not enabled, return database status
    if (!parkingLot.cameraEnabled || parkingLot.detectionMethod !== 'yolo') {
      const slot = await ParkingSlot.findOne({
        parkingLot: parkingLot._id,
        slotNumber: slotNumber
      });

      if (!slot) {
        return res.status(404).json({ message: 'Slot not found' });
      }

      return res.json({
        slotNumber: slot.slotNumber,
        isOccupied: slot.isOccupied,
        source: slot.source || 'manual',
        verificationMethod: 'database',
        lastUpdated: slot.lastUpdated
      });
    }

    // YOLO verification
    try {
      console.log(`[VERIFY SLOT] Running YOLO detection for slot ${slotNumber}...`);

      // Refresh slot status with YOLO
      const slotStatus = await slotAvailabilityService.getSlotStatus(parkingLot._id);
      const slotInfo = slotStatus.slots.find(s => s.slot_number === slotNumber);

      if (!slotInfo) {
        return res.status(404).json({ message: 'Slot not found' });
      }

      const isOccupied = slotInfo.status === 'occupied';
      const hasVehicle = slotInfo.vehicle_metadata ? true : false;

      console.log(`[VERIFY SLOT] Slot ${slotNumber}: ${isOccupied ? 'OCCUPIED' : 'VACANT'}, Vehicle: ${hasVehicle ? 'YES' : 'NO'}`);

      res.json({
        slotNumber: slotNumber,
        isOccupied: isOccupied,
        hasVehicle: hasVehicle,
        source: slotInfo.source,
        verificationMethod: 'yolo',
        confidence: slotInfo.confidence,
        occupancyRatio: slotInfo.occupancy_ratio,
        vehicleMetadata: slotInfo.vehicle_metadata,
        timestamp: new Date(),
        recommendation: isOccupied
          ? 'This slot is currently occupied. Please select another slot.'
          : 'This slot is available for booking.'
      });

    } catch (error) {
      console.error('[VERIFY SLOT] YOLO verification failed:', error.message);

      // Fallback to database status
      const slot = await ParkingSlot.findOne({
        parkingLot: parkingLot._id,
        slotNumber: slotNumber
      });

      if (!slot) {
        return res.status(404).json({ message: 'Slot not found' });
      }

      res.json({
        slotNumber: slot.slotNumber,
        isOccupied: slot.isOccupied,
        source: slot.source || 'manual',
        verificationMethod: 'database_fallback',
        lastUpdated: slot.lastUpdated,
        error: 'YOLO verification failed, using database status'
      });
    }

  } catch (error) {
    console.error('Verify slot error:', error);
    res.status(500).json({ message: error.message || 'Failed to verify slot' });
  }
};

// @desc    Get slot status (unified endpoint)
// @route   GET /api/parking-lots/:id/slot-status
// @access  Public
exports.getSlotStatus = async (req, res) => {
  try {
    const parkingLot = await ParkingLot.findById(req.params.id);

    if (!parkingLot) {
      return res.status(404).json({ message: 'Parking lot not found' });
    }

    const status = await slotAvailabilityService.getSlotStatus(parkingLot._id);

    res.json({
      ...status,
      detectionMethod: parkingLot.detectionMethod || 'classical',
      cameraEnabled: parkingLot.cameraEnabled || false
    });

  } catch (error) {
    console.error('Get slot status error:', error);
    res.status(500).json({ message: error.message || 'Failed to get slot status' });
  }
};
