"""
Camera Manager - Handles camera source detection and frame capture
Supports webcam, USB cameras, IP cameras, and file-based sources
"""
import cv2
import numpy as np
from typing import List, Dict, Any, Optional
import os


class CameraManager:
    """Manages camera sources and frame capture"""
    
    @staticmethod
    def list_available_cameras(max_check: int = 10) -> List[Dict[str, Any]]:
        """
        List all available camera sources on the system
        
        Args:
            max_check: Maximum number of camera indices to check (default: 10)
            
        Returns:
            List of available camera sources with their properties
        """
        available_cameras = []
        
        # Check standard camera indices (0-9)
        for i in range(max_check):
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                # Try to read a frame to verify it works
                ret, frame = cap.read()
                if ret and frame is not None:
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    fps = cap.get(cv2.CAP_PROP_FPS)
                    backend = cap.getBackendName()
                    
                    available_cameras.append({
                        "index": i,
                        "name": f"Camera {i}",
                        "type": "webcam",
                        "width": width,
                        "height": height,
                        "fps": fps if fps > 0 else 30,
                        "backend": backend,
                        "source": f"camera://{i}"
                    })
                cap.release()
        
        return available_cameras
    
    @staticmethod
    def capture_frame_from_camera(source: str, timeout: int = 5) -> Optional[np.ndarray]:
        """
        Capture a frame from a camera source
        
        Args:
            source: Camera source (e.g., "camera://0", "camera://1", or file path)
            timeout: Timeout in seconds for camera initialization
            
        Returns:
            Captured frame as numpy array, or None if failed
        """
        camera_index = None
        
        # Parse camera source
        if source.startswith("camera://"):
            try:
                camera_index = int(source.replace("camera://", ""))
            except ValueError:
                return None
        elif source.isdigit():
            camera_index = int(source)
        else:
            # Treat as file path
            if os.path.exists(source):
                # It's a file path (image or video)
                return None  # File sources handled by load_image
            return None
        
        # Open camera
        cap = cv2.VideoCapture(camera_index)
        
        if not cap.isOpened():
            return None
        
        # Set timeout properties
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce latency
        
        # Read frame
        ret, frame = cap.read()
        cap.release()
        
        if ret and frame is not None:
            return frame
        
        return None
    
    @staticmethod
    def test_camera_connection(source: str) -> Dict[str, Any]:
        """
        Test if a camera source is accessible
        
        Args:
            source: Camera source to test
            
        Returns:
            Dictionary with test results
        """
        result = {
            "success": False,
            "source": source,
            "message": "",
            "width": None,
            "height": None,
            "fps": None
        }
        
        try:
            if source.startswith("camera://"):
                camera_index = int(source.replace("camera://", ""))
            elif source.isdigit():
                camera_index = int(source)
            else:
                # File path
                if os.path.exists(source):
                    result["success"] = True
                    result["message"] = "File exists"
                    return result
                else:
                    result["message"] = "File not found"
                    return result
            
            cap = cv2.VideoCapture(camera_index)
            
            if not cap.isOpened():
                result["message"] = f"Camera {camera_index} could not be opened"
                return result
            
            # Try to read a frame
            ret, frame = cap.read()
            
            if not ret or frame is None:
                result["message"] = f"Camera {camera_index} opened but could not read frame"
                cap.release()
                return result
            
            result["success"] = True
            result["width"] = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            result["height"] = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            result["fps"] = cap.get(cv2.CAP_PROP_FPS)
            result["message"] = f"Camera {camera_index} connected successfully"
            
            cap.release()
            
        except Exception as e:
            result["message"] = f"Error: {str(e)}"
        
        return result
    
    @staticmethod
    def get_camera_source_types() -> List[Dict[str, str]]:
        """
        Get list of available camera source types
        
        Returns:
            List of camera source type definitions
        """
        return [
            {
                "type": "webcam",
                "label": "Webcam/USB Camera",
                "description": "Built-in or USB connected camera",
                "format": "camera://{index}",
                "example": "camera://0"
            },
            {
                "type": "ip_camera",
                "label": "IP Camera",
                "description": "Network IP camera (RTSP, HTTP, etc.)",
                "format": "rtsp://ip:port/stream",
                "example": "rtsp://192.168.1.100:554/stream"
            },
            {
                "type": "file",
                "label": "Video File",
                "description": "Pre-recorded video file",
                "format": "file path",
                "example": "C:/videos/parking.mp4"
            },
            {
                "type": "image",
                "label": "Image File",
                "description": "Static image file",
                "format": "file path",
                "example": "C:/images/parking.jpg"
            }
        ]

