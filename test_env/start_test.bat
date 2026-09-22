@echo off
chcp 65001 > nul
title INTERPOL BOT • Test Environment
cd /d "%~dp0"
node start_test.js
if errorlevel 1 pause
