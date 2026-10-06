import { 
  Events, 
  GuildMember, 
  PartialGuildMember, 
  AuditLogEvent, 
  EmbedBuilder, 
  GuildBan,
  TextChannel,
} from 'discord.js';
import bot from '../../../client';
import prisma from '../../../../database/client';
import { AuditLogger } from '../auditLogger';
import { RolePersistenceService } from '../../roles/rolePersistenceService';
import { buildCustomTemplateEmbed } from '../../../utils/templateEmbed';
import { NicknameService } from '../../nicknames/nicknameService';
import { BotMessageManager } from '../../../utils/botMessageManager';
import { RecruitmentService } from '../../recruitment/recruitmentService';

export function registerMemberLogs() {
  // Member Join
  bot.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    // Role restoration has been disabled per user request

    // Track invite link used to join
    const inviteInfo = await import('./inviteLogs').then(m => m.trackMemberJoinInvite(member)).catch(() => null);

    // Send customizable welcome message if enabled
    try {
      const msgConfig = await prisma.botMessagesConfig.findUnique({
        where: { guildId: member.guild.id },
      });
      if (msgConfig && msgConfig.welcomeEnabled && msgConfig.welcomeChannelId) {
        const welcomeChannel = (member.guild.channels.cache.get(msgConfig.welcomeChannelId) ||
          await member.guild.channels.fetch(msgConfig.welcomeChannelId).catch(() => null)) as TextChannel | null;
        if (welcomeChannel && welcomeChannel.isTextBased()) {
          const rendered = await BotMessageManager.renderMessage(member.guild.id, 'welcome', {
            user: `<@${member.id}>`,
            username: member.user.username,
            guild: member.guild.name,
            memberCount: String(member.guild.memberCount),
            date: new Date().toLocaleDateString('ru-RU'),
          });

          if (rendered.enabled) {
            rendered.embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
            await welcomeChannel.send({
              content: rendered.content,
              embeds: [rendered.embed],
            }).catch(() => null);
          }
        }
      }
    } catch (err) {
      console.error('[BotMessages] Error dispatching welcome message:', err);
    }

    // Send personal Welcome DM if enabled
    try {
      BotMessageManager.sendDM(member.guild.id, member, 'welcome_dm', {
        user: `<@${member.id}>`,
        username: member.user.username,
        guild: member.guild.name,
        memberCount: String(member.guild.memberCount),
      }).catch(() => null);
    } catch {}

    const accountAgeDays = Math.floor((Date.now() - member.user.createdTimestamp) / (24 * 3600 * 1000));
    const embed = new EmbedBuilder()
      .setColor(0x57F287) // Green
      .setTitle('📥 Новый участник присоединился')
      .setDescription(
        `**Пользователь:** ${member} (\`${member.user.tag}\` / \`${member.id}\`)\n` +
        (inviteInfo ? `**Инвайт:** \`${inviteInfo.code}\`${inviteInfo.inviterTag ? ` (пригласил: \`${inviteInfo.inviterTag}\`)` : ''}\n` : '') +
        `**Возраст аккаунта:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R> (${accountAgeDays} дн.)\n` +
        `**Всего участников:** ${member.guild.memberCount}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    const meta = {
      action: 'MEMBER_JOIN',
      targetId: member.id,
      targetTag: member.user.tag,
      details: `Вход на сервер. Инвайт: ${inviteInfo?.code || 'Неизвестно'} (пригласил: ${inviteInfo?.inviterTag || 'Неизвестно'})`,
      metadata: {
        inviteCode: inviteInfo?.code,
        inviterTag: inviteInfo?.inviterTag,
        inviterId: inviteInfo?.inviterId,
        accountAgeDays,
      },
    };

    if (member.user.bot) {
      await AuditLogger.sendLog(member.guild, 'BOT', embed, meta);
    } else {
      await AuditLogger.sendLog(member.guild, 'MEMBERS', embed, meta);
    }
  });

  // Member Leave / Kick
  bot.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    // Cleanup recruitment application
    await RecruitmentService.handleApplicantLeave(member.guild.id, member.id).catch(() => null);

    // Role saving has been disabled per user request

    const kickEntry = await AuditLogger.getAuditLogEntry(
      member.guild, 
      AuditLogEvent.MemberKick, 
      member.id
    );

    const isKicked = !!kickEntry;
    const kickExecutor = kickEntry?.executor || null;
    const kickReason = kickEntry?.reason || 'Причина не указана';

    // Send customizable leave message if enabled
    try {
      const msgConfig = await prisma.botMessagesConfig.findUnique({
        where: { guildId: member.guild.id },
      });
      if (msgConfig && msgConfig.leaveEnabled && msgConfig.leaveChannelId) {
        const leaveChannel = (member.guild.channels.cache.get(msgConfig.leaveChannelId) ||
          await member.guild.channels.fetch(msgConfig.leaveChannelId).catch(() => null)) as TextChannel | null;
        if (leaveChannel && leaveChannel.isTextBased()) {
          const userTag = member.user?.tag || member.id;
          const rendered = await BotMessageManager.renderMessage(member.guild.id, 'leave', {
            user: `**${userTag}**`,
            username: member.user?.username || userTag,
            guild: member.guild.name,
            memberCount: String(member.guild.memberCount),
            date: new Date().toLocaleDateString('ru-RU'),
          });

          if (rendered.enabled) {
            await leaveChannel.send({
              content: rendered.content,
              embeds: [rendered.embed],
            }).catch(() => null);
          }
        }
      }
    } catch (err) {
      console.error('[BotMessages] Error dispatching leave message:', err);
    }

    const logEmbed = new EmbedBuilder()
      .setColor(isKicked ? 0xED4245 : 0xE67E22)
      .setTitle(isKicked ? '👢 Участник был исключен (Кик)' : '📤 Участник покинул сервер')
      .setDescription(
        `**Пользователь:** ${member.user?.tag || member.id} (\`${member.id}\`)\n` +
        (isKicked ? `**Исключил модератор:** ${kickExecutor ? `${kickExecutor} (\`${kickExecutor.tag}\`)` : 'Неизвестно'}\n` : '') +
        (isKicked ? `**Причина:** ${kickReason}\n` : '') +
        `**Всего участников:** ${member.guild.memberCount}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    if (isKicked) {
      await AuditLogger.sendHumanOrBotLog(member.guild, 'MEMBERS', kickExecutor, logEmbed, {
        action: 'MEMBER_KICK',
        executorId: kickExecutor?.id,
        executorTag: kickExecutor?.tag,
        targetId: member.id,
        targetTag: member.user?.tag || member.id,
        details: `Кикнут модератором @${kickExecutor?.tag || 'Неизвестно'}. Причина: ${kickReason}`,
        metadata: { reason: kickReason },
      });
      await BotMessageManager.sendDM(member.guild.id, member.id, 'sanction_dm_kick', {
        user: `<@${member.id}>`,
        username: member.user?.tag || member.id,
        moderator: kickExecutor ? `${kickExecutor.tag}` : 'Модератор',
        reason: kickReason,
        guild: member.guild.name,
      }).catch(() => null);
    } else {
      const meta = {
        action: 'MEMBER_LEAVE',
        targetId: member.id,
        targetTag: member.user?.tag || member.id,
        details: `Участник покинул сервер по собственному желанию`,
      };
      if (member.user?.bot) {
        await AuditLogger.sendLog(member.guild, 'BOT', logEmbed, meta);
      } else {
        await AuditLogger.sendLog(member.guild, 'MEMBERS', logEmbed, meta);
      }
    }
  });

  // Member Ban
  bot.on(Events.GuildBanAdd, async (ban: GuildBan) => {
    const banEntry = await AuditLogger.getAuditLogEntry(
      ban.guild,
      AuditLogEvent.MemberBanAdd,
      ban.user.id
    );

    const banExecutor = banEntry?.executor || null;
    const reason = ban.reason || banEntry?.reason || 'Не указана';

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔨 Пользователь забанен')
      .setDescription(
        `**Пользователь:** ${ban.user} (\`${ban.user.tag}\` / \`${ban.user.id}\`)\n` +
        `**Забанил:** ${banExecutor ? `${banExecutor} (\`${banExecutor.tag}\`)` : 'Неизвестно'}\n` +
        `**Причина:** ${reason}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setThumbnail(ban.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    await AuditLogger.sendHumanOrBotLog(ban.guild, 'MEMBERS', banExecutor, embed, {
      action: 'MEMBER_BAN',
      executorId: banExecutor?.id,
      executorTag: banExecutor?.tag,
      targetId: ban.user.id,
      targetTag: ban.user.tag,
      details: `Забанен модератором @${banExecutor?.tag || 'Неизвестно'}. Причина: ${reason}`,
      metadata: { reason },
    });

    await BotMessageManager.sendDM(ban.guild.id, ban.user.id, 'sanction_dm_ban', {
      user: `<@${ban.user.id}>`,
      username: ban.user.tag || ban.user.id,
      moderator: banExecutor ? `${banExecutor.tag}` : 'Модератор',
      reason,
      guild: ban.guild.name,
    }).catch(() => null);
  });

  // Member Unban
  bot.on(Events.GuildBanRemove, async (ban: GuildBan) => {
    const unbanEntry = await AuditLogger.getAuditLogEntry(
      ban.guild,
      AuditLogEvent.MemberBanRemove,
      ban.user.id
    );

    const unbanExecutor = unbanEntry?.executor || null;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🔓 Пользователь разбанен')
      .setDescription(
        `**Пользователь:** ${ban.user} (\`${ban.user.tag}\` / \`${ban.user.id}\`)\n` +
        `**Разбанил:** ${unbanExecutor ? `${unbanExecutor} (\`${unbanExecutor.tag}\`)` : 'Неизвестно'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendHumanOrBotLog(ban.guild, 'MEMBERS', unbanExecutor, embed, {
      action: 'MEMBER_UNBAN',
      executorId: unbanExecutor?.id,
      executorTag: unbanExecutor?.tag,
      targetId: ban.user.id,
      targetTag: ban.user.tag,
      details: `Разбанен модератором @${unbanExecutor?.tag || 'Неизвестно'}`,
    });
  });

  // Member Update (Nickname, Roles, Timeout)
  bot.on(Events.GuildMemberUpdate, async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    // 1. Nickname change
    if (oldMember.nickname !== newMember.nickname) {
      const nickEntry = await AuditLogger.getAuditLogEntry(
        newMember.guild,
        AuditLogEvent.MemberUpdate,
        newMember.id,
        e => e.changes?.some(c => c.key === 'nick')
      );

      const executor = nickEntry?.executor || null;
      const oldNick = oldMember.nickname || oldMember.user?.username || 'Нет';
      const newNick = newMember.nickname || newMember.user.username;

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🏷️ Изменен никнейм')
        .setDescription(
          `**Участник:** ${newMember} (\`${newMember.user.tag}\`)\n` +
          `**Исполнитель:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Сам участник'}\n` +
          `**Было:** \`${oldNick}\`\n` +
          `**Стало:** \`${newNick}\`\n` +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      await AuditLogger.sendHumanOrBotLog(newMember.guild, 'MEMBERS', executor, embed, {
        action: 'MEMBER_NICKNAME_UPDATE',
        executorId: executor?.id,
        executorTag: executor?.tag,
        targetId: newMember.id,
        targetTag: newMember.user.tag,
        details: `Смена ника: «${oldNick}» ➔ «${newNick}» (${executor ? `изменил @${executor.tag}` : 'сам'})`,
        metadata: { oldNick, newNick },
      });
    }

    // 2. Roles added / removed
    const oldRoles = new Set(oldMember.roles.cache.keys());
    const newRoles = new Set(newMember.roles.cache.keys());

    const addedRoles = [...newRoles].filter(r => !oldRoles.has(r));
    const removedRoles = [...oldRoles].filter(r => !newRoles.has(r));

    if (addedRoles.length > 0 || removedRoles.length > 0) {
      const roleEntry = await AuditLogger.getAuditLogEntry(
        newMember.guild,
        AuditLogEvent.MemberRoleUpdate,
        newMember.id
      );

      const executor = roleEntry?.executor || null;
      const addedRoleNames = addedRoles.map(rId => newMember.guild.roles.cache.get(rId)?.name || rId);
      const removedRoleNames = removedRoles.map(rId => oldMember.guild.roles.cache.get(rId)?.name || rId);

      const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle('🛡️ Изменение ролей участника')
        .setDescription(
          `**Участник:** ${newMember} (\`${newMember.user.tag}\`)\n` +
          `**Исполнитель:** ${executor ? `${executor} (\`${executor.tag}\`)` : 'Неизвестно'}\n` +
          (addedRoles.length > 0 ? `**Выданы роли:** ${addedRoles.map(r => `<@&${r}>`).join(', ')}\n` : '') +
          (removedRoles.length > 0 ? `**Сняты роли:** ${removedRoles.map(r => `<@&${r}>`).join(', ')}\n` : '') +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setTimestamp();

      const detailsParts: string[] = [];
      if (addedRoleNames.length > 0) detailsParts.push(`+ Выданы: ${addedRoleNames.join(', ')}`);
      if (removedRoleNames.length > 0) detailsParts.push(`- Сняты: ${removedRoleNames.join(', ')}`);

      await AuditLogger.sendHumanOrBotLog(newMember.guild, 'ROLES', executor, embed, {
        action: 'MEMBER_ROLES_UPDATE',
        executorId: executor?.id,
        executorTag: executor?.tag,
        targetId: newMember.id,
        targetTag: newMember.user.tag,
        details: `${detailsParts.join(' | ')} (${executor ? `изменил @${executor.tag}` : 'система'})`,
        metadata: {
          addedRoleNames,
          removedRoleNames,
          addedRoles,
          removedRoles,
        },
      });

      // Auto-update nickname based on configured role bindings
      await NicknameService.syncMemberNickname(newMember, 'Обновление ролей').catch(() => null);
    }

    // 3. Timeout (communication disabled) - MUTE / UNMUTE
    if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
      const isMuted = newMember.isCommunicationDisabled();

      const timeoutEntry = await AuditLogger.getAuditLogEntry(
        newMember.guild,
        AuditLogEvent.MemberUpdate,
        newMember.id,
        e => e.changes?.some(c => c.key === 'communication_disabled_until')
      );

      const executor = timeoutEntry?.executor || null;
      const reason = timeoutEntry?.reason || 'Причина не указана';

      let durationStr = '';
      let durationSec = 0;
      if (isMuted && newMember.communicationDisabledUntilTimestamp) {
        durationSec = Math.max(0, Math.floor((newMember.communicationDisabledUntilTimestamp - Date.now()) / 1000));
        const mins = Math.ceil(durationSec / 60);
        if (mins < 60) durationStr = `${mins} мин.`;
        else if (mins < 1440) durationStr = `${(mins / 60).toFixed(1).replace('.0', '')} ч.`;
        else durationStr = `${(mins / 1440).toFixed(1).replace('.0', '')} дн.`;
      }

      const embed = new EmbedBuilder()
        .setColor(isMuted ? 0xE67E22 : 0x2ECC71)
        .setTitle(isMuted ? '⏳ Участнику выдан тайм-аут (Мут)' : '⌛ Тайм-аут досрочно снят (Размут)')
        .setDescription(
          `**Участник:** ${newMember} (\`${newMember.user.tag}\` / \`${newMember.id}\`)\n` +
          `**Модератор:** ${executor ? `${executor} (\`${executor.tag}\` / \`${executor.id}\`)` : 'Неизвестно'}\n` +
          `**Причина:** ${reason}\n` +
          (isMuted && durationStr ? `**Длительность:** \`${durationStr}\`\n` : '') +
          (isMuted && newMember.communicationDisabledUntilTimestamp ? `**Действует до:** <t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F> (<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>)\n` : '') +
          `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
        )
        .setThumbnail(newMember.user.displayAvatarURL({ size: 256 }))
        .setTimestamp();

      const details = isMuted
        ? `Тайм-аут на ${durationStr || 'время'}. Модератор: @${executor?.tag || 'Неизвестно'}. Причина: ${reason}`
        : `Тайм-аут досрочно снят модератором @${executor?.tag || 'Неизвестно'}`;

      await AuditLogger.sendHumanOrBotLog(newMember.guild, 'MEMBERS', executor, embed, {
        action: isMuted ? 'MEMBER_TIMEOUT' : 'MEMBER_UNTIMEOUT',
        executorId: executor?.id,
        executorTag: executor?.tag,
        targetId: newMember.id,
        targetTag: newMember.user.tag,
        details,
        metadata: {
          isMuted,
          durationStr,
          durationSec,
          until: newMember.communicationDisabledUntilTimestamp,
          reason,
        },
      });

      // Send DM notification to user
      try {
        if (isMuted) {
          await newMember.send({
            content: `⏳ Вам был выдан тайм-аут (мут) на сервере **${newMember.guild.name}** на **${durationStr || 'время'}**.\n**Модератор:** @${executor?.tag || 'Модератор'}\n**Причина:** ${reason}\n**Окончание:** <t:${Math.floor(newMember.communicationDisabledUntilTimestamp! / 1000)}:F>`
          }).catch(() => null);
        } else {
          await newMember.send({
            content: `⌛ Ваш тайм-аут на сервере **${newMember.guild.name}** был досрочно снят модератором @${executor?.tag || 'Модератор'}.`
          }).catch(() => null);
        }
      } catch {}
    }
  });
}
