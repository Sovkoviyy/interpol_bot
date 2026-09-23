import { 
  Guild, 
  GuildMember, 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  TextChannel 
} from 'discord.js';
import prisma from '../../../database/client';
import { ProfileService } from '../profiles/profileService';
import { AuditLogger } from '../logging/auditLogger';

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
    const rawName = profile.characterName || member.displayName || member.user.username;
    const cleanName = rawName
      .toLowerCase()
      .replace(/[^a-z0-9а-яё_-]/gi, '')
      .slice(0, 20) || member.user.username.toLowerCase().slice(0, 20);
    const prefix = config.channelPrefix || 'academ-';
    const channelName = `${prefix}${cleanName}`;

    // Ensure category ACADEMY
    let targetCategoryId = config.categoryId;
    if (!targetCategoryId || !guild.channels.cache.has(targetCategoryId)) {
      let cat = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && (c.name.toUpperCase() === 'ACADEMY' || c.name.toUpperCase() === 'АКАДЕМИЯ')
      );
      if (!cat) {
        cat = await guild.channels.create({
          name: 'ACADEMY',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: guild.members.me?.id || '',
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages],
            },
          ],
        });
        await prisma.academyConfig.update({
          where: { guildId: guild.id },
          data: { categoryId: cat.id },
        }).catch(() => null);
      }
      targetCategoryId = cat.id;
    }

    // Permissions: private to @everyone, visible to member and recruiters
    const permissionOverwrites: any[] = [
      {
        id: guild.id,
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

    // Grant recruiters view permissions if configured in RecruitmentConfig
    const recruitConfig = await prisma.recruitmentConfig.findUnique({ where: { guildId: guild.id } });
    if (recruitConfig && recruitConfig.recruiterRoleIds) {
      try {
        const recruiterRoleIds: string[] = JSON.parse(recruitConfig.recruiterRoleIds);
        for (const roleId of recruiterRoleIds) {
          if (guild.roles.cache.has(roleId)) {
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

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: targetCategoryId || undefined,
      permissionOverwrites,
      topic: `Личный канал отчетов академика ${member.user.tag} (Статик: ${effectiveStatic})`,
    });

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

    // Post initial greeting embed with button to submit report
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0xEC4899)
      .setTitle(`🎓 Личный канал академии | ${effectiveStatic}`)
      .setDescription(
        `Приветствуем тебя в семье, ${member}!\n\n` +
        `**Твой статик:** \`${effectiveStatic}\`\n` +
        `**Условие повышения на 2 ранг:** Отыграть и сдать отчеты по **${academyRecord.requiredMp + academyRecord.penaltyMp} МП**.\n\n` +
        `📌 **Как сдавать отчеты:**\n` +
        `После участия в мероприятии (Дроп, Цех, ВЗМ, МЦЛ, Капт) нажми на кнопку ниже **«Сдать отчет по МП»**, укажи тип МП и прикрепи ссылку на скриншот (или загрузи скрин прямо сюда).\n\n` +
        `Рекрутеры проверят твой отчет, и бот обновит твой прогресс. Удачи!`
      )
      .addFields(
        { name: '📊 Текущий прогресс', value: `0 / ${academyRecord.requiredMp + academyRecord.penaltyMp} МП`, inline: true },
        { name: '⚖️ Штрафы', value: `${academyRecord.penaltyMp} МП`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('academy_submit_report_btn')
        .setLabel('📸 Сдать отчет по МП')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('academy_check_progress_btn')
        .setLabel('📊 Мой прогресс')
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ content: `${member}`, embeds: [welcomeEmbed], components: [row] });

    return { channel, academyRecord };
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

    const channel = member.guild.channels.cache.get(channelId) as TextChannel | undefined;
    if (channel) {
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

    const channel = reviewer.guild.channels.cache.get(report.channelId) as TextChannel | undefined;

    if (approved) {
      // Increment MP count
      const updatedChannel = await prisma.academyChannel.update({
        where: { id: report.academyChannelId! },
        data: { approvedMpCount: { increment: 1 } },
      });

      await ProfileService.incrementMp(reviewer.guild.id, report.userId, 1);

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

    const config = await this.getConfig(reviewer.guild.id);
    const targetMember = await reviewer.guild.members.fetch(academy.userId).catch(() => null);
    const channel = reviewer.guild.channels.cache.get(academy.channelId) as TextChannel | undefined;

    if (approved) {
      // 1. Roles transfer
      if (targetMember) {
        if (config.promotedRoleId) {
          await targetMember.roles.add(config.promotedRoleId).catch(() => null);
        }
        if (config.academicRoleId) {
          await targetMember.roles.remove(config.academicRoleId).catch(() => null);
        }
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
      if (channel) {
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
      const updated = await prisma.academyChannel.update({
        where: { id: academyChannelId },
        data: {
          penaltyMp: { increment: penalty },
        },
      });

      await ProfileService.addPenaltyMp(
        reviewer.guild.id,
        academy.userId,
        penalty,
        `Отклонено повышение: ${rejectionReason || 'Нарушение/Недостаточная активность'}`
      );

      if (channel) {
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
