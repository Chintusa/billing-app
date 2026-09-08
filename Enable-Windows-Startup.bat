@echo off
setlocal
cd /d "%~dp0"
title Enable Smart Bill Windows Auto-Startup

echo ===================================================
echo   ENABLE SMART BILL WINDOWS AUTO-STARTUP
echo ===================================================
echo.
echo [*] Adding Smart Bill Backend to Windows Startup (Minimized Mode)...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "launcher\setup-autostart.ps1"

echo.
echo ===================================================
echo When you restart your PC or log into Windows, the
echo Node.js backend will start automatically in a
echo minimized CMD window and serve on http://localhost:3000
echo ===================================================
echo.
pause
