Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public class WinEnum {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowTextW(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool IsWindowVisible(IntPtr h);
  delegate bool EnumWindowsProc(IntPtr h, IntPtr lp);
  public static List<string> Titles(uint target) {
    var r = new List<string>();
    EnumWindows((h, lp) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == target && IsWindowVisible(h)) {
        var sb = new StringBuilder(256); GetWindowTextW(h, sb, 256);
        if (sb.Length > 0) { RECT rc; GetWindowRect(h, out rc); r.Add(sb.ToString() + " | L=" + rc.L + " T=" + rc.T + " size=" + (rc.R - rc.L) + "x" + (rc.B - rc.T)); }
      }
      return true;
    }, IntPtr.Zero);
    return r;
  }
}
"@
$p = Get-Process pwb-app -ErrorAction SilentlyContinue
if ($p) { [WinEnum]::Titles($p.Id) | ForEach-Object { "WIN: $_" } } else { "APP NOT RUNNING" }
