@echo off
rem WorkTop Lite launcher (bundled Node runtime preferred, system Node as fallback)
cd /d "%~dp0"
if not exist "%APPDATA%\WorkTopLite\data" mkdir "%APPDATA%\WorkTopLite\data"
if exist "%~dp0runtime\node.exe" (
  "%~dp0runtime\node.exe" server.mjs --root "%APPDATA%\WorkTopLite\data" --open
  goto :eof
)
where node >nul 2>nul
if errorlevel 1 (
  echo [WorkTop Lite] Node.js is required. Reinstall WorkTop Lite or install Node.js from https://nodejs.org
  pause
  exit /b 1
)
node server.mjs --root "%APPDATA%\WorkTopLite\data" --open
