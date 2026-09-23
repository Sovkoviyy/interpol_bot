import prisma from '../../../database/client';

export class ProfileService {
  /**
   * Get or create a user profile for a guild member
   */
  static async getOrCreateProfile(guildId: string, userId: string, userTag?: string) {
    let profile = await prisma.userProfile.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          guildId,
          userId,
          userTag: userTag || 'User',
          rank: 1,
        },
      });
    } else if (userTag && profile.userTag !== userTag) {
      profile = await prisma.userProfile.update({
        where: { id: profile.id },
        data: { userTag },
      });
    }

    return profile;
  }

  /**
   * Bind Majestic Static ID and in-game nickname
   */
  static async setStatic(guildId: string, userId: string, staticId: string, characterName?: string, userTag?: string) {
    const profile = await this.getOrCreateProfile(guildId, userId, userTag);
    return await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        staticId: staticId.trim(),
        characterName: characterName?.trim() || profile.characterName,
      },
    });
  }

  /**
   * Add penalty MPs (adds required MPs before promotion)
   */
  static async addPenaltyMp(guildId: string, userId: string, count: number, reason?: string) {
    const profile = await this.getOrCreateProfile(guildId, userId);
    const updated = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        penaltyMp: { increment: count },
        notes: reason ? `${profile.notes ? profile.notes + '\n' : ''}[Штраф +${count} МП]: ${reason}` : profile.notes,
      },
    });

    // Also update any active AcademyChannel for this user
    await prisma.academyChannel.updateMany({
      where: { guildId, userId, status: 'ACTIVE' },
      data: {
        penaltyMp: { increment: count },
      },
    });

    return updated;
  }

  /**
   * Increment verified MP count
   */
  static async incrementMp(guildId: string, userId: string, count = 1) {
    const profile = await this.getOrCreateProfile(guildId, userId);
    return await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        mpCount: { increment: count },
      },
    });
  }

  /**
   * Add voice seconds from MP sessions
   */
  static async addVoiceSeconds(guildId: string, userId: string, seconds: number) {
    const profile = await this.getOrCreateProfile(guildId, userId);
    return await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        voiceSeconds: { increment: seconds },
      },
    });
  }

  /**
   * Get top members leaderboard by MP count
   */
  static async getTopByMp(guildId: string, limit = 15) {
    return await prisma.userProfile.findMany({
      where: { guildId },
      orderBy: { mpCount: 'desc' },
      take: limit,
    });
  }

  /**
   * Get top members leaderboard by voice time
   */
  static async getTopByVoice(guildId: string, limit = 15) {
    return await prisma.userProfile.findMany({
      where: { guildId },
      orderBy: { voiceSeconds: 'desc' },
      take: limit,
    });
  }

  /**
   * Search profiles by static ID, Discord tag, or name
   */
  static async searchProfiles(guildId: string, query: string) {
    const q = query.trim();
    return await prisma.userProfile.findMany({
      where: {
        guildId,
        OR: [
          { staticId: { contains: q } },
          { userTag: { contains: q } },
          { characterName: { contains: q } },
          { userId: { contains: q } },
        ],
      },
      take: 20,
    });
  }
}
