@echo off
setlocal

cd /d "%~dp0"
set "URL=http://127.0.0.1:3010"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found.
  pause
  exit /b 1
)

set "PID="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":3010 .*LISTENING"') do (
  set "PID=%%a"
  goto open_browser
)

start "FYH-Web" cmd /k "cd /d %~dp0 && npm run web"
timeout /t 2 /nobreak >nul

:open_browser
start "" "%URL%"
exit /b 0
