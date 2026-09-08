@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo     CREATE DESKTOP SHORTCUT - SMART BILL
echo ===================================================
echo.
echo [*] Generating desktop shortcut...

if exist "launcher\create-shortcut.ps1" (
    powershell -ExecutionPolicy Bypass -File "launcher\create-shortcut.ps1"
) else if exist "launcher\create-shortcut.vbs" (
    cscript //nologo "launcher\create-shortcut.vbs"
) else (
    echo [!] Warning: launcher\create-shortcut.ps1 not found.
)

if %ERRORLEVEL% equ 0 (
    echo [OK] SUCCESS: Desktop shortcut 'Smart Bill - Billing Software' created on your Desktop!
    echo      You can now double-click the shortcut on your Desktop to launch the app.
    echo.
) else (
    echo [!] Could not create desktop shortcut automatically.
)
pause
