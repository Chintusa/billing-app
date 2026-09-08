$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = (Get-Item $scriptDir).Parent.FullName
if (-not $projectDir) {
    $projectDir = $scriptDir
}

$targetBat = Join-Path $projectDir "Smart-Bill.bat"

# Determine icon path
$smartBillIco = Join-Path $projectDir "assets\smart-bill.ico"
$iconIco = Join-Path $projectDir "assets\icon.ico"
$iconPath = if (Test-Path $smartBillIco) { $smartBillIco } elseif (Test-Path $iconIco) { $iconIco } else { "shell32.dll,138" }

Write-Host "[*] Creating Desktop Shortcut for Smart Bill..." -ForegroundColor Cyan

$desktopPaths = @(
    [Environment]::GetFolderPath("Desktop"),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "OneDrive\Desktop")
) | Select-Object -Unique

$wshShell = New-Object -ComObject WScript.Shell

foreach ($dt in $desktopPaths) {
    if (Test-Path $dt) {
        $shortcutPath = Join-Path $dt "Smart Bill - Billing Software.lnk"
        try {
            if (Test-Path $shortcutPath) {
                Remove-Item $shortcutPath -Force -ErrorAction SilentlyContinue
            }
            $shortcut = $wshShell.CreateShortcut($shortcutPath)
            $shortcut.TargetPath = $targetBat
            $shortcut.WorkingDirectory = $projectDir
            $shortcut.Description = "Smart Bill - Offline Billing & POS Software"
            $shortcut.IconLocation = $iconPath + ",0"
            $shortcut.Save()
            Write-Host "[OK] Desktop shortcut updated at: $shortcutPath" -ForegroundColor Green
        } catch {
            Write-Host "[!] Could not write shortcut: $_" -ForegroundColor Yellow
        }
    }
}

# Refresh shell icon cache
try {
    & ie4uinit.exe -show
} catch {}

