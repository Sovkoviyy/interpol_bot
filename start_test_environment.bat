@echo off
chcp 65001 > nul
cd /d "%~dp0test_env"
node start_test.js
if errorlevel 1 pause
