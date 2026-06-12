@echo off
cd /d "%~dp0"

echo ============================================
echo  ASPICE Doc Tool - Setup
echo ============================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found.
  echo  Please install from https://nodejs.org/
  pause
  exit /b 1
)

echo [1/3] Installing npm packages...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo [2/3] Creating desktop shortcut...
set SCRIPT_DIR=%~dp0
set SHORTCUT=%USERPROFILE%\Desktop\ASPICE Doc Tool.lnk
powershell -NoProfile -Command "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath='%SCRIPT_DIR%launch.bat'; $s.WorkingDirectory='%SCRIPT_DIR%'; $s.IconLocation='%SystemRoot%\System32\shell32.dll,13'; $s.Description='ASPICE Document Editor & Viewer'; $s.Save()"
echo  -> Desktop shortcut "ASPICE Doc Tool" created.

echo [3/3] Setup complete!
echo.
echo Usage:
echo  1. Double-click "ASPICE Doc Tool" on the Desktop
echo  2. To pin to taskbar: right-click the shortcut -> Pin to taskbar
echo  3. To bookmark in browser: run launch.bat first, then bookmark http://localhost:3000
echo.
pause
