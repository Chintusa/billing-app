param(
    [string]$InputImagePath = ""
)

Add-Type -AssemblyName System.Drawing

$projectDir = Split-Path -Parent $PSScriptRoot
if (-not $projectDir) {
    $projectDir = (Get-Item $PSScriptRoot).Parent.FullName
}

$assetsDir = Join-Path $projectDir "assets"
$publicDir = Join-Path $projectDir "public"

if (-not (Test-Path $assetsDir)) { New-Item -ItemType Directory -Path $assetsDir | Out-Null }
if (-not (Test-Path $publicDir)) { New-Item -ItemType Directory -Path $publicDir | Out-Null }

$srcPath = $null

if ($InputImagePath -and (Test-Path $InputImagePath)) {
    $srcPath = (Resolve-Path $InputImagePath).Path
} else {
    $candidates = @(
        (Join-Path $assetsDir "logo.png"),
        (Join-Path $assetsDir "custom-icon.png"),
        (Join-Path $assetsDir "logo.jpg"),
        (Join-Path $assetsDir "icon-source.png"),
        (Join-Path $projectDir "logo.png"),
        (Join-Path $projectDir "logo.svg")
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) {
            $srcPath = $cand
            break
        }
    }
}

if (-not $srcPath) {
    Write-Host "[!] No custom image provided." -ForegroundColor Yellow
    Write-Host "    Please drag and drop your PNG/JPG onto Update-Icon.bat, or" -ForegroundColor Yellow
    Write-Host "    place your file at: assets\logo.png and run this script again." -ForegroundColor Cyan
    exit 1
}

Write-Host "[*] Processing image: $srcPath" -ForegroundColor Cyan

