"""
Utility functions for OpenCV parking occupancy detection
"""
import cv2
import numpy as np
import os
from typing import List, Tuple, Dict, Any


def extract_frame_from_video(video_path: str, frame_number: int = 0) -> np.ndarray:
    """
    Extract a frame from a video file
    
    Args:
        video_path: Path to video file
        frame_number: Frame number to extract (0 = first frame, -1 = last frame)
        
    Returns:
        Extracted frame as numpy array
    """
    if not os.path.exists(video_path):
        raise ValueError(f"Video file not found: {video_path}")
    
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")
    
    # Get total frames
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if total_frames == 0:
        cap.release()
        raise ValueError(f"Video file has no frames: {video_path}")
    
    # Handle frame_number
    if frame_number == -1:
        # Get last frame
        frame_number = total_frames - 1
    elif frame_number < 0:
        # Get frame from end (e.g., -10 = 10 frames from end)
        frame_number = max(0, total_frames + frame_number)
    
    # Set frame position
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    
    # Read frame
    ret, frame = cap.read()
    cap.release()
    
    if not ret or frame is None:
        raise ValueError(f"Could not extract frame {frame_number} from video")
    
    return frame


def load_image(image_path: str, from_camera: bool = False) -> np.ndarray:
    """
    Load image from file path, video file, camera source, or URL
    
    Args:
        image_path: Path to image file, video file, camera source (camera://0), or URL
        from_camera: If True, treat as camera source
        
    Returns:
        Loaded image as numpy array
    """
    # Check if it's a camera source
    if image_path.startswith("camera://") or (from_camera and image_path.isdigit()):
        from camera_manager import CameraManager
        if image_path.isdigit() and not image_path.startswith("camera://"):
            image_path = f"camera://{image_path}"
        frame = CameraManager.capture_frame_from_camera(image_path)
        if frame is None:
            raise ValueError(f"Could not capture frame from camera: {image_path}")
        return frame
    
    # Check if it's a video file
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm']
    file_ext = os.path.splitext(image_path.lower())[1]
    
    if file_ext in video_extensions:
        return extract_frame_from_video(image_path, 0)  # Extract first frame by default
    
    # Try to load as image
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not load image from {image_path}")
    return img


def extract_frame_from_video(video_path: str, frame_number: int = 0) -> np.ndarray:
    """
    Extract a frame from a video file
    
    Args:
        video_path: Path to video file
        frame_number: Frame number to extract (0 = first frame, -1 = last frame)
        
    Returns:
        Extracted frame as numpy array
    """
    if not os.path.exists(video_path):
        raise ValueError(f"Video file not found: {video_path}")
    
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")
    
    # Get total frames
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if total_frames == 0:
        cap.release()
        raise ValueError(f"Video file has no frames: {video_path}")
    
    # Handle frame_number
    if frame_number == -1:
        # Get last frame
        frame_number = total_frames - 1
    elif frame_number < 0:
        # Get frame from end (e.g., -10 = 10 frames from end)
        frame_number = max(0, total_frames + frame_number)
    
    # Set frame position
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    
    # Read frame
    ret, frame = cap.read()
    cap.release()
    
    if not ret or frame is None:
        raise ValueError(f"Could not extract frame {frame_number} from video")
    
    return frame


