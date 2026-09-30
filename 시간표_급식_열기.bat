@echo off
chcp 65001 >nul
cd /d "%~dp0"
wscript "server_start.vbs"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
