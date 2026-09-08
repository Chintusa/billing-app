@echo off
setlocal enabledelayedexpansion
title Smart Bill - Node.js Backend Server (Port 3000)

:: ============================================================================
:: SMART BILL - NODE.JS BACKEND STARTUP SCRIPT
:: ============================================================================
:: Location: Project Root / Start-Backend-Minimized.bat
:: Command: node dist/server.cjs (Production Node.js Backend Server)
:: Port: 3000 (http://localhost:3000)
:: Mode: Background / Minimized CMD Window
:: ============================================================================

:: 1. Navigate to the project root directory
cd /d "%~dp0"

:: 2. Check if the server is already active on port 3000 to prevent duplicate instances
curl.exe -s -f -o nul --connect-timeout 1 http://localhost:3000/api/health 2>nul
if %ERRORLEVEL% equ 0 (
    echo [i] Smart Bill Server is already running and responding on port 3000.
    exit /b 0
)

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /R ":3000.*LISTENING"') do (
    echo [i] Smart Bill Server process is already listening on port 3000 (PID: %%a).
    exit /b 0
)

:: 3. Locate Node.js executable
set "NODE_CMD=node"
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "NODE_CMD=C:\Program Files\nodejs\node.exe"
        set "PATH=%PATH%;C:\Program Files\nodejs"
    ) else if exist "%LocalAppData%\Programs\nodejs\node.exe" (
        set "NODE_CMD=%LocalAppData%\Programs\nodejs\node.exe"
        set "PATH=%PATH%;%LocalAppData%\Programs\nodejs"
    ) else (
        echo [!] ERROR: Node.js runtime not found on this system.
        echo     Please install Node.js from https://nodejs.org
        pause
        exit /b 1
    )
)

:: 4. Verify production server build exists
if not exist "dist\server.cjs" (
    echo [*] Production build not found. Building project...
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo [!] ERROR: Project build failed.
        pause
        exit /b 1
    )
)

:: 5. Set Environment and launch the Node.js backend
set NODE_ENV=production
set PORT=3000

echo ===================================================
echo   Smart Bill Backend Server Started
echo   URL:  http://localhost:3000
echo   Port: 3000
echo   Mode: Production
echo ===================================================
echo [*] Keeping server process running continuously in the background...

"%NODE_CMD%" dist\server.cjs
