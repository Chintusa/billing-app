@echo off
setlocal
title Stop Smart Bill Server

echo ===================================================
echo            STOP SMART BILL SERVER
echo ===================================================
echo.
echo [*] Stopping active Smart Bill instances on port 3000...

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /R ":3000.*LISTENING"') do (
    set FOUND=1
    echo [*] Terminating process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

if "%FOUND%"=="1" (
    echo [✓] Smart Bill Server stopped successfully.
) else (
    echo [i] Smart Bill Server is not currently running.
)

echo.
ping 127.0.0.1 -n 2 >nul 2>&1
