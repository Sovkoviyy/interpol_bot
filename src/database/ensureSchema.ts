import prisma from './client';

export async function ensureDatabaseSchema(): Promise<void> {
  try {
    // 1. Check RecruiterSalaryConfig
    const salaryColumns: Array<{ name: string }> = await prisma.$queryRawUnsafe(
      `PRAGMA table_info("RecruiterSalaryConfig")`
    ).catch(() => []);

    if (salaryColumns.length > 0) {
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
    const guildColumns: Array<{ name: string }> = await prisma.$queryRawUnsafe(
      `PRAGMA table_info("GuildConfig")`
    ).catch(() => []);

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

    console.log('✅ [DB Self-Heal] Database schema verified and in sync.');
  } catch (err: any) {
    console.warn('⚠️ [DB Self-Heal Warning]:', err?.message || err);
  }
}
