@echo off
setlocal
title Update Smart Bill Icon
cd /d "%~dp0"

echo ===================================================
echo        SMART BILL - CUSTOM ICON APPLIER
echo ===================================================
echo.

set "INPUT_FILE=%~1"

if not "%INPUT_FILE%"=="" (
    echo [*] Converting dropped file: "%INPUT_FILE%"...
    powershell -ExecutionPolicy Bypass -File "launcher\convert-icon.ps1" -InputImagePath "%INPUT_FILE%"
) else (
    echo [*] Checking for custom logo in assets\logo.png or project folder...
    powershell -ExecutionPolicy Bypass -File "launcher\convert-icon.ps1"
)

echo.
echo ===================================================
echo Tip: You can drag and drop any PNG/JPG image file
echo      directly onto this Update-Icon.bat file anytime!
echo ===================================================
echo.
pause
