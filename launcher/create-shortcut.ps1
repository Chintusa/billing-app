$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = (Get-Item $scriptDir).Parent.FullName
if (-not $projectDir) {
    $projectDir = $scriptDir
}

$targetBat = Join-Path $projectDir "Smart-Bill.bat"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Smart Bill - Billing Software.lnk"

Write-Host "[*] Creating Desktop Shortcut for Smart Bill..." -ForegroundColor Cyan
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetBat
$shortcut.WorkingDirectory = $projectDir
$shortcut.Description = "Smart Bill - Offline Point of Sale"
$shortcut.IconLocation = "shell32.dll,138"
$shortcut.Save()

Write-Host "[✓] Success! Desktop shortcut created at:" -ForegroundColor Green
Write-Host "    $shortcutPath" -ForegroundColor Yellow
