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

    // Check if channel with name 'канал-ловушка' already exists in guild
    if (!channel) {
      if (guild.channels.cache.size === 0) {
        await guild.channels.fetch().catch(() => null);
      }
      const existing = guild.channels.cache.find(
        (c) => c.name === (config.channelName || 'канал-ловушка') && (c.type === ChannelType.GuildText || Number(c.type) === 0)
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
    if (!config.channelId || !config.messageId || !bot.isReady()) return;

    try {
      const channel = (await bot.channels.fetch(config.channelId).catch(() => null)) as TextChannel | null;
      if (!channel) return;

      const msg = await channel.messages.fetch(config.messageId).catch(() => null);
      if (msg) {
        const embed = this.buildTrapEmbed(config);
        await msg.edit({ embeds: [embed] });
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

    const config = await this.getConfig();
    if (!config.enabled || !config.channelId) return;

    // Check if message was sent in honeypot channel
    if (message.channelId !== config.channelId) return;

    // Check whitelist roles
    let whitelist: string[] = [];
    try {
      whitelist = JSON.parse(config.whitelistRoles || '[]');
    } catch {
      whitelist = [];
    }

    const member = message.member;
    if (member) {
      // Exempt administrators and owners
      if (member.permissions.has(PermissionFlagsBits.Administrator) || message.guild.ownerId === member.id) {
        console.log(`🛡️ [Honeypot] Admin ${message.author.tag} typed in trap channel, ignoring.`);
        return;
      }

      // Exempt whitelisted roles
      const hasWhitelistedRole = member.roles.cache.some((r) => whitelist.includes(r.id));
      if (hasWhitelistedRole) {
        console.log(`🛡️ [Honeypot] Whitelisted user ${message.author.tag} typed in trap channel, ignoring.`);
        return;
      }
    }

    const spamContent = message.content ? message.content.substring(0, 500) : '[Без текста / Вложение]';
    console.log(`🚨 [Honeypot TRAP TRIGGERED] User ${message.author.tag} (${message.author.id}) posted in honeypot: "${spamContent}"`);

    // 1. Delete triggering message immediately
    await message.delete().catch(() => {});

    // 2. Punish: Ban with 10-minute message deletion (and unban if KICK/Softban)
    const action = config.action || 'KICK';
    const deleteSec = config.deleteSeconds || 600; // 10 minutes

    try {
      // Banning with deleteMessageSeconds deletes ALL messages across the server for the past 10 minutes
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

      console.log(`🛡️ [Honeypot] Successfully executed ${action} on ${message.author.tag}`);
    } catch (err: any) {
      console.error(`❌ [Honeypot] Failed to ban/kick ${message.author.tag}:`, err?.message);
      // Fallback: try regular kick
      await member?.kick('Автомодерация: ловушка спам-ботов').catch(() => {});
    }

    // 3. Increment counter in DB
    let newTotal = config.totalCaught + 1;
    try {
      const updated = await prisma.honeypotConfig.update({
        where: { id: 'default' },
        data: { totalCaught: { increment: 1 } },
      });
      newTotal = updated.totalCaught;
    } catch (e) {
      // ignore
    }

    // 4. Record incident in HoneypotLog
    try {
      await prisma.honeypotLog.create({
        data: {
          guildId: message.guild.id,
          userId: message.author.id,
          userTag: message.author.tag,
          userAvatar: message.author.displayAvatarURL(),
          actionTaken: action,
          messageContent: spamContent,
        },
      });
    } catch (e) {
      // ignore
    }

    // 5. Update warning embed in the channel with updated count
    await this.refreshWarningMessage();
  }
}

export const honeypotManager = new HoneypotManager();
export default honeypotManager;
