@echo off
setlocal enabledelayedexpansion
title Smart Bill - Billing Software Launcher

:: Set working directory to project root
cd /d "%~dp0"

echo ===================================================
echo       SMART BILL - BILLING SOFTWARE LAUNCHER
echo ===================================================
echo.

:: 1. Check if application is already active on port 3000
curl.exe -s -f -o nul --connect-timeout 1 http://localhost:3000/api/health 2>nul
if %ERRORLEVEL% equ 0 (
    echo [✓] Smart Bill is already active!
    echo [*] Opening application in Chrome App mode...
    goto LAUNCH_APP
)

:: 2. Locate Node.js runtime
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
        echo.
        echo [!] ERROR: Node.js runtime was not found on this computer.
        echo     Please install Node.js LTS from https://nodejs.org
        echo     After installing, double-click this launcher again.
        echo.
        pause
        exit /b 1
    )
)

:: 3. Check for dependencies
if not exist "node_modules\" (
    echo [*] First-time setup: Installing required dependencies...
    call npm install --no-audit --no-fund
    if %ERRORLEVEL% neq 0 (
        echo [!] ERROR: Failed to install project dependencies.
        pause
        exit /b 1
    )
)

:: 4. Check for production build
if not exist "dist\server.cjs" (
    echo [*] Preparing application for fast offline performance...
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo [!] ERROR: Build failed.
        pause
        exit /b 1
    )
)

:: 5. Start Server in Minimized Window
echo [*] Starting Smart Bill Server...
set NODE_ENV=production
start "Smart Bill Server" /min "%NODE_CMD%" dist\server.cjs

:: 6. Wait for server health readiness (polling every 400ms, max 25 tries = 10s)
echo [*] Waiting for services to become ready...
set /a ATTEMPTS=0

:LAUNCH_APP
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000
) else if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
) else (
    start http://localhost:3000
)
exit /b 0

:HEALTH_CHECK
set /a ATTEMPTS+=1
curl.exe -s -f -o nul --connect-timeout 1 http://localhost:3000/api/health 2>nul
if %ERRORLEVEL% equ 0 (
    echo [✓] Smart Bill is ready!
    echo [*] Opening application...
    goto LAUNCH_APP
)

if !ATTEMPTS! geq 25 (
    echo.
    echo [!] ERROR: The application did not respond within 10 seconds.
    echo     Please check if port 3000 is occupied or restart the launcher.
    pause
    exit /b 1
)

ping 127.0.0.1 -n 1 >nul 2>&1
goto HEALTH_CHECK
