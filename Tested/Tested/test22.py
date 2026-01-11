"""
Smart Parking Management System
Combines YOLO detection with custom parking slot monitoring
"""
import cv2
import json
import numpy as np
from ultralytics import YOLO
import os
from collections import defaultdict

# ==================== CONFIGURATION ====================
VIDEO_PATH = r"C:\Users\Acer\Desktop\easy1.mp4"
SLOTS_FILE = "parking_slots.json"
MODEL_PATH = "yolo11s.pt"

# Auto-detect screen resolution
def get_screen_resolution():
    """Detect screen resolution using multiple methods"""
    try:
        # Method 1: Try using tkinter (cross-platform)
        import tkinter as tk
        root = tk.Tk()
        root.withdraw()  # Hide the window
        width = root.winfo_screenwidth()
        height = root.winfo_screenheight()
        root.update_idletasks()
        root.destroy()
        return width, height
    except:
        pass
    
    try:
        # Method 2: Try using screeninfo library (if available)
        from screeninfo import get_monitors
        monitor = get_monitors()[0]
        return monitor.width, monitor.height
    except:
        pass
    
    try:
        # Method 3: Windows-specific using ctypes
        import ctypes
        user32 = ctypes.windll.user32
        return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
    except:
        pass
    
    # Fallback to common resolution
    return 1920, 1080

SCREEN_WIDTH, SCREEN_HEIGHT = get_screen_resolution()
print(f"✅ Detected screen resolution: {SCREEN_WIDTH}x{SCREEN_HEIGHT}")

MAX_DISPLAY_HEIGHT = int(SCREEN_HEIGHT * 0.9)  # Use 90% of screen height (leave space for taskbar)

# Detection parameters
CONF_THRESHOLD = 0.35
IOU_THRESHOLD = 0.45
OCCUPIED_THRESHOLD = 0.30  # Minimum IoU to consider slot occupied

# Visual settings
COLOR_FREE = (0, 255, 0)      # Green for free spots
COLOR_OCCUPIED = (0, 0, 255)  # Red for occupied spots
COLOR_DRAWING = (255, 255, 0) # Cyan for drawing
SLOT_THICKNESS = 2
TEXT_SCALE = 0.6

# ==================== UTILITY FUNCTIONS ====================
def calculate_display_size(original_width, original_height, max_width, max_height):
    """Calculate optimal display size maintaining aspect ratio"""
    # Calculate scaling factors
    width_scale = max_width / original_width
    height_scale = max_height / original_height
    
    # Use the smaller scale to ensure video fits in both dimensions
    scale = min(width_scale, height_scale)
    
    # Calculate new dimensions
    new_width = int(original_width * scale)
    new_height = int(original_height * scale)
    
    return new_width, new_height, scale

