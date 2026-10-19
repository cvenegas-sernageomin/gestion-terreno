# make-icons.ps1 — genera icons/icon-192.png e icon-512.png (GDI+, sin dependencias)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$iconDir = Join-Path $PSScriptRoot "icons"
if (-not (Test-Path $iconDir)) { New-Item -ItemType Directory -Path $iconDir | Out-Null }

function New-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(11, 109, 182))   # azul institucional

  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  # caja (bed) + cabina de la camioneta
  $g.FillRectangle($white, [single]($size*0.18), [single]($size*0.42), [single]($size*0.64), [single]($size*0.20))
  $g.FillRectangle($white, [single]($size*0.55), [single]($size*0.28), [single]($size*0.27), [single]($size*0.34))
  $g.FillEllipse($white, [single]($size*0.24), [single]($size*0.60), [single]($size*0.14), [single]($size*0.14))
  $g.FillEllipse($white, [single]($size*0.62), [single]($size*0.60), [single]($size*0.14), [single]($size*0.14))

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $white.Dispose(); $g.Dispose(); $bmp.Dispose()
}

New-Icon 192 (Join-Path $iconDir "icon-192.png")
New-Icon 512 (Join-Path $iconDir "icon-512.png")
Write-Host "Iconos generados en $iconDir" -ForegroundColor Green
