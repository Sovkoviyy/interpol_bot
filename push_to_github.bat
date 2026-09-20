@echo off
chcp 65001 > nul
title Git Push to GitHub
cd /d "%~dp0"

echo =====================================================================
echo    🚀 ОТПРАВКА КОДА В РЕПОЗИТОРИЙ GITHUB
echo    https://github.com/Sovkoviyy/interpol_bot.git
echo =====================================================================
echo.

git push -u origin main

if errorlevel 1 (
    echo.
    echo -----------------------------------------------------------------
    echo Если авторизация через браузер не сработала, вы можете использовать
    echo GitHub Personal Access Token (PAT).
    echo.
    echo Чтобы отправить по токену, скопируйте токен с GitHub:
    echo https://github.com/settings/tokens
    echo и запустите команду:
    echo git push https://ВАШ_ТОКЕН@github.com/Sovkoviyy/interpol_bot.git main
    echo -----------------------------------------------------------------
) else (
    echo.
    echo [УСПЕХ] Код успешно отправлен в репозиторий GitHub!
)

pause
