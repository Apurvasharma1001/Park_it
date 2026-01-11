const express = require('express');
const router = express.Router();
const {
  createParkingLot,
  getParkingLots,
  getOwnerParkingLots,
  getParkingLot,
  updateParkingLot,
  deleteParkingLot,
  updateSlotOccupancy,
  getCameras,
  testCamera,
  enableCamera,
  disableCamera,
  defineSlots,
  getSlotStatus,
  refreshSlots,
} = require('../controllers/parkingLotController');
const { processFrame, verifySlotOccupancy, getSlotStatus: getCameraSlotStatus } = require('../controllers/cameraController');
const { protect, authorize } = require('../middleware/auth');

// Public/Protected routes
router.get('/', protect, getParkingLots);
router.get('/:id', protect, getParkingLot);

// Owner-only routes
router.post('/', protect, authorize('OWNER'), createParkingLot);
router.get('/owner/my-lots', protect, authorize('OWNER'), getOwnerParkingLots);
router.put('/:id', protect, authorize('OWNER'), updateParkingLot);
router.delete('/:id', protect, authorize('OWNER'), deleteParkingLot);
router.put('/:id/slots/:slotId/occupancy', protect, authorize('OWNER'), updateSlotOccupancy);

// Camera detection routes
router.get('/cameras', protect, authorize('OWNER'), getCameras);
router.post('/test-camera', protect, authorize('OWNER'), testCamera);
router.post('/:id/enable-camera', protect, authorize('OWNER'), enableCamera);
router.post('/:id/disable-camera', protect, authorize('OWNER'), disableCamera);
router.post('/:id/define-slots', protect, authorize('OWNER'), defineSlots);
router.post('/:id/refresh-slots', protect, authorize('OWNER'), refreshSlots);

// Slot status route (unified - works for camera and manual)
router.get('/:id/slot-status', protect, getSlotStatus);

// Live camera frame processing
router.post('/:id/process-frame', protect, authorize('OWNER'), processFrame);

// YOLO slot verification (public for booking pre-check)
router.post('/:id/verify-slot', verifySlotOccupancy);

// Camera-based slot status (alternative to parkingLotController's getSlotStatus)
router.get('/:id/camera-slot-status', getCameraSlotStatus);

module.exports = router;


