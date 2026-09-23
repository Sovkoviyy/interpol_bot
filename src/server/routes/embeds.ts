import { Router, Response } from 'express';
import { EmbedBuilder, TextChannel } from 'discord.js';
import bot from '../../bot/client';
import config from '../../config';
import prisma from '../../database/client';
import { requireAuth, AuthenticatedRequest } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { AuditLogger } from '../../bot/modules/logging/auditLogger';
import { resolveGuildId, getDiscordGuild } from '../utils/guild';

export const embedsRouter = Router();

// Get list of saved embed templates
embedsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);

  const templates = await prisma.customEmbedTemplate.findMany({
    where: { guildId },
    orderBy: { updatedAt: 'desc' },
  });

  return res.json({ templates });
});

// Save or update an embed template
embedsRouter.post('/', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const {
    id,
    name,
    targetChannelId,
    content,
    title,
    description,
    color,
    authorName,
    authorIconUrl,
    authorUrl,
    thumbnailUrl,
    imageUrl,
    footerText,
    footerIconUrl,
    fields,
  } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Укажите название шаблона' });
  }

  const fieldsJson = JSON.stringify(fields || []);

  let template;
  if (id) {
    template = await prisma.customEmbedTemplate.update({
      where: { id },
      data: {
        name,
        targetChannelId,
        content,
        title,
        description,
        color: color || '#EC4899',
        authorName,
        authorIconUrl,
        authorUrl,
        thumbnailUrl,
        imageUrl,
        footerText,
        footerIconUrl,
        fieldsJson,
      },
    });
  } else {
    template = await prisma.customEmbedTemplate.create({
      data: {
        guildId,
        name,
        targetChannelId,
        content,
        title,
        description,
        color: color || '#EC4899',
        authorName,
        authorIconUrl,
        authorUrl,
        thumbnailUrl,
        imageUrl,
        footerText,
        footerIconUrl,
        fieldsJson,
      },
    });
  }

  return res.json({ success: true, template });
});

// Delete a saved embed template
embedsRouter.delete('/:id', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  await prisma.customEmbedTemplate.delete({
    where: { id },
  }).catch(() => null);

  return res.json({ success: true });
});

// Send embed to Discord channel
embedsRouter.post('/send', requireAuth, requirePermission('manageSettings'), async (req: AuthenticatedRequest, res: Response) => {
  const guildId = resolveGuildId(req);
  const {
    targetChannelId,
    content,
    title,
    description,
    color,
    authorName,
    authorIconUrl,
    authorUrl,
    thumbnailUrl,
    imageUrl,
    footerText,
    footerIconUrl,
    includeTimestamp,
    fields,
    templateId,
  } = req.body;

  if (!targetChannelId) {
    return res.status(400).json({ error: 'Выберите канал Discord для отправки!' });
  }

  const guild = await getDiscordGuild(guildId);
  if (!guild) return res.status(404).json({ error: 'Discord Guild not found' });

  const channel = (guild.channels.cache.get(targetChannelId) ||
    await guild.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;

  if (!channel || !channel.isTextBased()) {
    return res.status(400).json({ error: 'Выбранный канал недоступен для отправки сообщений' });
  }

  // Build Discord Embed
  const rawColor = color?.replace('#', '') || 'EC4899';
  const colorInt = parseInt(rawColor, 16) || 0xEC4899;

  const embed = new EmbedBuilder().setColor(colorInt);

  if (title && title.trim()) embed.setTitle(title.trim());
  if (description && description.trim()) embed.setDescription(description.trim());

  if (authorName && authorName.trim()) {
    embed.setAuthor({
      name: authorName.trim(),
      iconURL: authorIconUrl && authorIconUrl.trim() ? authorIconUrl.trim() : undefined,
      url: authorUrl && authorUrl.trim() ? authorUrl.trim() : undefined,
    });
  }

  if (thumbnailUrl && thumbnailUrl.trim()) {
    try {
      embed.setThumbnail(thumbnailUrl.trim());
    } catch {}
  }

  if (imageUrl && imageUrl.trim()) {
    try {
      embed.setImage(imageUrl.trim());
    } catch {}
  }

  if (footerText && footerText.trim()) {
    embed.setFooter({
      text: footerText.trim(),
      iconURL: footerIconUrl && footerIconUrl.trim() ? footerIconUrl.trim() : undefined,
    });
  }

  if (includeTimestamp) {
    embed.setTimestamp();
  }

  if (Array.isArray(fields) && fields.length > 0) {
    const validFields = fields
      .filter((f: any) => f.name && f.name.trim() && f.value && f.value.trim())
      .slice(0, 25)
      .map((f: any) => ({
        name: f.name.trim(),
        value: f.value.trim(),
        inline: !!f.inline,
      }));

    if (validFields.length > 0) {
      embed.addFields(validFields);
    }
  }

  const messageOptions: any = {
    embeds: [embed],
  };

  if (content && content.trim()) {
    messageOptions.content = content.trim();
  }

  try {
    const sentMsg = await channel.send(messageOptions);

    if (templateId) {
      await prisma.customEmbedTemplate.update({
        where: { id: templateId },
        data: {
          sentMessageId: sentMsg.id,
          lastSentAt: new Date(),
        },
      }).catch(() => null);
    }

    // Send audit log
    const auditEmbed = new EmbedBuilder()
      .setColor(0xEC4899)
      .setTitle('🎨 Отправлено кастомное Embed сообщение')
      .setDescription(
        `Отправитель: <@${req.user!.userId}> (${req.user!.username})\n` +
        `Канал: <#${targetChannelId}>\n` +
        `Заголовок: **${title || 'Без заголовка'}**\n` +
        `[Перейти к сообщению](${sentMsg.url})`
      )
      .setTimestamp();
    await AuditLogger.sendLog(guild, 'BOT', auditEmbed).catch(() => null);

    return res.json({ success: true, messageId: sentMsg.id, messageUrl: sentMsg.url });
  } catch (err: any) {
    console.error('[Embeds] Error sending embed:', err);
    return res.status(500).json({ error: err.message || 'Ошибка отправки в Discord' });
  }
});

export default embedsRouter;
