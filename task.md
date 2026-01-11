# YOLO Integration with Vehicle Tracking - Task Breakdown

## Backend - YOLO Detection Service
- [/] Create Python YOLO detection service adapter
  - [/] Port YOLO detection logic from `test22.py`
  - [/] Create `yolo_detector.py` in `server/opencv_service/`
  - [ ] Implement vehicle detection with bounding boxes
  - [ ] Add IoU calculation for slot occupancy
- [ ] Integrate YOLO with existing OpenCV service
  - [ ] Update `service.py` to support YOLO mode
  - [ ] Add configuration for detection method (classical vs YOLO)
  - [ ] Ensure backward compatibility with existing classical detection

## Database Schema Updates
- [ ] Extend `ParkingSlot` model for vehicle tracking
  - [ ] Add `vehicleDetectionHistory` array field
  - [ ] Add `currentVehicle` object with arrival/departure times
  - [ ] Add `lastVehicleId` for tracking unique vehicles
- [ ] Create `VehicleEvent` model
  - [ ] Track arrival timestamp
  - [ ] Track departure timestamp  
  - [ ] Link to parking slot and parking lot
  - [ ] Store vehicle detection metadata (bounding box, confidence)
- [ ] Extend `ParkingLot` model
  - [ ] Add `detectionMethod` field (classical/yolo)
  - [ ] Add `yoloModelPath` field
  - [ ] Add `notificationSettings` for owner preferences

## Vehicle Tracking Logic
- [ ] Create `vehicleTrackingService.js`
  - [ ] Implement arrival detection logic
  - [ ] Implement departure detection logic
  - [ ] Track vehicle presence duration
  - [ ] Generate unique vehicle session IDs
- [ ] Update `slotAvailabilityService.js`
  - [ ] Integrate vehicle tracking on status changes
  - [ ] Detect state transitions (vacant→occupied, occupied→vacant)
  - [ ] Trigger events on arrival/departure

## Real-time Notification System
- [ ] Create `notificationService.js`
  - [ ] Implement owner notification logic
  - [ ] Support multiple notification channels (in-app, email)
  - [ ] Create notification templates for arrival/departure
- [ ] Add WebSocket/SSE support for live updates
  - [ ] Set up Socket.IO or Server-Sent Events
  - [ ] Create real-time event emitters
  - [ ] Handle owner subscriptions to their parking lots
- [ ] Create notification API endpoints
  - [ ] GET `/api/notifications` - fetch notifications
  - [ ] POST `/api/notifications/mark-read` - mark as read
  - [ ] GET `/api/notifications/live` - SSE endpoint

## API Endpoints
- [ ] Update camera controller
  - [ ] Add YOLO detection mode toggle
  - [ ] Add vehicle event history endpoint
  - [ ] Add real-time stats endpoint
- [ ] Create vehicle tracking endpoints
  - [ ] GET `/api/parking-lots/:id/vehicle-events` - event history
  - [ ] GET `/api/parking-lots/:id/current-vehicles` - active vehicles
  - [ ] GET `/api/parking-lots/:id/analytics` - occupancy analytics

## Frontend Integration
- [ ] Update `LiveOccupancyTracker.jsx`
  - [ ] Add vehicle bounding box visualization
  - [ ] Show arrival/departure timestamps
  - [ ] Display vehicle session duration
- [ ] Create `OwnerNotifications.jsx` component
  - [ ] Real-time notification display
  - [ ] Notification history list
  - [ ] Mark as read functionality
- [ ] Update `UserDashboard.jsx`
  - [ ] Add notification bell icon
  - [ ] Show unread notification count
  - [ ] Integrate notification panel
- [ ] Create `VehicleEventHistory.jsx`
  - [ ] Display arrival/departure timeline
  - [ ] Show slot-wise vehicle history
  - [ ] Export functionality for reports

## YOLO Model Setup
- [ ] Copy YOLO model files
  - [ ] Move `yolo11s.pt` to `server/opencv_service/models/`
  - [ ] Create models directory if needed
  - [ ] Update `.gitignore` for large model files
- [ ] Install YOLO dependencies
  - [ ] Add `ultralytics` to `requirements.txt`
  - [ ] Update setup scripts

## Testing & Validation
- [ ] Test YOLO detection accuracy
  - [ ] Compare with classical detection
  - [ ] Validate IoU threshold tuning
- [ ] Test vehicle tracking
  - [ ] Verify arrival detection
  - [ ] Verify departure detection
  - [ ] Check timing accuracy
- [ ] Test notification delivery
  - [ ] Verify real-time updates
  - [ ] Test notification persistence
- [ ] Integration testing
  - [ ] End-to-end flow testing
  - [ ] Multi-slot concurrent tracking

## Documentation
- [ ] Update API documentation
- [ ] Create YOLO setup guide
- [ ] Document notification system
- [ ] Update deployment guide
