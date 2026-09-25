import { EmbedBuilder } from 'discord.js';

export interface TemplateVariables {
  user: string;
  username?: string;
  guild: string;
  memberCount?: string;
}

export function buildCustomTemplateEmbed(template: any, variables: TemplateVariables): EmbedBuilder {
  const replaceVars = (text?: string | null): string | null => {
    if (!text) return null;
    let res = text
      .replace(/{user}/g, variables.user)
      .replace(/{guild}/g, variables.guild);
    if (variables.memberCount) res = res.replace(/{memberCount}/g, variables.memberCount);
    if (variables.username) res = res.replace(/{username}/g, variables.username);
    return res;
  };

  const embed = new EmbedBuilder();
  if (template.title) {
    const formatted = replaceVars(template.title);
    if (formatted) embed.setTitle(formatted);
  }
  if (template.description) {
    const formatted = replaceVars(template.description);
    if (formatted) embed.setDescription(formatted);
  }
  if (template.color) {
    const rawCol = template.color.replace('#', '');
    embed.setColor(parseInt(rawCol, 16) || 0xEC4899);
  }
  if (template.footerText) {
    const formatted = replaceVars(template.footerText);
    if (formatted) {
      embed.setFooter({
        text: formatted,
        iconURL: template.footerIconUrl || undefined,
      });
    }
  }
  if (template.authorName) {
    const formatted = replaceVars(template.authorName);
    if (formatted) {
      embed.setAuthor({
        name: formatted,
        iconURL: template.authorIconUrl || undefined,
        url: template.authorUrl || undefined,
      });
    }
  }
  if (template.thumbnailUrl) embed.setThumbnail(template.thumbnailUrl);
  if (template.imageUrl) embed.setImage(template.imageUrl);

  if (template.fieldsJson) {
    try {
      const parsedFields = typeof template.fieldsJson === 'string' 
        ? JSON.parse(template.fieldsJson) 
        : template.fieldsJson;
      if (Array.isArray(parsedFields)) {
        for (const f of parsedFields) {
          if (f.name && f.value) {
            embed.addFields({
              name: replaceVars(f.name) || f.name,
              value: replaceVars(f.value) || f.value,
              inline: Boolean(f.inline),
            });
          }
        }
      }
    } catch (e) {
      console.warn('[templateEmbed] Failed parsing fieldsJson:', e);
    }
  }

  return embed;
}
