#!/bin/bash
# Bash script to set up Python virtual environment for OpenCV service
# Run this from the opencv_service directory

echo "Setting up Python virtual environment for OpenCV service..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed or not in PATH"
    echo "Please install Python 3.7 or higher"
    exit 1
fi

python3 --version

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create virtual environment"
        exit 1
    fi
    echo "Virtual environment created successfully!"
else
    echo "Virtual environment already exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
python -m pip install --upgrade pip

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo ""
    echo "Setup completed successfully!"
    echo ""
    echo "To activate the virtual environment in the future, run:"
    echo "  source venv/bin/activate"
    echo ""
    echo "To start the service, run:"
    echo "  python service.py"
else
    echo "Error: Failed to install requirements"
    exit 1
fi


