"""
Slot Selector - Manual slot region definition utility

This module provides an interactive interface for parking lot owners
to define parking slot regions by clicking on a reference image.

Usage:
    python slot_selector.py <image_path> <output_json_path>
    
Interactive Controls:
    - Left Click: Add a point to current slot region
    - Right Click: Remove last point from current slot
    - 'n' Key: Finish current slot and start new one
    - 's' Key: Save all slots and exit
    - 'q' Key: Quit without saving
"""
import cv2
import json
import sys
from typing import List, Tuple, Dict, Any
import numpy as np


class SlotSelector:
    """Interactive slot region selector"""
    
    def __init__(self, image_path: str):
        """
        Initialize slot selector
        
        Args:
            image_path: Path to reference parking lot image
        """
        self.image_path = image_path
        self.image = cv2.imread(image_path)
        if self.image is None:
            raise ValueError(f"Could not load image from {image_path}")
        
        self.display_image = self.image.copy()
        self.slots = []  # List of slot regions
        self.current_slot = []  # Current slot being defined
        self.window_name = "Parking Slot Selector - Left click to add, Right click to remove, 'n' for next, 's' to save"
        
    def mouse_callback(self, event, x, y, flags, param):
        """
        Mouse callback for interactive region selection
        
        Args:
            event: OpenCV mouse event
            x, y: Mouse coordinates
            flags: Event flags
            param: User data
        """
        if event == cv2.EVENT_LBUTTONDOWN:
            # Left click: Add point to current slot
            self.current_slot.append((x, y))
            self.update_display()
            
        elif event == cv2.EVENT_RBUTTONDOWN:
            # Right click: Remove last point
            if self.current_slot:
                self.current_slot.pop()
                self.update_display()
    
    def update_display(self):
        """Update the display image with current slots and current selection"""
        self.display_image = self.image.copy()
        
        # Draw all completed slots
        for i, slot in enumerate(self.slots):
            if len(slot) >= 3:  # Need at least 3 points for a polygon
                pts = np.array(slot, np.int32)
                cv2.polylines(self.display_image, [pts], True, (0, 255, 0), 2)
                # Draw slot number
                if slot:
                    center = np.mean(slot, axis=0, dtype=np.int32)
                    cv2.putText(self.display_image, f"S{i+1}", 
                              (center[0]-10, center[1]), 
                              cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        # Draw current slot being defined
        if len(self.current_slot) > 1:
            pts = np.array(self.current_slot, np.int32)
            cv2.polylines(self.display_image, [pts], False, (0, 0, 255), 2)
        elif len(self.current_slot) == 1:
            cv2.circle(self.display_image, self.current_slot[0], 5, (0, 0, 255), -1)
        
        # Draw points
        for point in self.current_slot:
            cv2.circle(self.display_image, point, 5, (0, 0, 255), -1)
    
    def run(self) -> List[Dict[str, Any]]:
        """
        Run the interactive slot selector
        
        Returns:
            List of slot dictionaries with coordinates
        """
        cv2.namedWindow(self.window_name)
        cv2.setMouseCallback(self.window_name, self.mouse_callback)
        
        self.update_display()
        
        while True:
            cv2.imshow(self.window_name, self.display_image)
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('n'):
                # Finish current slot and start new one
                if len(self.current_slot) >= 3:  # Minimum 3 points for a polygon
                    self.slots.append(self.current_slot.copy())
                    self.current_slot = []
                    self.update_display()
                    print(f"Slot {len(self.slots)} completed. Start defining next slot.")
                else:
                    print("Need at least 3 points to complete a slot region.")
            
            elif key == ord('s'):
                # Save and exit
                if self.current_slot and len(self.current_slot) >= 3:
                    self.slots.append(self.current_slot)
                    self.current_slot = []
                
                if self.slots:
                    cv2.destroyAllWindows()
                    return self.slots_to_dict()
                else:
                    print("No slots defined. Cannot save.")
            
            elif key == ord('q'):
                # Quit without saving
                cv2.destroyAllWindows()
                return []
        
        cv2.destroyAllWindows()
    
    def slots_to_dict(self) -> List[Dict[str, Any]]:
        """
        Convert slots to dictionary format for storage
        
        Returns:
            List of slot dictionaries
        """
        result = []
        img_height, img_width = self.image.shape[:2]
        
        for i, slot_coords in enumerate(self.slots):
            # Normalize coordinates for storage flexibility
            normalized = [(x / img_width, y / img_height) for x, y in slot_coords]
            result.append({
                "slot_id": f"S{i+1}",
                "slot_number": i + 1,
                "coordinates": normalized,  # Store as normalized [0-1] coordinates
                "image_width": img_width,
                "image_height": img_height
            })
        
        return result


def main():
    """Main entry point for command-line usage"""
    if len(sys.argv) < 2:
        print("Usage: python slot_selector.py <image_path> [output_json_path]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "slots.json"
    
    try:
        selector = SlotSelector(image_path)
        slots = selector.run()
        
        if slots:
            with open(output_path, 'w') as f:
                json.dump({
                    "image_path": image_path,
                    "slots": slots
                }, f, indent=2)
            print(f"Saved {len(slots)} slots to {output_path}")
        else:
            print("No slots saved.")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()


