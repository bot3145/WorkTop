# WorkTop demo recorder - produces GIF/PNG assets into docs/media/
# Usage:  powershell -ExecutionPolicy Bypass -File record-demos.ps1 [-Only menu,dock,magnet,snip,hero]
# Requires: ffmpeg in D:\app\ffmpeg\bin (or PATH), WorkTop running with desktop shell on.
param([string]$Only = "menu,dock,magnet,snip,hero,closeup")

$ErrorActionPreference = "Stop"
$FF = "D:\app\ffmpeg\bin\ffmpeg.exe"
if (-not (Test-Path $FF)) { $FF = "ffmpeg" }
$Out = Join-Path $PSScriptRoot "media"
New-Item -ItemType Directory -Force -Path $Out | Out-Null

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class DR {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int idx);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  public struct RECT { public int L; public int T; public int R; public int B; }
}
"@
[DR]::SetProcessDPIAware() | Out-Null
$Z = [UIntPtr]::Zero
$ProcId = (Get-Process pwb-app | Select-Object -First 1 -ExpandProperty Id)

function Find-Window([string]$titleLike, [int]$maxW = 99999) {
  $found = [IntPtr]::Zero
  $cb = {
    param($h, $l)
    $wpid = 0
    [DR]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null
    if ($wpid -eq $script:ProcId -and [DR]::IsWindowVisible($h)) {
      $sb = New-Object System.Text.StringBuilder 128
      [DR]::GetWindowTextW($h, $sb, 128) | Out-Null
      $r = New-Object DR+RECT
      [DR]::GetWindowRect($h, [ref]$r) | Out-Null
      if ($sb.ToString() -like $script:wantTitle -and (($r.R - $r.L) -le $script:wantMaxW)) { $script:found = $h }
    }
    return $true
  }
  $script:wantTitle = $titleLike; $script:wantMaxW = $maxW
  [DR]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
  return $found
}
function Move-To([int]$px, [int]$py) { [DR]::SetCursorPos($px, $py) | Out-Null }
function Click-At([int]$px, [int]$py) {
  Move-To $px $py; Start-Sleep -Milliseconds 150
  [DR]::mouse_event(2,0,0,0,$Z); Start-Sleep -Milliseconds 90
  [DR]::mouse_event(4,0,0,0,$Z)
}
function Drag([int]$x1,[int]$y1,[int]$x2,[int]$y2) {
  Move-To $x1 $y1; Start-Sleep -Milliseconds 200
  [DR]::mouse_event(2,0,0,0,$Z)
  for ($i = 1; $i -le 30; $i++) {
    Move-To ($x1 + [int](($x2-$x1)*$i/30)), ($y1 + [int](($y2-$y1)*$i/30))
    Start-Sleep -Milliseconds 18
  }
  Start-Sleep -Milliseconds 250
  [DR]::mouse_event(4,0,0,0,$Z)
}
function Press-Esc {
  [DR]::keybd_event(0x1B,0,0,$Z); Start-Sleep -Milliseconds 80
  [DR]::keybd_event(0x1B,0,2,$Z)
}
function Record-Gif([string]$name, [int]$ox, [int]$oy, [int]$w, [int]$h, [int]$secs, [scriptblock]$actions) {
  Write-Output "recording: $name"
  $tmp = Join-Path $env:TEMP "$name.mp4"
  $job = Start-Job -ScriptBlock {
    param($ff, $ox, $oy, $w, $h, $secs, $tmp)
    & $ff -y -f gdigrab -framerate 15 -t $secs -offset_x $ox -offset_y $oy -video_size "$w`x$h" -i desktop -c:v libx264 -preset ultrafast -crf 18 $tmp 2>$null
  } -ArgumentList $FF, $ox, $oy, $w, $h, $secs, $tmp
  Start-Sleep -Milliseconds 800
  & $actions
  Wait-Job $job | Out-Null; Remove-Job $job -Force
  & $FF -y -i $tmp -vf "fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3" -loop 0 (Join-Path $Out "$name.gif") 2>$null
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  Write-Output "  -> $name.gif"
}
$Scale = 1.5  # physical = logical * 1.5

