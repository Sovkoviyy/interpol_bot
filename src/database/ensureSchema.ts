import prisma from './client';

export async function ensureDatabaseSchema(): Promise<void> {
  try {
    // 1. Check RecruiterSalaryConfig
    const salaryColumns = (await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info("RecruiterSalaryConfig")`
    ).catch(() => [])) as Array<{ name: string }>;

    if (salaryColumns && salaryColumns.length > 0) {
      const colNames = new Set(salaryColumns.map((c) => c.name));

      if (!colNames.has('lastResetAt')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "RecruiterSalaryConfig" ADD COLUMN "lastResetAt" DATETIME;`
        );
        console.log('✅ [DB Self-Heal] Added column "lastResetAt" to RecruiterSalaryConfig');
      }

      if (!colNames.has('recruiterResetsJson')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "RecruiterSalaryConfig" ADD COLUMN "recruiterResetsJson" TEXT NOT NULL DEFAULT '{}';`
        );
        console.log('✅ [DB Self-Heal] Added column "recruiterResetsJson" to RecruiterSalaryConfig');
      }
    }

    // 2. Check GuildConfig
    const guildColumns = (await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info("GuildConfig")`
    ).catch(() => [])) as Array<{ name: string }>;

    if (guildColumns.length > 0) {
      const colNames = new Set(guildColumns.map((c) => c.name));

      if (!colNames.has('eventRoleHierarchyJson')) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "GuildConfig" ADD COLUMN "eventRoleHierarchyJson" TEXT DEFAULT '[]';`
        );
        console.log('✅ [DB Self-Heal] Added column "eventRoleHierarchyJson" to GuildConfig');
      }
    }

    // 3. Ensure ManualNicknameLock table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ManualNicknameLock" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "guildId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "userTag" TEXT,
        "nickname" TEXT NOT NULL,
        "lockedBy" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ManualNicknameLock_guildId_userId_key" 
      ON "ManualNicknameLock"("guildId", "userId");
    `).catch(() => {});

    // 4. Ensure HoneypotConfig table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HoneypotConfig" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
        "guildId" TEXT,
        "channelId" TEXT,
        "channelName" TEXT NOT NULL DEFAULT 'канал-ловушка',
        "messageId" TEXT,
        "enabled" BOOLEAN NOT NULL DEFAULT 1,
        "action" TEXT NOT NULL DEFAULT 'KICK',
        "deleteSeconds" INTEGER NOT NULL DEFAULT 600,
        "totalCaught" INTEGER NOT NULL DEFAULT 0,
        "whitelistRoles" TEXT NOT NULL DEFAULT '[]',
        "embedTitle" TEXT NOT NULL DEFAULT '🛡️ Канал-ловушка автомодерации',
        "embedDescription" TEXT NOT NULL DEFAULT '⚠️ **НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ**\n\nЭтот канал используется для выявления спам-ботов.\nЛюбое сообщение здесь приведёт к немедленной блокировке.',
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    // 5. Ensure HoneypotLog table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "HoneypotLog" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "guildId" TEXT,
        "userId" TEXT NOT NULL,
        "userTag" TEXT NOT NULL,
        "userAvatar" TEXT,
        "actionTaken" TEXT NOT NULL DEFAULT 'KICK',
        "messageContent" TEXT,
        "caughtAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    // 6. Ensure BotActivityConfig table exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BotActivityConfig" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
        "enabled" BOOLEAN NOT NULL DEFAULT 1,
        "status" TEXT NOT NULL DEFAULT 'online',
        "mode" TEXT NOT NULL DEFAULT 'STATIC',
        "rotationInterval" INTEGER NOT NULL DEFAULT 30,
        "activityType" TEXT NOT NULL DEFAULT 'PLAYING',
        "activityName" TEXT NOT NULL DEFAULT 'Majestic RP • Dallas',
        "activityState" TEXT DEFAULT 'Семья INTERPOL • {members} бойцов',
        "streamingUrl" TEXT DEFAULT 'https://twitch.tv/interpol',
        "activitiesJson" TEXT NOT NULL DEFAULT '[]',
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `).catch(() => {});

    console.log('✅ [DB Self-Heal] Database schema verified and in sync.');
  } catch (err: any) {
    console.warn('⚠️ [DB Self-Heal Warning]:', err?.message || err);
  }
}
