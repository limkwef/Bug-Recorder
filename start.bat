@echo off
cd /d "%~dp0"
title Bug Recorder

echo ============================================
echo    Bug Recorder - Startup Script
echo ============================================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo         Download: https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js:
node -v
echo.

:: Install dependencies if needed
if not exist "node_modules\" (
    echo [..] Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed.
    echo.
) else (
    echo [OK] Dependencies ready.
    echo.
)

:: Create data folders
if not exist "data\" mkdir data
if not exist "uploads\" mkdir uploads

:: Start server in background (same window)
echo [..] Starting server on http://localhost:3002 ...
start /b node server.js > server.log 2>&1

:: Wait for port 3002 to be ready (using find/netstat to avoid PowerShell)
echo [..] Waiting for server...
set WAITED=0
:CHECK_PORT
timeout /t 1 /nobreak >nul
netstat -an 2>nul | find "0.0.0.0:3002" >nul 2>&1
if not errorlevel 1 goto READY
set /a WAITED+=1
if %WAITED% LSS 10 goto CHECK_PORT

echo [ERROR] Server failed to start within 10 seconds.
pause
exit /b 1

:READY
echo [OK] Server is running!
echo [..] Opening browser...
start http://localhost:3002
echo.
echo ============================================
echo    Bug Recorder - Running
echo    URL:  http://localhost:3002
echo ============================================
echo.
echo Close this window or press any key to stop the server.
pause >nul

echo [..] Stopping...
taskkill /f /im node.exe >nul 2>&1
echo [OK] Stopped.
