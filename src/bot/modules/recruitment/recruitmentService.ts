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

export class RecruitmentService {
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
    const guild = interaction.guild;
    if (!guild) return;

    await interaction.deferReply({ ephemeral: true });

    // Check if recruitment is enabled
    const guildConfig = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
    if (guildConfig && !guildConfig.recruitmentEnabled) {
      await interaction.editReply({ content: '❌ Прием заявок в семью в данный момент закрыт.' });
      return;
    }

    const recConfig = await prisma.recruitmentConfig.findUnique({ where: { guildId: guild.id } });
    if (!recConfig) {
      await interaction.editReply({ content: '❌ Модуль заявок еще не настроен администратором.' });
      return;
    }

    // Check if user already has an active application
    const existing = await prisma.recruitmentApplication.findFirst({
      where: {
        guildId: guild.id,
        userId: interaction.user.id,
        status: { in: ['PENDING', 'UNDER_REVIEW'] },
      },
    });

    if (existing && existing.channelId) {
      await interaction.editReply({
        content: `❌ У вас уже есть открытая заявка в канале <#${existing.channelId}>!`,
      });
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

    // Create private ticket channel
    const overwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: guild.members.me?.id || '',
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      },
    ];

    for (const roleId of recruiterRoleIds) {
      if (guild.roles.cache.has(roleId)) {
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

    const channelName = `заявка-${interaction.user.username.replace(/[^a-zA-Z0-9А-Яа-я_-]/g, '').slice(0, 20)}`;
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: recConfig.categoryId || undefined,
      permissionOverwrites: overwrites,
    });

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
    const recruiterPings = recruiterRoleIds.map(r => `<@&${r}>`).join(' ');
    await ticketChannel.send({
      content: `${interaction.user} ${recruiterPings}`,
      embeds: [embed],
      components: [buttonsRow],
    });

    await interaction.editReply({
      content: `✅ Ваша заявка успешно создана! Перейдите в канал: <#${ticketChannel.id}>`,
    });

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
    await AuditLogger.sendLog(guild, 'BOT', logEmbed);
  }

  /**
   * Check if member is a recruiter or admin
   */
  public static async isRecruiter(member: GuildMember): Promise<boolean> {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId: member.guild.id },
    });
    if (!config) return false;

    let roles: string[] = [];
    try {
      roles = JSON.parse(config.recruiterRoleIds || '[]');
    } catch {
      roles = [];
    }

    return roles.some(r => member.roles.cache.has(r));
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

    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    // 1. Give role to applicant
    const targetMember = await interaction.guild!.members.fetch(application.userId).catch(() => null);
    if (targetMember && config?.memberRoleId) {
      await targetMember.roles.add(config.memberRoleId).catch(e => {
        console.error('Failed to grant family role:', e);
      });
    }

    // 2. Send DM notification
    if (targetMember) {
      await targetMember.send({
        content: `🎉 **Поздравляем!** Ваша заявка в семью на сервере **${interaction.guild!.name}** была **одобрена** рекрутером ${interaction.user.tag}!\nВам выдана роль участника семьи. Добро пожаловать!`,
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
    const transcriptAttachment = await TranscriptService.generateTranscript(channel);

    const logChannelId = config?.logChannelId;
    if (logChannelId) {
      const logChannel = interaction.guild!.channels.cache.get(logChannelId) as TextChannel | undefined;
      if (logChannel && logChannel.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(`✅ Заявка одобрена: ${application.userTag}`)
          .setDescription(
            `**Кандидат:** <@${application.userId}> (\`${application.userId}\`)\n` +
            `**Рекрутер:** ${interaction.user} (\`${interaction.user.tag}\`)\n` +
            `**Канал:** \`#${channel.name}\`\n` +
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
    await AuditLogger.sendLog(interaction.guild!, 'BOT', botEmbed);

    await interaction.editReply({
      content: `✅ Заявка одобрена! Роль выдана. Канал будет удален через 5 секунд...`,
    });

    setTimeout(async () => {
      await channel.delete('Application approved').catch(() => null);
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

    const application = await prisma.recruitmentApplication.findUnique({
      where: { id: applicationId },
    });
    if (!application) {
      await interaction.editReply({ content: '❌ Заявка не найдена.' });
      return;
    }

    const config = await prisma.recruitmentConfig.findUnique({
      where: { guildId: interaction.guildId! },
    });

    const targetMember = await interaction.guild!.members.fetch(application.userId).catch(() => null);

    // 1. Send DM with rejection reason
    if (targetMember) {
      await targetMember.send({
        content: `❌ Здравствуйте. К сожалению, вы не прошли собеседование в семью на сервере **${interaction.guild!.name}**.\n\n**Причина отказа:**\n${reason}`,
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
    const transcriptAttachment = await TranscriptService.generateTranscript(channel);

    const logChannelId = config?.logChannelId;
    if (logChannelId) {
      const logChannel = interaction.guild!.channels.cache.get(logChannelId) as TextChannel | undefined;
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
    await AuditLogger.sendLog(interaction.guild!, 'BOT', botEmbed);

    await interaction.editReply({
      content: `❌ Заявка отклонена. Пользователь кикнут. Канал будет удален через 5 секунд...`,
    });

    setTimeout(async () => {
      await channel.delete('Application rejected').catch(() => null);
    }, 5000);
  }
}
