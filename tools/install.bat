@echo off
chcp 65001 > nul
echo ============================================
echo  ASPICE Doc Tool — セットアップ
echo ============================================
echo.

cd /d "%~dp0"

:: Node.js チェック
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [エラー] Node.js が見つかりません。
  echo  https://nodejs.org/ からインストールしてください。
  pause
  exit /b 1
)

echo [1/3] 依存パッケージをインストール中...
call npm install
if %errorlevel% neq 0 (
  echo [エラー] npm install に失敗しました。
  pause
  exit /b 1
)

echo [2/3] デスクトップショートカットを作成中...
set SCRIPT_DIR=%~dp0
set SHORTCUT=%USERPROFILE%\Desktop\ASPICE Doc Tool.lnk
powershell -NoProfile -Command ^
  "$ws=New-Object -ComObject WScript.Shell; $s=$ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath='%SCRIPT_DIR%launch.bat'; $s.WorkingDirectory='%SCRIPT_DIR%'; $s.IconLocation='%SystemRoot%\System32\shell32.dll,13'; $s.Description='ASPICE Document Editor & Viewer'; $s.Save()"
echo  → デスクトップに「ASPICE Doc Tool」ショートカットを作成しました

echo [3/3] セットアップ完了！
echo.
echo 使い方:
echo  1. デスクトップの「ASPICE Doc Tool」をダブルクリック
echo  2. タスクバーにピンして使う場合はショートカットを右クリック→タスクバーにピン
echo  3. ブラウザのブックマークに http://localhost:3000 を登録する場合は
echo     先に launch.bat を実行してからブックマーク登録してください
echo.
pause
