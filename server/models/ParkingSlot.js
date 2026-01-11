const mongoose = require('mongoose');

const parkingSlotSchema = new mongoose.Schema({
  parkingLot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ParkingLot',
    required: true,
  },
  slotNumber: {
    type: Number,
    required: true,
  },
  isOccupied: {
    type: Boolean,
    default: false,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  // Detection source: 'camera', 'manual', or 'booking'
  source: {
    type: String,
    enum: ['camera', 'manual', 'booking'],
    default: 'manual',
  },
  // Slot region coordinates for camera detection (normalized 0-1)
  coordinates: {
    type: [[Number]], // Array of [x, y] pairs (normalized coordinates)
    default: null,
  },
  // Original image dimensions when coordinates were defined
  imageWidth: {
    type: Number,
    default: null,
  },
  imageHeight: {
    type: Number,
    default: null,
  },
  // Camera detection metadata
  detectionMetadata: {
    confidence: Number,
    timestamp: Date,
    occupancyRatio: Number,
    whitePixelCount: Number,
  },
  // Current vehicle session (for YOLO tracking)
  currentVehicle: {
    sessionId: String,
    arrivalTime: Date,
    lastSeenTime: Date,
    boundingBox: {
      x1: Number,
      y1: Number,
      x2: Number,
      y2: Number
    },
    confidence: Number,
    iou: Number
  },
  // Vehicle history (past sessions)
  vehicleHistory: [{
    sessionId: String,
    arrivalTime: Date,
    departureTime: Date,
    duration: Number, // in minutes
    notificationSent: Boolean,
    boundingBox: {
      x1: Number,
      y1: Number,
      x2: Number,
      y2: Number
    }
  }],
  // Consecutive polls without vehicle (for auto-departure)
  consecutiveVacantPolls: {
    type: Number,
    default: 0
  }
});

// Compound index for efficient queries
parkingSlotSchema.index({ parkingLot: 1, slotNumber: 1 }, { unique: true });

module.exports = mongoose.model('ParkingSlot', parkingSlotSchema);


