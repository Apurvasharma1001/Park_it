# OpenCV Parking Occupancy Detection Service

## Overview

This module provides **optional** camera-based parking slot occupancy detection using classical OpenCV computer vision techniques. It is designed to be:

- **Optional**: Owners can choose camera-based detection OR manual slot management
- **Decoupled**: Runs as a separate Python service, independent of the Node.js backend
- **Non-ML**: Uses deterministic, explainable classical computer vision algorithms
- **Modular**: Can be enabled/disabled per parking lot without affecting others

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start the service
python service.py

# 3. Service runs on http://localhost:5001
```

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for detailed setup and usage instructions.

## Architecture

```
Node.js Backend (Express)
    ↓ HTTP API calls (axios)
Python OpenCV Service (Flask)
    ↓ Classical CV Processing
Parking Slot Occupancy Status
```

## Components

### 1. `slot_selector.py`
Interactive slot region definition utility:
- Loads reference parking lot image
- Interactive GUI for defining slot regions (polygons)
- Left click to add point, Right click to remove point
- Press 'n' for next slot, 's' to save, 'q' to quit
- Saves slot coordinates (normalized 0-1)

### 2. `occupancy_detector.py`
Classical OpenCV-based occupancy detection:
- Image preprocessing (grayscale, blur, threshold, morphology)
- Region extraction per slot
- White pixel counting
- Threshold-based decision (vacant/occupied)
- **No ML models, no training, deterministic**

### 3. `utils.py`
Utility functions:
- Image loading and preprocessing
- Coordinate normalization/denormalization
- Region extraction and pixel counting
- Validation functions

### 4. `service.py` (Flask API)
HTTP API wrapper exposing OpenCV functionality:
- `/health` - Health check
- `/define-slots` - Define slot regions (interactive)
- `/detect-occupancy` - Detect occupancy for all slots
- `/detect-single` - Detect occupancy for single slot

## Detection Algorithm

**Classical Computer Vision Pipeline:**

1. Grayscale conversion
2. Gaussian blur (noise reduction)
3. Adaptive thresholding (handles varying lighting)
4. Median blur (salt/pepper noise removal)
5. Morphological dilation (connect nearby pixels)
6. Region analysis (white pixel count per slot)
7. Threshold comparison → occupied/vacant

**Decision Logic:**
```
occupancy_ratio = white_pixels / total_region_area
if occupancy_ratio > threshold:
    status = "occupied"
else:
    status = "vacant"
```

## How Camera-Enabled and Manual Parking Coexist

1. **ParkingLot.cameraEnabled** flag controls detection method
2. **SlotAvailabilityService** (Node.js) abstracts the source
3. Customers get consistent API regardless of detection method
4. Owners can switch between modes anytime

**Benefits:**
- ✅ Robustness: Manual fallback if camera fails
- ✅ Scalability: Optional feature doesn't burden all parking lots  
- ✅ Flexibility: Owners choose best method for their setup
- ✅ Explainability: Classical CV is deterministic and debuggable

## API Endpoints (Internal Python Service)

- `GET /health` - Health check
- `POST /define-slots` - Interactive slot region definition
- `POST /detect-occupancy` - Detect occupancy for all slots
- `POST /detect-single` - Detect occupancy for single slot

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for Node.js backend integration endpoints.

## Requirements

- Python 3.7+
- opencv-python >= 4.8.0
- flask >= 2.3.0
- flask-cors >= 4.0.0
- numpy >= 1.24.0

## Configuration

Set environment variables:
```bash
OPENCV_SERVICE_PORT=5001  # Default: 5001
```

Node.js backend needs:
```env
OPENCV_SERVICE_URL=http://localhost:5001
```

## Usage Example

```python
from occupancy_detector import OccupancyDetector

detector = OccupancyDetector(threshold=0.15)

slots = [
    {
        "slot_id": "S1",
        "slot_number": 1,
        "coordinates": [[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]],
        "image_width": 1920,
        "image_height": 1080
    }
]

results = detector.detect_occupancy("parking_lot.jpg", slots)
# Returns: [{"slot_id": "S1", "status": "vacant", "occupancy_ratio": 0.05, ...}]
```

## Notes

- Coordinates are normalized [0-1] for flexibility with different image sizes
- Threshold is configurable per parking lot (default: 0.15)
- Detection is deterministic (same image + coordinates = same result)
- No machine learning - uses classical computer vision only

For detailed integration instructions, see [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).
