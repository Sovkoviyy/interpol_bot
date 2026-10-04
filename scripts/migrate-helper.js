#!/usr/bin/env node

/**
 * ====================================================================
 * INTERPOL BOT • Помощник миграции и диагностики базы данных
 * ====================================================================
 * Команды:
 *   node scripts/migrate-helper.js check    - Проверить БД, подсчитать записи и сверить GUILD_ID
 *   node scripts/migrate-helper.js export   - Сделать архив для переноса на новый VPS (.env + БД)
 *   node scripts/migrate-helper.js import   - Развернуть архив на новом VPS и накатить схему v6
 *   node scripts/migrate-helper.js fix      - Автоматически синхронизировать пути и конфиг базы
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PRISMA_DIR = path.join(ROOT_DIR, 'prisma');
const ENV_FILE = path.join(ROOT_DIR, '.env');

function parseEnv() {
  const env = {};
  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[key] = val;
      }
    }
  }
  return env;
}

function resolveDatabasePath(databaseUrl) {
  if (!databaseUrl || !databaseUrl.startsWith('file:')) {
    return path.join(PRISMA_DIR, 'dev.db');
  }
  const rawPath = databaseUrl.replace(/^file:/, '').replace(/^\/\//, '');
  if (path.isAbsolute(rawPath)) return rawPath;
  return path.resolve(PRISMA_DIR, rawPath);
}

function getFileInfo(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.statSync(filePath);
  return {
    path: filePath,
    relPath: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
    bytes: stats.size,
    kb: (stats.size / 1024).toFixed(1),
    mtime: stats.mtime.toLocaleString('ru-RU'),
  };
}

function findDatabaseFiles() {
  const candidates = [
    path.join(PRISMA_DIR, 'data', 'interpol.db'),
    path.join(ROOT_DIR, 'data', 'interpol.db'),
    path.join(PRISMA_DIR, 'interpol.db'),
    path.join(ROOT_DIR, 'interpol.db'),
    path.join(PRISMA_DIR, 'dev.db'),
    path.join(ROOT_DIR, 'dev.db'),
  ];

  // Также сканируем prisma/data/ на любые .db файлы
  const prismaDataDir = path.join(PRISMA_DIR, 'data');
  if (fs.existsSync(prismaDataDir)) {
    try {
      const files = fs.readdirSync(prismaDataDir);
      for (const f of files) {
        if (f.endsWith('.db')) {
          candidates.push(path.join(prismaDataDir, f));
        }
      }
    } catch {}
  }

  const found = new Map();
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      found.set(path.normalize(c), getFileInfo(c));
    }
  }
  return Array.from(found.values());
}

async function runCheck() {
  console.log('\n====================================================================');
  console.log('🔍 [INTERPOL BOT] Диагностика базы данных и конфигурации');
  console.log('====================================================================\n');

  const env = parseEnv();
  const dbUrl = env.DATABASE_URL || 'file:./dev.db';
  const activeDbPath = resolveDatabasePath(dbUrl);
  const activeDbInfo = getFileInfo(activeDbPath);

  console.log('📄 [1] Проверка конфигурации (.env):');
  console.log(`   • Файл .env: ${fs.existsSync(ENV_FILE) ? '✅ Найден' : '❌ ОТСУТСТВУЕТ!'}`);
  console.log(`   • GUILD_ID в .env: ${env.GUILD_ID ? `"${env.GUILD_ID}"` : '❌ НЕ ЗАДАН'}`);
  console.log(`   • DISCORD_TOKEN: ${env.DISCORD_TOKEN ? (env.DISCORD_TOKEN.includes('your_') ? '⚠️ Шаблонный (не заполнен)' : '✅ Задан') : '❌ Отсутствует'}`);
  console.log(`   • DATABASE_URL: "${dbUrl}"`);
  console.log(`   • Активный путь БД (по Prisma): ${activeDbPath}`);

  console.log('\n💾 [2] Поиск файлов баз данных SQLite на диске:');
  const allDbFiles = findDatabaseFiles();

  if (allDbFiles.length === 0) {
    console.log('   ❌ На диске не найдено ни одного файла базы данных SQLite (.db)!');
  } else {
    for (const db of allDbFiles) {
      const isActive = path.normalize(db.path) === path.normalize(activeDbPath);
      const mark = isActive ? '👉 [АКТИВНАЯ В .ENV]' : '   [другая]';
      console.log(`   ${mark} ${db.relPath} (${db.kb} KB, изменен: ${db.mtime})`);
    }
  }

  // Проверка несоответствий путей
  const interpolDbInPrisma = getFileInfo(path.join(PRISMA_DIR, 'data', 'interpol.db'));
  if (interpolDbInPrisma && path.normalize(activeDbPath) !== path.normalize(interpolDbInPrisma.path)) {
    console.log('\n⚠️ ВНИМАНИЕ: Обнаружена база данных по оригинальному пути:');
    console.log(`   prisma/data/interpol.db (${interpolDbInPrisma.kb} KB)`);
    console.log(`   Но в .env указан DATABASE_URL="${dbUrl}"!`);
    console.log(`   👉 Бот может подключаться к пустой базе вместо реальной!`);
    console.log(`   👉 Решение: укажите в .env: DATABASE_URL="file:./data/interpol.db"`);
    console.log(`   Или выполните: node scripts/migrate-helper.js fix`);
  }

  if (activeDbInfo && activeDbInfo.bytes < 40960) {
    // База меньше 40 KB — скорее всего пустая свежесозданная
    const largerDb = allDbFiles.find((d) => d.bytes > 50000);
    if (largerDb) {
      console.log('\n⚠️ ПРЕДУПРЕЖДЕНИЕ: Активная база кажется пустой (<40 KB),');
      console.log(`   но найден другой файл базы с данными: ${largerDb.relPath} (${largerDb.kb} KB)!`);
      console.log(`   Выполните команду авто-исправления: node scripts/migrate-helper.js fix`);
    }
  }

  console.log('\n📊 [3] Подключение через Prisma и подсчет записей...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ log: ['error'] });

    try {
      await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL);');
    } catch {}

    const [
      userProfiles,
      characters,
      guilds,
      payouts,
      salaries,
      blacklists,
      leaves,
      nicknames,
      invites,
    ] = await Promise.all([
      prisma.userProfile.count().catch(() => 0),
      prisma.userCharacter.count().catch(() => 0),
      prisma.guildConfig.count().catch(() => 0),
      prisma.recruiterPayoutRecord.count().catch(() => 0),
      prisma.recruiterSalaryConfig.count().catch(() => 0),
      prisma.blacklistEntry.count().catch(() => 0),
      prisma.leaveRequest.count().catch(() => 0),
      prisma.roleNicknameBinding.count().catch(() => 0),
      prisma.memberInviteTracking.count().catch(() => 0),
    ]);

    console.log(`   👥 Профилей пользователей (UserProfile): ${userProfiles > 0 ? `✅ ${userProfiles}` : '⚪ 0'}`);
    console.log(`   🎮 Персонажей (UserCharacter): ${characters > 0 ? `✅ ${characters}` : '⚪ 0'}`);
    console.log(`   🏰 Серверов (GuildConfig): ${guilds > 0 ? `✅ ${guilds}` : '⚪ 0'}`);
    console.log(`   💰 Записей выплат рекрутерам: ${payouts > 0 ? `✅ ${payouts}` : '⚪ 0'}`);
    console.log(`   ⚙️ Конфигов зарплат рекрутеров: ${salaries > 0 ? `✅ ${salaries}` : '⚪ 0'}`);
    console.log(`   🚫 Записей в черном списке: ${blacklists > 0 ? `✅ ${blacklists}` : '⚪ 0'}`);
    console.log(`   🏖️ Заявок на отпуск: ${leaves > 0 ? `✅ ${leaves}` : '⚪ 0'}`);
    console.log(`   🏷️ Привязок никнеймов: ${nicknames > 0 ? `✅ ${nicknames}` : '⚪ 0'}`);
    console.log(`   📨 Трекинг инвайтов: ${invites > 0 ? `✅ ${invites}` : '⚪ 0'}`);

    // Проверка GuildId
    if (userProfiles > 0) {
      const distinctGuilds = await prisma.userProfile.findMany({
        select: { guildId: true },
        distinct: ['guildId'],
      });
      const foundGuildIds = distinctGuilds.map((g) => g.guildId);
      console.log(`\n🎯 Гильдии в базе данных: ${foundGuildIds.join(', ')}`);

      if (env.GUILD_ID && !foundGuildIds.includes(env.GUILD_ID)) {
        console.log('\n❌ КРИТИЧЕСКОЕ НЕСООТВЕТСТВИЕ GUILD_ID!');
        console.log(`   В файле .env указан GUILD_ID: "${env.GUILD_ID}"`);
        console.log(`   Но профили пользователей привязаны к: "${foundGuildIds.join(', ')}"`);
        console.log(`   ⚠️ Из-за этого расхождения бот и веб-панель не отображают данные пользователей!`);
        console.log(`   👉 Решение: Укажите в .env: GUILD_ID=${foundGuildIds[0]}`);
      } else if (env.GUILD_ID && foundGuildIds.includes(env.GUILD_ID)) {
        console.log(`   ✅ GUILD_ID в .env совпадает с данными в базе!`);
      }
    } else {
      console.log('\n⚠️ В текущей активной базе 0 профилей пользователей.');
      console.log('   Если на старом сервере пользователи были:');
      console.log('   Убедитесь, что скопирован файл /root/interpol_bot/prisma/data/interpol.db');
    }

    await prisma.$disconnect();
  } catch (err) {
    console.error('❌ Ошибка чтения базы данных через Prisma:', err.message);
  }

  console.log('\n====================================================================\n');
}

function runFix() {
  console.log('\n====================================================================');
  console.log('🛠️ [INTERPOL BOT] Автоматическое выравнивание файлов базы данных');
  console.log('====================================================================\n');

  const allDbFiles = findDatabaseFiles();
  if (allDbFiles.length === 0) {
    console.log('❌ Не найдено ни одного файла базы данных SQLite.');
    return;
  }

  // Находим самый большой файл базы (где лежат реальные данные)
  const largestDb = [...allDbFiles].sort((a, b) => b.bytes - a.bytes)[0];
  console.log(`📦 Самый объемный файл базы данных: ${largestDb.relPath} (${largestDb.kb} KB)`);

  // Убеждаемся, что prisma/data создана
  const prismaDataDir = path.join(PRISMA_DIR, 'data');
  fs.mkdirSync(prismaDataDir, { recursive: true });

  const targetInterpolDb = path.join(prismaDataDir, 'interpol.db');
  const targetDevDb = path.join(PRISMA_DIR, 'dev.db');

  if (largestDb.path !== targetInterpolDb) {
    fs.copyFileSync(largestDb.path, targetInterpolDb);
    console.log(`✅ Скопирован ${largestDb.relPath} -> prisma/data/interpol.db`);
  }

  if (largestDb.path !== targetDevDb) {
    fs.copyFileSync(largestDb.path, targetDevDb);
    console.log(`✅ Скопирован ${largestDb.relPath} -> prisma/dev.db (для совместимости)`);
  }

  // Проверяем .env
  if (fs.existsSync(ENV_FILE)) {
    let envContent = fs.readFileSync(ENV_FILE, 'utf-8');
    if (!envContent.includes('file:./data/interpol.db')) {
      if (envContent.includes('DATABASE_URL=')) {
        envContent = envContent.replace(/DATABASE_URL=["'][^"']*["']/g, 'DATABASE_URL="file:./data/interpol.db"');
        envContent = envContent.replace(/DATABASE_URL=[^\r\n]*/g, 'DATABASE_URL="file:./data/interpol.db"');
      } else {
        envContent += '\nDATABASE_URL="file:./data/interpol.db"\n';
      }
      fs.writeFileSync(ENV_FILE, envContent, 'utf-8');
      console.log('✅ В файле .env установлен DATABASE_URL="file:./data/interpol.db"');
    }
  }

  console.log('\n🎉 Выравнивание завершено! Проверяю базу:');
  runCheck();
}

