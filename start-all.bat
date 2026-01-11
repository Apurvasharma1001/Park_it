@echo off
title Smart Parking System
color 0A

echo ===================================================
echo   SMART PARKING SYSTEM - STARTING ALL SERVICES
echo ===================================================
echo.
echo   [BACKEND] http://localhost:5000
echo   [CLIENT]  http://localhost:3000
echo   [OPENCV]  http://localhost:5001
echo.
echo   Starting Backend, Frontend, and OpenCV Service...
echo ===================================================
echo.

REM Check if node_modules exists, install if not
if not exist "node_modules" (
    echo [INFO] Installing root dependencies...
    call npm install
)

REM Run everything using concurrently
call npm run dev:all

pause


