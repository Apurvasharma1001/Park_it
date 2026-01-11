const mongoose = require('mongoose');

const vehicleEventSchema = new mongoose.Schema({
    parkingLot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParkingLot',
        required: true,
    },
    parkingSlot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParkingSlot',
        required: true,
    },
    sessionId: {
        type: String,
        required: true,
        index: true,
    },
    eventType: {
        type: String,
        enum: ['ARRIVAL', 'DEPARTURE'],
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
    },
    vehicleMetadata: {
        boundingBox: {
            x1: Number,
            y1: Number,
            x2: Number,
            y2: Number,
        },
        confidence: Number,
        iou: Number,
    },
    // Optional link to booking if vehicle arrival matches a booking
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
    },
    // Duration for departure events (in minutes)
    duration: {
        type: Number,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Indexes for efficient queries
vehicleEventSchema.index({ parkingLot: 1, timestamp: -1 });
vehicleEventSchema.index({ parkingSlot: 1, timestamp: -1 });
vehicleEventSchema.index({ sessionId: 1 });
vehicleEventSchema.index({ eventType: 1, timestamp: -1 });

// Compound index for owner's parking lot event queries
vehicleEventSchema.index({ parkingLot: 1, eventType: 1, timestamp: -1 });

module.exports = mongoose.model('VehicleEvent', vehicleEventSchema);
