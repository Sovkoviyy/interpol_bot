#!/usr/bin/env node

/**
 * ====================================================================
 * INTERPOL BOT • Помощник миграции и диагностики базы данных
 * ====================================================================
 * Команды:
 *   node scripts/migrate-helper.js check    - Проверить БД, подсчитать записи и сверить GUILD_ID
 *   node scripts/migrate-helper.js export   - Сделать архив для переноса на новый VPS (.env + dev.db)
 *   node scripts/migrate-helper.js import   - Развернуть архив на новом VPS и накатить схему v6
 *   node scripts/migrate-helper.js sync     - Синхронизировать dev.db между корнем и prisma/
 * ====================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PRISMA_DIR = path.join(ROOT_DIR, 'prisma');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const ROOT_DB = path.join(ROOT_DIR, 'dev.db');
const PRISMA_DB = path.join(PRISMA_DIR, 'dev.db');

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

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.statSync(filePath);
  return {
    bytes: stats.size,
    kb: (stats.size / 1024).toFixed(1),
    mtime: stats.mtime.toLocaleString('ru-RU'),
  };
}

async function runCheck() {
  console.log('\n====================================================================');
  console.log('🔍 [INTERPOL BOT] Диагностика базы данных и конфигурации');
  console.log('====================================================================\n');

  const env = parseEnv();
  console.log('📄 [1] Проверка конфигурации (.env):');
  console.log(`   • Файл .env: ${fs.existsSync(ENV_FILE) ? '✅ Найден' : '❌ ОТСУТСТВУЕТ!'}`);
  console.log(`   • GUILD_ID в .env: ${env.GUILD_ID ? `"${env.GUILD_ID}"` : '❌ НЕ ЗАДАН'}`);
  console.log(`   • DISCORD_TOKEN: ${env.DISCORD_TOKEN ? (env.DISCORD_TOKEN.includes('your_') ? '⚠️ Шаблонный (не заполнен)' : '✅ Задан') : '❌ Отсутствует'}`);
  console.log(`   • DATABASE_URL: ${env.DATABASE_URL || 'file:./dev.db (по умолчанию)'}`);

  console.log('\n💾 [2] Проверка файлов SQLite на диске:');
  const rootDbInfo = getFileSize(ROOT_DB);
  const prismaDbInfo = getFileSize(PRISMA_DB);

  console.log(`   • В корне проекта (dev.db): ${rootDbInfo ? `✅ ${rootDbInfo.kb} KB (изменен: ${rootDbInfo.mtime})` : '⚪ нет файла'}`);
  console.log(`   • В папке prisma (prisma/dev.db): ${prismaDbInfo ? `✅ ${prismaDbInfo.kb} KB (изменен: ${prismaDbInfo.mtime})` : '⚪ нет файла'}`);

  // Проверка журналов WAL
  const rootWal = getFileSize(path.join(ROOT_DIR, 'dev.db-wal'));
  const prismaWal = getFileSize(path.join(PRISMA_DIR, 'dev.db-wal'));
  if (rootWal || prismaWal) {
    console.log(`   ℹ️ Обнаружен SQLite WAL: root=${rootWal ? `${rootWal.kb} KB` : 'нет'}, prisma=${prismaWal ? `${prismaWal.kb} KB` : 'нет'}`);
  }

  // Предупреждение о несоответствии
  if (rootDbInfo && prismaDbInfo) {
    if (Math.abs(rootDbInfo.bytes - prismaDbInfo.bytes) > 1024) {
      console.log('\n⚠️ ВНИМАНИЕ: Файлы dev.db в корне и в prisma/ РАЗНОГО размера!');
      console.log(`   Prisma по умолчанию использует именно prisma/dev.db.`);
      if (rootDbInfo.bytes > prismaDbInfo.bytes) {
        console.log(`   👉 Файл в корне проекта больше (${rootDbInfo.kb} KB > ${prismaDbInfo.kb} KB)! Возможно, данные были скопированы в корень, а не в prisma/.`);
        console.log(`   👉 Выполните команду: node scripts/migrate-helper.js sync`);
      }
    }
  } else if (rootDbInfo && !prismaDbInfo) {
    console.log('\n⚠️ ВНИМАНИЕ: dev.db найден только в корне, но Prisma ожидает prisma/dev.db!');
    console.log(`   👉 Скопируйте файл в prisma/dev.db командой: node scripts/migrate-helper.js sync`);
  }

  console.log('\n📊 [3] Подключение к базе данных и подсчет записей...');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient({ log: ['error'] });

    // Принудительно сбрасываем WAL
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

    // Проверка GuildId в существующих профилях
    if (userProfiles > 0) {
      const distinctGuilds = await prisma.userProfile.findMany({
        select: { guildId: true },
        distinct: ['guildId'],
      });
      const foundGuildIds = distinctGuilds.map((g) => g.guildId);
      console.log(`\n🎯 Гильдии, к которым привязаны профили в базе данных: ${foundGuildIds.join(', ')}`);

      if (env.GUILD_ID && !foundGuildIds.includes(env.GUILD_ID)) {
        console.log('\n❌ КРИТИЧЕСКОЕ НЕСООТВЕТСТВИЕ GUILD_ID!');
        console.log(`   В файле .env указан GUILD_ID: "${env.GUILD_ID}"`);
        console.log(`   Но профили в базе данных привязаны к: "${foundGuildIds.join(', ')}"`);
        console.log(`   ⚠️ Из-за этого бот и сайт ищут пользователей по чужому GUILD_ID и показывают 0!`);
        console.log(`   👉 Решение: Откройте .env и укажите GUILD_ID=${foundGuildIds[0]}`);
      } else if (env.GUILD_ID && foundGuildIds.includes(env.GUILD_ID)) {
        console.log(`   ✅ GUILD_ID в .env совпадает с данными в базе!`);
      }
    } else {
      console.log('\n⚠️ В текущей активной базе 0 профилей пользователей.');
      console.log('   Если на старом сервере пользователи были:');
      console.log('   1. Убедитесь, что вы скопировали dev.db именно со старого сервера.');
      console.log('   2. Файл должен лежать по пути: interpol_bot/prisma/dev.db');
    }

    await prisma.$disconnect();
  } catch (err) {
    console.error('❌ Ошибка чтения базы данных через Prisma:', err.message);
  }

  console.log('\n====================================================================\n');
}

function runSync() {
  console.log('🔄 Синхронизация файлов dev.db между корнем и prisma/ ...');
  const rootDbInfo = getFileSize(ROOT_DB);
  const prismaDbInfo = getFileSize(PRISMA_DB);

  if (!rootDbInfo && !prismaDbInfo) {
    console.log('❌ Ни один файл dev.db не найден.');
    return;
  }

  if (rootDbInfo && (!prismaDbInfo || rootDbInfo.bytes > prismaDbInfo.bytes)) {
    fs.mkdirSync(PRISMA_DIR, { recursive: true });
    fs.copyFileSync(ROOT_DB, PRISMA_DB);
    console.log(`✅ Скопирован ${ROOT_DB} (${rootDbInfo.kb} KB) -> ${PRISMA_DB}`);
  } else if (prismaDbInfo && (!rootDbInfo || prismaDbInfo.bytes > rootDbInfo.bytes)) {
    fs.copyFileSync(PRISMA_DB, ROOT_DB);
    console.log(`✅ Скопирован ${PRISMA_DB} (${prismaDbInfo.kb} KB) -> ${ROOT_DB}`);
  } else {
    console.log('✅ Файлы dev.db в корне и в prisma/ уже идентичны.');
  }
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
    console.log('✅ SQLite WAL успешно сброшен в основной файл dev.db');
  } catch (e) {
    console.log('ℹ️ WAL сброс пропущен или не требуется.');
  }

  // Синхронизируем dev.db
  runSync();

  const exportDir = path.join(ROOT_DIR, 'migration_export');
  if (fs.existsSync(exportDir)) {
    fs.rmSync(exportDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(exportDir, 'prisma'), { recursive: true });

  // Копируем .env
  if (fs.existsSync(ENV_FILE)) {
    fs.copyFileSync(ENV_FILE, path.join(exportDir, '.env'));
    console.log('✅ Конфигурация .env добавлена в архив.');
  } else {
    console.warn('⚠️ Внимание: файл .env не найден!');
  }

  // Копируем dev.db
  let dbFound = false;
  if (fs.existsSync(PRISMA_DB)) {
    fs.copyFileSync(PRISMA_DB, path.join(exportDir, 'prisma', 'dev.db'));
    fs.copyFileSync(PRISMA_DB, path.join(exportDir, 'dev.db'));
    dbFound = true;
    const size = getFileSize(PRISMA_DB);
    console.log(`✅ База данных prisma/dev.db (${size.kb} KB) добавлена в архив.`);
  } else if (fs.existsSync(ROOT_DB)) {
    fs.copyFileSync(ROOT_DB, path.join(exportDir, 'prisma', 'dev.db'));
    fs.copyFileSync(ROOT_DB, path.join(exportDir, 'dev.db'));
    dbFound = true;
    const size = getFileSize(ROOT_DB);
    console.log(`✅ База данных dev.db (${size.kb} KB) добавлена в архив.`);
  }

  if (!dbFound) {
    console.error('❌ ОШИБКА: Файл базы данных dev.db не найден!');
    return;
  }

  const archiveName = 'interpol_vps_data.tar.gz';
  const archivePath = path.join(ROOT_DIR, archiveName);

  try {
    execSync(`tar -czf "${archivePath}" -C "${exportDir}" .`, { stdio: 'inherit' });
    fs.rmSync(exportDir, { recursive: true, force: true });
    const archiveSize = getFileSize(archivePath);
    console.log(`\n🎉 Архив успешно создан: ${archiveName} (${archiveSize.kb} KB)!`);
    console.log('\n👉 Чтобы перенести данные на новый VPS, выполните на старом сервере:');
    console.log(`   scp ${archiveName} root@<НОВЫЙ_VPS_IP>:/путь/к/interpol_bot/`);
    console.log('\n👉 Затем на новом сервере в папке бота выполните:');
    console.log(`   node scripts/migrate-helper.js import`);
  } catch (err) {
    console.log('\nℹ️ Утилита tar не сработала или недоступна. Папка с файлами сохранена:');
    console.log(`   ${exportDir}`);
    console.log('   Скопируйте файлы .env и prisma/dev.db на новый сервер вручную.');
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

  // Синхронизируем dev.db
  runSync();

  // Применяем схему Prisma v6
  console.log('\n⚙️ Синхронизация структуры БД со схемой v6...');
  try {
    execSync('npx prisma generate', { cwd: ROOT_DIR, stdio: 'inherit' });
    execSync('npx prisma db push --accept-data-loss', { cwd: ROOT_DIR, stdio: 'inherit' });
    console.log('✅ Структура базы данных успешно обновлена до v6!');
  } catch (e) {
    console.error('⚠️ Ошибка выполнения prisma db push:', e.message);
  }

  // Запуск проверки
  await runCheck();

  console.log('🎉 Импорт завершен! Теперь вы можете перезапустить бота:');
  console.log('   npm run build && (pm2 restart interpol-bot || node start.js)');
}

const action = process.argv[2] || 'check';

switch (action) {
  case 'check':
    runCheck();
    break;
  case 'sync':
    runSync();
    break;
  case 'export':
    runExport();
    break;
  case 'import':
    runImport();
    break;
  default:
    console.log(`Неизвестное действие: ${action}`);
    console.log('Доступно: check | sync | export | import');
}
