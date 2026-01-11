# Quick Start Guide

## Setup (One-time)

### Option 1: Using Setup Scripts (Recommended)

**Windows PowerShell:**
```powershell
.\setup.ps1
```

**Windows Command Prompt:**
```cmd
setup.bat
```

**Linux/macOS:**
```bash
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

1. Create virtual environment:
   ```bash
   python -m venv venv
   ```

2. Activate virtual environment:
   - **Windows:** `venv\Scripts\Activate.ps1` or `venv\Scripts\activate.bat`
   - **Linux/macOS:** `source venv/bin/activate`

3. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```

## Starting the Service

1. **Activate the virtual environment** (if not already activated):
   ```powershell
   # Windows PowerShell
   .\venv\Scripts\Activate.ps1
   
   # Windows CMD
   venv\Scripts\activate.bat
   
   # Linux/macOS
   source venv/bin/activate
   ```

2. **Start the service:**
   ```bash
   python service.py
   ```

   The service will start on `http://localhost:5001` by default.

3. **Verify it's running:**
   Open another terminal and check:
   ```bash
   curl http://localhost:5001/health
   ```
   
   Or open in browser: `http://localhost:5001/health`

## Configuration

Make sure your Node.js backend has this in `server/.env`:
```env
OPENCV_SERVICE_URL=http://localhost:5001
```

## Next Steps

- See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for API usage
- See [README.md](./README.md) for detailed documentation
- See [SETUP.md](./SETUP.md) for troubleshooting

## Quick Test

Test the service is working:
```bash
# Health check
curl http://localhost:5001/health

# Should return:
# {"status":"healthy","service":"opencv-parking-detection","opencv_version":"4.x.x"}
```


