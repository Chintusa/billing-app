@echo off
setlocal
cd /d "%~dp0"
title Disable Smart Bill Windows Auto-Startup

echo ===================================================
echo   DISABLE SMART BILL WINDOWS AUTO-STARTUP
echo ===================================================
echo.
echo [*] Removing Smart Bill Backend from Windows Startup...
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "launcher\remove-autostart.ps1"

echo.
pause
