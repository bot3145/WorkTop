# Region snip: fullscreen overlay, drag a rectangle, result goes to the clipboard.
# ASCII-only on purpose (see project rule: keep PowerShell free of non-ASCII text).
# Launched by Worktop's `snip_region` command; exits by itself after the snip.
param(
  [int]$DelayMs = 260,      # let the trigger menu disappear before we grab the screen
  [string]$SaveDir = "",    # optional: also save a PNG here
  [string]$AutoRect = ""    # testing/automation: "x,y,w,h" - skip the overlay, crop this rect
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Be DPI aware so the captured bitmap and the mouse coordinates share one pixel space.
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class SnipDpi {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
}
"@
[SnipDpi]::SetProcessDPIAware() | Out-Null
$console = [SnipDpi]::GetConsoleWindow()
if ($console -ne [IntPtr]::Zero) { [SnipDpi]::ShowWindow($console, 0) | Out-Null }

if ($DelayMs -gt 0) { Start-Sleep -Milliseconds $DelayMs }

$vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
if ($vs.Width -le 0 -or $vs.Height -le 0) { exit 1 }

# Grab the whole virtual desktop once; the overlay then paints a dimmed copy.
$screen = New-Object System.Drawing.Bitmap $vs.Width, $vs.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($screen)
$g.CopyFromScreen($vs.Left, $vs.Top, 0, 0, $screen.Size, [System.Drawing.CopyPixelOperation]::SourceCopy)
$g.Dispose()

if ($AutoRect) {
  $parts = $AutoRect.Split(",")
  if ($parts.Length -eq 4) {
    $rect = New-Object System.Drawing.Rectangle ([int]$parts[0]), ([int]$parts[1]), ([int]$parts[2]), ([int]$parts[3])
    $crop = $screen.Clone($rect, $screen.PixelFormat)
    if ($SaveDir -and (Test-Path $SaveDir)) {
      $crop.Save((Join-Path $SaveDir ("snip-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".png")), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    for ($i = 0; $i -lt 10; $i++) {
      try { [System.Windows.Forms.Clipboard]::SetImage($crop); break } catch { Start-Sleep -Milliseconds 120 }
    }
    $crop.Dispose()
    $screen.Dispose()
    exit 0
  }
}

$form = New-Object System.Windows.Forms.Form
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$form.Bounds = $vs
$form.TopMost = $true
$form.ShowInTaskbar = $false
$form.Cursor = [System.Windows.Forms.Cursors]::Cross
$form.KeyPreview = $true
$form.BackColor = [System.Drawing.Color]::Black
$form.DoubleBuffered = $true

$script:start = $null
$script:current = $null
$script:cancelled = $false

$dimBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(120, 0, 0, 0))
$edgePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 52, 199, 89)), 2
$hintBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
$hintFont = New-Object System.Drawing.Font "Segoe UI", 11

$form.add_Paint({
  param($sender, $e)
  $gr = $e.Graphics
  $gr.DrawImage($screen, 0, 0)
  $gr.FillRectangle($dimBrush, 0, 0, $vs.Width, $vs.Height)
  if ($script:start -and $script:current) {
    $x1 = [Math]::Min($script:start.X, $script:current.X)
    $y1 = [Math]::Min($script:start.Y, $script:current.Y)
    $x2 = [Math]::Max($script:start.X, $script:current.X)
    $y2 = [Math]::Max($script:start.Y, $script:current.Y)
    $w = [Math]::Max(1, $x2 - $x1)
    $h = [Math]::Max(1, $y2 - $y1)
    # bright copy inside the selection, thin green border
    $gr.DrawImage($screen, (New-Object System.Drawing.Rectangle $x1, $y1, $w, $h), (New-Object System.Drawing.Rectangle $x1, $y1, $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
    $gr.DrawRectangle($edgePen, $x1, $y1, $w, $h)
    $label = "$w x $h"
    $sz = $gr.MeasureString($label, $hintFont)
    $lx = [Math]::Min([Math]::Max(0, $x1), $vs.Width - $sz.Width - 8)
    $ly = if ($y2 + $sz.Height + 6 -lt $vs.Height) { $y2 + 4 } else { [Math]::Max(0, $y1 - $sz.Height - 6) }
    $gr.DrawString($label, $hintFont, $hintBrush, $lx, $ly)
  } else {
    $msg = "Drag to select a region - Esc to cancel"
    $gr.DrawString($msg, $hintFont, $hintBrush, 24, 24)
  }
})

$form.add_MouseDown({
  param($sender, $e)
  $script:start = $e.Location
  $script:current = $e.Location
  $form.Invalidate()
})
$form.add_MouseMove({
  param($sender, $e)
  if ($script:start) { $script:current = $e.Location; $form.Invalidate() }
})
$form.add_MouseUp({
  param($sender, $e)
  $script:current = $e.Location
  $form.Close()
})
$form.add_KeyDown({
  param($sender, $e)
  if ($e.KeyCode -eq [System.Windows.Forms.Keys]::Escape) { $script:cancelled = $true; $form.Close() }
})

[void]$form.ShowDialog()
$form.Dispose()

if ($script:cancelled -or -not $script:start -or -not $script:current) { exit 0 }

$rx = [Math]::Min($script:start.X, $script:current.X)
$ry = [Math]::Min($script:start.Y, $script:current.Y)
$rw = [Math]::Abs($script:current.X - $script:start.X)
$rh = [Math]::Abs($script:current.Y - $script:start.Y)
if ($rw -lt 3 -or $rh -lt 3) { exit 0 }   # treat a click as "cancel"

$rect = New-Object System.Drawing.Rectangle $rx, $ry, $rw, $rh
$crop = $screen.Clone($rect, $screen.PixelFormat)

if ($SaveDir -and (Test-Path $SaveDir)) {
  $name = "snip-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".png"
  $crop.Save((Join-Path $SaveDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
}

# Clipboard needs STA (powershell.exe -File is STA by default); retry while another app holds it.
$ok = $false
for ($i = 0; $i -lt 10 -and -not $ok; $i++) {
  try {
    [System.Windows.Forms.Clipboard]::SetImage($crop)
    $ok = $true
  } catch {
    Start-Sleep -Milliseconds 120
  }
}

$crop.Dispose()
$screen.Dispose()
$dimBrush.Dispose()
$edgePen.Dispose()
$hintBrush.Dispose()
$hintFont.Dispose()

if ($ok) { exit 0 } else { exit 2 }
