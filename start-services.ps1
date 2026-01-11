Write-Host "Starting Smart Parking System..." -ForegroundColor Cyan

# Get the script's directory
$root = $PSScriptRoot

# Start Backend
Write-Host "Launching Backend Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\server'; npm run dev"

# Start Client (Frontend)
Write-Host "Launching Frontend Client..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\client'; npm run dev"

# Start OpenCV
Write-Host "Launching OpenCV Service..."
$opencvPath = Join-Path $root "server\opencv_service"
$venvPython = Join-Path $opencvPath "venv\Scripts\python.exe"

# Command to verify venv and run service
$opencvCmd = "cd '$opencvPath'; if (Test-Path '$venvPython') { Write-Host 'Using venv python...'; & '$venvPython' service.py } else { Write-Host 'Using system python...'; python service.py }"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "$opencvCmd"

Write-Host "All services started in separate windows." -ForegroundColor Green
