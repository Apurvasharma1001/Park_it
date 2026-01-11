/**
 * Unified Slot Availability Service
 * 
 * This service abstracts the detection source (camera vs manual) and provides
 * a unified interface for slot availability checking.
 * 
 * Customers don't need to know whether detection is camera-based or manual.
 * Owners can switch between modes seamlessly.
 */
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLot = require('../models/ParkingLot');
const opencvService = require('./opencvService');
const vehicleTrackingService = require('./vehicleTrackingService');
const path = require('path');
const fs = require('fs').promises;

class SlotAvailabilityService {
  /**
   * Get unified slot status for a parking lot
   * Automatically uses camera detection if enabled, otherwise uses manual status
   * 
   * @param {string} parkingLotId - Parking lot ID
   * @returns {Promise<Object>} Unified slot status with all slots
   */
  async getSlotStatus(parkingLotId) {
    const parkingLot = await ParkingLot.findById(parkingLotId);

    if (!parkingLot) {
      throw new Error('Parking lot not found');
    }

    const slots = await ParkingSlot.find({ parkingLot: parkingLotId })
      .sort({ slotNumber: 1 });

    // If camera is enabled and image URL exists, try camera detection
    if (parkingLot.cameraEnabled && parkingLot.cameraImageUrl) {
      try {
        return await this.getCameraBasedStatus(parkingLot, slots);
      } catch (error) {
        console.error('Camera detection failed, falling back to manual status:', error.message);
        // Fall back to manual status if camera detection fails
        return this.getManualStatus(slots);
      }
    }

    // Use manual status
    return this.getManualStatus(slots);
  }

  /**
   * Get slot status using camera detection
   * 
   * @param {ParkingLot} parkingLot - Parking lot document
   * @param {Array} slots - Array of slot documents
   * @returns {Promise<Object>} Slot status with camera detection results
   */
  async getCameraBasedStatus(parkingLot, slots) {
    // Check if OpenCV service is available
    const serviceAvailable = await opencvService.healthCheck();
    if (!serviceAvailable) {
      throw new Error('OpenCV detection service is not available');
    }

    // Filter slots that have coordinates defined
    const slotsWithCoords = slots.filter(slot =>
      slot.coordinates &&
      slot.coordinates.length > 0 &&
      slot.imageWidth &&
      slot.imageHeight
    );

    if (slotsWithCoords.length === 0) {
      throw new Error('No slots have coordinates defined for camera detection');
    }

    // Prepare slots data for OpenCV service
    // Use MongoDB ID as slot_id for proper mapping
    const slotsData = slotsWithCoords.map(slot => ({
      slotId: slot._id.toString(), // Use MongoDB ID for consistent mapping
      slotNumber: slot.slotNumber,
      coordinates: slot.coordinates,
      imageWidth: slot.imageWidth,
      imageHeight: slot.imageHeight,
    }));

    // Get image/camera source (prioritize cameraSource over cameraImageUrl)
    let imagePath = parkingLot.cameraSource || parkingLot.cameraImageUrl;

    // If it's a URL starting with http, we'd need to download it first
    // For now, assume it's a local file path
    if (imagePath.startsWith('http')) {
      throw new Error('URL-based images not yet supported. Please use local file paths.');
    }

    // Check if file exists
    try {
      await fs.access(imagePath);
    } catch (error) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Call OpenCV service (YOLO or classical based on detection method)
    let detectionResults;
    if (parkingLot.detectionMethod === 'yolo') {
      detectionResults = await opencvService.detectOccupancyYOLO(
        imagePath,
        slotsData,
        parkingLot.yoloConfig || {}
      );
    } else {
      detectionResults = await opencvService.detectOccupancy(
        imagePath,
        slotsData,
        parkingLot.cameraThreshold
      );
    }

    // Map results to slots and update database with vehicle tracking
    const updatedSlots = [];
    const slotMap = new Map(slots.map(s => [s._id.toString(), s]));

    for (const result of detectionResults) {
      const slot = slotMap.get(result.slot_id);
      if (!slot) {
        console.warn(`Slot not found for result slot_id: ${result.slot_id}`);
        continue;
      }

      const isOccupied = result.status === 'occupied';
      const previousStatus = slot.isOccupied;

      // VEHICLE TRACKING: Detect state transitions
      if (!previousStatus && isOccupied) {
        // ARRIVAL: vacant → occupied
        console.log(`[SLOT AVAILABILITY] Arrival detected for slot ${slot.slotNumber}`);
        await vehicleTrackingService.handleArrival(slot, result.vehicle_metadata, parkingLot);
      } else if (previousStatus && !isOccupied) {
        // Check if this is a real departure or just a momentary glitch
        if (parkingLot.detectionMethod === 'yolo' && slot.currentVehicle) {
          // For YOLO, use consecutive vacant poll threshold
          const autoDeparture = await vehicleTrackingService.incrementVacantPoll(slot, parkingLot, 3);
          if (!autoDeparture) {
            // Not yet confirmed departure, keep as occupied
            console.log(`[SLOT AVAILABILITY] Potential departure for slot ${slot.slotNumber}, waiting for confirmation`);
            isOccupied = true; // Override to keep occupied
          }
        } else {
          // DEPARTURE: occupied → vacant (classical detection or no current vehicle)
          console.log(`[SLOT AVAILABILITY] Departure detected for slot ${slot.slotNumber}`);
          if (slot.currentVehicle) {
            await vehicleTrackingService.handleDeparture(slot, parkingLot);
          }
        }
      } else if (isOccupied && slot.currentVehicle) {
        // PRESENCE UPDATE: still occupied
        await vehicleTrackingService.updateVehiclePresence(slot, result.vehicle_metadata);
      }

      // Update slot if status changed
      // PROTECTION: Do not mark as vacant if source is 'booking' (user reserved it but hasn't arrived or momentary glitch)
      // Only allow camera to mark as occupied (confirming arrival) or if source is not booking
      if (slot.source === 'booking' && !isOccupied) {
        // Skip updating to vacant if it's a booking
        continue;
      }

      if (previousStatus !== isOccupied || slot.source !== 'camera') {
        // If it was a booking found to be occupied by camera, we can optionally switch source to 'camera' or keep 'booking'
        // For now, let's keep 'booking' source if it was 'booking', so we maintain protection
        // But if we want to track that they arrived, we might just update metadata

        if (slot.source === 'booking' && isOccupied) {
          // User arrived. Keep source as booking to protect against flickering? 
          // Or change to camera? If we change to camera, next Vacant reading will free it.
          // Better to keep source as 'booking' until booking expires/completes.
          // We just update the lastUpdated time.
          slot.lastUpdated = new Date();
        } else {
          slot.isOccupied = isOccupied;
          slot.source = 'camera';
          slot.lastUpdated = new Date();
        }

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
        source: 'camera',
        confidence: result.confidence,
        occupancy_ratio: result.occupancy_ratio,
        vehicle_metadata: result.vehicle_metadata, // Include vehicle metadata for YOLO
      });
    }

