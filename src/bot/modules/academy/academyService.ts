import { 
  Guild, 
  GuildMember, 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  TextChannel,
  Message
} from 'discord.js';
import prisma from '../../../database/client';
import bot from '../../client';
import { ProfileService } from '../profiles/profileService';
import { AuditLogger } from '../logging/auditLogger';
import { RecruitmentService } from '../recruitment/recruitmentService';
import { NicknameService } from '../nicknames/nicknameService';

export class AcademyService {
  /**
   * Get Academy configuration for guild
   */
  static async getConfig(guildId: string) {
    let config = await prisma.academyConfig.findUnique({
      where: { guildId },
    });

    if (!config) {
      config = await prisma.academyConfig.create({
        data: {
          guildId,
          requiredMpForRankUp: 10,
          channelPrefix: 'academ-',
        },
      });
    }

    return config;
  }

  /**
   * Save or update Academy configuration
   */
  static async saveConfig(guildId: string, data: any) {
    return await prisma.academyConfig.upsert({
      where: { guildId },
      update: {
        categoryId: data.categoryId,
        archiveCategoryId: data.archiveCategoryId,
        academicRoleId: data.academicRoleId,
        promotedRoleId: data.promotedRoleId,
        requiredMpForRankUp: parseInt(data.requiredMpForRankUp, 10) || 10,
        channelPrefix: data.channelPrefix || 'academ-',
      },
      create: {
        guildId,
        categoryId: data.categoryId,
        archiveCategoryId: data.archiveCategoryId,
        academicRoleId: data.academicRoleId,
        promotedRoleId: data.promotedRoleId,
        requiredMpForRankUp: parseInt(data.requiredMpForRankUp, 10) || 10,
        channelPrefix: data.channelPrefix || 'academ-',
      },
    });
  }

