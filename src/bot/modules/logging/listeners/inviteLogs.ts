import { 
  Events, 
  Invite, 
  EmbedBuilder,
  GuildMember,
  Collection 
} from 'discord.js';
import bot from '../../../client';
import { AuditLogger } from '../auditLogger';
import prisma from '../../../../database/client';

// In-memory cache of invite usage counts: guildId -> (inviteCode -> uses)
const guildInvitesCache = new Map<string, Map<string, number>>();

export async function cacheGuildInvites(guildId: string) {
  try {
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return;

    const invites = await guild.invites.fetch().catch(() => null);
    if (!invites) return;

    const codeMap = new Map<string, number>();
    for (const [, inv] of invites) {
      codeMap.set(inv.code, inv.uses || 0);
    }
    guildInvitesCache.set(guildId, codeMap);
  } catch (err) {
    // Missing ManageGuild permission to read invites, ignore
  }
}

export async function trackMemberJoinInvite(member: GuildMember): Promise<{ code: string; inviterTag?: string; inviterId?: string } | null> {
  try {
    const guild = member.guild;
    const currentInvites = await guild.invites.fetch().catch(() => null);
    if (!currentInvites) return null;

    const cachedCodeMap = guildInvitesCache.get(guild.id);
    let usedInvite: Invite | null = null;

    if (cachedCodeMap) {
      for (const [, inv] of currentInvites) {
        const prevUses = cachedCodeMap.get(inv.code) || 0;
        if ((inv.uses || 0) > prevUses) {
          usedInvite = inv;
          break;
        }
      }
    }

    // Update cache with new invite counts
    const updatedMap = new Map<string, number>();
    for (const [, inv] of currentInvites) {
      updatedMap.set(inv.code, inv.uses || 0);
    }
    guildInvitesCache.set(guild.id, updatedMap);

    if (usedInvite) {
      // Save to database
      await prisma.memberInviteTracking.upsert({
        where: {
          guildId_userId: {
            guildId: guild.id,
            userId: member.id,
          },
        },
        update: {
          inviteCode: usedInvite.code,
          inviterId: usedInvite.inviter?.id || null,
          inviterTag: usedInvite.inviter?.tag || null,
        },
        create: {
          guildId: guild.id,
          userId: member.id,
          inviteCode: usedInvite.code,
          inviterId: usedInvite.inviter?.id || null,
          inviterTag: usedInvite.inviter?.tag || null,
          joinedAt: member.joinedAt || new Date(),
        },
      }).catch(e => console.error('[InviteTracking] Failed to save invite info:', e));

      return {
        code: usedInvite.code,
        inviterTag: usedInvite.inviter?.tag,
        inviterId: usedInvite.inviter?.id,
      };
    }
  } catch (err) {
    console.error('[InviteTracking Error]:', err);
  }

  return null;
}

export function registerInviteLogs() {
  // Cache invites on bot ready
  bot.once('ready', async () => {
    for (const [guildId] of bot.guilds.cache) {
      await cacheGuildInvites(guildId);
    }
  });

  // Invite Create
  bot.on(Events.InviteCreate, async (invite: Invite) => {
    if (!invite.guild || !(invite.guild && 'id' in invite.guild)) return;
    const guild = bot.guilds.cache.get(invite.guild.id);
    if (!guild) return;

    // Update cache
    const map = guildInvitesCache.get(guild.id) || new Map<string, number>();
    map.set(invite.code, invite.uses || 0);
    guildInvitesCache.set(guild.id, map);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🔗 Приглашение создано')
      .setDescription(
        `**Код:** \`${invite.code}\` ([Ссылка](${invite.url}))\n` +
        `**Создал:** ${invite.inviter ? `${invite.inviter} (\`${invite.inviter.tag}\`)` : 'Неизвестно'}\n` +
        `**Канал:** <#${invite.channelId}>\n` +
        `**Макс. использований:** ${invite.maxUses === 0 ? 'Бесконечно' : invite.maxUses}\n` +
        `**Истекает:** ${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp / 1000)}:R>` : 'Никогда'}\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendHumanOrBotLog(guild, 'INVITES', invite.inviter, embed);
  });

  // Invite Delete
  bot.on(Events.InviteDelete, async (invite: Invite) => {
    if (!invite.guild || !(invite.guild && 'id' in invite.guild)) return;
    const guild = bot.guilds.cache.get(invite.guild.id);
    if (!guild) return;

    // Update cache
    const map = guildInvitesCache.get(guild.id);
    if (map) map.delete(invite.code);

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🚫 Приглашение удалено/истекло')
      .setDescription(
        `**Код:** \`${invite.code}\`\n` +
        `**Канал:** <#${invite.channelId}>\n` +
        `**Время:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    await AuditLogger.sendLog(guild, 'INVITES', embed);
  });
}
