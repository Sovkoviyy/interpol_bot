import {
  Guild,
  GuildMember,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import prisma from '../../../database/client';
import { FormQuestion } from '../../../shared/types';
import { TranscriptService } from './transcript';
import { AuditLogger } from '../logging/auditLogger';
import { AcademyService } from '../academy/academyService';
import bot from '../../client';

export class RecruitmentService {
  private static async resolveGuild(interaction: { guild?: Guild | null; guildId?: string | null }): Promise<Guild | null> {
    if (interaction.guild) return interaction.guild;
    const guildId = interaction.guildId;
    if (!guildId) return null;
    return bot.guilds.cache.get(guildId) || await bot.guilds.fetch(guildId).catch(() => null);
  }

  /**
   * Get default form questions if none configured in DB
   */
  public static getDefaultQuestions(): FormQuestion[] {
    return [
      {
        id: 'q_name',
        label: 'Имя Фамилия (RP Nickname)',
        placeholder: 'John Doe',
        required: true,
        style: 'SHORT',
        maxLength: 50,
      },
      {
        id: 'q_static',
        label: 'Статический ID / Паспорт',
        placeholder: '123456',
        required: true,
        style: 'SHORT',
        maxLength: 20,
      },
      {
        id: 'q_age',
        label: 'Реальный возраст',
        placeholder: '18',
        required: true,
        style: 'SHORT',
        maxLength: 5,
      },
      {
        id: 'q_experience',
        label: 'Опыт в семьях / фракциях',
        placeholder: 'Был в семьях ..., капты, стрельба 8/10',
        required: true,
        style: 'PARAGRAPH',
        maxLength: 500,
      },
      {
        id: 'q_online',
        label: 'Средний суточный онлайн (часов)',
        placeholder: '4-6 часов',
        required: true,
        style: 'SHORT',
        maxLength: 30,
      },
    ];
  }

  /**
   * Builds the interactive application modal for a user
   */
  public static async buildApplicationModal(guildId: string): Promise<ModalBuilder> {
    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId },
    });

    let questions: FormQuestion[] = [];
    if (config?.questionsJson) {
      try {
        questions = JSON.parse(config.questionsJson);
      } catch {
        questions = this.getDefaultQuestions();
      }
    }
    if (!questions || questions.length === 0) {
      questions = this.getDefaultQuestions();
    }

    // Limit to 5 fields (Discord max)
    questions = questions.slice(0, 5);

    const modal = new ModalBuilder()
      .setCustomId('recruit_modal_submit')
      .setTitle('Заявка на вступление в семью');

    for (const q of questions) {
      const input = new TextInputBuilder()
        .setCustomId(q.id)
        .setLabel(q.label.slice(0, 45))
        .setStyle(q.style === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
        .setRequired(q.required);

      if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100));
      if (q.maxLength) input.setMaxLength(q.maxLength);

      const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
      modal.addComponents(row);
    }

    return modal;
  }

  /**
   * Handles user submission of the modal
   */
  public static async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const guild = await this.resolveGuild(interaction);
      if (!guild) {
        const errorContent = '❌ Сервер Discord не определен.';
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorContent }).catch(() => null);
        } else {
          await interaction.reply({ content: errorContent, ephemeral: true }).catch(() => null);
        }
        return;
      }

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true }).catch(() => null);
      }

      // Check if recruitment is enabled
      const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);
      if (guildConfig && !guildConfig.recruitmentEnabled) {
        await interaction.editReply({ content: '❌ Прием заявок в семью в данный момент закрыт.' }).catch(() => null);
        return;
      }

      const recConfig = await prisma.recruitmentConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);
      if (!recConfig) {
        await interaction.editReply({ content: '❌ Модуль заявок еще не настроен администратором.' }).catch(() => null);
        return;
      }

      // Check if user already has an active application
      const existing = await prisma.recruitmentApplication.findFirst({
        where: {
          guildId: guild.id,
          userId: interaction.user.id,
          status: { in: ['PENDING', 'UNDER_REVIEW'] },
        },
      }).catch(() => null);

      if (existing && existing.channelId) {
        await interaction.editReply({
          content: `❌ У вас уже есть открытая заявка в канале <#${existing.channelId}>!`,
        }).catch(() => null);
        return;
      }

      // Parse answers
      const answers: Record<string, string> = {};
      let questions: FormQuestion[] = [];
      try {
        questions = JSON.parse(recConfig.questionsJson || '[]');
      } catch {
        questions = this.getDefaultQuestions();
      }
      if (questions.length === 0) questions = this.getDefaultQuestions();

      for (const q of questions.slice(0, 5)) {
        try {
          const val = interaction.fields.getTextInputValue(q.id);
          answers[q.label] = val;
        } catch {
          // Field wasn't in modal
        }
      }

      // Recruiter role IDs
      let recruiterRoleIds: string[] = [];
      try {
        recruiterRoleIds = JSON.parse(recConfig.recruiterRoleIds || '[]');
      } catch {
        recruiterRoleIds = [];
      }

      // Resolve bot user ID safely
      const botUserId = guild.members.me?.id || bot.user?.id;

      // Create private ticket channel with strictly valid snowflakes
      const overwrites: any[] = [];

      // @everyone deny
      if (guild.roles.everyone?.id) {
        overwrites.push({
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        });
      }

      // Candidate allow
      if (interaction.user.id) {
        overwrites.push({
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        });
      }

      // Bot allow
      if (botUserId) {
        overwrites.push({
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

      // Recruiter roles
      for (const roleId of recruiterRoleIds) {
        if (typeof roleId === 'string' && /^\d{17,20}$/.test(roleId) && guild.roles.cache.has(roleId)) {
          overwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          });
        }
      }

      // Channel name: lowercase, valid symbols only, non-empty fallback
      const cleanUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9а-я_-]/g, '').slice(0, 20);
      const channelName = `заявка-${cleanUsername || interaction.user.id.slice(-4)}`;

      // Validate parent category: must exist, be GuildCategory, and have < 50 channels
      let parentCategoryId: string | undefined = undefined;
      if (recConfig.categoryId && typeof recConfig.categoryId === 'string' && /^\d{17,20}$/.test(recConfig.categoryId)) {
        const cat = guild.channels.cache.get(recConfig.categoryId) || await guild.channels.fetch(recConfig.categoryId).catch(() => null);
        if (cat && cat.type === ChannelType.GuildCategory) {
          const childCount = guild.channels.cache.filter(c => c.parentId === cat.id).size;
          if (childCount < 50) {
            parentCategoryId = cat.id;
          } else {
            console.warn(`[Recruitment] Category ${cat.name} (${cat.id}) is full (50 channels max). Creating ticket channel at root level.`);
          }
        } else {
          console.warn(`[Recruitment] Category ID ${recConfig.categoryId} is invalid or not a GuildCategory. Falling back to root level.`);
        }
      }

      // Resilient channel creation with automatic fallback on Discord API 50035 / permissions errors
      let ticketChannel: TextChannel;
      try {
        ticketChannel = (await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: parentCategoryId,
          permissionOverwrites: overwrites,
        })) as TextChannel;
      } catch (createErr: any) {
        console.warn(`[Recruitment] Initial channel creation failed (${createErr.message}). Retrying with safe minimal fallback...`);
        
        const fallbackOverwrites: any[] = [];
        if (guild.roles.everyone?.id) {
          fallbackOverwrites.push({
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel],
          });
        }
        fallbackOverwrites.push({
          id: interaction.user.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
        if (botUserId) {
          fallbackOverwrites.push({
            id: botUserId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
          });
        }

        ticketChannel = (await guild.channels.create({
          name: `заявка-${interaction.user.id.slice(-4)}`,
          type: ChannelType.GuildText,
          permissionOverwrites: fallbackOverwrites,
        })) as TextChannel;
      }

      // Save DB application
      const application = await prisma.recruitmentApplication.create({
        data: {
          guildId: guild.id,
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          channelId: ticketChannel.id,
          status: 'PENDING',
          answersJson: JSON.stringify(answers),
        },
      });

      // Create ticket embed
      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`📋 Новая заявка в семью: ${interaction.user.username}`)
        .setDescription(
          `**Кандидат:** ${interaction.user} (\`${interaction.user.tag}\` / \`${interaction.user.id}\`)\n` +
          `**Дата подачи:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)\n` +
          `**Статус:** ⏳ Ожидает рассмотрения\n\n` +
          `*Рекрутеры могут нажать кнопку ниже, чтобы взять заявку в работу.*`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));

      for (const [question, answer] of Object.entries(answers)) {
        embed.addFields({ name: question, value: answer || 'Не указано', inline: false });
      }

      const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`recruit_claim_${application.id}`)
          .setLabel('Взять на рассмотрение')
          .setEmoji('📌')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`recruit_approve_${application.id}`)
          .setLabel('Одобрить')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`recruit_reject_${application.id}`)
          .setLabel('Отклонить')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Danger)
      );

      // Mention recruiter roles if configured
      const recruiterPings = recruiterRoleIds.filter(r => guild.roles.cache.has(r)).map(r => `<@&${r}>`).join(' ');
      await ticketChannel.send({
        content: `${interaction.user} ${recruiterPings}`.trim(),
        embeds: [embed],
        components: [buttonsRow],
      }).catch(err => console.error('[Recruitment] Error sending initial ticket message:', err));

      // Send custom candidate greeting/instructions from BotMessagesConfig if present
      try {
        const botMsgConfig = await prisma.botMessagesConfig.findUnique({ where: { guildId: guild.id } }).catch(() => null);
        if (botMsgConfig && botMsgConfig.ticketGreetingDesc) {
          const greetingTitle = botMsgConfig.ticketGreetingTitle || 'Заявка в семью INTERPOL';
          const greetingDesc = botMsgConfig.ticketGreetingDesc
            .replace(/{user}/g, `<@${interaction.user.id}>`)
            .replace(/{guild}/g, guild.name);
          
          const greetingEmbed = new EmbedBuilder()
            .setColor(0xEC4899)
            .setTitle(`🌸 ${greetingTitle}`)
            .setDescription(greetingDesc);
          await ticketChannel.send({ embeds: [greetingEmbed] }).catch(() => null);
        }
      } catch (err) {
        console.error('[Recruitment] Error sending ticket greeting:', err);
      }

      await interaction.editReply({
        content: `✅ Ваша заявка успешно создана! Перейдите в канал: <#${ticketChannel.id}>`,
      }).catch(() => null);

      // Log to BOT logs
      const logEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📋 Создана новая заявка')
        .setDescription(
          `**Кандидат:** ${interaction.user} (\`${interaction.user.tag}\`)\n` +
          `**Канал:** <#${ticketChannel.id}>\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();
      await AuditLogger.sendLog(guild, 'BOT', logEmbed).catch(() => null);
    } catch (err: any) {
      console.error('[Recruitment handleModalSubmit Error]:', err);
      const userErrorMsg = `❌ Не удалось создать заявку (${err.message || 'Ошибка прав Discord'}). Убедитесь, что у бота есть право «Управлять каналами» (Manage Channels).`;
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: userErrorMsg }).catch(() => null);
      } else {
        await interaction.reply({ content: userErrorMsg, ephemeral: true }).catch(() => null);
      }
    }
  }

  /**
   * Check if member is a recruiter or admin
   */
  public static async isRecruiter(member: GuildMember): Promise<boolean> {
    if (!member) return false;
    const hasAdmin = member.permissions && typeof member.permissions.has === 'function'
      ? member.permissions.has(PermissionFlagsBits.Administrator)
      : false;
    if (hasAdmin) return true;

    const guildId = member.guild?.id;
    if (!guildId) return false;

    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId },
    });
    if (!config) return false;

    let roles: string[] = [];
    try {
      roles = JSON.parse(config.recruiterRoleIds || '[]');
    } catch {
      roles = [];
    }

    if (member.roles && 'cache' in member.roles && member.roles.cache) {
      return roles.some(r => member.roles.cache.has(r));
    } else if (Array.isArray(member.roles)) {
      return roles.some(r => (member.roles as any).includes(r));
    }
    return false;
  }

  /**
   * Claim ticket handler
   */
  public static async handleClaim(interaction: ButtonInteraction, applicationId: string): Promise<void> {
    const member = interaction.member as GuildMember;
    if (!(await this.isRecruiter(member))) {
      await interaction.reply({ content: '❌ У вас нет прав рекрутера для этого действия.', ephemeral: true });
      return;
    }

    const application = await prisma.recruitmentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      await interaction.reply({ content: '❌ Заявка не найдена в базе данных.', ephemeral: true });
      return;
    }

    await prisma.recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        status: 'UNDER_REVIEW',
        recruiterId: interaction.user.id,
        recruiterTag: interaction.user.tag,
      },
    });

    await interaction.reply({
      content: `📌 Рекрутер ${interaction.user} взял заявку на рассмотрение.`,
    });

    // Update original embed if possible
    if (interaction.message && interaction.message.embeds.length > 0) {
      const oldEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
      oldEmbed.setColor(0xFEE75C);
      oldEmbed.setDescription(
        oldEmbed.data.description?.replace(
          /Статус: .*/,
          `Статус: 🟡 На рассмотрении у ${interaction.user} (\`${interaction.user.tag}\`)`
        ) || null
      );
      await interaction.message.edit({ embeds: [oldEmbed] });
    }
  }

  /**
   * Approve application handler
   */
  public static async handleApprove(interaction: ButtonInteraction, applicationId: string): Promise<void> {
    const member = interaction.member as GuildMember;
    if (!(await this.isRecruiter(member))) {
      await interaction.reply({ content: '❌ У вас нет прав рекрутера для этого действия.', ephemeral: true });
      return;
    }

    const application = await prisma.recruitmentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      await interaction.reply({ content: '❌ Заявка не найдена.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const guild = await this.resolveGuild(interaction);
    if (!guild) {
      await interaction.editReply({ content: '❌ Сервер Discord не найден.' });
      return;
    }

    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId: guild.id },
    });

    // 1. Give role to applicant
    const targetMember = await guild.members.fetch(application.userId).catch(() => null);
    if (targetMember && config?.memberRoleId) {
      await targetMember.roles.add(config.memberRoleId).catch(e => {
        console.error('Failed to grant family role:', e);
      });
    }

    // Auto-create Academy channel for 1st rank MP progression
    if (targetMember) {
      let staticId: string | undefined;
      try {
        const answers = JSON.parse(application.answersJson || '{}');
        for (const [key, val] of Object.entries(answers)) {
          if (/статик|static|id/i.test(key)) {
            staticId = String(val).trim();
            break;
          }
        }
      } catch {}

      await AcademyService.createAcademyChannel(guild, targetMember, staticId).catch(err => {
        console.warn('[Academy] Could not auto-create academy channel:', err.message);
      });
    }

    // 2. Send DM notification
    if (targetMember) {
      await targetMember.send({
        content: `🎉 **Поздравляем!** Ваша заявка в семью на сервере **${guild.name}** была **одобрена** рекрутером ${interaction.user.tag}!\nВам выдана роль участника семьи. Добро пожаловать!`,
      }).catch(() => {
        console.log(`Could not send approval DM to ${application.userId} (DMs closed)`);
      });
    }

    // 3. Update DB
    await prisma.recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        status: 'ACCEPTED',
        recruiterId: interaction.user.id,
        recruiterTag: interaction.user.tag,
        closedAt: new Date(),
      },
    });

    // 4. Generate Transcript and send to log channel
    const channel = interaction.channel as TextChannel;
    const transcriptAttachment = channel ? await TranscriptService.generateTranscript(channel) : null;

    const logChannelId = config?.logChannelId;
    if (logChannelId && transcriptAttachment) {
      const logChannel = (guild.channels.cache.get(logChannelId) ||
        await guild.channels.fetch(logChannelId).catch(() => null)) as TextChannel | null;
      if (logChannel && logChannel.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(`✅ Заявка одобрена: ${application.userTag}`)
          .setDescription(
            `**Кандидат:** <@${application.userId}> (\`${application.userId}\`)\n` +
            `**Рекрутер:** ${interaction.user} (\`${interaction.user.tag}\`)\n` +
            `**Канал:** \`#${channel?.name || 'ticket'}\`\n` +
            `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
          )
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment] });
      }
    }

    // Bot log
    const botEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Заявка в семью одобрена')
      .setDescription(
        `**Кандидат:** <@${application.userId}> (\`${application.userTag}\`)\n` +
        `**Рекрутер:** ${interaction.user}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();
    await AuditLogger.sendLog(guild, 'BOT', botEmbed);

    await interaction.editReply({
      content: `✅ Заявка одобрена! Роль выдана. Канал будет удален через 5 секунд...`,
    });

    setTimeout(async () => {
      if (channel && typeof channel.delete === 'function') {
        await channel.delete('Application approved').catch(() => null);
      }
    }, 5000);
  }

  /**
   * Prompt rejection reason modal
   */
  public static async promptRejectModal(interaction: ButtonInteraction, applicationId: string): Promise<void> {
    const member = interaction.member as GuildMember;
    if (!(await this.isRecruiter(member))) {
      await interaction.reply({ content: '❌ У вас нет прав рекрутера для этого действия.', ephemeral: true });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`recruit_modal_reject_${applicationId}`)
      .setTitle('Укажите причину отказа');

    const reasonInput = new TextInputBuilder()
      .setCustomId('rejection_reason')
      .setLabel('Причина отказа (будет отправлена в ЛС)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Недостаточный онлайн / не подходите по критериям...')
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
    await interaction.showModal(modal);
  }

  /**
   * Process rejection modal submit
   */
  public static async handleRejectSubmit(interaction: ModalSubmitInteraction, applicationId: string): Promise<void> {
    const reason = interaction.fields.getTextInputValue('rejection_reason');
    await interaction.deferReply();

    const guild = await this.resolveGuild(interaction);
    if (!guild) {
      await interaction.editReply({ content: '❌ Сервер Discord не найден.' });
      return;
    }

    const application = await prisma.recruitmentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      await interaction.editReply({ content: '❌ Заявка не найдена.' });
      return;
    }

    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId: guild.id },
    });

    const targetMember = await guild.members.fetch(application.userId).catch(() => null);

    // 1. Send DM with rejection reason
    if (targetMember) {
      await targetMember.send({
        content: `❌ Здравствуйте. К сожалению, вы не прошли собеседование в семью на сервере **${guild.name}**.\n\n**Причина отказа:**\n${reason}`,
      }).catch(() => {
        console.log(`Could not send rejection DM to ${application.userId} (DMs closed)`);
      });

      // Kick member
      await targetMember.kick(`Отказ в заявке: ${reason}`).catch(e => {
        console.error('Failed to kick member:', e);
      });
    }

    // 2. Update DB
    await prisma.recruitmentApplication.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        recruiterId: interaction.user.id,
        recruiterTag: interaction.user.tag,
        closedAt: new Date(),
      },
    });

    // 3. Transcript & Logs
    const channel = interaction.channel as TextChannel;
    const transcriptAttachment = channel ? await TranscriptService.generateTranscript(channel) : null;

    const logChannelId = config?.logChannelId;
    if (logChannelId && transcriptAttachment) {
      const logChannel = (guild.channels.cache.get(logChannelId) ||
        await guild.channels.fetch(logChannelId).catch(() => null)) as TextChannel | null;
      if (logChannel && logChannel.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`❌ Заявка отклонена: ${application.userTag}`)
          .setDescription(
            `**Кандидат:** <@${application.userId}> (\`${application.userId}\`)\n` +
            `**Рекрутер:** ${interaction.user} (\`${interaction.user.tag}\`)\n` +
            `**Причина:** ${reason}\n` +
            `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
          )
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed], files: [transcriptAttachment] });
      }
    }

    // Bot log
    const botEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('❌ Заявка отклонена и кандидат кикнут')
      .setDescription(
        `**Кандидат:** <@${application.userId}> (\`${application.userTag}\`)\n` +
        `**Рекрутер:** ${interaction.user}\n` +
        `**Причина:** ${reason}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();
    await AuditLogger.sendLog(guild, 'BOT', botEmbed);

    await interaction.editReply({
      content: `❌ Заявка отклонена. Пользователь кикнут. Канал будет удален через 5 секунд...`,
    });

    setTimeout(async () => {
      if (channel && typeof channel.delete === 'function') {
        await channel.delete('Application rejected').catch(() => null);
      }
    }, 5000);
  }
}