async function runExport() {
  console.log('\n====================================================================');
  console.log('📦 [INTERPOL BOT] Создание полного архива для переноса на новый VPS');
  console.log('====================================================================\n');

  // Сброс SQLite WAL перед архивацией
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ log: ['error'] });
    await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL);');
    await prisma.$disconnect();
    console.log('✅ SQLite WAL успешно сброшен в файлы базы.');
  } catch (e) {
    console.log('ℹ️ WAL сброс пропущен или не требуется.');
  }

  const exportDir = path.join(ROOT_DIR, 'migration_export');
  if (fs.existsSync(exportDir)) {
    fs.rmSync(exportDir, { recursive: true, force: true });
  }

  // Создаем папки
  fs.mkdirSync(path.join(exportDir, 'prisma', 'data'), { recursive: true });

  // 1. Копируем .env
  if (fs.existsSync(ENV_FILE)) {
    fs.copyFileSync(ENV_FILE, path.join(exportDir, '.env'));
    console.log('✅ Конфигурация .env добавлена в архив.');
  } else {
    console.warn('⚠️ Внимание: файл .env не найден в корне!');
  }

  // 2. Ищем и копируем все базы данных и журналы
  const allDbFiles = findDatabaseFiles();
  let dbCopied = 0;

  for (const db of allDbFiles) {
    const rel = db.relPath;
    const dest = path.join(exportDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(db.path, dest);
    console.log(`✅ База данных ${rel} (${db.kb} KB) добавлена в архив.`);
    dbCopied++;

    // Проверяем сопутствующие wal / shm / journal
    for (const ext of ['-wal', '-shm', '-journal']) {
      const companion = db.path + ext;
      if (fs.existsSync(companion)) {
        fs.copyFileSync(companion, dest + ext);
        console.log(`   ➕ Сопутствующий файл ${path.basename(companion)} добавлен.`);
      }
    }
  }

  if (dbCopied === 0) {
    console.error('❌ ОШИБКА: На сервере не найдено ни одного файла базы данных SQLite!');
    return;
  }

  const archiveName = 'interpol_vps_data.tar.gz';
  const archivePath = path.join(ROOT_DIR, archiveName);

  try {
    execSync(`tar -czf "${archivePath}" -C "${exportDir}" .`, { stdio: 'inherit' });
    fs.rmSync(exportDir, { recursive: true, force: true });
    const archiveSize = getFileInfo(archivePath);
    console.log(`\n🎉 Архив успешно создан: ${archiveName} (${archiveSize.kb} KB)!`);
    console.log('\n👉 Чтобы перенести данные на новый VPS, выполните на старом сервере:');
    console.log(`   scp ${archiveName} root@<НОВЫЙ_VPS_IP>:/root/interpol_bot/`);
    console.log('\n👉 Затем на новом сервере в папке /root/interpol_bot выполните:');
    console.log(`   node scripts/migrate-helper.js import`);
  } catch (err) {
    console.log('\nℹ️ Утилита tar недоступна. Папка с файлами сохранена:');
    console.log(`   ${exportDir}`);
  }
}

