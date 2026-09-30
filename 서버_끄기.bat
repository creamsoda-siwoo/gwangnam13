@echo off
chcp 65001 >nul
set found=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul
  set found=1
)
if defined found (echo 서버를 껐습니다.) else (echo 켜져 있는 서버가 없습니다.)
pause
