
"""
Reference Parking Lot Tracker
Based on user-provided cvzone/OpenCV implementation.
"""
import cv2
import numpy as np
import os
from typing import List, Dict, Any

class ParkingLotTracker:
    def __init__(self, threshold_val=900):
        # User reference hardcoded parameters
        self.val1 = 25  # Adaptive Threshold Block Size
        self.val2 = 16  # Adaptive Threshold C
        self.val3 = 5   # Median Blur
        self.threshold_val = threshold_val # User ref: count < 900 is Free

    def preprocess_image(self, img):
        # EXACT User Reference Pipeline
        imgGray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        imgBlur = cv2.GaussianBlur(imgGray, (3, 3), 1)
        
        # Adaptive Threshold
        imgThres = cv2.adaptiveThreshold(imgBlur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                         cv2.THRESH_BINARY_INV, self.val1, self.val2)
        
        # Median Blur
        imgThres = cv2.medianBlur(imgThres, self.val3)
        
        # Dilate
        kernel = np.ones((3, 3), np.uint8)
        imgDilate = cv2.dilate(imgThres, kernel, iterations=1)
        
        return imgDilate

    def detect_occupancy(self, image_path: str, slots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        print(f"[TRACKER] processing image: {image_path} with {len(slots)} slots")
        
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            print(f"[ERROR] Could not load image from {image_path}")
            raise ValueError(f"Could not load image from {image_path}")

        # Preprocess
        imgPro = self.preprocess_image(img)
        img_height, img_width = img.shape[:2]

        results = []

        # Save Debug Frame
        try:
             # Save to client root to be accessible via Vite dev server
            debug_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(image_path))), 'client', 'debug_frame.jpg')
            if 'server' in os.getcwd():
                debug_path = os.path.abspath(os.path.join(os.getcwd(), '..', 'client', 'debug_frame.jpg'))
            
            cv2.imwrite(debug_path, imgPro)
            print(f"[DEBUG] Saved processed frame to {debug_path}")
        except:
            pass

        for slot in slots:
            try:
                # Extract coordinates - handle multiple naming conventions
                coordinates = slot.get('coordinates', [])
                slot_id = slot.get('slot_id') or slot.get('slotId')
                slot_num = slot.get('slot_number') or slot.get('slotNumber')
                
                # Default dims if missing
                s_width = slot.get('image_width') or slot.get('imageWidth') or img_width
                s_height = slot.get('image_height') or slot.get('imageHeight') or img_height

                if not coordinates:
                    print(f"[WARN] Slot {slot_num} has no coordinates")
                    continue

                # Create mask for polygon (User Code supported rects, we adapt for polygons)
                mask = np.zeros(imgPro.shape, dtype=np.uint8)
                
                # Convert normalized to pixel coords
                pixel_coords = []
                for coord in coordinates:
                    # Handle both [x, y] list and {'x': x, 'y': y} dict
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
                
                pts = np.array(pixel_coords, np.int32)
                
                # Bounding Rect
                x, y, w, h = cv2.boundingRect(pts)
                
                # Start with crop
                if y+h > imgPro.shape[0]: h = imgPro.shape[0] - y
                if x+w > imgPro.shape[1]: w = imgPro.shape[1] - x
                
                imgCrop = imgPro[y:y+h, x:x+w]
                
                # Mask within crop to handle rotation/polygons precisely
                mask_roi = np.zeros(imgCrop.shape, dtype=np.uint8)
                pts_shifted = pts - [x, y]
                cv2.fillPoly(mask_roi, [pts_shifted], 255)
                imgCropMasked = cv2.bitwise_and(imgCrop, imgCrop, mask=mask_roi)
                
                count = cv2.countNonZero(imgCropMasked)
                area = w * h 
                if area == 0: area = 1

                # ADAPTIVE FIX: 
                threshold_pixel = self.threshold_val
                
                is_occupied = False
                
                if threshold_pixel > 1.0:
                    # Absolute logic requested
                    if count >= threshold_pixel:
                        is_occupied = True
                else:
                    # Ratio logic
                    if (count / area) > threshold_pixel: 
                        is_occupied = True
                
                status = 'occupied' if is_occupied else 'vacant'
                
                print(f"[TRACKER] Slot {slot_num}: Count={count}, Area={area}, Ratio={(count/area):.2f}, Status={status}, Thresh={threshold_pixel}")

                results.append({
                    'slot_id': slot_id,
                    'slot_number': slot_num,
                    'status': status,
                    'occupancy_ratio': float(count/area),
                    'white_pixel_count': int(count),
                    'total_area': int(area), # Added for compatibility
                    'confidence': 1.0 
                })

            except Exception as e:
                print(f"[ERROR] Slot processing error: {e}")
                
        return results
