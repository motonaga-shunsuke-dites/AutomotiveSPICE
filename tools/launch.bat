@echo off
chcp 65001 > nul
cd /d "%~dp0"

:: ポート 3000 が使用中か確認（既に起動中の場合はブラウザだけ開く）
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
  echo サーバーは既に起動中です。ブラウザを開きます...
  start http://localhost:3000
  exit /b 0
)

:: Node.js チェック
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [エラー] Node.js が見つかりません。install.bat を先に実行してください。
  pause
  exit /b 1
)

:: node_modules チェック
if not exist node_modules (
  echo 依存パッケージが見つかりません。install.bat を先に実行してください。
  pause
  exit /b 1
)

echo ASPICE Doc Tool を起動中...

:: サーバーをバックグラウンドで起動
start /b node server.js

:: サーバー起動待機 (最大5秒)
set /a count=0
:wait
timeout /t 1 /nobreak >nul
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 goto opened
set /a count+=1
if %count% lss 5 goto wait

:opened
echo ブラウザを開いています: http://localhost:3000
start http://localhost:3000
