/**
 * Notification Service
 * 
 * Handles creation and delivery of owner notifications for vehicle events
 */
const Notification = require('../models/Notification');
const ParkingLot = require('../models/ParkingLot');

class NotificationService {
    /**
     * Notify owner of vehicle arrival
     * 
     * @param {Object} parkingLot - ParkingLot document
     * @param {Object} slot - ParkingSlot document
     * @param {Object} vehicleEvent - VehicleEvent document
     * @returns {Promise<Object>} Created notification
     */
    async notifyArrival(parkingLot, slot, vehicleEvent) {
        try {
            const notification = await Notification.create({
                owner: parkingLot.owner,
                parkingLot: parkingLot._id,
                type: 'VEHICLE_ARRIVAL',
                title: `🚗 Vehicle Arrived - Slot ${slot.slotNumber}`,
                message: `A vehicle has arrived at ${parkingLot.name}, Slot #${slot.slotNumber}`,
                metadata: {
                    slotNumber: slot.slotNumber,
                    sessionId: vehicleEvent.sessionId,
                    timestamp: vehicleEvent.timestamp,
                    vehicleEvent: vehicleEvent._id,
                },
            });

            console.log(`[NOTIFICATION] Arrival notification sent to owner ${parkingLot.owner} for slot ${slot.slotNumber}`);

            // Emit real-time event if socket.io is available
            this.emitRealTimeNotification(parkingLot._id, notification);

            return notification;
        } catch (error) {
            console.error('[NOTIFICATION] Error creating arrival notification:', error);
            throw error;
        }
    }

    /**
     * Notify owner of vehicle departure
     * 
     * @param {Object} parkingLot - ParkingLot document
     * @param {Object} slot - ParkingSlot document
     * @param {Object} vehicleEvent - VehicleEvent document
     * @param {Number} duration - Parking duration in minutes
     * @returns {Promise<Object>} Created notification
     */
    async notifyDeparture(parkingLot, slot, vehicleEvent, duration) {
        try {
            const durationText = this.formatDuration(duration);

            const notification = await Notification.create({
                owner: parkingLot.owner,
                parkingLot: parkingLot._id,
                type: 'VEHICLE_DEPARTURE',
                title: `🚙 Vehicle Departed - Slot ${slot.slotNumber}`,
                message: `A vehicle has left ${parkingLot.name}, Slot #${slot.slotNumber}. Duration: ${durationText}`,
                metadata: {
                    slotNumber: slot.slotNumber,
                    sessionId: vehicleEvent.sessionId,
                    timestamp: vehicleEvent.timestamp,
                    duration,
                    vehicleEvent: vehicleEvent._id,
                },
            });

            console.log(`[NOTIFICATION] Departure notification sent to owner ${parkingLot.owner} for slot ${slot.slotNumber}`);

            // Emit real-time event if socket.io is available
            this.emitRealTimeNotification(parkingLot._id, notification);

            return notification;
        } catch (error) {
            console.error('[NOTIFICATION] Error creating departure notification:', error);
            throw error;
        }
    }

    /**
     * Get notifications for an owner
     * 
     * @param {String} ownerId - Owner user ID
     * @param {Object} filters - Optional filters (read, type, parkingLotId, limit)
     * @returns {Promise<Array>} Array of notifications
     */
    async getNotifications(ownerId, filters = {}) {
        try {
            const query = { owner: ownerId };

            if (filters.read !== undefined) {
                query.read = filters.read;
            }

            if (filters.type) {
                query.type = filters.type;
            }

            if (filters.parkingLotId) {
                query.parkingLot = filters.parkingLotId;
            }

            const limit = filters.limit || 50;

            const notifications = await Notification.find(query)
                .populate('parkingLot', 'name')
                .sort({ createdAt: -1 })
                .limit(limit);

            return notifications;
        } catch (error) {
            console.error('[NOTIFICATION] Error getting notifications:', error);
            throw error;
        }
    }

    /**
     * Get unread notification count for an owner
     * 
     * @param {String} ownerId - Owner user ID
     * @param {String} parkingLotId - Optional parking lot filter
     * @returns {Promise<Number>} Unread count
     */
    async getUnreadCount(ownerId, parkingLotId = null) {
        try {
            const query = { owner: ownerId, read: false };

            if (parkingLotId) {
                query.parkingLot = parkingLotId;
            }

            const count = await Notification.countDocuments(query);
            return count;
        } catch (error) {
            console.error('[NOTIFICATION] Error getting unread count:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     * 
     * @param {String} notificationId - Notification ID
     * @param {String} ownerId - Owner user ID (for verification)
     * @returns {Promise<Object>} Updated notification
     */
    async markAsRead(notificationId, ownerId) {
        try {
            const notification = await Notification.findOneAndUpdate(
                { _id: notificationId, owner: ownerId },
                { read: true, readAt: new Date() },
                { new: true }
            );

            if (!notification) {
                throw new Error('Notification not found or unauthorized');
            }

            return notification;
        } catch (error) {
            console.error('[NOTIFICATION] Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * Mark all notifications as read for an owner
     * 
     * @param {String} ownerId - Owner user ID
     * @param {String} parkingLotId - Optional parking lot filter
     * @returns {Promise<Number>} Number of notifications marked as read
     */
    async markAllAsRead(ownerId, parkingLotId = null) {
        try {
            const query = { owner: ownerId, read: false };

            if (parkingLotId) {
                query.parkingLot = parkingLotId;
            }

            const result = await Notification.updateMany(
                query,
                { read: true, readAt: new Date() }
            );

            return result.modifiedCount;
        } catch (error) {
            console.error('[NOTIFICATION] Error marking all as read:', error);
            throw error;
        }
    }

    /**
     * Format duration in human-readable format
     * 
     * @param {Number} minutes - Duration in minutes
     * @returns {String} Formatted duration
     */
    formatDuration(minutes) {
        if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`;
        }

        return `${hours}h ${remainingMinutes}m`;
    }

    /**
     * Emit real-time notification via Socket.IO
     * This will be called by the socket.io integration
     * 
     * @param {String} parkingLotId - Parking lot ID
     * @param {Object} notification - Notification document
     */
    emitRealTimeNotification(parkingLotId, notification) {
        try {
            // Get io instance from global (set in server.js)
            const io = global.io;

            if (io) {
                io.to(`parking-lot-${parkingLotId}`).emit('notification', {
                    id: notification._id,
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    metadata: notification.metadata,
                    createdAt: notification.createdAt,
                });

                console.log(`[NOTIFICATION] Real-time event emitted for parking lot ${parkingLotId}`);
            }
        } catch (error) {
            console.error('[NOTIFICATION] Error emitting real-time notification:', error);
            // Don't throw - this is non-critical
        }
    }

    /**
     * Delete old notifications (cleanup)
     * 
     * @param {Number} daysOld - Delete notifications older than this many days
     * @returns {Promise<Number>} Number of deleted notifications
     */
    async deleteOldNotifications(daysOld = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await Notification.deleteMany({
                read: true,
                createdAt: { $lt: cutoffDate },
            });

            console.log(`[NOTIFICATION] Deleted ${result.deletedCount} old notifications`);
            return result.deletedCount;
        } catch (error) {
            console.error('[NOTIFICATION] Error deleting old notifications:', error);
            throw error;
        }
    }
}

module.exports = new NotificationService();