async function runImport() {
  console.log('\n====================================================================');
  console.log('📥 [INTERPOL BOT] Восстановление данных на новом VPS');
  console.log('====================================================================\n');

  const archiveName = 'interpol_vps_data.tar.gz';
  const archivePath = path.join(ROOT_DIR, archiveName);

  if (fs.existsSync(archivePath)) {
    console.log(`📦 Найден архив ${archiveName}, распаковываю...`);
    try {
      execSync(`tar -xzf "${archivePath}" -C "${ROOT_DIR}"`, { stdio: 'inherit' });
      console.log('✅ Архив успешно распакован.');
    } catch (e) {
      console.error('❌ Ошибка распаковки архива:', e.message);
    }
  }

  // Запускаем авто-выравнивание путей
  runFix();

  // Применяем схему Prisma v6
  console.log('\n⚙️ Синхронизация структуры БД со схемой v6...');
  try {
    execSync('npx prisma generate', { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('npx prisma db push --accept-data-loss', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('✅ Структура базы данных успешно синхронизирована с v6!');
  } catch (e) {
    console.error('⚠️ Ошибка выполнения prisma db push:', e.message);
  }

  console.log('\n🎉 Импорт завершен! Теперь вы можете перезапустить бота:');
  console.log('   npm run build && (pm2 restart interpol_bot || node start.js)');
}

const action = process.argv[2] || 'check';

switch (action) {
  case 'check':
    runCheck();
    break;
  case 'fix':
    runFix();
    break;
  case 'export':
    runExport();
    break;
  case 'import':
    runImport();
    break;
  default:
    console.log(`Неизвестное действие: ${action}`);
    console.log('Доступно: check | fix | export | import');
}
