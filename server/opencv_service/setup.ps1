# PowerShell script to set up Python virtual environment for OpenCV service
# Run this from the opencv_service directory

Write-Host "Setting up Python virtual environment for OpenCV service..." -ForegroundColor Green

# Check if Python is installed
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.7 or higher from https://www.python.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Found $pythonVersion" -ForegroundColor Green

# Create virtual environment if it doesn't exist
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }
    Write-Host "Virtual environment created successfully!" -ForegroundColor Green
} else {
    Write-Host "Virtual environment already exists" -ForegroundColor Green
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Failed to activate virtual environment. You may need to run:" -ForegroundColor Yellow
    Write-Host "  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser" -ForegroundColor Yellow
    Write-Host "Or manually activate using: venv\Scripts\activate" -ForegroundColor Yellow
} else {
    Write-Host "Virtual environment activated!" -ForegroundColor Green
}

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip

# Install requirements
Write-Host "Installing requirements..." -ForegroundColor Yellow
pip install -r requirements.txt

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSetup completed successfully!" -ForegroundColor Green
    Write-Host "`nTo activate the virtual environment in the future, run:" -ForegroundColor Cyan
    Write-Host "  venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "`nTo start the service, run:" -ForegroundColor Cyan
    Write-Host "  python service.py" -ForegroundColor White
} else {
    Write-Host "Error: Failed to install requirements" -ForegroundColor Red
    exit 1
}


