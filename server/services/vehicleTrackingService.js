/**
 * Vehicle Tracking Service
 * 
 * Handles vehicle arrival/departure detection and session management
 * for YOLO-based parking slot monitoring.
 */
const { v4: uuidv4 } = require('uuid');
const ParkingSlot = require('../models/ParkingSlot');
const VehicleEvent = require('../models/VehicleEvent');
const notificationService = require('./notificationService');

class VehicleTrackingService {
    /**
     * Handle vehicle arrival (vacant → occupied transition)
     * 
     * @param {Object} slot - ParkingSlot document
     * @param {Object} vehicleMetadata - Vehicle detection metadata from YOLO
     * @param {Object} parkingLot - ParkingLot document
     * @returns {Promise<Object>} Vehicle event
     */
    async handleArrival(slot, vehicleMetadata, parkingLot) {
        try {
            const sessionId = this.generateSessionId();
            const arrivalTime = new Date();

            console.log(`[VEHICLE TRACKING] Arrival detected - Slot ${slot.slotNumber}, Session ${sessionId}`);

            // Update slot with current vehicle
            slot.currentVehicle = {
                sessionId,
                arrivalTime,
                lastSeenTime: arrivalTime,
                boundingBox: vehicleMetadata?.bounding_box || {},
                confidence: vehicleMetadata?.confidence || 0,
                iou: vehicleMetadata?.iou || 0,
            };
            slot.consecutiveVacantPolls = 0;
            await slot.save();

            // Create vehicle event
            const vehicleEvent = await VehicleEvent.create({
                parkingLot: slot.parkingLot,
                parkingSlot: slot._id,
                sessionId,
                eventType: 'ARRIVAL',
                timestamp: arrivalTime,
                vehicleMetadata: {
                    boundingBox: vehicleMetadata?.bounding_box || {},
                    confidence: vehicleMetadata?.confidence || 0,
                    iou: vehicleMetadata?.iou || 0,
                },
            });

            // Send notification to owner
            if (parkingLot.ownerNotifications?.enabled && parkingLot.ownerNotifications?.onArrival) {
                await notificationService.notifyArrival(parkingLot, slot, vehicleEvent);
            }

            return vehicleEvent;
        } catch (error) {
            console.error('[VEHICLE TRACKING] Error handling arrival:', error);
            throw error;
        }
    }

    /**
     * Handle vehicle departure (occupied → vacant transition)
     * 
     * @param {Object} slot - ParkingSlot document
     * @param {Object} parkingLot - ParkingLot document
     * @returns {Promise<Object>} Vehicle event
     */
    async handleDeparture(slot, parkingLot) {
        try {
            if (!slot.currentVehicle || !slot.currentVehicle.sessionId) {
                console.log(`[VEHICLE TRACKING] No current vehicle for slot ${slot.slotNumber}, skipping departure`);
                return null;
            }

            const departureTime = new Date();
            const arrivalTime = slot.currentVehicle.arrivalTime;
            const duration = Math.round((departureTime - arrivalTime) / (1000 * 60)); // minutes

            console.log(`[VEHICLE TRACKING] Departure detected - Slot ${slot.slotNumber}, Session ${slot.currentVehicle.sessionId}, Duration ${duration} min`);

            // Create vehicle event
            const vehicleEvent = await VehicleEvent.create({
                parkingLot: slot.parkingLot,
                parkingSlot: slot._id,
                sessionId: slot.currentVehicle.sessionId,
                eventType: 'DEPARTURE',
                timestamp: departureTime,
                duration,
                vehicleMetadata: {
                    boundingBox: slot.currentVehicle.boundingBox || {},
                    confidence: slot.currentVehicle.confidence || 0,
                    iou: slot.currentVehicle.iou || 0,
                },
            });

            // Move to history
            if (!slot.vehicleHistory) {
                slot.vehicleHistory = [];
            }

            slot.vehicleHistory.push({
                sessionId: slot.currentVehicle.sessionId,
                arrivalTime,
                departureTime,
                duration,
                notificationSent: parkingLot.ownerNotifications?.enabled && parkingLot.ownerNotifications?.onDeparture,
                boundingBox: slot.currentVehicle.boundingBox || {},
            });

            // Limit history to last 100 entries
            if (slot.vehicleHistory.length > 100) {
                slot.vehicleHistory = slot.vehicleHistory.slice(-100);
            }

            // Clear current vehicle
            slot.currentVehicle = undefined;
            slot.consecutiveVacantPolls = 0;
            await slot.save();

            // Send notification to owner
            if (parkingLot.ownerNotifications?.enabled && parkingLot.ownerNotifications?.onDeparture) {
                await notificationService.notifyDeparture(parkingLot, slot, vehicleEvent, duration);
            }

            return vehicleEvent;
        } catch (error) {
            console.error('[VEHICLE TRACKING] Error handling departure:', error);
            throw error;
        }
    }

