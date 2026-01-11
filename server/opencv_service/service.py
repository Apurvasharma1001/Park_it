"""
Flask API Service for OpenCV Parking Occupancy Detection

This service exposes the OpenCV detection functionality via HTTP API
for integration with the Node.js backend.
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import tempfile
from typing import Dict, Any, List
from occupancy_detector import OccupancyDetector
from slot_selector import SlotSelector
from camera_manager import CameraManager
import cv2

app = Flask(__name__)
CORS(app)  # Enable CORS for Node.js backend

from parking_lot_tracker import ParkingLotTracker
from yolo_detector import YOLODetector

# Global detector instances
detector = ParkingLotTracker(threshold_val=800)  # Classical detection
yolo_detector = None  # YOLO detection (lazy-loaded)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "opencv-parking-detection",
        "opencv_version": cv2.__version__
    }), 200


@app.route('/cameras', methods=['GET'])
def list_cameras():
    """
    List all available camera sources on the system
    
    Returns:
    {
        "success": true,
        "cameras": [
            {
                "index": 0,
                "name": "Camera 0",
                "type": "webcam",
                "width": 1920,
                "height": 1080,
                "fps": 30,
                "backend": "DirectShow",
                "source": "camera://0"
            },
            ...
        ],
        "source_types": [
            {
                "type": "webcam",
                "label": "Webcam/USB Camera",
                "description": "...",
                "format": "camera://{index}",
                "example": "camera://0"
            },
            ...
        ]
    }
    """
    try:
        cameras = CameraManager.list_available_cameras()
        source_types = CameraManager.get_camera_source_types()
        
        return jsonify({
            "success": True,
            "cameras": cameras,
            "source_types": source_types
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/test-camera', methods=['POST'])
def test_camera():
    """
    Test if a camera source is accessible
    
    Expected JSON:
    {
        "source": "camera://0" or "0" or file path
    }
    
    Returns:
    {
        "success": true/false,
        "source": "camera://0",
        "message": "Camera 0 connected successfully",
        "width": 1920,
        "height": 1080,
        "fps": 30
    }
    """
    try:
        data = request.json
        source = data.get('source')
        
        if not source:
            return jsonify({"success": False, "error": "source is required"}), 400
        
        result = CameraManager.test_camera_connection(source)
        status_code = 200 if result["success"] else 400
        
        return jsonify(result), status_code
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/define-slots', methods=['POST'])
def define_slots():
    """
    Define slot regions from an image
    
    Expected JSON:
    {
        "image_path": "path/to/image.jpg",
        "output_path": "path/to/save/slots.json" (optional)
    }
    
    Returns:
    {
        "success": true,
        "slots": [
            {
                "slot_id": "S1",
                "slot_number": 1,
                "coordinates": [[0.1, 0.2], [0.3, 0.2], ...],
                "image_width": 1920,
                "image_height": 1080
            },
            ...
        ]
    }
    """
    try:
        data = request.json
        image_path = data.get('image_path')
        
        if not image_path:
            return jsonify({"success": False, "error": "image_path is required"}), 400
        
        if not os.path.exists(image_path):
            return jsonify({"success": False, "error": f"Image file not found: {image_path}"}), 404
        
        # Run slot selector
        selector = SlotSelector(image_path)
        slots = selector.run()
        
        if not slots:
            return jsonify({"success": False, "error": "No slots defined"}), 400
        
        # Save to file if output_path provided
        output_path = data.get('output_path')
        if output_path:
            with open(output_path, 'w') as f:
                json.dump({
                    "image_path": image_path,
                    "slots": slots
                }, f, indent=2)
        
        return jsonify({
            "success": True,
            "slots": slots
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/detect-occupancy', methods=['POST'])
def detect_occupancy():
    """
    Detect occupancy for all slots
    
    Expected JSON:
    {
        "image_path": "path/to/current/image.jpg" or "path/to/video.mp4",
        "slots": [
            {
                "slot_id": "S1",
                "slot_number": 1,
                "coordinates": [[0.1, 0.2], [0.3, 0.2], ...],
                "image_width": 1920,
                "image_height": 1080
            },
            ...
        ],
        "threshold": 0.15 (optional, overrides default),
        "video_frame": 0 (optional, for videos: frame number, -1 for last frame)
    }
    
    Returns:
    {
        "success": true,
        "results": [
            {
                "slot_id": "S1",
                "slot_number": 1,
                "status": "occupied" | "vacant",
                "occupancy_ratio": 0.25,
                "white_pixel_count": 1234,
                "total_area": 5000,
                "confidence": 0.8
            },
            ...
        ]
    }
    """
    try:
        data = request.json
        image_path = data.get('image_path')
        slots = data.get('slots')
        threshold = data.get('threshold')
        
        if not image_path:
            return jsonify({"success": False, "error": "image_path is required"}), 400
        
        if not slots:
            return jsonify({"success": False, "error": "slots array is required"}), 400
        
        if not os.path.exists(image_path):
            return jsonify({"success": False, "error": f"Image/Video file not found: {image_path}"}), 404
        
        # Override threshold if provided
        if threshold is not None:
            detector.threshold = float(threshold)
        
        # Handle video frame extraction if needed
        video_frame = data.get('video_frame', 0)
        
        # Check if it's a camera source
        if image_path.startswith("camera://") or (len(image_path) == 1 and image_path.isdigit()):
            # Capture frame from camera
            frame = CameraManager.capture_frame_from_camera(image_path)
            if frame is None:
                return jsonify({"success": False, "error": f"Could not capture frame from camera: {image_path}"}), 400
            
            # Save as temp file for detection
            temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
            temp_path = temp_file.name
            temp_file.close()
            cv2.imwrite(temp_path, frame)
            try:
                results = detector.detect_occupancy(temp_path, slots)
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        # Check if it's a video file
        elif os.path.splitext(image_path.lower())[1] in ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm']:
            # Extract frame from video
            from utils import extract_frame_from_video
            frame = extract_frame_from_video(image_path, video_frame)
            # Save as temp file for detection
            temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
            temp_path = temp_file.name
            temp_file.close()
            cv2.imwrite(temp_path, frame)
            try:
                results = detector.detect_occupancy(temp_path, slots)
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        else:
            # Regular image file
            results = detector.detect_occupancy(image_path, slots)
        
        return jsonify({
            "success": True,
            "results": results
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/detect-single', methods=['POST'])
def detect_single_slot():
    """
    Detect occupancy for a single slot
    
    Expected JSON:
    {
        "image_path": "path/to/current/image.jpg",
        "slot_coordinates": [[0.1, 0.2], [0.3, 0.2], ...],
        "image_width": 1920,
        "image_height": 1080,
        "threshold": 0.15 (optional)
    }
    
    Returns:
    {
        "success": true,
        "status": "occupied" | "vacant",
        "occupancy_ratio": 0.25,
        "white_pixel_count": 1234,
        "total_area": 5000,
        "confidence": 0.8
    }
    """
    try:
        data = request.json
        image_path = data.get('image_path')
        slot_coordinates = data.get('slot_coordinates')
        image_width = data.get('image_width')
        image_height = data.get('image_height')
        threshold = data.get('threshold')
        
        if not all([image_path, slot_coordinates, image_width, image_height]):
            return jsonify({"success": False, "error": "Missing required fields"}), 400
        
        if threshold is not None:
            detector.threshold = float(threshold)
        
        result = detector.detect_single_slot(
            image_path,
            slot_coordinates,
            image_width,
            image_height
        )
        
        return jsonify({
            "success": True,
            **result
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/detect-yolo', methods=['POST'])
def detect_yolo():
    """
    Detect occupancy using YOLO vehicle detection
    
    Expected JSON:
    {
        "image_path": "path/to/current/image.jpg",
        "slots": [
            {
                "slot_id": "S1",
                "slot_number": 1,
                "coordinates": [[0.1, 0.2], [0.3, 0.2], ...],
                "image_width": 1920,
                "image_height": 1080
            },
            ...
        ],
        "model_path": "models/yolo11s.pt" (optional),
        "conf_threshold": 0.35 (optional),
        "iou_threshold": 0.45 (optional),
        "occupied_threshold": 0.30 (optional)
    }
    
    Returns:
    {
        "success": true,
        "results": [
            {
                "slot_id": "S1",
                "slot_number": 1,
                "status": "occupied" | "vacant",
                "occupancy_ratio": 0.45,  # IoU value
                "confidence": 1.0,
                "detection_method": "yolo",
                "vehicle_metadata": {  # Only if occupied
                    "bounding_box": {
                        "x1": 100, "y1": 200,
                        "x2": 300, "y2": 400
                    },
                    "confidence": 0.87,
                    "iou": 0.45
                }
            },
            ...
        ],
        "total_vehicles_detected": 5
    }
    """
    global yolo_detector
    
    try:
        data = request.json
        image_path = data.get('image_path')
        slots = data.get('slots')
        
        if not image_path:
            return jsonify({"success": False, "error": "image_path is required"}), 400
        
        if not slots:
            return jsonify({"success": False, "error": "slots array is required"}), 400
        
        if not os.path.exists(image_path):
            return jsonify({"success": False, "error": f"Image file not found: {image_path}"}), 404
        
        # Lazy-load YOLO detector
        if yolo_detector is None:
            model_path = data.get('model_path', 'models/yolo11s.pt')
            conf_threshold = data.get('conf_threshold', 0.35)
            iou_threshold = data.get('iou_threshold', 0.45)
            occupied_threshold = data.get('occupied_threshold', 0.30)
            
            try:
                yolo_detector = YOLODetector(
                    model_path=model_path,
                    conf_threshold=conf_threshold,
                    iou_threshold=iou_threshold,
                    occupied_threshold=occupied_threshold
                )
            except Exception as e:
                return jsonify({
                    "success": False,
                    "error": f"Failed to load YOLO model: {str(e)}",
                    "hint": "Make sure yolo11s.pt is in the models/ directory and ultralytics is installed"
                }), 500
        
        # Run YOLO detection
        results = yolo_detector.detect_occupancy(image_path, slots)
        
        # Count total vehicles detected
        total_vehicles = sum(1 for r in results if r.get('vehicle_metadata'))
        
        return jsonify({
            "success": True,
            "results": results,
            "total_vehicles_detected": total_vehicles,
            "detection_method": "yolo"
        }), 200
        
    except Exception as e:
        import traceback
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500


if __name__ == "__main__":
    # Run Flask service
    port = int(os.environ.get('OPENCV_SERVICE_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)


