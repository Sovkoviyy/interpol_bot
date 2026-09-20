@echo off
chcp 65001 > nul
title INTERPOL BOT • Majestic Family • Local Launcher

echo =====================================================================
echo    🚀 INTERPOL BOT - ЛОКАЛЬНЫЙ ЗАПУСК С CLOUDFLARE TUNNEL
echo =====================================================================
echo.

:: 1. Проверка наличия cloudflared
if not exist "cloudflared.exe" (
    echo [1/4] cloudflared.exe не найден. Скачивание Cloudflare Tunnel CLI...
    curl.exe -L -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    if errorlevel 1 (
        echo [ОШИБКА] Не удалось скачать cloudflared.exe. Проверьте интернет-соединение.
        pause
        exit /b 1
    )
    echo [УСПЕХ] cloudflared.exe успешно загружен!
    echo.
) else (
    echo [1/4] cloudflared.exe найден.
)

:: 2. Проверка сборки фронтенда
if not exist "web\dist\index.html" (
    echo [2/4] Сборка веб-панели (React + Vite)...
    cd web
    call npm.cmd run build
    cd ..
    echo [УСПЕХ] Веб-панель собрана!
    echo.
) else (
    echo [2/4] Сборка веб-панели готова.
)

:: 3. Проверка базы данных и бэкенда
echo [3/4] Синхронизация базы данных и компиляция TypeScript...
call npm.cmd run prisma:push
call npm.cmd run build
echo.

:: 4. Запуск сервера и туннеля
echo [4/4] Запуск бота и поднятие публичного домена...
echo.
echo =====================================================================
echo  ВАЖНО:
echo  1. Бот и веб-сервер открываются в отдельном окне.
echo  2. Ниже появится публичная ссылка Cloudflare вида:
echo     https://xxxx-xxxx-xxxx.trycloudflare.com
echo.
echo  Скопируйте полученную ссылку для входа в панель из интернета!
echo  Для работы Discord OAuth2 добавьте в Redirects:
echo  https://ваш-домен.trycloudflare.com/api/auth/callback
echo =====================================================================
echo.

start "INTERPOL BOT - Server & Discord Bot" cmd /k "node dist/index.js"

:: Запуск Cloudflare туннеля на порт 3001
cloudflared.exe tunnel --url http://localhost:3001

pause