    /**
     * Update vehicle presence (still occupied)
     * 
     * @param {Object} slot - ParkingSlot document
     * @param {Object} vehicleMetadata - Vehicle detection metadata from YOLO
     */
    async updateVehiclePresence(slot, vehicleMetadata) {
        try {
            if (!slot.currentVehicle) {
                console.log(`[VEHICLE TRACKING] No current vehicle for slot ${slot.slotNumber}, cannot update presence`);
                return;
            }

            // Update last seen time and metadata
            slot.currentVehicle.lastSeenTime = new Date();
            slot.currentVehicle.boundingBox = vehicleMetadata?.bounding_box || slot.currentVehicle.boundingBox;
            slot.currentVehicle.confidence = vehicleMetadata?.confidence || slot.currentVehicle.confidence;
            slot.currentVehicle.iou = vehicleMetadata?.iou || slot.currentVehicle.iou;
            slot.consecutiveVacantPolls = 0;

            await slot.save();
        } catch (error) {
            console.error('[VEHICLE TRACKING] Error updating vehicle presence:', error);
            throw error;
        }
    }

    /**
     * Increment vacant poll counter (for auto-departure detection)
     * 
     * @param {Object} slot - ParkingSlot document
     * @param {Object} parkingLot - ParkingLot document
     * @param {Number} threshold - Number of consecutive vacant polls before auto-departure (default: 3)
     * @returns {Promise<Boolean>} True if auto-departure was triggered
     */
    async incrementVacantPoll(slot, parkingLot, threshold = 3) {
        try {
            if (!slot.currentVehicle) {
                return false;
            }

            slot.consecutiveVacantPolls = (slot.consecutiveVacantPolls || 0) + 1;

            console.log(`[VEHICLE TRACKING] Slot ${slot.slotNumber} vacant poll count: ${slot.consecutiveVacantPolls}/${threshold}`);

            // Auto-departure if threshold reached
            if (slot.consecutiveVacantPolls >= threshold) {
                console.log(`[VEHICLE TRACKING] Auto-departure triggered for slot ${slot.slotNumber}`);
                await this.handleDeparture(slot, parkingLot);
                return true;
            }

            await slot.save();
            return false;
        } catch (error) {
            console.error('[VEHICLE TRACKING] Error incrementing vacant poll:', error);
            throw error;
        }
    }

    /**
     * Generate unique session ID for vehicle
     * 
     * @returns {String} UUID session ID
     */
    generateSessionId() {
        return uuidv4();
    }

    /**
     * Get current vehicles for a parking lot
     * 
     * @param {String} parkingLotId - Parking lot ID
     * @returns {Promise<Array>} Array of slots with current vehicles
     */
    async getCurrentVehicles(parkingLotId) {
        try {
            const slots = await ParkingSlot.find({
                parkingLot: parkingLotId,
                'currentVehicle.sessionId': { $exists: true, $ne: null },
            }).select('slotNumber currentVehicle isOccupied');

            return slots.map(slot => ({
                slotNumber: slot.slotNumber,
                sessionId: slot.currentVehicle.sessionId,
                arrivalTime: slot.currentVehicle.arrivalTime,
                lastSeenTime: slot.currentVehicle.lastSeenTime,
                duration: Math.round((new Date() - slot.currentVehicle.arrivalTime) / (1000 * 60)), // minutes
                boundingBox: slot.currentVehicle.boundingBox,
                confidence: slot.currentVehicle.confidence,
            }));
        } catch (error) {
            console.error('[VEHICLE TRACKING] Error getting current vehicles:', error);
            throw error;
        }
    }

    /**
     * Get vehicle event history for a parking lot
     * 
     * @param {String} parkingLotId - Parking lot ID
     * @param {Object} filters - Optional filters (eventType, startDate, endDate, limit)
     * @returns {Promise<Array>} Array of vehicle events
     */
    async getVehicleEvents(parkingLotId, filters = {}) {
        try {
            const query = { parkingLot: parkingLotId };

            if (filters.eventType) {
                query.eventType = filters.eventType;
            }

            if (filters.startDate || filters.endDate) {
                query.timestamp = {};
                if (filters.startDate) {
                    query.timestamp.$gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    query.timestamp.$lte = new Date(filters.endDate);
                }
            }

            const limit = filters.limit || 100;

            const events = await VehicleEvent.find(query)
                .populate('parkingSlot', 'slotNumber')
                .sort({ timestamp: -1 })
                .limit(limit);

            return events;
        } catch (error) {
            console.error('[VEHICLE TRACKING] Error getting vehicle events:', error);
            throw error;
        }
    }
}

module.exports = new VehicleTrackingService();
