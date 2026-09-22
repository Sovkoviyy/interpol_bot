@echo off
chcp 65001 > nul
title INTERPOL BOT • Universal Launcher
cd /d "%~dp0"
node start.js %*
if errorlevel 1 (
    echo.
    echo [ОШИБКА] Произошел сбой при запуске бота.
    pause
)