# ==================== SLOT DRAWING MODULE ====================
class SlotDrawer:
    def __init__(self, video_path, output_file):
        self.video_path = video_path
        self.output_file = output_file
        self.points = []
        self.slots = []
        self.frame = None
        self.original_frame = None
        self.display_width = 0
        self.display_height = 0
        self.scale_factor = 1.0
        self.drawing_mode = True
        
    def mouse_callback(self, event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            # Convert display coordinates back to original coordinates
            orig_x = int(x / self.scale_factor)
            orig_y = int(y / self.scale_factor)
            
            self.points.append((orig_x, orig_y))
            print(f"Point {len(self.points)}/4 added at ({orig_x}, {orig_y})")
            
            if len(self.points) == 4:
                self.slots.append(self.points.copy())
                print(f"✅ Slot #{len(self.slots)} completed")
                self.points.clear()
        
        elif event == cv2.EVENT_RBUTTONDOWN:
            # Right click to undo last point or slot
            if self.points:
                removed = self.points.pop()
                print(f"❌ Removed point {removed}")
            elif self.slots:
                removed = self.slots.pop()
                print(f"❌ Removed slot #{len(self.slots) + 1}")
    
    def draw_slots_on_frame(self, frame):
        temp = frame.copy()
        
        # Draw completed slots
        for i, slot in enumerate(self.slots):
            # Scale points for display
            scaled_slot = [(int(x * self.scale_factor), int(y * self.scale_factor)) for x, y in slot]
            pts = np.array(scaled_slot, np.int32).reshape((-1, 1, 2))
            cv2.polylines(temp, [pts], True, COLOR_FREE, SLOT_THICKNESS)
            
            # Add slot number at center
            M = cv2.moments(pts)
            if M["m00"] != 0:
                cx = int(M["m10"] / M["m00"])
                cy = int(M["m01"] / M["m00"])
                cv2.putText(temp, str(i + 1), (cx - 10, cy + 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # Draw current points being selected
        for pt in self.points:
            scaled_pt = (int(pt[0] * self.scale_factor), int(pt[1] * self.scale_factor))
            cv2.circle(temp, scaled_pt, 5, (0, 255, 255), -1)
        
        # Draw lines connecting current points
        if len(self.points) > 1:
            for i in range(len(self.points) - 1):
                pt1 = (int(self.points[i][0] * self.scale_factor), int(self.points[i][1] * self.scale_factor))
                pt2 = (int(self.points[i + 1][0] * self.scale_factor), int(self.points[i + 1][1] * self.scale_factor))
                cv2.line(temp, pt1, pt2, COLOR_DRAWING, 2)
        
        return temp
    
    def run(self):
        cap = cv2.VideoCapture(self.video_path)
        ret, self.original_frame = cap.read()
        cap.release()
        
        if not ret:
            print("❌ Failed to read video")
            return False
        
        # Calculate optimal display size
        orig_h, orig_w = self.original_frame.shape[:2]
        self.display_width, self.display_height, self.scale_factor = calculate_display_size(
            orig_w, orig_h, SCREEN_WIDTH, MAX_DISPLAY_HEIGHT
        )
        
        print(f"Original video size: {orig_w}x{orig_h}")
        print(f"Display size: {self.display_width}x{self.display_height}")
        print(f"Scale factor: {self.scale_factor:.3f}")
        
        cv2.namedWindow("Draw Parking Slots", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Draw Parking Slots", self.display_width, self.display_height)
        cv2.setMouseCallback("Draw Parking Slots", self.mouse_callback)
        
        print("\n" + "="*60)
        print("SLOT DRAWING MODE")
        print("="*60)
        print("📌 Click 4 corners for each parking slot (clockwise)")
        print("📌 Right-click to undo last point/slot")
        print("📌 Press 'R' to reset all slots")
        print("📌 Press 'S' to save and exit")
        print("📌 Press 'Q' to quit without saving")
        print("="*60 + "\n")
        
        while True:
            # Resize frame for display
            self.frame = cv2.resize(self.original_frame, (self.display_width, self.display_height))
            display = self.draw_slots_on_frame(self.frame)
            
            # Add instructions
            cv2.putText(display, f"Slots: {len(self.slots)} | Points: {len(self.points)}/4",
                       (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
            cv2.putText(display, "S=Save | R=Reset | Q=Quit | Right-click=Undo",
                       (10, display.shape[0] - 20), cv2.FONT_HERSHEY_SIMPLEX, 
                       0.6, (255, 255, 255), 2)
            
            cv2.imshow("Draw Parking Slots", display)
            key = cv2.waitKey(1) & 0xFF
            
            if key == ord('s') or key == ord('S'):
                if self.slots:
                    self.save_slots()
                    break
                else:
                    print("⚠️  No slots to save!")
            
            elif key == ord('r') or key == ord('R'):
                self.slots.clear()
                self.points.clear()
                print("🔄 Reset all slots")
            
            elif key == ord('q') or key == ord('Q'):
                print("❌ Exiting without saving")
                break
        
        cv2.destroyAllWindows()
        return len(self.slots) > 0
    
    def save_slots(self):
        with open(self.output_file, "w") as f:
            json.dump(self.slots, f, indent=2)
        print(f"✅ Saved {len(self.slots)} parking slots to {self.output_file}")
        print(f"   (Coordinates saved in original video resolution)")


# ==================== PARKING DETECTOR MODULE ====================
class ParkingDetector:
    def __init__(self, video_path, slots_file, model_path):
        self.video_path = video_path
        self.slots_file = slots_file
        self.model_path = model_path
        self.slots = []
        self.model = None
        self.cap = None
        
        # Display settings
        self.display_width = 0
        self.display_height = 0
        self.scale_factor = 1.0
        
        # Statistics
        self.frame_count = 0
        self.total_slots = 0
        self.occupied_slots = 0
        
    def load_model(self):
        if not os.path.exists(self.model_path):
            print(f"❌ Model file '{self.model_path}' not found")
            return False
        
        print("Loading YOLO model...")
        self.model = YOLO(self.model_path)
        print("✅ YOLO model loaded")
        return True
    
    def load_slots(self):
        if not os.path.exists(self.slots_file):
            print(f"❌ Slots file '{self.slots_file}' not found")
            return False
        
        with open(self.slots_file, "r") as f:
            self.slots = json.load(f)
        
        self.total_slots = len(self.slots)
        print(f"✅ Loaded {self.total_slots} parking slots")
        return True
    
    def open_video(self):
        if not os.path.exists(self.video_path):
            print(f"❌ Video file not found: {self.video_path}")
            return False
        
        self.cap = cv2.VideoCapture(self.video_path)
        if not self.cap.isOpened():
            print("❌ Cannot open video file")
            return False
        
        # Get original video dimensions
        orig_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Calculate optimal display size
        self.display_width, self.display_height, self.scale_factor = calculate_display_size(
            orig_width, orig_height, SCREEN_WIDTH, MAX_DISPLAY_HEIGHT
        )
        
        print("✅ Video loaded successfully")
        print(f"   Original size: {orig_width}x{orig_height}")
        print(f"   Display size: {self.display_width}x{self.display_height}")
        print(f"   Scale factor: {self.scale_factor:.3f}")
        return True
    
    def polygon_to_bbox(self, polygon):
        """Convert polygon points to bounding box"""
        pts = np.array(polygon)
        x_min, y_min = pts.min(axis=0)
        x_max, y_max = pts.max(axis=0)
        return [x_min, y_min, x_max, y_max]
    
    def calculate_iou(self, box1, box2):
        """Calculate IoU between two bounding boxes"""
        x1_min, y1_min, x1_max, y1_max = box1
        x2_min, y2_min, x2_max, y2_max = box2
        
        # Intersection area
        inter_x_min = max(x1_min, x2_min)
        inter_y_min = max(y1_min, y2_min)
        inter_x_max = min(x1_max, x2_max)
        inter_y_max = min(y1_max, y2_max)
        
        if inter_x_max < inter_x_min or inter_y_max < inter_y_min:
            return 0.0
        
        inter_area = (inter_x_max - inter_x_min) * (inter_y_max - inter_y_min)
        
        # Union area
        box1_area = (x1_max - x1_min) * (y1_max - y1_min)
        box2_area = (x2_max - x2_min) * (y2_max - y2_min)
        union_area = box1_area + box2_area - inter_area
        
        return inter_area / union_area if union_area > 0 else 0.0
    
    def check_slot_occupancy(self, slot_polygon, car_boxes):
        """Check if a parking slot is occupied by any detected car"""
        slot_bbox = self.polygon_to_bbox(slot_polygon)
        
        max_iou = 0.0
        for car_box in car_boxes:
            iou = self.calculate_iou(slot_bbox, car_box)
            max_iou = max(max_iou, iou)
        
        return max_iou >= OCCUPIED_THRESHOLD
    
    def draw_slot(self, frame, slot, is_occupied, slot_number):
        """Draw a parking slot on the frame"""
        # Scale slot coordinates for display
        scaled_slot = [(int(x * self.scale_factor), int(y * self.scale_factor)) for x, y in slot]
        pts = np.array(scaled_slot, np.int32).reshape((-1, 1, 2))
        color = COLOR_OCCUPIED if is_occupied else COLOR_FREE
        
        # Draw polygon
        cv2.polylines(frame, [pts], True, color, SLOT_THICKNESS)
        
        # Fill with semi-transparent color
        overlay = frame.copy()
        cv2.fillPoly(overlay, [pts], color)
        cv2.addWeighted(overlay, 0.2, frame, 0.8, 0, frame)
        
        # Add slot number and status
        M = cv2.moments(pts)
        if M["m00"] != 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            
            status = "FULL" if is_occupied else "FREE"
            text = f"#{slot_number}"
            
            # Draw text background
            (text_w, text_h), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 
                                                   TEXT_SCALE, 2)
            cv2.rectangle(frame, (cx - text_w//2 - 5, cy - text_h - 5),
                         (cx + text_w//2 + 5, cy + 5), (0, 0, 0), -1)
            
            # Draw text
            cv2.putText(frame, text, (cx - text_w//2, cy),
                       cv2.FONT_HERSHEY_SIMPLEX, TEXT_SCALE, (255, 255, 255), 2)
    
    def draw_statistics(self, frame):
        """Draw statistics panel on frame"""
        h, w = frame.shape[:2]
        
        # Create semi-transparent panel
        panel_height = 120
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, panel_height), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        
        free_slots = self.total_slots - self.occupied_slots
        occupancy_rate = (self.occupied_slots / self.total_slots * 100) if self.total_slots > 0 else 0
        
        # Draw statistics
        cv2.putText(frame, "SMART PARKING SYSTEM", (20, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)
        
        cv2.putText(frame, f"Total Slots: {self.total_slots}", (20, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        cv2.putText(frame, f"Free: {free_slots}", (20, 90),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_FREE, 2)
        
        cv2.putText(frame, f"Occupied: {self.occupied_slots}", (250, 90),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, COLOR_OCCUPIED, 2)
        
        cv2.putText(frame, f"Occupancy: {occupancy_rate:.1f}%", (500, 90),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    
    def run(self):
        if not self.load_model() or not self.load_slots() or not self.open_video():
            return
        
        cv2.namedWindow("Smart Parking Detection", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("Smart Parking Detection", self.display_width, self.display_height)
        
        print("\n" + "="*60)
        print("PARKING DETECTION MODE")
        print("="*60)
        print("Press ESC to exit")
        print("="*60 + "\n")
        
        while True:
            ret, frame = self.cap.read()
            if not ret:
                # Loop video
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            
            self.frame_count += 1
            
            # Run YOLO detection on original frame
            results = self.model.predict(frame, conf=CONF_THRESHOLD, 
                               iou=IOU_THRESHOLD, verbose=False)
            
            # Get the original frame from results
            result_frame = results[0].orig_img
            
            # Extract car bounding boxes (class 2 = car in COCO)
            car_boxes = []
            for box in results[0].boxes:
                cls = int(box.cls[0])
                if cls == 2:  # car
                    x1, y1, x2, y2 = map(float, box.xyxy[0])
                    car_boxes.append([x1, y1, x2, y2])
            
            # Check each parking slot (using original coordinates)
            self.occupied_slots = 0
            for i, slot in enumerate(self.slots):
                is_occupied = self.check_slot_occupancy(slot, car_boxes)
                if is_occupied:
                    self.occupied_slots += 1
            
            # Resize frame for display
            display_frame = cv2.resize(result_frame, (self.display_width, self.display_height))
            
            # Draw detected cars on display frame
            for box in car_boxes:
                x1, y1, x2, y2 = box
                # Scale coordinates for display
                x1 = int(x1 * self.scale_factor)
                y1 = int(y1 * self.scale_factor)
                x2 = int(x2 * self.scale_factor)
                y2 = int(y2 * self.scale_factor)
                cv2.rectangle(display_frame, (x1, y1), (x2, y2), (255, 0, 255), 2)
            
            # Draw slots on display frame
            for i, slot in enumerate(self.slots):
                is_occupied = self.check_slot_occupancy(slot, car_boxes)
                self.draw_slot(display_frame, slot, is_occupied, i + 1)
            
            # Draw statistics
            self.draw_statistics(display_frame)
            
            # Show frame
            cv2.imshow("Smart Parking Detection", display_frame)
            
            # Exit on ESC
            if cv2.waitKey(1) & 0xFF == 27:
                break
        
        self.cap.release()
        cv2.destroyAllWindows()
        print(f"✅ Processed {self.frame_count} frames")


# ==================== MAIN PROGRAM ====================
def main():
    print("\n" + "="*60)
    print("SMART PARKING MANAGEMENT SYSTEM")
    print("="*60)
    print("1. Draw Parking Slots")
    print("2. Run Parking Detection")
    print("3. Exit")
    print("="*60)
    
    choice = input("\nEnter your choice (1-3): ").strip()
    
    if choice == "1":
        drawer = SlotDrawer(VIDEO_PATH, SLOTS_FILE)
        drawer.run()
    
    elif choice == "2":
        if not os.path.exists(SLOTS_FILE):
            print("\n⚠️  No parking slots found!")
            print("Please run option 1 to draw parking slots first.")
            return
        
        detector = ParkingDetector(VIDEO_PATH, SLOTS_FILE, MODEL_PATH)
        detector.run()
    
    elif choice == "3":
        print("👋 Goodbye!")
    
    else:
        print("❌ Invalid choice!")


if __name__ == "__main__":
    main()