    // Include slots without coordinates (manual only)
    const slotsWithoutCoords = slots.filter(slot =>
      !slot.coordinates ||
      slot.coordinates.length === 0 ||
      !slot.imageWidth ||
      !slot.imageHeight
    );

    for (const slot of slotsWithoutCoords) {
      updatedSlots.push({
        slot_id: slot._id.toString(),
        slot_number: slot.slotNumber,
        status: slot.isOccupied ? 'occupied' : 'vacant',
        source: 'manual',
      });
    }

    // Sort by slot number
    updatedSlots.sort((a, b) => a.slot_number - b.slot_number);

    return {
      parking_id: parkingLot._id.toString(),
      camera_enabled: true,
      slots: updatedSlots,
      total_slots: slots.length,
      occupied_slots: updatedSlots.filter(s => s.status === 'occupied').length,
      vacant_slots: updatedSlots.filter(s => s.status === 'vacant').length,
    };
  }

  /**
   * Get slot status from manual/booking-based tracking
   * 
   * @param {Array} slots - Array of slot documents
   * @returns {Object} Slot status from database
   */
  getManualStatus(slots) {
    const slotStatus = slots.map(slot => ({
      slot_id: slot._id.toString(),
      slot_number: slot.slotNumber,
      status: slot.isOccupied ? 'occupied' : 'vacant',
      source: slot.source || 'manual',
      last_updated: slot.lastUpdated,
    }));

    return {
      parking_id: slots[0]?.parkingLot?.toString() || '',
      camera_enabled: false,
      slots: slotStatus,
      total_slots: slots.length,
      occupied_slots: slots.filter(s => s.isOccupied).length,
      vacant_slots: slots.filter(s => !s.isOccupied).length,
    };
  }

  /**
   * Refresh slot status (trigger detection if camera enabled)
   * 
   * @param {string} parkingLotId - Parking lot ID
   * @returns {Promise<Object>} Updated slot status
   */
  async refreshSlotStatus(parkingLotId) {
    return await this.getSlotStatus(parkingLotId);
  }

  /**
   * Get available slots for booking
   * 
   * @param {string} parkingLotId - Parking lot ID
   * @returns {Promise<Array>} Array of available slot IDs
   */
  async getAvailableSlots(parkingLotId) {
    const status = await this.getSlotStatus(parkingLotId);
    return status.slots
      .filter(slot => slot.status === 'vacant')
      .map(slot => slot.slot_id);
  }
}

module.exports = new SlotAvailabilityService();

