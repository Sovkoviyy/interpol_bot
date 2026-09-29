import { 
  ChannelType, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  Message, 
  TextChannel, 
  Guild 
} from 'discord.js';
import bot from '../../client';
import prisma from '../../../database/client';
import appConfig from '../../../config';

export class HoneypotManager {
  /**
   * Retrieve or create default honeypot config
   */
  public async getConfig() {
    try {
      let config = await prisma.honeypotConfig.findUnique({
        where: { id: 'default' },
      });

      if (!config) {
        config = await prisma.honeypotConfig.create({
          data: {
            id: 'default',
            channelName: 'канал-ловушка',
            enabled: true,
            action: 'KICK',
            deleteSeconds: 600,
            totalCaught: 0,
            whitelistRoles: '[]',
            embedTitle: '🛡️ Канал-ловушка автомодерации',
            embedDescription: '⚠️ **НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ**\n\nЭтот канал используется для выявления спам-ботов.\nЛюбое сообщение здесь приведёт к немедленной блокировке.',
          },
        });
      }

      return config;
    } catch (err: any) {
      console.warn('⚠️ [Honeypot] DB read error:', err?.message);
      return {
        id: 'default',
        guildId: null,
        channelId: null,
        channelName: 'канал-ловушка',
        messageId: null,
        enabled: true,
        action: 'KICK',
        deleteSeconds: 600,
        totalCaught: 0,
        whitelistRoles: '[]',
        embedTitle: '🛡️ Канал-ловушка автомодерации',
        embedDescription: '⚠️ **НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ**\n\nЭтот канал используется для выявления спам-ботов.\nЛюбое сообщение здесь приведёт к немедленной блокировке.',
        updatedAt: new Date(),
        createdAt: new Date(),
      };
    }
  }

  /**
   * Auto-sync Honeypot channel on bot startup or gateway reconnection
   */
  public async autoSync(): Promise<void> {
    if (!bot.isReady()) return;

    try {
      const config = await this.getConfig();
      if (!config.enabled) {
        console.log('ℹ️ [Honeypot] Trap channel is disabled in configuration.');
        return;
      }

      let channel: TextChannel | null = null;

      // 1. Try to fetch existing channel by ID
      if (config.channelId) {
        channel = (bot.channels.cache.get(config.channelId) as TextChannel) || null;
        if (!channel) {
          channel = (await bot.channels.fetch(config.channelId).catch(() => null)) as TextChannel | null;
        }
      }

      // 2. If channel not found by ID, auto-discover across guilds by name
      if (!channel) {
        const targetName = (config.channelName || 'канал-ловушка').toLowerCase();
        for (const guild of bot.guilds.cache.values()) {
          try {
            const fetched = await guild.channels.fetch().catch(() => null);
            const channelList = fetched ? Array.from(fetched.values()) : Array.from(guild.channels.cache.values());
            const found = channelList.find(
              (c: any) =>
                c &&
                (c.name?.toLowerCase() === targetName ||
                  c.name?.toLowerCase() === 'канал-ловушка') &&
                (c.type === ChannelType.GuildText || Number(c.type) === 0)
            ) as TextChannel | undefined;

            if (found) {
              channel = found;
              console.log(`🛡️ [Honeypot Auto-Sync] Auto-discovered #${found.name} (${found.id}) in "${guild.name}"`);

              await prisma.honeypotConfig.upsert({
                where: { id: 'default' },
                update: {
                  guildId: guild.id,
                  channelId: found.id,
                  channelName: found.name,
                },
                create: {
                  id: 'default',
                  guildId: guild.id,
                  channelId: found.id,
                  channelName: found.name,
                },
              });
              config.channelId = found.id;
              config.guildId = guild.id;
              config.channelName = found.name;
              break;
            }
          } catch (e: any) {
            console.warn(`⚠️ [Honeypot Auto-Sync] Guild channels fetch error (${guild.id}):`, e?.message);
          }
        }
      }

      // 3. Ensure warning embed is posted & pinned in the channel
      if (channel) {
        await this.ensureWarningEmbedInChannel(channel, config);
        console.log(`✅ [Honeypot Auto-Sync] Active & monitoring #${channel.name} (${channel.id})`);
      } else {
        console.log('ℹ️ [Honeypot Auto-Sync] No honeypot channel bound or found in connected guilds.');
      }
    } catch (err: any) {
      console.warn('⚠️ [Honeypot Auto-Sync] Error during auto-sync:', err?.message);
    }
  }

