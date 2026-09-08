$ErrorActionPreference = "Stop"
$startupPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup)
$shortcutPath = Join-Path $startupPath "Smart Bill Backend (Auto-Start).lnk"

Write-Host "[*] Removing Windows Auto-Startup for Smart Bill Backend..." -ForegroundColor Cyan

if (Test-Path $shortcutPath) {
    Remove-Item -Path $shortcutPath -Force
    Write-Host "[SUCCESS] Auto-startup shortcut removed from Windows Startup folder." -ForegroundColor Green
    Write-Host "Removed: $shortcutPath" -ForegroundColor Yellow
} else {
    Write-Host "[INFO] No auto-startup shortcut was found in Windows Startup folder." -ForegroundColor Yellow
}
