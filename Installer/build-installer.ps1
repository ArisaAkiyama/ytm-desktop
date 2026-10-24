$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$projectPath = Join-Path $rootDir "src\YouTubeMusicDesktop\YouTubeMusicDesktop.csproj"
$iconSource = Join-Path $rootDir "src\YouTubeMusicDesktop\Assets\ytm.ico"
$publishDir = Join-Path $rootDir "publish\win-x64"
$distDir = Join-Path $rootDir "dist"
$installerAssetsDir = Join-Path $PSScriptRoot "assets"
$issPath = Join-Path $PSScriptRoot "YouTubeMusic.iss"

New-Item -ItemType Directory -Force -Path $publishDir | Out-Null
New-Item -ItemType Directory -Force -Path $distDir | Out-Null
New-Item -ItemType Directory -Force -Path $installerAssetsDir | Out-Null

Write-Host "==> [1/4] Generating Inno Setup Wizard Branding Assets (BMP)..." -ForegroundColor Cyan
Add-Type -AssemblyName System.Drawing

function Draw-YtmLogo([System.Drawing.Graphics]$g, [float]$cx, [float]$cy, [float]$radius) {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Outer Red Circle (#FF0000)
    $redBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 0, 32))
    $g.FillEllipse($redBrush, [float]($cx - $radius), [float]($cy - $radius), [float]($radius * 2), [float]($radius * 2))

    # Inner White Ring
    $ringR = [float]($radius * 0.54)
    $penW = [Math]::Max(1.6, [float]($radius * 0.10))
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penW)
    $g.DrawEllipse($whitePen, [float]($cx - $ringR), [float]($cy - $ringR), [float]($ringR * 2), [float]($ringR * 2))

    # Inner Play Triangle
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $triR = [float]($radius * 0.28)
    $offX = [float]($radius * 0.03)
    $p1 = New-Object System.Drawing.PointF([float]($cx - $triR * 0.55 + $offX), [float]($cy - $triR * 0.88))
    $p2 = New-Object System.Drawing.PointF([float]($cx - $triR * 0.55 + $offX), [float]($cy + $triR * 0.88))
    $p3 = New-Object System.Drawing.PointF([float]($cx + $triR * 0.95 + $offX), [float]$cy)
    $g.FillPolygon($whiteBrush, [System.Drawing.PointF[]]@($p1, $p2, $p3))

    $redBrush.Dispose()
    $whitePen.Dispose()
    $whiteBrush.Dispose()
}

# 1. Generate wizard-banner.bmp (164 x 314, 24-bit RGB)
$bannerBmp = New-Object System.Drawing.Bitmap(164, 314, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$bg = [System.Drawing.Graphics]::FromImage($bannerBmp)
$bg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$bg.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$gradRect = New-Object System.Drawing.Rectangle(0, 0, 164, 314)
$gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $gradRect,
    [System.Drawing.Color]::FromArgb(255, 10, 10, 14),
    [System.Drawing.Color]::FromArgb(255, 24, 8, 12),
    90.0)
$bg.FillRectangle($gradBrush, $gradRect)

# Rounded Dynamic Island Pill preview at top of banner
$gp = New-Object System.Drawing.Drawing2D.GraphicsPath
$gp.AddArc(32, 22, 18, 18, 90, 180)
$gp.AddArc(114, 22, 18, 18, 270, 180)
$gp.CloseFigure()
$pillBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 0, 0, 0))
$pillPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(65, 255, 255, 255), 1.0)
$bg.FillPath($pillBrush, $gp)
$bg.DrawPath($pillPen, $gp)

# Mini YTM dot & waveform inside the banner pill
Draw-YtmLogo $bg 42.0 31.0 5.5
$waveBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 45, 85))
$bg.FillRectangle($waveBrush, 110, 28, 2, 6)
$bg.FillRectangle($waveBrush, 114, 25, 2, 12)
$bg.FillRectangle($waveBrush, 118, 27, 2, 8)
$waveBrush.Dispose()
$gp.Dispose()

# Main YouTube Music Emblem in center
Draw-YtmLogo $bg 82.0 126.0 38.0

# Title & Subtitle on Banner
$titleFont = New-Object System.Drawing.Font("Segoe UI", 12.0, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Regular)
$whiteTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 245, 247))
$mutedTextBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 160, 160, 170))
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center

$bg.DrawString("YouTube Music", $titleFont, $whiteTextBrush, [float]82.0, [float]182.0, $sf)
$bg.DrawString("Ad-Free Desktop App", $subFont, $mutedTextBrush, [float]82.0, [float]206.0, $sf)
$bg.DrawString("+ Dynamic Island", $subFont, $mutedTextBrush, [float]82.0, [float]222.0, $sf)

$bannerPath = Join-Path $installerAssetsDir "wizard-banner.bmp"
$bannerBmp.Save($bannerPath, [System.Drawing.Imaging.ImageFormat]::Bmp)

$gradBrush.Dispose()
$pillBrush.Dispose()
$pillPen.Dispose()
$titleFont.Dispose()
$subFont.Dispose()
$whiteTextBrush.Dispose()
$mutedTextBrush.Dispose()
$sf.Dispose()
$bg.Dispose()
$bannerBmp.Dispose()

# 2. Generate wizard-small.bmp (55 x 55, 24-bit RGB)
$smallBmp = New-Object System.Drawing.Bitmap(55, 55, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$sg = [System.Drawing.Graphics]::FromImage($smallBmp)
$sg.Clear([System.Drawing.Color]::White)
Draw-YtmLogo $sg 27.5 27.5 22.0
$smallPath = Join-Path $installerAssetsDir "wizard-small.bmp"
$smallBmp.Save($smallPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$sg.Dispose()
$smallBmp.Dispose()

Write-Host "==> [2/4] Stopping any running YouTubeMusic process & publishing Single-File Release..." -ForegroundColor Cyan
Get-Process YouTubeMusic -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

dotnet publish $projectPath `
    --configuration Release `
    --runtime win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:EnableCompressionInSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    -p:DebugType=embedded `
    --output $publishDir

Copy-Item -Path $iconSource -Destination (Join-Path $publishDir "ytm.ico") -Force

Write-Host "==> [3/4] Locating Inno Setup Compiler (ISCC.exe)..." -ForegroundColor Cyan
function Find-IsccPath {
    $cmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $candidates = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "$env:LocalAppData\Programs\Inno Setup 6\ISCC.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

$iscc = Find-IsccPath
if (-not $iscc) {
    Write-Host "Inno Setup 6 not found. Installing JRSoftware.InnoSetup via winget..." -ForegroundColor Yellow
    winget install --id JRSoftware.InnoSetup --exact --silent --accept-package-agreements --accept-source-agreements
    $iscc = Find-IsccPath
}

if (-not $iscc) {
    throw "Failed to locate ISCC.exe after installation."
}

Write-Host "==> [4/4] Compiling Inno Setup Installer ($issPath)..." -ForegroundColor Cyan
& $iscc $issPath
if ($LASTEXITCODE -ne 0) {
    throw "ISCC compilation failed with exit code $LASTEXITCODE"
}

$outputInstaller = Join-Path $distDir "YouTubeMusic_Setup_v1.0.0.exe"
$fileInfo = Get-Item $outputInstaller
Write-Host ""
Write-Host "SUCCESS! Installer created:" -ForegroundColor Green
Write-Host "  Path: $($fileInfo.FullName)" -ForegroundColor Green
Write-Host "  Size: $([Math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Green
