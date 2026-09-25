import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import prisma from '../../../database/client';
import bot from '../../client';
import { NicknameService } from '../nicknames/nicknameService';

export class ProfileService {
  /**
   * Get or create a user profile for a guild member
   */
  static async getOrCreateProfile(guildId: string, userId: string, userTag?: string) {
    let profile = await prisma.userProfile.findUnique({
      where: { guildId_userId: { guildId, userId } },
      include: { characters: { orderBy: { createdAt: 'asc' } } },
    });

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: {
          guildId,
          userId,
          userTag: userTag || 'User',
          rank: 1,
        },
        include: { characters: true },
      });
    } else if (userTag && profile.userTag !== userTag) {
      profile = await prisma.userProfile.update({
        where: { id: profile.id },
        data: { userTag },
        include: { characters: { orderBy: { createdAt: 'asc' } } },
      });
    }

    return profile;
  }

  /**
   * Bind Majestic Static ID and in-game nickname (supports up to 3 characters, automatically handles main)
   */
  static async setStatic(guildId: string, userId: string, staticId: string, characterName?: string, userTag?: string, setAsMain = true) {
    const profile = await this.getOrCreateProfile(guildId, userId, userTag);
    const cleanStatic = staticId.trim();
    const cleanNick = characterName?.trim() || null;

    // Check existing characters
    const existingChars = await prisma.userCharacter.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'asc' },
    });

    let matchedChar = existingChars.find(c => c.staticId === cleanStatic);

    if (matchedChar) {
      // Update existing character
      await prisma.userCharacter.update({
        where: { id: matchedChar.id },
        data: {
          characterName: cleanNick || matchedChar.characterName,
          isMain: setAsMain ? true : matchedChar.isMain,
        },
      });
    } else {
      // If we already have 3 characters and adding a new one, update the 3rd or non-main
      if (existingChars.length >= 3) {
        const charToReplace = existingChars.find(c => !c.isMain) || existingChars[existingChars.length - 1];
        await prisma.userCharacter.update({
          where: { id: charToReplace.id },
          data: {
            staticId: cleanStatic,
            characterName: cleanNick,
            isMain: setAsMain,
          },
        });
      } else {
        // Create new character
        const shouldBeMain = setAsMain || existingChars.length === 0;
        await prisma.userCharacter.create({
          data: {
            profileId: profile.id,
            staticId: cleanStatic,
            characterName: cleanNick,
            isMain: shouldBeMain,
          },
        });
      }
    }

    // If this character is designated as main, ensure others are isMain = false
    if (setAsMain) {
      await prisma.userCharacter.updateMany({
        where: {
          profileId: profile.id,
          staticId: { not: cleanStatic },
        },
        data: { isMain: false },
      });
    }

    // Refresh and sync to UserProfile
    const updatedChars = await prisma.userCharacter.findMany({
      where: { profileId: profile.id },
    });
    const mainChar = updatedChars.find(c => c.isMain) || updatedChars[0];

    const updatedProfile = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        staticId: mainChar?.staticId || cleanStatic,
        characterName: mainChar?.characterName || cleanNick || profile.characterName,
      },
      include: { characters: { orderBy: { createdAt: 'asc' } } },
    });

    return updatedProfile;
  }

  /**
   * Set which character is main
   */
  static async setMainCharacter(guildId: string, userId: string, staticOrCharId: string) {
    const profile = await this.getOrCreateProfile(guildId, userId);
    const chars = await prisma.userCharacter.findMany({
      where: { profileId: profile.id },
    });

    const targetChar = chars.find(c => c.id === staticOrCharId || c.staticId === staticOrCharId);
    if (!targetChar) throw new Error('Персонаж со статиком не найден в профиле');

    await prisma.userCharacter.updateMany({
      where: { profileId: profile.id },
      data: { isMain: false },
    });

    await prisma.userCharacter.update({
      where: { id: targetChar.id },
      data: { isMain: true },
    });

    const updatedProfile = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        staticId: targetChar.staticId,
        characterName: targetChar.characterName || profile.characterName,
      },
      include: { characters: { orderBy: { createdAt: 'asc' } } },
    });

    // Auto-sync nickname in Discord
    try {
      const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          await NicknameService.syncMemberNickname(member, 'Смена основного персонажа').catch(() => null);
        }
      }
    } catch {}

    return updatedProfile;
  }

  /**
   * Replace or sync all characters (up to 3) for a member
   */
  static async syncCharacters(guildId: string, userId: string, charactersList: { staticId: string; characterName?: string; isMain?: boolean }[]) {
    const profile = await this.getOrCreateProfile(guildId, userId);
    
    // Delete existing characters and recreate clean
    await prisma.userCharacter.deleteMany({
      where: { profileId: profile.id },
    });

    const sliceList = charactersList.slice(0, 3).filter(c => c.staticId && c.staticId.trim() !== '');
    if (sliceList.length > 0 && !sliceList.some(c => c.isMain)) {
      sliceList[0].isMain = true;
    }

    for (const c of sliceList) {
      await prisma.userCharacter.create({
        data: {
          profileId: profile.id,
          staticId: c.staticId.trim(),
          characterName: c.characterName?.trim() || null,
          isMain: Boolean(c.isMain),
        },
      });
    }

    const mainChar = sliceList.find(c => c.isMain) || sliceList[0];

    const updatedProfile = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        staticId: mainChar ? mainChar.staticId.trim() : null,
        characterName: mainChar ? (mainChar.characterName?.trim() || null) : null,
      },
      include: { characters: { orderBy: { createdAt: 'asc' } } },
    });

    // Auto-sync nickname in Discord
    try {
      const guild = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
      if (guild) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) {
          await NicknameService.syncMemberNickname(member, 'Обновление данных профиля').catch(() => null);
        }
      }
    } catch {}

    return updatedProfile;
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
      include: { characters: true },
    });

    // Also update any active AcademyChannel for this user
    await prisma.academyChannel.updateMany({
      where: { guildId, userId, status: 'ACTIVE' },
      data: {
        penaltyMp: { increment: count },
      },
    });

    try {
      const { AcademyService } = await import('../academy/academyService');
      const activeChannels = await prisma.academyChannel.findMany({
        where: { guildId, userId, status: 'ACTIVE' },
      });
      const g = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
      if (g) {
        for (const ac of activeChannels) {
          const ch = (g.channels.cache.get(ac.channelId) || await g.channels.fetch(ac.channelId).catch(() => null)) as any;
          if (ch && ch.isTextBased()) {
            await AcademyService.refreshStatusMessage(ch, ac.id);
          }
        }
      }
    } catch {}

    return updated;
  }

  /**
   * Remove penalty MPs (down to 0 minimum)
   */
  static async removePenaltyMp(guildId: string, userId: string, count: number, reason?: string) {
    const profile = await this.getOrCreateProfile(guildId, userId);
    const currentPenalty = profile.penaltyMp || 0;
    const newPenalty = Math.max(0, currentPenalty - count);
    const removedCount = currentPenalty - newPenalty;

    const updated = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        penaltyMp: newPenalty,
        notes: reason ? `${profile.notes ? profile.notes + '\n' : ''}[Снят штраф -${removedCount} МП]: ${reason}` : profile.notes,
      },
      include: { characters: true },
    });

    // Also update active AcademyChannels
    const activeChannels = await prisma.academyChannel.findMany({
      where: { guildId, userId, status: 'ACTIVE' },
    });

    for (const ac of activeChannels) {
      const updatedAcPenalty = Math.max(0, (ac.penaltyMp || 0) - removedCount);
      await prisma.academyChannel.update({
        where: { id: ac.id },
        data: { penaltyMp: updatedAcPenalty },
      });
    }

    try {
      const { AcademyService } = await import('../academy/academyService');
      const g = bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
      if (g) {
        for (const ac of activeChannels) {
          const ch = (g.channels.cache.get(ac.channelId) || await g.channels.fetch(ac.channelId).catch(() => null)) as any;
          if (ch && ch.isTextBased()) {
            await AcademyService.refreshStatusMessage(ch, ac.id);
          }
        }
      }
    } catch {}

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
          { characters: { some: { staticId: { contains: q } } } },
          { characters: { some: { characterName: { contains: q } } } },
        ],
      },
      include: {
        characters: { orderBy: { createdAt: 'asc' } },
      },
      take: 50,
    });
  }

  /**
   * Deploy interactive button panel in a Discord channel to let members bind their static ID
   */
  static async deployStaticBindingPanel(channel: TextChannel) {
    const embed = new EmbedBuilder()
      .setColor(0xEC4899)
      .setTitle('🆔 Привязка Majestic Static ID | Семья INTERPOL')
      .setDescription(
        'Каждый участник и академик семьи должен привязать свой внутриигровой Static ID и никнейм персонажа.\n\n' +
        '**Зачем это нужно:**\n' +
        '• Учет посещения мероприятий (МП, дропы, цеха, ВЗМ)\n' +
        '• Сдача отчетов и повышение со 2 ранга\n' +
        '• Личная статистика и отображение в топе актива семьи\n\n' +
        '👇 Нажмите кнопку ниже, чтобы ввести свой Static ID:'
      )
      .setFooter({ text: 'INTERPOL Majestic RP • Привязка профиля' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_bind_static')
        .setLabel('🆔 Привязать статик')
        .setStyle(ButtonStyle.Success)
    );

    return await channel.send({ embeds: [embed], components: [row] });
  }
}

