import prisma from '../../../database/client';

export class BlacklistService {
  /**
   * Check if a static ID or Discord ID is in blacklist
   */
  static async isBlacklisted(guildId: string, staticId?: string | null, discordId?: string | null) {
    if (!staticId && !discordId) return null;

    const conditions: any[] = [];
    if (staticId) conditions.push({ staticId: staticId.trim() });
    if (discordId) conditions.push({ discordId: discordId.trim() });

    return await prisma.blacklistEntry.findFirst({
      where: {
        guildId,
        OR: conditions,
      },
    });
  }

  /**
   * Add a person to the blacklist
   */
  static async addEntry(
    guildId: string,
    data: {
      staticId?: string;
      discordId?: string;
      name?: string;
      reason: string;
      proofUrl?: string;
      addedById: string;
      addedByTag?: string;
    }
  ) {
    const entry = await prisma.blacklistEntry.create({
      data: {
        guildId,
        staticId: data.staticId?.trim() || null,
        discordId: data.discordId?.trim() || null,
        name: data.name?.trim() || 'Unknown',
        reason: data.reason,
        proofUrl: data.proofUrl || null,
        addedById: data.addedById,
        addedByTag: data.addedByTag || data.addedById,
      },
    });

    // If discordId is given, mark their profile as BLACKLISTED
    if (data.discordId) {
      await prisma.userProfile.updateMany({
        where: { guildId, userId: data.discordId },
        data: { status: 'BLACKLISTED', notes: `ЧС: ${data.reason}` },
      });
    }

    return entry;
  }

  /**
   * Remove an entry from blacklist
   */
  static async removeEntry(guildId: string, id: string) {
    const entry = await prisma.blacklistEntry.findUnique({ where: { id } });
    if (!entry) throw new Error('Запись в ЧС не найдена');

    await prisma.blacklistEntry.delete({ where: { id } });

    if (entry.discordId) {
      await prisma.userProfile.updateMany({
        where: { guildId, userId: entry.discordId, status: 'BLACKLISTED' },
        data: { status: 'ACTIVE' },
      });
    }

    return entry;
  }

  /**
   * List all blacklist entries
   */
  static async listEntries(guildId: string, search?: string) {
    const q = search?.trim();
    return await prisma.blacklistEntry.findMany({
      where: {
        guildId,
        ...(q
          ? {
              OR: [
                { staticId: { contains: q } },
                { discordId: { contains: q } },
                { name: { contains: q } },
                { reason: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
