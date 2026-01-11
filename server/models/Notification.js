const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    parkingLot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParkingLot',
        required: true,
    },
    type: {
        type: String,
        enum: ['VEHICLE_ARRIVAL', 'VEHICLE_DEPARTURE', 'SLOT_OCCUPIED', 'SLOT_VACANT', 'SYSTEM'],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    metadata: {
        slotNumber: Number,
        sessionId: String,
        timestamp: Date,
        duration: Number, // for departures (in minutes)
        vehicleEvent: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'VehicleEvent',
        },
    },
    read: {
        type: Boolean,
        default: false,
    },
    readAt: {
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Indexes for efficient queries
notificationSchema.index({ owner: 1, read: 1, createdAt: -1 });
notificationSchema.index({ parkingLot: 1, createdAt: -1 });
notificationSchema.index({ owner: 1, type: 1, createdAt: -1 });

// Auto-delete old read notifications after 90 days
notificationSchema.index(
    { createdAt: 1 },
    {
        expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
        partialFilterExpression: { read: true }
    }
);

module.exports = mongoose.model('Notification', notificationSchema);
