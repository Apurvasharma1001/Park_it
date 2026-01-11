"""
Occupancy Detector - Classical OpenCV-based parking slot occupancy detection
Uses image processing techniques (no ML) for deterministic, explainable detection.

Algorithm matches reference implementation:
1. Grayscale conversion
2. Gaussian blur (3x3, sigma=1)
3. Adaptive thresholding (block size 25, C=16)
4. Median blur (size 5)
5. Morphological dilation (3x3 kernel)
6. Pixel counting per slot region using cv2.countNonZero
7. Threshold comparison
"""
import cv2
import numpy as np
from typing import List, Dict, Any
from utils import count_pixels_in_region


class OccupancyDetector:
    """
    Detects parking slot occupancy using classical computer vision techniques.
    
    Algorithm:
    1. Grayscale conversion
    2. Gaussian blur
    3. Adaptive thresholding
    4. Median blur
    5. Morphological dilation
    6. Pixel counting per slot region
    7. Threshold comparison
    """
    
    
    def __init__(self, threshold: float = 800, 
                 adaptive_thresh_block_size: int = 25,
                 adaptive_thresh_c: int = 16,
                 median_blur_size: int = 5,
                 dilate_kernel_size: int = 3):
        """
        Initialize the occupancy detector.
        
        Args:
            threshold: Occupancy threshold (0-1). Values below this indicate vacant slots.
            adaptive_thresh_block_size: Block size for adaptive thresholding (must be odd)
            adaptive_thresh_c: Constant subtracted from mean for adaptive thresholding
            median_blur_size: Kernel size for median blur (must be odd)
            dilate_kernel_size: Kernel size for dilation
        """
        self.threshold = threshold
        self.adaptive_thresh_block_size = adaptive_thresh_block_size if adaptive_thresh_block_size % 2 == 1 else adaptive_thresh_block_size + 1
        self.adaptive_thresh_c = adaptive_thresh_c
        self.median_blur_size = median_blur_size if median_blur_size % 2 == 1 else median_blur_size + 1
        self.dilate_kernel_size = dilate_kernel_size
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image using classical CV techniques (matches reference algorithm).
        
        Pipeline:
        1. Convert to grayscale
        2. Apply Gaussian blur (3x3, sigma=1)
        3. Adaptive thresholding (block size 25, C=16)
        4. Median blur (size 5)
        5. Morphological dilation (3x3 kernel)
        
        Args:
            image: Input BGR image
            
        Returns:
            Preprocessed binary image
        """
        from utils import preprocess_image
        return preprocess_image(
            image,
            adaptive_thresh_block_size=self.adaptive_thresh_block_size,
            adaptive_thresh_c=self.adaptive_thresh_c,
            median_blur_size=self.median_blur_size,
            dilate_kernel_size=self.dilate_kernel_size
        )
    
    def detect_occupancy(self, image_path: str, slots: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detect occupancy for multiple parking slots.
        
        Args:
            image_path: Path to current parking lot image
            slots: List of slot definitions with:
                - slot_id: Unique identifier
                - slot_number: Slot number
                - coordinates: Normalized coordinates [0-1] as [[x1, y1], [x2, y2], ...]
                - image_width: Original image width
                - image_height: Original image height
                
        Returns:
            List of detection results with:
                - slot_id: Slot identifier
                - slot_number: Slot number
                - status: 'occupied' or 'vacant'
                - occupancy_ratio: Ratio of white pixels (0-1)
                - white_pixel_count: Number of white pixels
                - total_area: Total pixel area of the slot
                - confidence: Confidence score (1 - occupancy_ratio for vacant, occupancy_ratio for occupied)
        """
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image from {image_path}")
        
        img_height, img_width = img.shape[:2]
        
        # Preprocess image
        img_processed = self.preprocess_image(img)
        
        # DEBUG: Save processed image for verification
        try:
            # Save to client root to be accessible via Vite dev server
            debug_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(image_path))), 'client', 'debug_frame.jpg')
            # If path resolution is tricky, try absolute knowing the structure
            # c:\Users\apurv\OneDrive\Desktop\PROJECTS\Parkit Final\client\debug_frame.jpg
            if 'server' in os.getcwd():
                debug_path = os.path.abspath(os.path.join(os.getcwd(), '..', 'client', 'debug_frame.jpg'))
            
            cv2.imwrite(debug_path, img_processed)
            print(f"[DEBUG] Saved processed frame to {debug_path}")
        except Exception as e:
            print(f"[WARN] Could not save debug frame: {e}")
        
        results = []
        
        for slot in slots:
            try:
                # Extract slot region coordinates
                coordinates = slot.get('coordinates', [])
                if not coordinates or len(coordinates) < 3:
                    # Skip slots without valid coordinates
                    results.append({
                        'slot_id': slot.get('slot_id', ''),
                        'slot_number': slot.get('slot_number', 0),
                        'status': 'unknown',
                        'occupancy_ratio': 0.0,
                        'white_pixel_count': 0,
                        'total_area': 0,
                        'confidence': 0.0
                    })
                    continue
                
                # Denormalize coordinates
                slot_image_width = slot.get('image_width', img_width)
                slot_image_height = slot.get('image_height', img_height)
                
                # Convert normalized coordinates to pixel coordinates
                pixel_coords = []
                for coord in coordinates:
                    if isinstance(coord, (list, tuple)) and len(coord) >= 2:
                        x = int(coord[0] * slot_image_width)
                        y = int(coord[1] * slot_image_height)
                        pixel_coords.append([x, y])
                    else:
                        pixel_coords.append([0, 0])
                
                # Count white pixels in the region using utility function
                # (which uses cv2.countNonZero like the reference code)
                pixel_coords_tuples = [(int(p[0]), int(p[1])) for p in pixel_coords]
                white_pixel_count = count_pixels_in_region(img_processed, pixel_coords_tuples)
                total_area = cv2.contourArea(np.array(pixel_coords, dtype=np.int32))
                
                if total_area == 0:
                    # Fallback: calculate area from bounding box
                    pixel_coords_array = np.array(pixel_coords, dtype=np.int32)
                    x, y, w, h = cv2.boundingRect(pixel_coords_array)
                    total_area = w * h
                
                # Calculate occupancy ratio
                if total_area > 0:
                    occupancy_ratio = white_pixel_count / total_area
                else:
                    occupancy_ratio = 0.0
                
                # Determine status based on threshold logic
                # Reference implementation uses absolute pixel count (e.g., < 900 is free)
                # But here we look for white pixels which indicate EDGES/TEXTURE (Occupied)
                # So High Count = Occupied.
                # User Ref: count < 900 means Free. So count >= 900 means Occupied.
                
                # Heuristic: If threshold > 1.0, treat as absolute pixel count.
                # If threshold <= 1.0, treat as ratio.
                if self.threshold > 1.0:
                     is_occupied = white_pixel_count >= self.threshold
                     # Confidence for pixel count
                     if is_occupied:
                         confidence = min(white_pixel_count / (self.threshold * 2), 1.0)
                     else:
                         confidence = min((self.threshold - white_pixel_count) / self.threshold, 1.0)
                else:
                    is_occupied = occupancy_ratio > self.threshold
                    # Confidence for ratio
                    if is_occupied:
                        confidence = min(occupancy_ratio / self.threshold, 1.0)
                    else:
                        confidence = min((self.threshold - occupancy_ratio) / self.threshold, 1.0)

                status = 'occupied' if is_occupied else 'vacant'
                
                results.append({
                    'slot_id': slot.get('slot_id', ''),
                    'slot_number': slot.get('slot_number', 0),
                    'status': status,
                    'occupancy_ratio': float(occupancy_ratio),
                    'white_pixel_count': int(white_pixel_count),
                    'total_area': int(total_area),
                    'confidence': float(confidence)
                })
                
            except Exception as e:
                print(f"Error processing slot {slot.get('slot_id', 'unknown')}: {e}")
                results.append({
                    'slot_id': slot.get('slot_id', ''),
                    'slot_number': slot.get('slot_number', 0),
                    'status': 'error',
                    'occupancy_ratio': 0.0,
                    'white_pixel_count': 0,
                    'total_area': 0,
                    'confidence': 0.0
                })
        
        return results
