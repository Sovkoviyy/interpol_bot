import { EmbedBuilder } from 'discord.js';

/**
 * Visual Identity & Design System for INTERPOL Bot
 * Strict Black & Pink palette, minimalist clean structure, professional Discord markdown formatting
 */
export const THEME = {
  COLORS: {
    // Primary Black & Pink Palette
    PRIMARY: 0xEC4899,   // Hot Pink (Main visual accent)
    ACCENT: 0xF43F5E,    // Rose Pink (Highlights & Attention)
    DARK: 0x111214,      // Deep Night Black (Background tone)
    CARD: 0x18191C,      // Slate Charcoal (Secondary tone)
    
    // Status Tones (Harmonized with dark-pink palette)
    SUCCESS: 0x10B981,   // Emerald (Approvals, Success)
    DANGER: 0xBE185D,    // Dark Magenta / Crimson (Rejections, Warnings)
    WARNING: 0xFB7185,   // Soft Rose (Alerts, Pending)
    MUTED: 0x475569,     // Slate (Footers, inactive)
  },

  DEFAULT_FOOTER: 'INTERPOL • Majestic RP',

  /**
   * Formatting primitives using clean Discord markdown
   */
  format: {
    title: (text: string) => `## ${text}`,
    section: (text: string) => `### ${text}`,
    item: (label: string, value: string | number) => `- **${label}:** ${value}`,
    bullet: (text: string) => `- ${text}`,
    quote: (text: string) => `> ${text}`,
    subtext: (text: string) => `-# ${text}`,
    code: (text: string | number) => `\`${text}\``,
    bold: (text: string | number) => `**${text}**`,
    
    /**
     * Clean modern progress bar: ▰▰▰▰▰▱▱▱▱▱ 50%
     */
    progressBar: (current: number, total: number, length = 10): string => {
      const safeTotal = Math.max(1, total);
      const safeCurrent = Math.max(0, Math.min(current, safeTotal));
      const filled = Math.round((safeCurrent / safeTotal) * length);
      const empty = Math.max(0, length - filled);
      const percent = Math.min(100, Math.round((safeCurrent / safeTotal) * 100));
      return `\`${'▰'.repeat(filled)}${'▱'.repeat(empty)}\` **${percent}%** (${safeCurrent}/${safeTotal})`;
    },
  },
};

export interface ThemedEmbedOptions {
  title?: string;
  description?: string;
  color?: number;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  footerText?: string;
  footerIconUrl?: string;
  timestamp?: boolean | Date;
  fields?: { name: string; value: string; inline?: boolean }[];
}

/**
 * Creates a consistently styled embed adhering to the strict black-and-pink aesthetic.
 */
export function createThemedEmbed(options: ThemedEmbedOptions): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(options.color ?? THEME.COLORS.PRIMARY);

  if (options.title) {
    embed.setTitle(options.title);
  }

  if (options.description) {
    embed.setDescription(options.description);
  }

  if (options.thumbnailUrl) {
    embed.setThumbnail(options.thumbnailUrl);
  }

  if (options.imageUrl) {
    embed.setImage(options.imageUrl);
  }

  if (options.fields && options.fields.length > 0) {
    embed.addFields(options.fields);
  }

  const footerText = options.footerText || THEME.DEFAULT_FOOTER;
  embed.setFooter({
    text: footerText,
    iconURL: options.footerIconUrl,
  });

  if (options.timestamp !== false) {
    embed.setTimestamp(options.timestamp instanceof Date ? options.timestamp : undefined);
  }

  return embed;
}