  /**
   * Helper to ensure the official warning embed is sent and pinned in the channel
   */
  private async ensureWarningEmbedInChannel(channel: TextChannel, config: any): Promise<void> {
    try {
      let warningMsg: Message | null = null;
      if (config.messageId) {
        warningMsg = await channel.messages.fetch(config.messageId).catch(() => null);
      }

      const embed = this.buildTrapEmbed(config);

      if (warningMsg) {
        await warningMsg.edit({ embeds: [embed] }).catch(() => null);
      } else {
        // Look for any existing warning embed by the bot in recent messages
        const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
        if (recent) {
          const existingBotEmbed = recent.find(
            (m) => m.author.id === bot.user?.id && m.embeds.length > 0 && (m.embeds[0].title?.includes('ловушка') || m.embeds[0].title?.includes('Автомодерация'))
          );
          if (existingBotEmbed) {
            warningMsg = existingBotEmbed;
            await warningMsg.edit({ embeds: [embed] }).catch(() => null);
            await warningMsg.pin().catch(() => {});
          }
        }

        if (!warningMsg) {
          warningMsg = await channel.send({ embeds: [embed] });
          await warningMsg.pin().catch(() => {});
          await this.cleanSystemMessages(channel);
        }

        if (warningMsg) {
          await prisma.honeypotConfig.update({
            where: { id: 'default' },
            data: { messageId: warningMsg.id },
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ [Honeypot] ensureWarningEmbedInChannel error:`, err?.message);
    }
  }

  /**
   * Remove any Discord system messages (e.g. "pinned a message") to keep channel clean
   */
  private async cleanSystemMessages(channel: TextChannel): Promise<void> {
    try {
      const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
      if (recent) {
        for (const m of recent.values()) {
          if (m.system || Number(m.type) !== 0) {
            await m.delete().catch(() => {});
          }
        }
      }
    } catch {}
  }

  /**
   * Automatically create or reconfigure the honeypot channel on Discord guild
   */
  public async setupChannel(targetGuildId?: string) {
    if (!bot.isReady()) {
      throw new Error('Discord бот не подключен к сети');
    }

    let guild: Guild | null = null;
    if (targetGuildId && targetGuildId !== 'default') {
      guild = bot.guilds.cache.get(targetGuildId) || await bot.guilds.fetch(targetGuildId).catch(() => null);
    }

    const config = await this.getConfig();
    if (!guild && config.guildId && config.guildId !== 'default') {
      guild = bot.guilds.cache.get(config.guildId) || await bot.guilds.fetch(config.guildId).catch(() => null);
    }

    if (!guild && appConfig.discord.guildId) {
      guild = bot.guilds.cache.get(appConfig.discord.guildId) || await bot.guilds.fetch(appConfig.discord.guildId).catch(() => null);
    }

    if (!guild) {
      guild = bot.guilds.cache.first() || null;
    }

    if (!guild) {
      throw new Error('Сервер Discord не найден или бот не добавлен на сервер');
    }

    let channel: TextChannel | null = null;

    // Check if channel already exists by ID
    if (config.channelId) {
      channel = (guild.channels.cache.get(config.channelId) as TextChannel) || null;
      if (!channel) {
        channel = await guild.channels.fetch(config.channelId).catch(() => null) as TextChannel | null;
      }
    }

    // Check if channel with target name already exists in guild
    if (!channel) {
      const fetchedChannels = await guild.channels.fetch().catch(() => null);
      const channelList = fetchedChannels ? Array.from(fetchedChannels.values()) : Array.from(guild.channels.cache.values());
      const targetName = (config.channelName || 'канал-ловушка').toLowerCase();
      const existing = channelList.find(
        (c: any) =>
          c &&
          (c.name?.toLowerCase() === targetName ||
            c.name?.toLowerCase() === 'канал-ловушка') &&
          (c.type === ChannelType.GuildText || Number(c.type) === 0)
      ) as TextChannel | undefined;
      if (existing) {
        channel = existing;
      }
    }

    // If channel doesn't exist, create it
    if (!channel) {
      channel = await guild.channels.create({
        name: config.channelName || 'канал-ловушка',
        type: ChannelType.GuildText,
        topic: '🛡️ Автомодерация: ловушка для спам-ботов. Сообщения строго запрещены.',
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
            deny: [
              PermissionFlagsBits.AddReactions,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads,
            ],
          },
          {
            id: bot.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });
    }

    // Build Warning Embed Message
    const embed = this.buildTrapEmbed(config);

    // Send or update warning message
    let warningMsg: Message | null = null;
    if (config.messageId) {
      try {
        warningMsg = await channel.messages.fetch(config.messageId);
        await warningMsg.edit({ embeds: [embed] });
      } catch {
        warningMsg = null;
      }
    }

    if (!warningMsg) {
      warningMsg = await channel.send({ embeds: [embed] });
      try {
        await warningMsg.pin();
        await this.cleanSystemMessages(channel);
      } catch {
        // ignore pin limit error
      }
    }

    // Save channel and message ID safely via upsert
    const updated = await prisma.honeypotConfig.upsert({
      where: { id: 'default' },
      update: {
        guildId: guild.id,
        channelId: channel.id,
        channelName: channel.name,
        messageId: warningMsg.id,
      },
      create: {
        id: 'default',
        guildId: guild.id,
        channelId: channel.id,
        channelName: channel.name,
        messageId: warningMsg.id,
      },
    });

    console.log(`🛡️ [Honeypot] Channel configured: #${channel.name} (${channel.id}) on guild "${guild.name}"`);

    return {
      success: true,
      guildId: guild.id,
      channelId: channel.id,
      channelName: channel.name,
      messageId: warningMsg.id,
      config: updated,
    };
  }

  /**
   * Send the warning trap embed message directly into a chosen Discord channel and pin it
   */
  public async sendEmbedToChannel(targetChannelId: string, targetGuildId?: string) {
    if (!bot.isReady()) {
      throw new Error('Discord бот не подключен к сети');
    }

    if (!targetChannelId || !targetChannelId.trim()) {
      throw new Error('ID канала Discord не указан');
    }

    const cleanChannelId = targetChannelId.trim();

    // Fetch the channel from Discord
    const channel = (await bot.channels.fetch(cleanChannelId).catch((err: any) => {
      console.warn('⚠️ [Honeypot] Channel fetch error:', err?.message);
      return null;
    })) as TextChannel | null;

    if (!channel) {
      throw new Error(`Канал с ID ${cleanChannelId} не найден в Discord или бот не имеет к нему доступа`);
    }

    if (!channel.isTextBased()) {
      throw new Error('Указанный канал не является текстовым каналом Discord');
    }

    // Check bot permissions in this channel
    if (channel.guild) {
      const me = channel.guild.members.me;
      if (me) {
        const perms = channel.permissionsFor(me);
        if (!perms.has(PermissionFlagsBits.ViewChannel)) {
          throw new Error(`У бота нет прав на просмотр канала #${channel.name}`);
        }
        if (!perms.has(PermissionFlagsBits.SendMessages)) {
          throw new Error(`У бота нет прав на отправку сообщений в канал #${channel.name}`);
        }
        if (!perms.has(PermissionFlagsBits.EmbedLinks)) {
          throw new Error(`У бота нет прав на встраивание ссылок (Embed Links) в канале #${channel.name}`);
        }
      }
    }

    const config = await this.getConfig();
    const embed = this.buildTrapEmbed(config);

    // Send the embed message
    const msg = await channel.send({ embeds: [embed] });

    // Pin the message
    await msg.pin().catch(() => {});
    await this.cleanSystemMessages(channel);

    // Save channelId, channelName, guildId, and messageId to database permanently
    const updated = await prisma.honeypotConfig.upsert({
      where: { id: 'default' },
      update: {
        guildId: channel.guildId || targetGuildId || config.guildId,
        channelId: channel.id,
        channelName: channel.name,
        messageId: msg.id,
      },
      create: {
        id: 'default',
        guildId: channel.guildId || targetGuildId || config.guildId,
        channelId: channel.id,
        channelName: channel.name,
        messageId: msg.id,
      },
    });

    console.log(`🛡️ [Honeypot] Embed successfully sent to #${channel.name} (${channel.id}), msg ID: ${msg.id}`);

    return {
      success: true,
      channelId: channel.id,
      channelName: channel.name,
      guildId: channel.guildId,
      messageId: msg.id,
      config: updated,
    };
  }

  /**
   * Build the official warning embed with live counter
   */
  public buildTrapEmbed(config: any): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(config.embedTitle || '🛡️ Канал-ловушка автомодерации')
      .setDescription(
        config.embedDescription ||
        '⚠️ **НЕ ПИШИТЕ СООБЩЕНИЯ В ЭТОТ КАНАЛ**\n\n' +
        'Этот канал используется для выявления спам-ботов.\n' +
        'Любое сообщение здесь приведёт к немедленной блокировке.'
      )
      .setColor(0xED4245) // Discord Red
      .addFields(
        {
          name: '📊 Статистика защиты',
          value: `• Поймано и наказано нарушителей: **${config.totalCaught || 0}**\n• Статус ловушки: **${config.enabled ? 'Активна 🟢' : 'Выключена 🔴'}**\n• Наказание: **${config.action === 'BAN' ? 'Блокировка (Бан)' : 'Кик с сервера'}**`,
          inline: false,
        },
        {
          name: '⚠️ Предупреждение',
          value: 'Канал находится под круглосуточным автоматическим контролем бота. Все сообщения в этом канале моментально удаляются, а автор исключается с сервера с удалением всей истории сообщений за последние 10 минут.',
          inline: false,
        }
      )
      .setFooter({ text: 'INTERPOL Security System • Автомодерация' })
      .setTimestamp();
  }

  /**
   * Update the warning embed message in Discord
   */
  public async refreshWarningMessage(): Promise<void> {
    const config = await this.getConfig();
    if (!config.channelId || !bot.isReady()) return;

    try {
      const channel = (await bot.channels.fetch(config.channelId).catch(() => null)) as TextChannel | null;
      if (!channel) return;

      let msg: Message | null = null;
      if (config.messageId) {
        msg = await channel.messages.fetch(config.messageId).catch(() => null);
      }

      const embed = this.buildTrapEmbed(config);
      if (msg) {
        await msg.edit({ embeds: [embed] }).catch(() => null);
      } else {
        const newMsg = await channel.send({ embeds: [embed] }).catch(() => null);
        if (newMsg) {
          await newMsg.pin().catch(() => {});
          await prisma.honeypotConfig.update({
            where: { id: 'default' },
            data: { messageId: newMsg.id },
          }).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn('⚠️ [Honeypot] Failed to refresh warning message:', err?.message);
    }
  }

  /**
   * Handle incoming message in honeypot channel
   */
  public async handleMessage(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    // Must be a text-based channel
    if (!message.channel.isTextBased()) return;

    const config = await this.getConfig();
    if (!config.enabled) return;

    const channel = message.channel as TextChannel;
    const chName = channel.name?.toLowerCase() || '';
    const targetName = (config.channelName || 'канал-ловушка').toLowerCase();

    // Check if message belongs to trap channel (strictly by bound ID if set, or exact matching name)
    const isTrapChannel = Boolean(config.channelId)
      ? message.channelId === config.channelId
      : (chName === targetName || chName === 'канал-ловушка');

    if (!isTrapChannel) return;

    // Auto-bind channel ID only if it was never bound before
    if (!config.channelId) {
      config.channelId = message.channelId;
      config.guildId = message.guild.id;
      config.channelName = channel.name;
      await prisma.honeypotConfig.upsert({
        where: { id: 'default' },
        update: {
          guildId: message.guild.id,
          channelId: message.channelId,
          channelName: channel.name,
        },
        create: {
          id: 'default',
          guildId: message.guild.id,
          channelId: message.channelId,
          channelName: channel.name,
        },
      }).catch(() => {});
      console.log(`🛡️ [Honeypot] Auto-bound trap channel to #${channel.name} (${message.channelId})`);
    }

    // Clean up system messages (such as "pinned a message to this channel")
    if (message.system) {
      await message.delete().catch(() => {});
      return;
    }

    const spamContent = message.content ? message.content.substring(0, 500) : '[Без текста / Вложение]';
    console.log(`🚨 [Honeypot TRAP TRIGGERED] User ${message.author.tag} (${message.author.id}) posted in #${channel.name}: "${spamContent}"`);

    // 1. Delete triggering message IMMEDIATELY so the trap channel stays completely clean
    await message.delete().catch((err) => {
      console.warn('⚠️ [Honeypot] Failed to delete message:', err?.message);
    });

    // 2. Check whitelist roles and admin privileges
    let whitelist: string[] = [];
    try {
      whitelist = JSON.parse(config.whitelistRoles || '[]');
    } catch {
      whitelist = [];
    }

    const member = message.member || (await message.guild.members.fetch(message.author.id).catch(() => null));
    const isAdmin =
      member?.permissions.has(PermissionFlagsBits.Administrator) ||
      message.guild.ownerId === message.author.id;
    const isWhitelisted = member?.roles.cache.some((r) => whitelist.includes(r.id));

    // Admin & Whitelist safety:
    // Do NOT ban/kick server admins or whitelisted members when they test or accidentally post!
    // Instead: delete their message, record in HoneypotLog so dashboard displays the incident,
    // and show a temporary auto-deleting confirmation notice in the channel.
    if (isAdmin || isWhitelisted) {
      const roleType = isAdmin ? 'права Администратора' : 'роль из белого списка';
      console.log(`🛡️ [Honeypot] User ${message.author.tag} has ${roleType}. Message deleted without ban/kick.`);

      await prisma.honeypotLog.create({
        data: {
          guildId: message.guild.id,
          userId: message.author.id,
          userTag: message.author.tag,
          userAvatar: message.author.displayAvatarURL(),
          actionTaken: isAdmin ? 'ИММУНИТЕТ (АДМИНИСТРАТОР)' : 'ИММУНИТЕТ (WHITELIST)',
          messageContent: spamContent,
        },
      }).catch(() => {});

      const notice = await channel.send({
        content: `⚠️ <@${message.author.id}>, **это канал-ловушка автомодерации!**\nВаше сообщение удалено. Вы не были исключены с сервера, так как обладаете (${roleType}).\n*Обычные пользователи и спам-боты за любое сообщение здесь получают немедленный ${config.action === 'BAN' ? 'бан' : 'кик'} с сервера.*`,
      }).catch(() => null);

      if (notice) {
        setTimeout(() => notice.delete().catch(() => null), 7000);
      }

      return;
    }

    // 3. Punish non-exempt violators (spammers, raid bots, unverified members)
    const action = config.action || 'KICK';
    const deleteSec = config.deleteSeconds || 600; // 10 minutes
    let punished = false;

    try {
      // Banning with deleteMessageSeconds purges all messages across the guild for the past 10 minutes
      await message.guild.members.ban(message.author.id, {
        deleteMessageSeconds: deleteSec,
        reason: 'Автомодерация: ловушка спам-ботов (канал-ловушка)',
      });

      if (action === 'KICK') {
        // Softban: unban immediately to complete the kick with message purge
        await message.guild.members.unban(
          message.author.id,
          'Снятие бана после софтбана в ловушке (кик + очистка 10 мин сообщений)'
        ).catch(() => {});
      }

      punished = true;
      console.log(`🛡️ [Honeypot] Successfully executed ${action} on ${message.author.tag}`);
    } catch (err: any) {
      console.error(`❌ [Honeypot] Failed to ban/kick ${message.author.tag}:`, err?.message);
      // Fallback: try regular kick
      if (member && member.kickable) {
        await member.kick('Автомодерация: ловушка спам-ботов').catch(() => {});
        punished = true;
      }
    }

    // 4. Increment counter in DB
    try {
      await prisma.honeypotConfig.update({
        where: { id: 'default' },
        data: { totalCaught: { increment: 1 } },
      });
    } catch (e) {
      // ignore
    }

    // 5. Record incident in HoneypotLog
    try {
      await prisma.honeypotLog.create({
        data: {
          guildId: message.guild.id,
          userId: message.author.id,
          userTag: message.author.tag,
          userAvatar: message.author.displayAvatarURL(),
          actionTaken: punished ? (action === 'BAN' ? 'БАН (10М ОЧИСТКА)' : 'КИК (СОФТБАН 10М)') : 'ОШИБКА_НАКАЗАНИЯ',
          messageContent: spamContent,
        },
      });
    } catch (e) {
      // ignore
    }

    // 6. Update warning embed in the channel with updated count
    await this.refreshWarningMessage().catch(() => {});
  }
}

export const honeypotManager = new HoneypotManager();
export default honeypotManager;
