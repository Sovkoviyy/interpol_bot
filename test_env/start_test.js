#!/usr/bin/env node

/**
 * ====================================================================
 *  INTERPOL BOT • Интерактивный запуск тестового окружения
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync, spawn } = require('child_process');

const TEST_DIR = __dirname;
const ROOT_DIR = path.resolve(TEST_DIR, '..');
const ENV_FILE = path.join(TEST_DIR, '.env');

console.log('====================================================================');
console.log('🧪 [INTERPOL BOT] ТЕСТОВОЕ ОКРУЖЕНИЕ (ИЗОЛИРОВАННАЯ ПЕСОЧНИЦА)');
console.log('====================================================================');
console.log('• Отдельная база данных: test_env/test.db');
console.log('• Отдельный файл конфигурации: test_env/.env\n');

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// Загрузка существующих значений из .env
function loadCurrentEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const k = trimmed.slice(0, idx).trim();
          let v = trimmed.slice(idx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          env[k] = v;
        }
      }
    }
  }
  return env;
}

async function configureEnv() {
  const current = loadCurrentEnv();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  if (fs.existsSync(ENV_FILE) && current.DISCORD_TOKEN) {
    const maskedToken = current.DISCORD_TOKEN.slice(0, 8) + '...' + current.DISCORD_TOKEN.slice(-4);
    console.log(`[i] Найдена сохраненная конфигурация (Токен: ${maskedToken}, Guild: ${current.GUILD_ID || 'не указан'})`);
    const reconfig = await ask(rl, 'Хотите изменить эти настройки? (y/N, Enter = оставить): ');
    if (reconfig.trim().toLowerCase() !== 'y') {
      rl.close();
      return current;
    }
  }

  console.log('\n--------------------------------------------------------------------');
  console.log('Введите данные вашего тестового Discord-бота (нажмите Enter для сохранения):');
  console.log('--------------------------------------------------------------------');

  const token = (await ask(rl, `1. DISCORD_TOKEN (токен бота)${current.DISCORD_TOKEN ? ` [${current.DISCORD_TOKEN.slice(0, 6)}...]` : ''}: `)).trim() || current.DISCORD_TOKEN || '';
  const clientId = (await ask(rl, `2. CLIENT_ID (Application ID)${current.CLIENT_ID ? ` [${current.CLIENT_ID}]` : ''}: `)).trim() || current.CLIENT_ID || '';
  const clientSecret = (await ask(rl, `3. CLIENT_SECRET (секрет приложения)${current.CLIENT_SECRET ? ` [${current.CLIENT_SECRET.slice(0, 4)}...]` : ''}: `)).trim() || current.CLIENT_SECRET || '';
  const guildId = (await ask(rl, `4. GUILD_ID (ID тестового сервера Discord)${current.GUILD_ID ? ` [${current.GUILD_ID}]` : ''}: `)).trim() || current.GUILD_ID || '';
  const port = (await ask(rl, `5. Порт веб-панели [${current.PORT || '3001'}]: `)).trim() || current.PORT || '3001';

  rl.close();

  const newEnvContent = [
    '# Discord Bot Test Configuration',
    `DISCORD_TOKEN=${token}`,
    `CLIENT_ID=${clientId}`,
    `CLIENT_SECRET=${clientSecret}`,
    `GUILD_ID=${guildId}`,
    '',
    '# Web Configuration',
    `PORT=${port}`,
    'JWT_SECRET=interpol_test_jwt_secret_key_12345',
    'FRONTEND_URL=http://localhost:5173',
    `DISCORD_REDIRECT_URI=http://localhost:${port}/api/auth/callback`,
    '',
    '# Test Database (Isolated)',
    'DATABASE_URL="file:./test.db"',
    '',
  ].join('\n');

  fs.writeFileSync(ENV_FILE, newEnvContent, 'utf-8');
  console.log('\n✅ [УСПЕХ] Файл test_env/.env сохранен!\n');

  return {
    DISCORD_TOKEN: token,
    CLIENT_ID: clientId,
    CLIENT_SECRET: clientSecret,
    GUILD_ID: guildId,
    PORT: port,
  };
}

async function main() {
  const envConfig = await configureEnv();
  const serverPort = envConfig.PORT || '3001';

  // 1. Проверка cloudflared.exe
  let cfExe = path.join(ROOT_DIR, 'cloudflared.exe');
  if (!fs.existsSync(cfExe)) {
    cfExe = path.join(TEST_DIR, 'cloudflared.exe');
  }

  if (!fs.existsSync(cfExe)) {
    console.log('📦 [1/4] Скачивание Cloudflare Tunnel CLI (cloudflared.exe)...');
    try {
      execSync(`curl.exe -L -o "${cfExe}" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe`, {
        stdio: 'inherit',
      });
      console.log('✅ cloudflared.exe загружен!');
    } catch {
      console.error('❌ Не удалось скачать cloudflared.exe');
    }
  } else {
    console.log('✅ [1/4] cloudflared.exe найден.');
  }

  // 2. Проверка сборки фронтенда
  const webDist = path.join(ROOT_DIR, 'web', 'dist', 'index.html');
  if (!fs.existsSync(webDist)) {
    console.log('\n🔨 [2/4] Сборка веб-панели React...');
    execSync('npm run build', { cwd: path.join(ROOT_DIR, 'web'), stdio: 'inherit', shell: true });
  } else {
    console.log('✅ [2/4] Веб-панель готова.');
  }

  // 3. Синхронизация тестовой БД
  console.log('\n📦 [3/4] Инициализация тестовой базы данных SQLite (test_env/test.db)...');
  try {
    const schemaPath = path.join(ROOT_DIR, 'prisma', 'schema.prisma');
    execSync(`npx prisma db push --schema="${schemaPath}"`, {
      cwd: TEST_DIR,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        DATABASE_URL: 'file:./test.db',
      },
    });
  } catch (e) {
    console.error('❌ Ошибка инициализации test.db');
  }

  // Сборка бэкенда
  const backendDist = path.join(ROOT_DIR, 'dist', 'index.js');
  if (!fs.existsSync(backendDist)) {
    console.log('🔨 Сборка TypeScript бэкенда...');
    execSync('npm run build:server', { cwd: ROOT_DIR, stdio: 'inherit', shell: true });
  }

  // 4. Запуск тестового бота и сервера в отдельном окне
  console.log('\n====================================================================');
  console.log('🚀 [4/4] Запуск тестового бота и Cloudflare Tunnel...');
  console.log('====================================================================');
  console.log('• Бот и сервер запущены в отдельном окне.');
  console.log('• Ниже будет выведена публичная ссылка Cloudflare:\n');

  if (process.platform === 'win32') {
    // Windows: запуск в отдельном cmd окне
    const startCmd = `start "INTERPOL BOT [ТЕСТОВОЕ ОКРУЖЕНИЕ]" cmd /k "cd /d "${TEST_DIR}" && set ENV_FILE=${ENV_FILE} && node "${backendDist}""`;
    execSync(startCmd, { shell: true });
  } else {
    // Linux
    spawn('node', [backendDist], {
      cwd: TEST_DIR,
      stdio: 'inherit',
      env: {
        ...process.env,
        ENV_FILE,
      },
    });
  }

  // Запуск Cloudflare туннеля в текущем окне консоли
  if (fs.existsSync(cfExe)) {
    const cf = spawn(`"${cfExe}"`, ['tunnel', '--url', `http://localhost:${serverPort}`], {
      stdio: 'inherit',
      shell: true,
    });

    cf.on('close', (code) => {
      process.exit(code || 0);
    });
  } else {
    console.log(`\nВеб-панель доступна локально: http://localhost:${serverPort}`);
  }
}

main().catch(console.error);
