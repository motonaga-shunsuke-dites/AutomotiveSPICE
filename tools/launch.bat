@echo off
cd /d "%~dp0"

netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
  echo Server already running. Opening browser...
  start http://localhost:3000
  exit /b 0
)

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Node.js not found. Please run install.bat first.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [ERROR] node_modules not found. Please run install.bat first.
  pause
  exit /b 1
)

echo Starting ASPICE Doc Tool...
start /b node server.js

set /a count=0
:wait
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 goto opened
set /a count+=1
if %count% lss 5 goto wait

:opened
echo Opening browser: http://localhost:3000
start http://localhost:3000