# Define C# ICO Builder with true 32bpp DIB + PNG multi-resolution layers
$code = @"
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class NativeIcoBuilder {
    [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);

    public static void FlushShell() {
        try {
            // SHCNE_ASSOCCHANGED = 0x08000000, SHCNF_FLUSH = 0x1000
            SHChangeNotify(0x08000000, 0x1000, IntPtr.Zero, IntPtr.Zero);
        } catch { }
    }

    public static void BuildIco(string sourceImagePath, string outputIcoPath, string outputPngPath, string outputPublicPngPath) {
        using (Image src = Image.FromFile(sourceImagePath)) {
            // 1. Create master 256x256 PNG
            using (Bitmap master256 = new Bitmap(256, 256, PixelFormat.Format32bppArgb)) {
                using (Graphics g = Graphics.FromImage(master256)) {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.Clear(Color.Transparent);

                    float ratio = Math.Min(256.0f / src.Width, 256.0f / src.Height);
                    int nw = (int)(src.Width * ratio);
                    int nh = (int)(src.Height * ratio);
                    int px = (256 - nw) / 2;
                    int py = (256 - nh) / 2;

                    g.DrawImage(src, px, py, nw, nh);
                }

                if (!string.IsNullOrEmpty(outputPngPath)) {
                    master256.Save(outputPngPath, ImageFormat.Png);
                }
                if (!string.IsNullOrEmpty(outputPublicPngPath)) {
                    master256.Save(outputPublicPngPath, ImageFormat.Png);
                }

                // 2. Build multi-resolution ICO (256, 128, 64, 48, 32, 24, 16)
                int[] sizes = new int[] { 256, 128, 64, 48, 32, 24, 16 };
                List<byte[]> images = new List<byte[]>();
                List<int> sizeList = new List<int>();

                foreach (int sz in sizes) {
                    using (Bitmap bmp = new Bitmap(sz, sz, PixelFormat.Format32bppArgb)) {
                        using (Graphics g = Graphics.FromImage(bmp)) {
                            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                            g.SmoothingMode = SmoothingMode.HighQuality;
                            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                            g.Clear(Color.Transparent);
                            g.DrawImage(master256, 0, 0, sz, sz);
                        }

                        if (sz == 256) {
                            using (MemoryStream ms = new MemoryStream()) {
                                bmp.Save(ms, ImageFormat.Png);
                                images.Add(ms.ToArray());
                                sizeList.Add(256);
                            }
                        } else {
                            byte[] dib = CreateDib(bmp, sz);
                            images.Add(dib);
                            sizeList.Add(sz);
                        }
                    }
                }

                using (FileStream fs = new FileStream(outputIcoPath, FileMode.Create, FileAccess.Write))
                using (BinaryWriter bw = new BinaryWriter(fs)) {
                    bw.Write((ushort)0);
                    bw.Write((ushort)1);
                    bw.Write((ushort)images.Count);

                    int offset = 6 + (images.Count * 16);

                    for (int i = 0; i < images.Count; i++) {
                        int sz = sizeList[i];
                        byte bSz = (byte)(sz >= 256 ? 0 : sz);
                        bw.Write(bSz);
                        bw.Write(bSz);
                        bw.Write((byte)0);
                        bw.Write((byte)0);
                        bw.Write((ushort)1);
                        bw.Write((ushort)32);
                        bw.Write((uint)images[i].Length);
                        bw.Write((uint)offset);

                        offset += images[i].Length;
                    }

                    foreach (byte[] data in images) {
                        bw.Write(data);
                    }
                }
            }
        }
    }

    private static byte[] CreateDib(Bitmap bmp, int sz) {
        int width = sz;
        int height = sz;
        int maskRowBytes = ((width + 31) / 32) * 4;
        int maskSize = maskRowBytes * height;
        int pixelDataSize = width * height * 4;
        int totalSize = 40 + pixelDataSize + maskSize;

        byte[] dib = new byte[totalSize];
        using (MemoryStream ms = new MemoryStream(dib))
        using (BinaryWriter bw = new BinaryWriter(ms)) {
            bw.Write((uint)40);
            bw.Write((int)width);
            bw.Write((int)(height * 2));
            bw.Write((ushort)1);
            bw.Write((ushort)32);
            bw.Write((uint)0);
            bw.Write((uint)(pixelDataSize + maskSize));
            bw.Write((int)0);
            bw.Write((int)0);
            bw.Write((uint)0);
            bw.Write((uint)0);

            BitmapData data = bmp.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            byte[] rawPixels = new byte[data.Stride * height];
            Marshal.Copy(data.Scan0, rawPixels, 0, rawPixels.Length);
            bmp.UnlockBits(data);

            for (int y = height - 1; y >= 0; y--) {
                int rowOffset = y * data.Stride;
                for (int x = 0; x < width; x++) {
                    int pxOffset = rowOffset + (x * 4);
                    byte b = rawPixels[pxOffset];
                    byte g = rawPixels[pxOffset + 1];
                    byte r = rawPixels[pxOffset + 2];
                    byte a = rawPixels[pxOffset + 3];

                    bw.Write(b);
                    bw.Write(g);
                    bw.Write(r);
                    bw.Write(a);
                }
            }

            byte[] maskBytes = new byte[maskSize];
            bw.Write(maskBytes);
        }

        return dib;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'NativeIcoBuilder').Type) {
    Add-Type -TypeDefinition $code -ReferencedAssemblies "System.Drawing.dll"
}

$assetsPng = Join-Path $assetsDir "icon.png"
$publicPng = Join-Path $publicDir "icon.png"
$smartBillIco = Join-Path $assetsDir "smart-bill.ico"
$iconIco = Join-Path $assetsDir "icon.ico"
$publicFavicon = Join-Path $publicDir "favicon.ico"

Write-Host "[*] Converting image to multi-resolution Windows icon..." -ForegroundColor Cyan
[NativeIcoBuilder]::BuildIco($srcPath, $smartBillIco, $assetsPng, $publicPng)
[NativeIcoBuilder]::BuildIco($srcPath, $iconIco, "", "")
Copy-Item $smartBillIco $publicFavicon -Force

# Refresh desktop shortcuts
$shortcutScript = Join-Path $projectDir "launcher\create-shortcut.ps1"
if (Test-Path $shortcutScript) {
    & powershell -ExecutionPolicy Bypass -File $shortcutScript
}

# Invalidate Windows Explorer icon cache
[NativeIcoBuilder]::FlushShell()
try {
    Start-Process "ie4uinit.exe" -ArgumentList "-show" -NoNewWindow -Wait -ErrorAction SilentlyContinue
} catch {}

Write-Host ""
Write-Host "[SUCCESS] Custom logo converted and applied successfully!" -ForegroundColor Green
Write-Host "    - Desktop Shortcut (assets\smart-bill.ico)" -ForegroundColor Yellow
Write-Host "    - App Header and Web Icon (public\icon.png)" -ForegroundColor Yellow
Write-Host "    - Browser Favicon (public\favicon.ico)" -ForegroundColor Yellow
