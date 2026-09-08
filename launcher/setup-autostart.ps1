$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = (Get-Item $scriptDir).Parent.FullName
if (-not $projectDir) {
    $projectDir = $scriptDir
}

$targetBat = Join-Path $projectDir "Start-Backend-Minimized.bat"
$startupPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Startup)
$shortcutPath = Join-Path $startupPath "Smart Bill Backend (Auto-Start).lnk"

Write-Host "[*] Configuring Windows Auto-Startup for Smart Bill Backend..." -ForegroundColor Cyan
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetBat
$shortcut.WorkingDirectory = $projectDir
$shortcut.WindowStyle = 7
$shortcut.Description = "Smart Bill - Node.js Backend Auto Startup (Minimized)"
$smartBillIco = Join-Path $projectDir "assets\smart-bill.ico"
$iconIco = Join-Path $projectDir "assets\icon.ico"
if (Test-Path $smartBillIco) {
    $shortcut.IconLocation = "$smartBillIco,0"
} elseif (Test-Path $iconIco) {
    $shortcut.IconLocation = "$iconIco,0"
} else {
    $shortcut.IconLocation = "shell32.dll,138"
}
$shortcut.Save()

Write-Host "[SUCCESS] Auto-startup shortcut created in Windows Startup folder!" -ForegroundColor Green
Write-Host "Location: $shortcutPath" -ForegroundColor Yellow
Write-Host "Target:   $targetBat" -ForegroundColor Yellow
Write-Host "Mode:     Minimized" -ForegroundColor Yellow