  /**
   * Create a private academy channel for a new recruit
   */
  static async createAcademyChannel(guild: Guild, member: GuildMember, staticId?: string) {
    const config = await this.getConfig(guild.id);
    const profile = await ProfileService.getOrCreateProfile(guild.id, member.id, member.user.tag);

    const effectiveStatic = staticId || profile.staticId || member.id.slice(-5);
    const cleanStatic = (effectiveStatic || '').toString().replace(/[^\d]/g, '').trim() || member.id.slice(-5);

    // Extract FIRST NAME from full in-game RP name (e.g. "Ivan Ivanov" -> "ivan")
    const rawName = (profile.characterName || member.displayName || member.user.username).trim();
    const parts = rawName.split(/[\s_.-]+/);
    const firstName = parts[0] || 'игрок';
    const cleanFirstName = firstName
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]/gi, '')
      .slice(0, 15) || 'игрок';

    // Channel name strictly format: имя-статик (e.g. ivan-12345)
    const channelName = `${cleanFirstName}-${cleanStatic}`;

    // Ensure category ACADEMY
    let targetCategoryId = config.categoryId;
    if (!targetCategoryId || !guild.channels.cache.has(targetCategoryId)) {
      let cat = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && (c.name.toUpperCase() === 'ACADEMY' || c.name.toUpperCase() === 'АКАДЕМИЯ')
      );
      if (!cat) {
        const catBotId = guild.members.me?.id || bot.user?.id;
        const catOverwrites: any[] = [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ];
        if (catBotId) {
          catOverwrites.push({
            id: catBotId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages],
          });
        }
        cat = await guild.channels.create({
          name: 'ACADEMY',
          type: ChannelType.GuildCategory,
          permissionOverwrites: catOverwrites,
        });
        await prisma.academyConfig.update({
          where: { guildId: guild.id },
          data: { categoryId: cat.id },
        }).catch(() => null);
      }
      targetCategoryId = cat.id;
    }

    // Permissions: private to @everyone, visible to member and recruiters
    const botUserId = guild.members.me?.id || bot.user?.id;
    const permissionOverwrites: any[] = [
      {
        id: guild.roles.everyone?.id || guild.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ];

    if (botUserId) {
      permissionOverwrites.push({
        id: botUserId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      });
    }

    // Grant recruiters view permissions if configured in RecruitmentConfig
    const recruitConfig = await prisma.recruitmentConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);
    if (recruitConfig && recruitConfig.recruiterRoleIds) {
      try {
        const recruiterRoleIds: string[] = JSON.parse(recruitConfig.recruiterRoleIds);
        for (const roleId of recruiterRoleIds) {
          if (typeof roleId === 'string' && /^\d{17,20}$/.test(roleId) && guild.roles.cache.has(roleId)) {
            permissionOverwrites.push({
              id: roleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            });
          }
        }
      } catch (err) {
        // ignore parse error
      }
    }

    let channel: TextChannel;
    try {
      channel = (await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: targetCategoryId || undefined,
        permissionOverwrites,
        topic: `Личный канал отчетов академика ${member.user.tag} (Статик: ${effectiveStatic})`,
      })) as TextChannel;
    } catch (createErr: any) {
      console.warn(`[Academy] Failed to create channel with category (${createErr.message}). Retrying fallback...`);
      channel = (await guild.channels.create({
        name: `${channelName}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone?.id || guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: member.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
          ...(botUserId ? [{
            id: botUserId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
          }] : []),
        ],
        topic: `Личный канал отчетов академика ${member.user.tag} (Статик: ${effectiveStatic})`,
      })) as TextChannel;
    }

    const academyRecord = await prisma.academyChannel.create({
      data: {
        guildId: guild.id,
        userId: member.id,
        userTag: member.user.tag,
        staticId: effectiveStatic,
        channelId: channel.id,
        requiredMp: config.requiredMpForRankUp,
        penaltyMp: profile.penaltyMp,
      },
    });

    // Ensure member has academic role
    if (config.academicRoleId && !member.roles.cache.has(config.academicRoleId)) {
      await member.roles.add(config.academicRoleId).catch(() => null);
    }

    // Post initial greeting embed with button to submit report and pin it
    const welcomeEmbed = this.buildStatusEmbed(
      { id: member.id, tag: member.user.tag, avatarUrl: member.user.displayAvatarURL() },
      effectiveStatic,
      0,
      academyRecord.requiredMp,
      academyRecord.penaltyMp
    );
    const row = this.getStatusButtonsRow();

    const welcomeMsg = await channel.send({ content: `${member}`, embeds: [welcomeEmbed], components: [row] });
    if (welcomeMsg && typeof welcomeMsg.pin === 'function') {
      await Promise.resolve(welcomeMsg.pin()).catch(e => console.warn('[Academy] Could not pin welcome message:', e));
    }

    await prisma.academyChannel.update({
      where: { id: academyRecord.id },
      data: { pinnedMessageId: welcomeMsg?.id || null },
    }).catch(() => null);

    return { channel, academyRecord };
  }

  /**
   * Builds the live status embed for an academician's personal channel
   */
  public static buildStatusEmbed(
    memberUser: { id: string; tag?: string; avatarUrl?: string },
    staticId: string,
    approvedCount: number,
    requiredMp: number,
    penaltyMp: number
  ): EmbedBuilder {
    const totalNeeded = requiredMp + penaltyMp;
    const remaining = Math.max(0, totalNeeded - approvedCount);
    const percent = Math.min(100, Math.round((approvedCount / (totalNeeded || 1)) * 100));

    // Visual progress bar [████░░░░░░]
    const totalBars = 10;
    const filledBars = Math.min(totalBars, Math.round((approvedCount / (totalNeeded || 1)) * totalBars));
    const emptyBars = totalBars - filledBars;
    const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

    return new EmbedBuilder()
      .setColor(approvedCount >= totalNeeded ? 0x10B981 : 0xEC4899)
      .setTitle(`🎓 Личный канал академии | ${staticId}`)
      .setDescription(
        `Приветствуем тебя в семье, <@${memberUser.id}>!\n\n` +
        `**Твой статик:** \`${staticId}\`\n` +
        `**Условие повышения на 2 ранг:** Отыграть и сдать отчеты по **${totalNeeded} МП**.\n\n` +
        `\`[${progressBar}]\` **${percent}%** (${approvedCount}/${totalNeeded} МП)\n\n` +
        `📌 **Как сдавать отчеты:**\n` +
        `После участия в мероприятии (Дроп, Цех, ВЗМ, МЦЛ, Капт) нажми на кнопку ниже **«📸 Сдать отчет по МП»**, укажи тип МП и прикрепи ссылку на скриншот (или загрузи скрин прямо сюда).\n\n` +
        `Рекрутеры проверят твой отчет. После одобрения/отклонения сообщение с отчетом удаляется, а этот закрепленный статус обновляется автоматически.`
      )
      .addFields(
        { name: '📊 Сдано отчетов', value: `\`${approvedCount} / ${totalNeeded} МП\``, inline: true },
        { name: '⚖️ Штрафов', value: `\`${penaltyMp} МП\``, inline: true },
        { name: '⏳ Осталось сдать', value: `\`${remaining} МП\``, inline: true }
      )
      .setThumbnail(memberUser.avatarUrl || null)
      .setFooter({ text: 'INTERPOL Academy • Статус обновляется автоматически' })
      .setTimestamp();
  }

  /**
   * Action buttons for the academy channel status message
   */
  public static getStatusButtonsRow(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('academy_submit_report_btn')
        .setLabel('📸 Сдать отчет по МП')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('academy_check_progress_btn')
        .setLabel('📊 Мой прогресс')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  /**
   * Refreshes the pinned status message in the academy channel with live MP/penalty counts
   */
  public static async refreshStatusMessage(channel: TextChannel, academyChannelId?: string): Promise<void> {
    try {
      if (!channel || !channel.isTextBased()) return;

      const academy = academyChannelId
        ? await prisma.academyChannel.findUnique({ where: { id: academyChannelId } })
        : await prisma.academyChannel.findFirst({ where: { channelId: channel.id } });

      if (!academy) return;

      const profile = await prisma.userProfile.findUnique({
        where: { guildId_userId: { guildId: academy.guildId, userId: academy.userId } },
      }).catch(() => null);

      const penaltyMp = profile ? profile.penaltyMp : academy.penaltyMp;
      const approvedCount = academy.approvedMpCount;
      const requiredMp = academy.requiredMp;

      const guild = channel.guild || (bot.guilds.cache.get(academy.guildId) || await bot.guilds.fetch(academy.guildId).catch(() => null));
      const member = guild ? await guild.members.fetch(academy.userId).catch(() => null) : null;
      const avatarUrl = (member && typeof member.user?.displayAvatarURL === 'function')
        ? member.user.displayAvatarURL()
        : undefined;

      const embed = this.buildStatusEmbed(
        { id: academy.userId, tag: academy.userTag || member?.user?.tag, avatarUrl },
        academy.staticId || profile?.staticId || '—',
        approvedCount,
        requiredMp,
        penaltyMp
      );

      const row = this.getStatusButtonsRow();

      let msg: Message | null = null;
      if (academy.pinnedMessageId && typeof channel.messages?.fetch === 'function') {
        msg = await channel.messages.fetch(academy.pinnedMessageId).catch(() => null);
      }

      if (!msg && typeof channel.messages?.fetchPinned === 'function') {
        // Try to find existing pinned bot message
        const pinned = await channel.messages.fetchPinned().catch(() => null);
        if (pinned) {
          msg = pinned.find(m => m.author.id === channel.client?.user?.id) || null;
        }
      }

      if (msg) {
        if (typeof msg.edit === 'function') {
          await msg.edit({ embeds: [embed], components: [row] }).catch(() => null);
        }
        if (typeof msg.pin === 'function' && !msg.pinned) {
          await Promise.resolve(msg.pin()).catch(() => null);
        }
        if (academy.pinnedMessageId !== msg.id) {
          await prisma.academyChannel.update({
            where: { id: academy.id },
            data: { pinnedMessageId: msg.id },
          }).catch(() => null);
        }
      } else {
        const newMsg = await channel.send({ content: `<@${academy.userId}>`, embeds: [embed], components: [row] });
        if (newMsg && typeof newMsg.pin === 'function') {
          await Promise.resolve(newMsg.pin()).catch(() => null);
        }
        await prisma.academyChannel.update({
          where: { id: academy.id },
          data: { pinnedMessageId: newMsg?.id || null },
        }).catch(() => null);
      }
    } catch (err) {
      console.error('[Academy] refreshStatusMessage error:', err);
    }
  }

  /**
   * Submit an MP report in the academy channel
   */
  static async submitReport(
    guildId: string,
    member: GuildMember,
    channelId: string,
    mpType: string,
    screenshotUrls: string[],
    comment?: string
  ) {
    const academyChannel = await prisma.academyChannel.findFirst({
      where: { channelId, status: 'ACTIVE' },
    });

    if (!academyChannel) {
      throw new Error('Активная академ-ветка для этого канала не найдена');
    }

    const report = await prisma.mpReport.create({
      data: {
        guildId,
        userId: member.id,
        userTag: member.user.tag,
        academyChannelId: academyChannel.id,
        channelId,
        mpType,
        screenshotUrls: JSON.stringify(screenshotUrls),
        comment: comment || '',
        status: 'PENDING',
      },
    });

    const guild = member.guild || (guildId ? (bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null)) : null);
    const channel = guild ? ((guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null)) as TextChannel | null) : null;
    if (channel && channel.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xF59E0B)
        .setTitle(`📝 Новый отчет по МП: ${mpType}`)
        .setDescription(
          `**Академик:** ${member} (\`${member.user.tag}\`)\n` +
          `**Тип МП:** ${mpType}\n` +
          (comment ? `**Комментарий:** ${comment}\n` : '') +
          `**Скриншоты:**\n${screenshotUrls.map((u, i) => `[Скриншот ${i + 1}](${u})`).join(' • ')}`
        )
        .setThumbnail(screenshotUrls[0] || null)
        .setFooter({ text: `ID отчета: ${report.id} • Ожидает проверки рекрутером` })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`academy_approve_report_${report.id}`)
          .setLabel('✅ Одобрить отчет')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`academy_reject_report_${report.id}`)
          .setLabel('❌ Отклонить отчет')
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await channel.send({ embeds: [embed], components: [row] });
      await prisma.mpReport.update({
        where: { id: report.id },
        data: { messageId: msg.id },
      });
    }

    return report;
  }

  /**
   * Review an MP report (Approve / Reject)
   */
  static async reviewReport(
    reportId: string,
    reviewer: GuildMember,
    approved: boolean,
    rejectionReason?: string
  ) {
    const report = await prisma.mpReport.findUnique({
      where: { id: reportId },
      include: { academyChannel: true },
    });

    if (!report) throw new Error('Отчет не найден');
    if (report.status !== 'PENDING') throw new Error('Этот отчет уже был проверен');

    if (reviewer.id === report.userId) {
      throw new Error('Вы не можете проверять собственный отчет');
    }

    const isRecruiter = await RecruitmentService.isRecruiter(reviewer);
    if (!isRecruiter) {
      throw new Error('У вас нет роли рекрутера для проверки отчетов');
    }

    const updated = await prisma.mpReport.update({
      where: { id: reportId },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        reviewerId: reviewer.id,
        reviewerTag: reviewer.user.tag,
        rejectionReason: approved ? null : (rejectionReason || 'Не соответствует требованиям'),
        reviewedAt: new Date(),
      },
    });

    const guild = reviewer.guild || (report.guildId ? (bot.guilds.cache.get(report.guildId) || await bot.guilds.fetch(report.guildId).catch(() => null)) : null);
    const channel = guild ? ((guild.channels.cache.get(report.channelId) || await guild.channels.fetch(report.channelId).catch(() => null)) as TextChannel | null) : null;

    // Delete the report message itself after review
    if (report.messageId && channel && typeof channel.messages?.fetch === 'function') {
      try {
        const reportMsg = await channel.messages.fetch(report.messageId).catch(() => null);
        if (reportMsg && typeof reportMsg.delete === 'function') {
          await Promise.resolve(reportMsg.delete()).catch(() => null);
        }
      } catch (err) {
        console.warn('[Academy] Could not delete report message:', err);
      }
    }

    if (approved) {
      // Increment MP count
      const updatedChannel = await prisma.academyChannel.update({
        where: { id: report.academyChannelId! },
        data: { approvedMpCount: { increment: 1 } },
      });

      await ProfileService.incrementMp(guild ? guild.id : report.guildId, report.userId, 1);

      // Refresh the pinned status message
      if (channel) {
        await this.refreshStatusMessage(channel, updatedChannel.id);
      }

      const neededTotal = updatedChannel.requiredMp + updatedChannel.penaltyMp;
      const current = updatedChannel.approvedMpCount;

      if (channel) {
        const approvedEmbed = new EmbedBuilder()
          .setColor(0x10B981)
          .setTitle('✅ Отчет по МП одобрен!')
          .setDescription(
            `Рекрутер ${reviewer} одобрил отчет по **${report.mpType}**.\n\n` +
            `📊 **Прогресс:** \`${current} / ${neededTotal}\` МП`
          )
          .setTimestamp();

        await channel.send({ embeds: [approvedEmbed] });

        // Check if member reached the required amount of MPs for Rank 2 promotion!
        if (current >= neededTotal) {
          const promotionReadyEmbed = new EmbedBuilder()
            .setColor(0xEC4899)
            .setTitle('🎉 Академик готов к повышению на 2 ранг!')
            .setDescription(
              `Академик <@${report.userId}> успешно выполнил норму: **${current} из ${neededTotal} МП**!\n\n` +
              `Рекрутеры, проверьте кандидата и примите решение о выдаче 2 ранга.`
            )
            .setFooter({ text: 'Используйте кнопки ниже для повышения или отказа' })
            .setTimestamp();

          const promoRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`academy_promote_confirm_${updatedChannel.id}`)
              .setLabel('🎖️ Одобрить повышение на 2 ранг')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`academy_promote_reject_${updatedChannel.id}`)
              .setLabel('⚠️ Отклонить / Добавить штраф')
              .setStyle(ButtonStyle.Danger)
          );

          await channel.send({
            content: `🔔 <@${report.userId}> достиг 10 МП!`,
            embeds: [promotionReadyEmbed],
            components: [promoRow],
          });
        }
      }
    } else {
      if (channel) {
        await this.refreshStatusMessage(channel, report.academyChannelId || undefined);

        const rejectEmbed = new EmbedBuilder()
          .setColor(0xEF4444)
          .setTitle('❌ Отчет по МП отклонен')
          .setDescription(
            `Рекрутер ${reviewer} отклонил ваш отчет по **${report.mpType}**.\n\n` +
            `**Причина:** ${rejectionReason || 'Не указана'}\n` +
            `*Этот отчет не идет в зачет.*`
          )
          .setTimestamp();

        await channel.send({ embeds: [rejectEmbed] });
      }
    }

    return updated;
  }

  /**
   * Final promotion action (Grant Rank 2 or Reject with penalty)
   */
  static async promoteAcademician(
    academyChannelId: string,
    reviewer: GuildMember,
    approved: boolean,
    rejectionReason?: string,
    penaltyMp?: number
  ) {
    const academy = await prisma.academyChannel.findUnique({
      where: { id: academyChannelId },
    });

    if (!academy) throw new Error('Ветка академии не найдена');

    if (reviewer.id === academy.userId) {
      throw new Error('Вы не можете подтвердить собственное повышение');
    }

    const isRecruiter = await RecruitmentService.isRecruiter(reviewer);
    if (!isRecruiter) {
      throw new Error('У вас нет роли рекрутера для подтверждения повышения');
    }

    const guild = reviewer.guild || (academy.guildId ? (bot.guilds.cache.get(academy.guildId) || await bot.guilds.fetch(academy.guildId).catch(() => null)) : null);
    const config = await this.getConfig(guild ? guild.id : reviewer.guild.id);
    const targetMember = guild ? await guild.members.fetch(academy.userId).catch(() => null) : null;
    const channel = guild ? ((guild.channels.cache.get(academy.channelId) || await guild.channels.fetch(academy.channelId).catch(() => null)) as TextChannel | null) : null;

    if (approved) {
      // 1. Roles transfer
      if (targetMember) {
        if (config.promotedRoleId) {
          await targetMember.roles.add(config.promotedRoleId).catch(() => null);
        }
        if (config.academicRoleId) {
          await targetMember.roles.remove(config.academicRoleId).catch(() => null);
        }
        await NicknameService.syncMemberNickname(targetMember, 'Повышение в Академии').catch(() => null);
      }

      // 2. Update profile rank
      await prisma.userProfile.updateMany({
        where: { guildId: reviewer.guild.id, userId: academy.userId },
        data: { rank: 2 },
      });

      // 3. Mark channel as promoted and archived
      await prisma.academyChannel.update({
        where: { id: academyChannelId },
        data: {
          status: 'PROMOTED',
          promotedById: reviewer.id,
          promotedByTag: reviewer.user.tag,
          archivedAt: new Date(),
        },
      });

      // 4. Send celebration
      if (channel && channel.isTextBased()) {
        const celebrationEmbed = new EmbedBuilder()
          .setColor(0xEC4899)
          .setTitle('🎖️ Академик успешно повышен на 2 ранг!')
          .setDescription(
            `Поздравляем <@${academy.userId}> с успешным прохождением академии семьи!\n` +
            `Вам присвоен **2 ранг** (Основной состав).\n\n` +
            `Повышение провел: ${reviewer} (\`${reviewer.user.tag}\`).\n` +
            `Канал отправляется в архив.`
          )
          .setTimestamp();

        await channel.send({ embeds: [celebrationEmbed] });

        // Move to archive category if configured
        if (config.archiveCategoryId) {
          await channel.setParent(config.archiveCategoryId, { lockPermissions: false }).catch(() => null);
        }
      }
    } else {
      // Rejected promotion with penalties
      const penalty = penaltyMp || 2;

      // Add penalty via ProfileService (which safely updates profile penalty and all active academy channels)
      await ProfileService.addPenaltyMp(
        reviewer.guild.id,
        academy.userId,
        penalty,
        `Отклонено повышение: ${rejectionReason || 'Нарушение/Недостаточная активность'}`
      );

      const updated = await prisma.academyChannel.findUnique({
        where: { id: academyChannelId },
      }) || academy;

      if (channel && channel.isTextBased()) {
        await this.refreshStatusMessage(channel, academyChannelId);

        const penaltyEmbed = new EmbedBuilder()
          .setColor(0xEF4444)
          .setTitle('⚠️ Повышение отклонено | Назначен штраф')
          .setDescription(
            `Рекрутер ${reviewer} отклонил повышение на 2 ранг.\n\n` +
            `**Причина:** ${rejectionReason || 'Требуется дополнительная активность'}\n` +
            `**Штраф:** +${penalty} дополнительных МП.\n\n` +
            `📊 **Новая норма:** \`${updated.approvedMpCount} / ${updated.requiredMp + updated.penaltyMp}\` МП`
          )
          .setTimestamp();

        await channel.send({ embeds: [penaltyEmbed] });
      }
    }
  }
}
