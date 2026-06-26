Add-Type -AssemblyName System.Drawing

$source = Join-Path $PSScriptRoot '..\assets\tabman-icon-source.png'
$iconsDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'icons'

if (-not (Test-Path $source)) {
  Write-Error "Source icon not found: $source"
  exit 1
}

New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

$src = [System.Drawing.Image]::FromFile((Resolve-Path $source))
try {
  foreach ($size in 16, 48, 128) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($src, 0, 0, $size, $size)
    $g.Dispose()
    $path = Join-Path $iconsDir "icon$size.png"
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Wrote $path"
  }
} finally {
  $src.Dispose()
}