def preprocess_image(img: np.ndarray, 
                     adaptive_thresh_block_size: int = 25,
                     adaptive_thresh_c: int = 16,
                     median_blur_size: int = 5,
                     dilate_kernel_size: int = 3) -> np.ndarray:
    """
    Preprocess image for occupancy detection (matches reference algorithm):
    - Convert to grayscale
    - Apply Gaussian blur (3x3, sigma=1)
    - Apply adaptive thresholding (block size 25, C=16)
    - Apply median blur (size 5)
    - Apply morphological dilation (3x3 kernel)
    
    Args:
        img: Input BGR image
        adaptive_thresh_block_size: Block size for adaptive thresholding (must be odd)
        adaptive_thresh_c: Constant subtracted from mean for adaptive thresholding
        median_blur_size: Kernel size for median blur (must be odd)
        dilate_kernel_size: Kernel size for dilation
        
    Returns:
        Processed binary image
    """
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Gaussian blur (3x3 kernel, sigma=1) - matches reference code
    blurred = cv2.GaussianBlur(gray, (3, 3), 1)
    
    # Ensure block size is odd (adaptive threshold requirement)
    if adaptive_thresh_block_size % 2 == 0:
        adaptive_thresh_block_size += 1
    
    # Adaptive thresholding - matches reference code exactly
    # ADAPTIVE_THRESH_GAUSSIAN_C with THRESH_BINARY_INV
    thresh = cv2.adaptiveThreshold(
        blurred, 
        255, 
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
        cv2.THRESH_BINARY_INV, 
        adaptive_thresh_block_size, 
        adaptive_thresh_c
    )
    
    # Ensure median blur size is odd
    if median_blur_size % 2 == 0:
        median_blur_size += 1
    
    # Median blur to remove salt and pepper noise - matches reference code
    median = cv2.medianBlur(thresh, median_blur_size)
    
    # Morphological dilation to connect nearby pixels - matches reference code
    kernel = np.ones((dilate_kernel_size, dilate_kernel_size), np.uint8)
    dilated = cv2.dilate(median, kernel, iterations=1)
    
    return dilated


def extract_region(img: np.ndarray, coordinates: List[Tuple[int, int]]) -> np.ndarray:
    """
    Extract a region from image defined by coordinates
    
    Args:
        img: Input image
        coordinates: List of (x, y) tuples defining polygon region
        
    Returns:
        Extracted region
    """
    # Create mask for the region
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    pts = np.array(coordinates, np.int32)
    cv2.fillPoly(mask, [pts], 255)
    
    # Extract region
    region = cv2.bitwise_and(img, img, mask=mask)
    return region


def count_pixels_in_region(binary_img: np.ndarray, coordinates: List[Tuple[int, int]]) -> int:
    """
    Count white pixels (occupied area) in a region using cv2.countNonZero
    (matches reference algorithm approach)
    
    Args:
        binary_img: Binary processed image
        coordinates: List of (x, y) tuples defining polygon region
        
    Returns:
        Number of white pixels in the region
    """
    # Create mask for the region
    mask = np.zeros(binary_img.shape[:2], dtype=np.uint8)
    pts = np.array(coordinates, np.int32)
    cv2.fillPoly(mask, [pts], 255)
    
    # Extract the region from processed image
    img_crop = cv2.bitwise_and(binary_img, binary_img, mask=mask)
    
    # Count non-zero (white) pixels using cv2.countNonZero (matches reference code)
    white_pixel_count = cv2.countNonZero(img_crop)
    
    return int(white_pixel_count)


def calculate_region_area(coordinates: List[Tuple[int, int]]) -> float:
    """
    Calculate area of a polygon region
    
    Args:
        coordinates: List of (x, y) tuples defining polygon
        
    Returns:
        Area of the polygon
    """
    pts = np.array(coordinates, np.int32)
    area = cv2.contourArea(pts)
    return float(area)


def normalize_coordinates(coordinates: List[Tuple[int, int]], img_width: int, img_height: int) -> List[Tuple[float, float]]:
    """
    Normalize coordinates to 0-1 range (for storage flexibility)
    
    Args:
        coordinates: List of (x, y) tuples
        img_width: Image width
        img_height: Image height
        
    Returns:
        List of normalized (x, y) tuples
    """
    normalized = [(x / img_width, y / img_height) for x, y in coordinates]
    return normalized


def denormalize_coordinates(normalized_coords: List[Tuple[float, float]], img_width: int, img_height: int) -> List[Tuple[int, int]]:
    """
    Convert normalized coordinates back to pixel coordinates
    
    Args:
        normalized_coords: List of normalized (x, y) tuples
        img_width: Image width
        img_height: Image height
        
    Returns:
        List of (x, y) pixel coordinate tuples
    """
    coords = [(int(x * img_width), int(y * img_height)) for x, y in normalized_coords]
    return coords


def validate_coordinates(coordinates: List[Tuple[int, int]], img_width: int, img_height: int) -> bool:
    """
    Validate that coordinates are within image bounds
    
    Args:
        coordinates: List of (x, y) tuples
        img_width: Image width
        img_height: Image height
        
    Returns:
        True if all coordinates are valid
    """
    for x, y in coordinates:
        if x < 0 or x >= img_width or y < 0 or y >= img_height:
            return False
    return True


