import cv2
import sys

def test_camera(index=0):
    print(f"Testing Camera Index: {index}")
    cap = cv2.VideoCapture(index)
    
    if not cap.isOpened():
        print(f"ERROR: Could not open camera {index}")
        return False
    
    print(f"Camera {index} opened successfully.")
    
    # Try to read a frame
    ret, frame = cap.read()
    if not ret:
        print("ERROR: Could not read frame from camera")
        return False
        
    print(f"Successfully captured frame: {frame.shape}")
    print(f"Backend Name: {cap.getBackendName()}")
    
    cap.release()
    return True

if __name__ == "__main__":
    idx = 0
    if len(sys.argv) > 1:
        idx = int(sys.argv[1])
    
    success = test_camera(idx)
    if success:
        print("\nSUCCESS: Camera is working and accessible by OpenCV.")
    else:
        print("\nFAILURE: Camera could not be accessed.")
