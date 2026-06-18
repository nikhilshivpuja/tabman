Add-Type -AssemblyName System.Drawing
$iconsDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

foreach ($size in 16, 48, 128) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 15, 17, 23))
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 91, 141, 239))
  $margin = [math]::Floor($size * 0.2)
  $inner = $size - 2 * $margin
  $g.FillRectangle($brush, $margin, $margin, $inner, $inner)
  $g.Dispose()
  $path = Join-Path $iconsDir "icon$size.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "Wrote $path"
}
