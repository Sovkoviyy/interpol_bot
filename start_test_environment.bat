@echo off
chcp 65001 > nul
cd /d "%~dp0test_env"
call start_test.bat
