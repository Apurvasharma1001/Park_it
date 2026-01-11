"""
YOLO-based Vehicle Detection Module
Adapted from test22.py for Smart Parking System integration
"""
import cv2
import json
import numpy as np
from ultralytics import YOLO
import os
from typing import List, Dict, Any, Tuple, Optional


class YOLODetector:
    """
    YOLO-based vehicle detector for parking slot occupancy detection.
    Uses YOLO11 model to detect vehicles and calculate IoU with parking slots.
    """
    
    def __init__(
        self,
        model_path: str = "models/yolo11s.pt",
        conf_threshold: float = 0.35,
        iou_threshold: float = 0.45,
        occupied_threshold: float = 0.30
    ):
        """
        Initialize YOLO detector.
        
        Args:
            model_path: Path to YOLO model file
            conf_threshold: Confidence threshold for vehicle detection
            iou_threshold: IoU threshold for NMS (Non-Maximum Suppression)
            occupied_threshold: Minimum IoU to consider slot occupied
        """
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.occupied_threshold = occupied_threshold
        self.model = None
        
        print(f"[YOLO] Initializing detector with model: {model_path}")
        self._load_model()
    
    def _load_model(self):
        """Load YOLO model from file."""
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(f"YOLO model not found: {self.model_path}")
        
        try:
            self.model = YOLO(self.model_path)
            print(f"[YOLO] Model loaded successfully")
        except Exception as e:
            raise RuntimeError(f"Failed to load YOLO model: {e}")
    
    def detect_vehicles(self, image_path: str) -> List[Dict[str, Any]]:
        """
        Detect vehicles in the image.
        
        Args:
            image_path: Path to image file
            
        Returns:
            List of detected vehicles with bounding boxes and metadata
        """
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")
        
        # Read image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image from {image_path}")
        
        # Run YOLO detection
        results = self.model.predict(
            img,
            conf=self.conf_threshold,
            iou=self.iou_threshold,
            verbose=False
        )
        
        # Extract car bounding boxes (class 2 = car in COCO dataset)
        vehicles = []
        for box in results[0].boxes:
            cls = int(box.cls[0])
            if cls == 2:  # car class
                x1, y1, x2, y2 = map(float, box.xyxy[0])
                confidence = float(box.conf[0])
                
                vehicles.append({
                    'bbox': [x1, y1, x2, y2],
                    'confidence': confidence,
                    'class': 'car'
                })
        
        print(f"[YOLO] Detected {len(vehicles)} vehicles in image")
        return vehicles
    
    def polygon_to_bbox(self, polygon: List[List[float]]) -> List[float]:
        """
        Convert polygon points to bounding box.
        
        Args:
            polygon: List of [x, y] coordinates
            
        Returns:
            Bounding box as [x_min, y_min, x_max, y_max]
        """
        pts = np.array(polygon)
        x_min, y_min = pts.min(axis=0)
        x_max, y_max = pts.max(axis=0)
        return [x_min, y_min, x_max, y_max]
    
    def calculate_iou(self, box1: List[float], box2: List[float]) -> float:
        """
        Calculate Intersection over Union (IoU) between two bounding boxes.
        
        Args:
            box1: First bounding box [x_min, y_min, x_max, y_max]
            box2: Second bounding box [x_min, y_min, x_max, y_max]
            
        Returns:
            IoU value between 0 and 1
        """
        x1_min, y1_min, x1_max, y1_max = box1
        x2_min, y2_min, x2_max, y2_max = box2
        
        # Calculate intersection area
        inter_x_min = max(x1_min, x2_min)
        inter_y_min = max(y1_min, y2_min)
        inter_x_max = min(x1_max, x2_max)
        inter_y_max = min(y1_max, y2_max)
        
        if inter_x_max < inter_x_min or inter_y_max < inter_y_min:
            return 0.0
        
        inter_area = (inter_x_max - inter_x_min) * (inter_y_max - inter_y_min)
        
        # Calculate union area
        box1_area = (x1_max - x1_min) * (y1_max - y1_min)
        box2_area = (x2_max - x2_min) * (y2_max - y2_min)
        union_area = box1_area + box2_area - inter_area
        
        return inter_area / union_area if union_area > 0 else 0.0
    
    def check_slot_occupancy(
        self,
        slot_polygon: List[List[float]],
        vehicle_boxes: List[Dict[str, Any]]
    ) -> Tuple[bool, float, Optional[Dict[str, Any]]]:
        """
        Check if a parking slot is occupied by any detected vehicle.
        
        Args:
            slot_polygon: Parking slot polygon coordinates
            vehicle_boxes: List of detected vehicle bounding boxes
            
        Returns:
            Tuple of (is_occupied, max_iou, matched_vehicle)
        """
        slot_bbox = self.polygon_to_bbox(slot_polygon)
        
        max_iou = 0.0
        matched_vehicle = None
        
        for vehicle in vehicle_boxes:
            iou = self.calculate_iou(slot_bbox, vehicle['bbox'])
            if iou > max_iou:
                max_iou = iou
                matched_vehicle = vehicle
        
        is_occupied = max_iou >= self.occupied_threshold
        
        return is_occupied, max_iou, matched_vehicle
    
    def detect_occupancy(
        self,
        image_path: str,
        slots: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Detect occupancy for all parking slots using YOLO vehicle detection.
        
        Args:
            image_path: Path to parking lot image
            slots: List of slot definitions with coordinates
            
        Returns:
            List of slot occupancy results with vehicle metadata
        """
        print(f"[YOLO] Processing image: {image_path} with {len(slots)} slots")
        
        # Detect all vehicles in the image
        vehicles = self.detect_vehicles(image_path)
        
        # Load image to get dimensions
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image from {image_path}")
        
        img_height, img_width = img.shape[:2]
        
        results = []
        
        for slot in slots:
            try:
                # Extract slot information
                coordinates = slot.get('coordinates', [])
                slot_id = slot.get('slot_id') or slot.get('slotId')
                slot_num = slot.get('slot_number') or slot.get('slotNumber')
                
                # Get image dimensions (use slot's stored dims or actual image dims)
                s_width = slot.get('image_width') or slot.get('imageWidth') or img_width
                s_height = slot.get('image_height') or slot.get('imageHeight') or img_height
                
                if not coordinates:
                    print(f"[YOLO] Warning: Slot {slot_num} has no coordinates")
                    continue
                
                # Convert normalized coordinates to pixel coordinates
                pixel_coords = []
                for coord in coordinates:
                    if isinstance(coord, dict):
                        x_norm = coord.get('x', 0)
                        y_norm = coord.get('y', 0)
                    elif isinstance(coord, (list, tuple)):
                        x_norm = coord[0]
                        y_norm = coord[1]
                    else:
                        continue
                    
                    pixel_coords.append([
                        float(x_norm * s_width),
                        float(y_norm * s_height)
                    ])
                
                # Check slot occupancy
                is_occupied, max_iou, matched_vehicle = self.check_slot_occupancy(
                    pixel_coords,
                    vehicles
                )
                
                status = 'occupied' if is_occupied else 'vacant'
                
                # Prepare result
                result = {
                    'slot_id': slot_id,
                    'slot_number': slot_num,
                    'status': status,
                    'confidence': 1.0,
                    'occupancy_ratio': max_iou,
                    'detection_method': 'yolo'
                }
                
                # Add vehicle metadata if occupied
                if is_occupied and matched_vehicle:
                    result['vehicle_metadata'] = {
                        'bounding_box': {
                            'x1': matched_vehicle['bbox'][0],
                            'y1': matched_vehicle['bbox'][1],
                            'x2': matched_vehicle['bbox'][2],
                            'y2': matched_vehicle['bbox'][3]
                        },
                        'confidence': matched_vehicle['confidence'],
                        'iou': max_iou
                    }
                
                print(f"[YOLO] Slot {slot_num}: Status={status}, IoU={max_iou:.3f}, "
                      f"Vehicle={'Yes' if matched_vehicle else 'No'}")
                
                results.append(result)
                
            except Exception as e:
                print(f"[YOLO] Error processing slot {slot_num}: {e}")
                continue
        
        return results
    
    def visualize_detection(
        self,
        image_path: str,
        slots: List[Dict[str, Any]],
        results: List[Dict[str, Any]],
        output_path: str
    ):
        """
        Create visualization of detection results.
        
        Args:
            image_path: Path to original image
            slots: List of slot definitions
            results: Detection results
            output_path: Path to save visualization
        """
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image from {image_path}")
        
        img_height, img_width = img.shape[:2]
        
        # Detect vehicles for visualization
        vehicles = self.detect_vehicles(image_path)
        
        # Draw vehicle bounding boxes
        for vehicle in vehicles:
            x1, y1, x2, y2 = map(int, vehicle['bbox'])
            cv2.rectangle(img, (x1, y1), (x2, y2), (255, 0, 255), 2)
            conf_text = f"{vehicle['confidence']:.2f}"
            cv2.putText(img, conf_text, (x1, y1 - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 255), 2)
        
        # Draw parking slots
        result_map = {r['slot_number']: r for r in results}
        
        for slot in slots:
            slot_num = slot.get('slot_number') or slot.get('slotNumber')
            coordinates = slot.get('coordinates', [])
            
            if not coordinates:
                continue
            
            # Convert to pixel coordinates
            s_width = slot.get('image_width') or slot.get('imageWidth') or img_width
            s_height = slot.get('image_height') or slot.get('imageHeight') or img_height
            
            pixel_coords = []
            for coord in coordinates:
                if isinstance(coord, dict):
                    x_norm = coord.get('x', 0)
                    y_norm = coord.get('y', 0)
                elif isinstance(coord, (list, tuple)):
                    x_norm = coord[0]
                    y_norm = coord[1]
                else:
                    continue
                
                pixel_coords.append([
                    int(x_norm * s_width),
                    int(y_norm * s_height)
                ])
            
            pts = np.array(pixel_coords, np.int32).reshape((-1, 1, 2))
            
            # Color based on occupancy
            result = result_map.get(slot_num, {})
            is_occupied = result.get('status') == 'occupied'
            color = (0, 0, 255) if is_occupied else (0, 255, 0)  # Red/Green
            
            # Draw polygon
            cv2.polylines(img, [pts], True, color, 2)
            
            # Add slot number
            M = cv2.moments(pts)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                cv2.putText(img, f"#{slot_num}", (cx - 10, cy),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        # Save visualization
        cv2.imwrite(output_path, img)
        print(f"[YOLO] Saved visualization to {output_path}")


if __name__ == "__main__":
    # Test the detector
    print("Testing YOLO Detector...")
    
    detector = YOLODetector()
    print("✅ YOLO Detector initialized successfully")
