#!/usr/bin/env node

/**
 * ====================================================================
 *  INTERPOL BOT • Универсальный кроссплатформенный запуск (Win / Linux)
 * ====================================================================
 *  Автоматически:
 *  1. Проверяет и инициализирует базу данных (Prisma + SQLite/Postgres)
 *  2. Проверяет зависимости и собирает фронтенд (React + Vite)
 *  3. Собирает TypeScript бэкенд
 *  4. Запускает Discord-бота и веб-панель на едином порту
 * ====================================================================
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const IS_WINDOWS = process.platform === 'win32';

console.log('====================================================================');
console.log('🚀 [INTERPOL BOT] Запуск единой системы (Discord Bot + Web Dashboard)');
console.log(`💻 Платформа: ${IS_WINDOWS ? 'Windows' : 'Linux / Unix'}`);
console.log('====================================================================\n');

// 1. Проверка файла .env
const envFile = path.join(ROOT_DIR, '.env');
const envExample = path.join(ROOT_DIR, '.env.example');

if (!fs.existsSync(envFile)) {
  if (fs.existsSync(envExample)) {
    console.log('⚠️ Файл .env не найден. Создаю базовый .env из .env.example...');
    fs.copyFileSync(envExample, envFile);
    console.log('👉 Не забудьте указать ваши DISCORD_TOKEN, CLIENT_ID, CLIENT_SECRET в файле .env!\n');
  }
}

// Утилита для выполнения команд с выводом
function runCommand(command, cwd = ROOT_DIR) {
  try {
    execSync(command, { cwd, stdio: 'inherit', shell: true });
    return true;
  } catch (error) {
    console.error(`❌ Ошибка выполнения команды: ${command}`);
    return false;
  }
}

// 2. Инициализация базы данных Prisma
console.log('📦 [1/3] Проверка и синхронизация базы данных (Prisma)...');
if (!runCommand('npx prisma db push')) {
  console.error('❌ Ошибка синхронизации схемы Prisma.');
  process.exit(1);
}
if (!runCommand('npx prisma generate')) {
  console.error('❌ Ошибка генерации клиента Prisma.');
  process.exit(1);
}

// 3. Проверка и сборка веб-панели (React + Vite)
const webDir = path.join(ROOT_DIR, 'web');
const webDist = path.join(webDir, 'dist', 'index.html');
const webModules = path.join(webDir, 'node_modules');

if (!fs.existsSync(webModules)) {
  console.log('\n📦 Установка зависимостей веб-панели...');
  if (!runCommand('npm install', webDir)) {
    console.error('❌ Ошибка установки зависимостей веб-панели.');
    process.exit(1);
  }
}

if (!fs.existsSync(webDist)) {
  console.log('\n🔨 [2/3] Сборка веб-панели React...');
  if (!runCommand('npm run build', webDir)) {
    console.error('❌ Ошибка сборки веб-панели.');
    process.exit(1);
  }
} else {
  console.log('✅ [2/3] Веб-панель уже собрана (web/dist)');
}

// 4. Сборка TypeScript бэкенда
const backendDist = path.join(ROOT_DIR, 'dist', 'index.js');
console.log('\n🔨 [3/3] Компиляция TypeScript бэкенда...');
if (!runCommand('npm run build:server')) {
  console.error('❌ Ошибка сборки бэкенда.');
  process.exit(1);
}

if (process.argv.includes('--setup-only')) {
  console.log('\n🎉 Подготовка завершена! Флаг --setup-only указан, выход.');
  process.exit(0);
}

// 5. Запуск готового приложения с защитой от крашей (Supervisor Watchdog)
console.log('\n====================================================================');
console.log('✨ Все компоненты готовы! Запуск приложения с защитой от падений...');
console.log('====================================================================\n');

let isManualExit = false;
let restartCount = 0;
let lastRestartTime = Date.now();

function startApp() {
  const child = spawn('node', [backendDist], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'production',
    },
  });

  child.on('close', (code, signal) => {
    if (isManualExit) {
      process.exit(code || 0);
      return;
    }

    const now = Date.now();
    if (now - lastRestartTime > 60000) {
      restartCount = 0;
    }
    restartCount++;
    lastRestartTime = now;

    if (restartCount > 10) {
      console.error('\n💥 [SUPERVISOR] Слишком много аварийных перезапусков (>10 за минуту). Пауза 15 секунд...');
      setTimeout(startApp, 15000);
      return;
    }

    console.warn(`\n⚠️ [SUPERVISOR] Процесс бота завершился (код: ${code}, сигнал: ${signal || 'none'}).`);
    console.log(`🔄 [SUPERVISOR] Автоматический перезапуск через 2 секунды (перезапуск #${restartCount})...\n`);
    setTimeout(startApp, 2000);
  });

  // Обработка прерываний (Ctrl+C)
  const handleExit = (sig) => {
    isManualExit = true;
    try {
      child.kill(sig);
    } catch (e) {}
    process.exit(0);
  };

  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');
  process.on('SIGINT', () => handleExit('SIGINT'));
  process.on('SIGTERM', () => handleExit('SIGTERM'));
}

startApp();
