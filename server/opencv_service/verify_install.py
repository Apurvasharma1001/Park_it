"""Simple script to verify OpenCV service installation"""
try:
    import cv2
    import flask
    import numpy
    import flask_cors
    
    print("✓ All packages installed successfully!")
    print(f"  OpenCV version: {cv2.__version__}")
    print(f"  NumPy version: {numpy.__version__}")
    print(f"  Flask version: {flask.__version__}")
    print(f"  Flask-CORS version: {flask_cors.__version__}")
    print("\n✓ Installation verified! You can now start the service with:")
    print("  python service.py")
except ImportError as e:
    print(f"✗ Error: {e}")
    print("  Please install requirements: pip install -r requirements.txt")
    exit(1)


