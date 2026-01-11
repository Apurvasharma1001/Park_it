@echo off
REM Batch script to set up Python virtual environment for OpenCV service
REM Run this from the opencv_service directory

echo Setting up Python virtual environment for OpenCV service...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python 3.7 or higher from https://www.python.org/
    pause
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo Error: Failed to create virtual environment
        pause
        exit /b 1
    )
    echo Virtual environment created successfully!
) else (
    echo Virtual environment already exists
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Install requirements
echo Installing requirements...
pip install -r requirements.txt

if errorlevel 1 (
    echo Error: Failed to install requirements
    pause
    exit /b 1
)

echo.
echo Setup completed successfully!
echo.
echo To activate the virtual environment in the future, run:
echo   venv\Scripts\activate.bat
echo.
echo To start the service, run:
echo   python service.py
echo.
pause


