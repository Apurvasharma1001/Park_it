const mongoose = require('mongoose');

const parkingLotSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Please provide a parking lot name'],
    trim: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (v) {
          return v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90;
        },
        message: 'Invalid coordinates',
      },
    },
  },
  address: {
    type: String,
    required: [true, 'Please provide an address'],
    trim: true,
  },
  pricePerHour: {
    type: Number,
    required: [true, 'Please provide price per hour'],
    min: 0,
  },
  totalSlots: {
    type: Number,
    required: [true, 'Please provide total slots'],
    min: 1,
  },
  cameraImageUrl: {
    type: String,
    default: '',
  },
  cameraSource: {
    type: String,
    default: '',
    // Can be: "camera://0", "camera://1", file path, IP camera URL, etc.
  },
  cameraSourceType: {
    type: String,
    enum: ['webcam', 'ip_camera', 'file', 'image'],
    default: 'file',
  },
  cameraEnabled: {
    type: Boolean,
    default: false,
  },
  cameraThreshold: {
    type: Number,
    default: 800, // Default to pixel count logic (Reference asked for ~900)
    min: 0,
    max: 100000, // Allow large pixel counts
  },
  detectionMethod: {
    type: String,
    enum: ['classical', 'yolo'],
    default: 'classical',
  },
  yoloConfig: {
    modelPath: {
      type: String,
      default: 'models/yolo11s.pt',
    },
    confThreshold: {
      type: Number,
      default: 0.35,
      min: 0,
      max: 1,
    },
    iouThreshold: {
      type: Number,
      default: 0.45,
      min: 0,
      max: 1,
    },
    occupiedThreshold: {
      type: Number,
      default: 0.30,
      min: 0,
      max: 1,
    },
  },
  ownerNotifications: {
    enabled: {
      type: Boolean,
      default: true,
    },
    onArrival: {
      type: Boolean,
      default: true,
    },
    onDeparture: {
      type: Boolean,
      default: true,
    },
    email: {
      type: Boolean,
      default: false,
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Geospatial index for location queries
parkingLotSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('ParkingLot', parkingLotSchema);


