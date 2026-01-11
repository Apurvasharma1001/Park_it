# OpenCV Service Setup Guide

This guide will help you set up the Python virtual environment and install dependencies for the OpenCV parking detection service.

## Prerequisites

- Python 3.7 or higher installed
- pip (usually comes with Python)

## Quick Setup

### Windows (PowerShell)

1. Open PowerShell in the `server/opencv_service` directory
2. Run the setup script:
   ```powershell
   .\setup.ps1
   ```

   **Note:** If you get an execution policy error, run this first:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

### Windows (Command Prompt)

1. Open Command Prompt in the `server/opencv_service` directory
2. Run:
   ```cmd
   setup.bat
   ```

### Linux/macOS

1. Open terminal in the `server/opencv_service` directory
2. Make the script executable (first time only):
   ```bash
   chmod +x setup.sh
   ```
3. Run:
   ```bash
   ./setup.sh
   ```

## Manual Setup

If you prefer to set up manually:

### 1. Create Virtual Environment

**Windows:**
```cmd
python -m venv venv
venv\Scripts\activate
```

**Linux/macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Upgrade pip

```bash
python -m pip install --upgrade pip
```

### 3. Install Requirements

```bash
pip install -r requirements.txt
```

## Verify Installation

After installation, verify everything is set up correctly:

```bash
python -c "import cv2; import flask; import numpy; print('All packages installed successfully!')"
```

You should see: `All packages installed successfully!`

## Activating the Virtual Environment

After setup, you need to activate the virtual environment each time you want to use the service:

### Windows (PowerShell)
```powershell
venv\Scripts\Activate.ps1
```

### Windows (Command Prompt)
```cmd
venv\Scripts\activate.bat
```

### Linux/macOS
```bash
source venv/bin/activate
```

When activated, your terminal prompt should show `(venv)` at the beginning.

## Starting the Service

Once the virtual environment is activated:

```bash
python service.py
```

The service will start on `http://localhost:5001` by default.

You can also set a custom port:
```bash
# Windows
$env:OPENCV_SERVICE_PORT=5001; python service.py

# Linux/macOS
OPENCV_SERVICE_PORT=5001 python service.py
```

## Troubleshooting

### Python not found
- Make sure Python is installed and added to your PATH
- Try `python3` instead of `python` on Linux/macOS
- Verify installation: `python --version` or `python3 --version`

### Permission errors (Linux/macOS)
- Use `sudo` if needed (not recommended)
- Or check directory permissions: `chmod 755 venv`

### OpenCV installation fails
- Make sure you have the latest pip: `pip install --upgrade pip`
- On Windows, you might need Microsoft Visual C++ Redistributable
- Try installing opencv-python-headless if opencv-python fails

### Virtual environment activation fails
- Make sure you're in the correct directory
- Try the full path: `.\venv\Scripts\Activate.ps1` (Windows) or `source ./venv/bin/activate` (Linux/macOS)

## Next Steps

After setup:
1. Start the Python service: `python service.py`
2. Configure Node.js backend with `OPENCV_SERVICE_URL=http://localhost:5001` in `.env`
3. Start the Node.js backend server
4. See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for API usage


