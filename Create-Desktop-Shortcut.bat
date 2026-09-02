@echo off
setlocal
cd /d "%~dp0"

echo ===================================================
echo     CREATE DESKTOP SHORTCUT - SMART BILL
echo ===================================================
echo.
echo [*] Generating desktop shortcut...

if exist "launcher\create-shortcut.vbs" (
    cscript //nologo "launcher\create-shortcut.vbs"
) else (
    echo [!] Warning: launcher\create-shortcut.vbs not found.
)

if %ERRORLEVEL% equ 0 (
    echo [✓] SUCCESS: Desktop shortcut 'Smart Bill - Billing Software' created on your Desktop!
    echo     You can now simply double-click the shortcut on your Desktop to start working.
    echo.
) else (
    echo [!] Could not create desktop shortcut automatically.
)
pause
