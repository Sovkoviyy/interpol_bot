@echo off
chcp 65001 > nul
title INTERPOL BOT • ТЕСТОВОЕ ОКРУЖЕНИЕ (TEST ENV)
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "ROOT_DIR=%SCRIPT_DIR%..\"
set "ENV_FILE=%SCRIPT_DIR%.env"

echo =====================================================================
echo    🧪 INTERPOL BOT - ТЕСТОВОЕ ОКРУЖЕНИЕ (ИЗОЛИРОВАННАЯ ПЕСОЧНИЦА)
echo =====================================================================
echo.
echo Данное окружение изолировано от основного проекта:
echo • Отдельная база данных: test_env\test.db
echo • Отдельный конфигурационный файл: test_env\.env
echo.

:: 1. Проверка или создание .env
if not exist "%ENV_FILE%" (
    echo [!] Конфигурация для тестов не найдена. Давайте настроим её прямо сейчас.
    echo.
    goto :CONFIGURE
) else (
    echo [i] Найден существующий файл test_env\.env.
    set /p "RECONFIG=Хотите изменить настройки токена/сервера? (Y/N, Enter = оставить): "
    if /i "!RECONFIG!"=="Y" goto :CONFIGURE
    goto :LOAD_ENV
)

:CONFIGURE
echo ---------------------------------------------------------------------
echo Пожалуйста, введите данные вашего тестового Discord-бота:
echo ---------------------------------------------------------------------
set /p "INP_TOKEN=1. DISCORD_TOKEN (токен бота): "
set /p "INP_CLIENT_ID=2. CLIENT_ID (Application ID): "
set /p "INP_CLIENT_SECRET=3. CLIENT_SECRET (секрет приложения): "
set /p "INP_GUILD_ID=4. GUILD_ID (ID тестового Discord-сервера): "
set /p "INP_PORT=5. Порт сервера [Enter = 3001]: "

if "!INP_PORT!"=="" set "INP_PORT=3001"

:: Создание test_env\.env
(
echo # Discord Bot Test Configuration
echo DISCORD_TOKEN=!INP_TOKEN!
echo CLIENT_ID=!INP_CLIENT_ID!
echo CLIENT_SECRET=!INP_CLIENT_SECRET!
echo GUILD_ID=!INP_GUILD_ID!
echo.
echo # Web Configuration
echo PORT=!INP_PORT!
echo JWT_SECRET=interpol_test_jwt_secret_key_12345
echo FRONTEND_URL=http://localhost:5173
echo DISCORD_REDIRECT_URI=http://localhost:!INP_PORT!/api/auth/callback
echo.
echo # Test Database
echo DATABASE_URL="file:./test.db"
) > "%ENV_FILE%"

echo.
echo [УСПЕХ] Файл test_env\.env успешно сохранен!
echo.

:LOAD_ENV
:: Чтение порта из .env
set "SERVER_PORT=3001"
for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if "%%A"=="PORT" set "SERVER_PORT=%%B"
)

:: 2. Проверка наличия cloudflared.exe
set "CF_EXE=%ROOT_DIR%cloudflared.exe"
if not exist "!CF_EXE!" set "CF_EXE=%SCRIPT_DIR%cloudflared.exe"

if not exist "!CF_EXE!" (
    echo [1/4] cloudflared.exe не найден. Скачивание Cloudflare Tunnel CLI...
    curl.exe -L -o "%ROOT_DIR%cloudflared.exe" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    set "CF_EXE=%ROOT_DIR%cloudflared.exe"
    echo [УСПЕХ] cloudflared.exe успешно загружен!
    echo.
) else (
    echo [1/4] cloudflared.exe найден.
)

:: 3. Проверка сборки фронтенда
if not exist "%ROOT_DIR%web\dist\index.html" (
    echo [2/4] Сборка веб-панели (React + Vite)...
    cd /d "%ROOT_DIR%web"
    call npm.cmd run build
    cd /d "%SCRIPT_DIR%"
    echo [УСПЕХ] Веб-панель собрана!
    echo.
) else (
    echo [2/4] Сборка веб-панели готова.
)

:: 4. Инициализация изолированной БД test.db
echo [3/4] Инициализация тестовой базы данных SQLite (test.db)...
cd /d "%SCRIPT_DIR%"
set "DATABASE_URL=file:./test.db"
call "%ROOT_DIR%node_modules\.bin\prisma.cmd" db push --schema="%ROOT_DIR%prisma\schema.prisma"
if errorlevel 1 (
    echo [ОШИБКА] Не удалось инициализировать test.db
    pause
    exit /b 1
)

:: Компиляция TypeScript бэкенда
cd /d "%ROOT_DIR%"
call npm.cmd run build
cd /d "%SCRIPT_DIR%"
echo.

:: 5. Запуск бота и туннеля
echo [4/4] Запуск тестового бота и Cloudflare Tunnel...
echo.
echo =====================================================================
echo  ВАЖНО:
echo  1. Тестовый бот запущен в отдельном окне.
echo  2. База данных тестовая: test_env\test.db
echo  3. Ниже появится публичная ссылка Cloudflare вида:
echo     https://xxxx-xxxx-xxxx.trycloudflare.com
echo.
echo  Для проверки Discord OAuth2 добавьте в Discord Developer Portal:
echo  https://ваш-домен.trycloudflare.com/api/auth/callback
echo =====================================================================
echo.

start "INTERPOL BOT - [ТЕСТОВОЕ ОКРУЖЕНИЕ]" cmd /k "cd /d "%SCRIPT_DIR%" && set "ENV_FILE=%ENV_FILE%" && node "%ROOT_DIR%dist\index.js""

:: Запуск Cloudflare туннеля
"!CF_EXE!" tunnel --url http://localhost:!SERVER_PORT!

pause
