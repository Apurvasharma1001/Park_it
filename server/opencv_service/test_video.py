"""
Quick test script to test video frame extraction
Usage: python test_video.py <video_path> [frame_number]
"""
import sys
import cv2
from utils import extract_frame_from_video, load_image

def main():
    if len(sys.argv) < 2:
        print("Usage: python test_video.py <video_path> [frame_number]")
        print("  frame_number: 0 = first frame, -1 = last frame, or specific frame number")
        sys.exit(1)
    
    video_path = sys.argv[1]
    frame_number = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    
    try:
        print(f"Extracting frame {frame_number} from {video_path}...")
        
        # Extract frame
        frame = extract_frame_from_video(video_path, frame_number)
        
        print(f"Successfully extracted frame: {frame.shape}")
        
        # Save frame as image
        output_path = f"test_frame_{frame_number}.jpg"
        cv2.imwrite(output_path, frame)
        print(f"Saved frame to: {output_path}")
        
        # Test loading via load_image (should work for videos too)
        print("\nTesting load_image function...")
        loaded = load_image(video_path)
        print(f"Loaded via load_image: {loaded.shape}")
        
        # Show frame info
        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()
        
        print(f"\nVideo Info:")
        print(f"  Total frames: {total_frames}")
        print(f"  FPS: {fps:.2f}")
        print(f"  Duration: {total_frames/fps:.2f} seconds")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()