# ---- shot: mascot fan menu ----
if ($Only -match "menu") {
  $mascot = Find-Window "WorkTop" 300
  if ($mascot -eq [IntPtr]::Zero) { Write-Output "menu: mascot not visible, skip"; }
  else {
    $r = New-Object DR+RECT; [DR]::GetWindowRect($mascot, [ref]$r) | Out-Null
    $bx = [int](($r.L + $r.R) / 2); $by = [int](($r.T + $r.B) / 2)
    Press-Esc; Start-Sleep -Milliseconds 1400
    Record-Gif "mascot-menu" ($bx - 420) ($by - 240) 560 460 7 {
      Click-At $bx $by
      Start-Sleep -Milliseconds 1000
      Move-To $bx ($by - 108); Start-Sleep -Milliseconds 800
      Move-To ($bx - 108) $by; Start-Sleep -Milliseconds 800
      Move-To $bx ($by + 108); Start-Sleep -Milliseconds 1000
      Move-To ($bx - 80) ($by - 60)
    }
  }
}

# ---- shot: dock hover / launch-minimize toggle ----
if ($Only -match "dock") {
  $dock = Find-Window "*Dock*" 2000
  if ($dock -eq [IntPtr]::Zero) { Write-Output "dock: not visible, skip"; }
  else {
    $r = New-Object DR+RECT; [DR]::GetWindowRect($dock, [ref]$r) | Out-Null
    $dy = [int](($r.T + $r.B) / 2)
    # icons are evenly spread; probe 3rd icon from left
    $ix = $r.L + [int](($r.R - $r.L) * 0.22)
    Record-Gif "dock-demo" ($r.L - 60) ($r.T - 260) ([int](($r.R - $r.L) + 120)) 420 12 {
      Move-To $ix ($dy - 40); Start-Sleep -Milliseconds 900    # hover zoom
      Move-To $ix $dy; Start-Sleep -Milliseconds 300
      Click-At $ix $dy; Start-Sleep -Milliseconds 1800          # click: minimize running app
      Click-At $ix $dy; Start-Sleep -Milliseconds 1800          # click again: restore
      Move-To ($ix - 200) ($dy - 120)
    }
  }
}

# ---- shot: card magnetic snap ----
if ($Only -match "magnet") {
  # drag todo card left toward the clock/calendar column; tuned for the demo scene layout
  $sx = [int]((540 + 150) * $Scale); $sy = [int]((410 + 40) * $Scale)
  $dx = [int]((540 - 60) * $Scale);  $dy2 = [int]((410 + 40) * $Scale)
  Record-Gif "card-magnet" ($dx - 200) ($sy - 260) 900 560 7 {
    Drag $sx $sy $dx $dy2
    Start-Sleep -Milliseconds 800
  }
}

# ---- shot: snip flow (AirSnip F1 -> drag select -> Esc) ----
if ($Only -match "snip") {
  $exe = Join-Path $PSScriptRoot "..\app\src-tauri\sidecar\airsnip\AirSnip.exe"
  if (-not (Get-Process airsnip -ErrorAction SilentlyContinue)) {
    if (Test-Path $exe) { Start-Process $exe -WindowStyle Hidden; Start-Sleep -Milliseconds 1200 }
  }
  Record-Gif "snip-flow" 500 200 1500 1000 12 {
    [DR]::keybd_event(0x70,0,0,$Z); Start-Sleep -Milliseconds 60
    [DR]::keybd_event(0x70,0,2,$Z)              # F1
    Start-Sleep -Milliseconds 1500               # overlay freezes screen
    Drag 900 500 1500 900                        # select a rect
    Start-Sleep -Milliseconds 1200               # annotation bar visible
    Press-Esc                                    # cancel, keep demo clean
    Start-Sleep -Milliseconds 500
  }
}

# ---- shot: hero full screenshot ----
if ($Only -match "hero") {
  & $FF -y -f gdigrab -framerate 1 -i desktop -frames:v 1 (Join-Path $Out "hero.png") 2>$null
  Write-Output "  -> hero.png"
}

# ---- closeups from hero (calendar / todo / nav cards) ----
if ($Only -match "closeup") {
  & $FF -y -i (Join-Path $Out "hero.png") -vf "crop=520:400:60:60"   (Join-Path $Out "closeup-clock-calendar.png") 2>$null
  & $FF -y -i (Join-Path $Out "hero.png") -vf "crop=470:380:780:590" (Join-Path $Out "closeup-todo.png") 2>$null
  & $FF -y -i (Join-Path $Out "hero.png") -vf "crop=640:400:60:1140" (Join-Path $Out "closeup-nav.png") 2>$null
  Write-Output "  -> closeup-*.png"
}

Write-Output "all requested shots done -> $Out"
