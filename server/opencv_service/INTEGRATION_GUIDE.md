# OpenCV Parking Detection Integration Guide

## Overview

This guide explains how the optional OpenCV-based parking occupancy detection integrates with the Smart Parking System backend.

## Architecture

```
┌─────────────────┐
│  Node.js API    │
│   (Express)     │
└────────┬────────┘
         │ HTTP (axios)
         ↓
┌─────────────────┐
│  Python Service │
│  (Flask + CV2)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  OpenCV Module  │
│  (Classical CV) │
└─────────────────┘
```

## Key Design Principles

### 1. Optional Per Parking Lot
- Owners choose camera-based OR manual slot management
- `ParkingLot.cameraEnabled` flag controls detection method
- Both modes coexist without conflicts

### 2. Unified Interface
- `SlotAvailabilityService` abstracts detection source
- Customers always get consistent slot status
- No client-side changes needed

### 3. Deterministic & Explainable
- No ML models - uses classical computer vision
- Threshold-based detection (configurable)
- Transparent detection logic

### 4. Decoupled Service
- Python service runs independently
- HTTP API communication
- Can be scaled/deployed separately

## Setup Instructions

### 1. Install Python Dependencies

```bash
cd server/opencv_service
pip install -r requirements.txt
```

### 2. Start Python Service

```bash
# Default port: 5001
python service.py

# Or with custom port
OPENCV_SERVICE_PORT=5001 python service.py
```

### 3. Configure Node.js Backend

Add to `server/.env`:
```env
OPENCV_SERVICE_URL=http://localhost:5001
```

### 4. Start Node.js Backend

The Node.js backend will automatically connect to the Python service when needed.

## Workflow

### For Parking Lot Owners

#### Step 1: Enable Camera Detection

```bash
POST /api/parking-lots/:id/enable-camera
Authorization: Bearer <token>

{
  "cameraImageUrl": "/path/to/reference/image.jpg",
  "threshold": 0.15  // optional, default 0.15
}
```

#### Step 2: Define Slot Regions

**Option A: Using Slot Selector (Interactive)**

Run the interactive slot selector:
```bash
python server/opencv_service/slot_selector.py /path/to/image.jpg slots.json
```

- Left click to add points to a slot region
- Right click to remove last point
- Press 'n' to finish current slot and start new one
- Press 's' to save all slots
- Press 'q' to quit without saving

**Option B: Using API (Programmatic)**

```bash
POST /api/parking-lots/:id/define-slots
Authorization: Bearer <token>

{
  "slots": [
    {
      "slot_id": "slot_mongodb_id",
      "slot_number": 1,
      "coordinates": [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]],
      "image_width": 1920,
      "image_height": 1080
    },
    ...
  ]
}
```

Coordinates are normalized [0-1] for flexibility with different image sizes.

#### Step 3: Refresh Slot Status

```bash
POST /api/parking-lots/:id/refresh-slots
Authorization: Bearer <token>
```

This triggers detection if camera is enabled, or uses manual status if disabled.

### For Customers

Customers use the same API endpoints - detection source is abstracted:

```bash
GET /api/parking-lots/:id/slot-status
Authorization: Bearer <token>
```

Response:
```json
{
  "parking_id": "P123",
  "camera_enabled": true,
  "slots": [
    {
      "slot_id": "S1",
      "slot_number": 1,
      "status": "vacant",
      "source": "camera",
      "confidence": 0.95
    },
    {
      "slot_id": "S2",
      "slot_number": 2,
      "status": "occupied",
      "source": "camera",
      "confidence": 0.88
    }
  ],
  "total_slots": 10,
  "occupied_slots": 3,
  "vacant_slots": 7
}
```

## Detection Algorithm

The occupancy detection uses classical OpenCV techniques:

1. **Image Preprocessing**
   - Convert to grayscale
   - Apply Gaussian blur (reduces noise)
   - Adaptive thresholding (handles varying lighting)
   - Median blur (removes salt/pepper noise)
   - Morphological dilation (connects nearby pixels)

2. **Region Analysis**
   - Extract slot region from processed image
   - Count white pixels (detected objects)
   - Calculate occupancy ratio = white_pixels / total_area

3. **Decision Logic**
   - If occupancy_ratio > threshold → **occupied**
   - Else → **vacant**

## Configuration

### Detection Threshold

- Default: 0.15 (15% of slot area)
- Range: 0.0 - 1.0
- Set per parking lot via `cameraThreshold` field
- Lower threshold = more sensitive (detects smaller objects)
- Higher threshold = less sensitive (requires larger objects)

### Image Requirements

- Format: JPG, PNG, etc. (OpenCV supported)
- Path: Local file path (URL support can be added)
- Size: Any (coordinates auto-scale)

## Error Handling

The system gracefully handles failures:

1. **Python Service Unavailable**
   - Falls back to manual status
   - Logs error for debugging
   - Returns 503 if explicitly enabling camera

2. **Image Not Found**
   - Returns error message
   - Falls back to manual status for status queries

3. **No Slot Coordinates**
   - Slots without coordinates use manual status
   - Owner can define coordinates later

## Switching Between Modes

Owners can switch between camera and manual mode anytime:

```bash
# Disable camera
POST /api/parking-lots/:id/disable-camera

# Re-enable camera
POST /api/parking-lots/:id/enable-camera
```

When camera is disabled:
- System uses `ParkingSlot.isOccupied` field
- Updates come from booking system
- Manual updates via `/slots/:slotId/occupancy` endpoint

## Database Schema Changes

### ParkingLot Model
```javascript
{
  cameraEnabled: Boolean,      // Enable/disable camera detection
  cameraThreshold: Number,     // Detection threshold (0-1)
  cameraImageUrl: String       // Path to current image
}
```

### ParkingSlot Model
```javascript
{
  source: String,              // 'camera' | 'manual'
  coordinates: [[Number]],     // Normalized [0-1] coordinates
  imageWidth: Number,          // Image width when coordinates defined
  imageHeight: Number,         // Image height when coordinates defined
  detectionMetadata: {
    confidence: Number,
    occupancyRatio: Number,
    whitePixelCount: Number,
    timestamp: Date
  }
}
```

## Performance Considerations

- **Detection Speed**: ~100-500ms per image (depends on image size)
- **Concurrent Requests**: Python service handles multiple requests
- **Caching**: Consider caching detection results (not implemented)
- **Rate Limiting**: Add rate limiting if needed (not implemented)

## Troubleshooting

### Python Service Not Starting
- Check Python version (3.7+)
- Verify all dependencies installed: `pip install -r requirements.txt`
- Check port availability: `netstat -an | grep 5001`

### Detection Not Working
- Verify image path is correct and accessible
- Check slot coordinates are defined
- Verify threshold is appropriate (try 0.1-0.3)
- Check Python service logs for errors

### False Positives/Negatives
- Adjust threshold (lower = more sensitive)
- Ensure good lighting in images
- Verify slot region coordinates are accurate
- Consider using multiple images for better results

## Future Enhancements

Possible improvements (not implemented):
- URL-based image loading
- Automatic threshold tuning per parking lot
- Frame sampling for video streams
- Debug visualization mode
- Caching detection results
- WebSocket for real-time updates
- Multi-camera support


