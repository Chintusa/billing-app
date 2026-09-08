Add-Type -AssemblyName System.Drawing

$imgPath = "C:\Users\jhask\.gemini\antigravity-ide\brain\19f5e8ff-965b-484e-91e0-86d982ec68e1\smart_bill_app_icon_1788495355429.jpg"
$assetsDir = "c:\Users\jhask\Downloads\Freelance\Rinku da\smart-bill---billing-software\assets"
$publicDir = "c:\Users\jhask\Downloads\Freelance\Rinku da\smart-bill---billing-software\public"

if (-not (Test-Path $assetsDir)) { 
    New-Item -ItemType Directory -Path $assetsDir | Out-Null 
}
if (-not (Test-Path $publicDir)) { 
    New-Item -ItemType Directory -Path $publicDir | Out-Null 
}

$src = [System.Drawing.Bitmap]::FromFile($imgPath)

# Crop the center badge area
$cropSize = [int]($src.Width * 0.76)
$cropX = [int](($src.Width - $cropSize) / 2)
$cropY = [int]($src.Height * 0.12)
$cropRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropSize, $cropSize)
$cropped = $src.Clone($cropRect, $src.PixelFormat)

$png256 = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($png256)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($cropped, 0, 0, 256, 256)
$g.Dispose()

$pngPath = Join-Path $assetsDir "icon.png"
$png256.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$publicPngPath = Join-Path $publicDir "icon.png"
$png256.Save($publicPngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Build multi-res ICO file containing PNG encoded frames
$sizes = @(256, 128, 64, 48, 32, 16)
$imagesList = New-Object System.Collections.ArrayList

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $gr = [System.Drawing.Graphics]::FromImage($bmp)
    $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gr.DrawImage($png256, 0, 0, $sz, $sz)
    $gr.Dispose()
    
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $ms.Dispose()
    $bmp.Dispose()
    
    $entry = [PSCustomObject]@{
        Size = $sz
        Bytes = $bytes
    }
    $imagesList.Add($entry) | Out-Null
}

$icoPath = Join-Path $assetsDir "icon.ico"
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)

# 1. ICONDIR (6 bytes)
$bw.Write([uint16]0) # Reserved
$bw.Write([uint16]1) # Type (1=Icon)
$bw.Write([uint16]$imagesList.Count) # Image Count

$offset = 6 + ($imagesList.Count * 16)

# 2. ICONDIRENTRY (16 bytes per entry)
foreach ($item in $imagesList) {
    $sz = $item.Size
    $bytes = $item.Bytes
    
    $dimByte = if ($sz -ge 256) { [byte]0 } else { [byte]$sz }
    $bw.Write($dimByte)              # Width (0 = 256)
    $bw.Write($dimByte)              # Height (0 = 256)
    $bw.Write([byte]0)               # Color count
    $bw.Write([byte]0)               # Reserved
    $bw.Write([uint16]1)             # Planes
    $bw.Write([uint16]32)            # BitCount
    $bw.Write([uint32]$bytes.Length) # Image bytes size
    $bw.Write([uint32]$offset)       # Image data offset
    
    $offset += $bytes.Length
}

# 3. Image Data
foreach ($item in $imagesList) {
    $bw.Write($item.Bytes)
}

$bw.Close()
$fs.Close()

# Also copy icon.ico to public folder for browser favicon
Copy-Item $icoPath (Join-Path $publicDir "favicon.ico") -Force

$src.Dispose()
$cropped.Dispose()
$png256.Dispose()

Write-Host "Icons successfully generated in assets/ and public/!"
