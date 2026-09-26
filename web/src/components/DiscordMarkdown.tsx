import React, { useState } from 'react';

interface DiscordMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Format a Discord timestamp <t:1727376000:F> into a human readable Russian string
 */
function formatDiscordTimestamp(unixSec: number, style?: string): string {
  const date = new Date(unixSec * 1000);
  if (isNaN(date.getTime())) return `<t:${unixSec}>`;

  switch (style) {
    case 't': // Short Time (16:20)
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    case 'T': // Long Time (16:20:30)
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    case 'd': // Short Date (26.09.2026)
      return date.toLocaleDateString('ru-RU');
    case 'D': // Long Date (26 сентября 2026 г.)
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    case 'F': // Long Date/Time (суббота, 26 сентября 2026 г., 16:20)
      return date.toLocaleDateString('ru-RU', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'R': { // Relative
      const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
      const absDiff = Math.abs(diffSec);
      if (absDiff < 60) return diffSec >= 0 ? 'через несколько секунд' : 'только что';
      const mins = Math.round(absDiff / 60);
      if (mins < 60) return diffSec >= 0 ? `через ${mins} мин.` : `${mins} мин. назад`;
      const hours = Math.round(mins / 60);
      if (hours < 24) return diffSec >= 0 ? `через ${hours} ч.` : `${hours} ч. назад`;
      const days = Math.round(hours / 24);
      return diffSec >= 0 ? `через ${days} дн.` : `${days} дн. назад`;
    }
    case 'f': // Short Date/Time (default)
    default:
      return date.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
  }
}

/**
 * Interactive Spoiler component (hidden by default, reveals on click)
 */
const Spoiler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      onClick={() => setRevealed(!revealed)}
      title={revealed ? 'Скрыть спойлер' : 'Нажмите, чтобы показать'}
      className={`cursor-pointer rounded px-1 transition-all select-none ${
        revealed
          ? 'bg-[#2B2D31]/80 text-[#DBDEE1]'
          : 'bg-[#1E1F22] hover:bg-[#2B2D31] text-transparent'
      }`}
    >
      {children}
    </span>
  );
};

/**
 * Parses inline Discord Markdown tokens:
 * - Spoilers: ||text||
 * - Inline code: `text`
 * - Bold + Italic: ***text***
 * - Bold: **text**
 * - Underline: __text__
 * - Italic: *text* or _text_
 * - Strikethrough: ~~text~~
 * - Timestamps: <t:1727376000:F>
 * - Mentions: <@123>, <@&123>, <#123>, @User, #channel
 * - Links: [label](url), https://...
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match all potential tokens with regex
  // 1: Spoiler ||...||
  // 2: Inline code `...`
  // 3: Bold italic ***...***
  // 4: Bold **...**
  // 5: Underline __...__
  // 6: Strikethrough ~~...~~
  // 7: Italic *...* or _..._
  // 8: Discord timestamp <t:...>
  // 9: Channel/User/Role ID mention <#...>, <@...>, <@&...>
  // 10: Named mention @word or #word
  // 11: Markdown link [label](url)
  // 12: URL https://...
  const tokenRegex = /(?:\|\|([\s\S]+?)\|\|)|(?:`([^`]+)`)|(?:\*\*\*([^*]+?)\*\*\*)|(?:\*\*([^*]+?)\*\*)|(?:__([^_]+?)__)|(?:~~([^~]+?)~~)|(?:\*([^*]+?)\*)|(?:_([^_]+?)_)|(?:<t:(\d+)(?::([tTdDfFR]))?>)|(?:<(?:@!?|@&|#)(\d+)>)|(?:(@[a-zA-Z0-9а-яА-ЯёЁ_.-]+|#[a-zA-Z0-9а-яА-ЯёЁ_-]+))|(?:\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<]+)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    const key = `token-${match.index}-${lastIndex}`;

    if (match[1] !== undefined) {
      // Spoiler: ||...||
      elements.push(<Spoiler key={key}>{parseInlineMarkdown(match[1])}</Spoiler>);
    } else if (match[2] !== undefined) {
      // Inline code: `...`
      elements.push(
        <code key={key} className="bg-[#1E1F22] text-[#E0E1E5] px-1.5 py-0.5 rounded font-mono text-[11px] border border-white/5">
          {match[2]}
        </code>
      );
    } else if (match[3] !== undefined) {
      // Bold + Italic: ***...***
      elements.push(
        <strong key={key} className="font-bold italic text-[#F2F3F5]">
          {parseInlineMarkdown(match[3])}
        </strong>
      );
    } else if (match[4] !== undefined) {
      // Bold: **...**
      elements.push(
        <strong key={key} className="font-bold text-[#F2F3F5]">
          {parseInlineMarkdown(match[4])}
        </strong>
      );
    } else if (match[5] !== undefined) {
      // Underline: __...__
      elements.push(
        <u key={key} className="underline decoration-1 underline-offset-2">
          {parseInlineMarkdown(match[5])}
        </u>
      );
    } else if (match[6] !== undefined) {
      // Strikethrough: ~~...~~
      elements.push(
        <del key={key} className="line-through text-slate-400">
          {parseInlineMarkdown(match[6])}
        </del>
      );
    } else if (match[7] !== undefined || match[8] !== undefined) {
      // Italic: *...* or _..._
      const italicContent = match[7] !== undefined ? match[7] : match[8];
      elements.push(
        <em key={key} className="italic text-[#DBDEE1]">
          {parseInlineMarkdown(italicContent)}
        </em>
      );
    } else if (match[9] !== undefined) {
      // Discord timestamp: <t:1727376000:F>
      const unixSec = parseInt(match[9], 10);
      const style = match[10];
      const formatted = formatDiscordTimestamp(unixSec, style);
      elements.push(
        <span 
          key={key} 
          title={`Unix: ${unixSec}`}
          className="inline-flex items-center gap-1 bg-[#2B2D31] text-[#DBDEE1] hover:bg-[#35373C] px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors"
        >
          📅 {formatted}
        </span>
      );
    } else if (match[11] !== undefined) {
      // ID Mention: <@123456>, <@&123456>, <#123456>
      const raw = match[0];
      const isChannel = raw.startsWith('<#');
      const isRole = raw.startsWith('<@&');
      const prefix = isChannel ? '#' : '@';
      elements.push(
        <span
          key={key}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer select-none ${
            isChannel 
              ? 'bg-[#5865F2]/15 text-[#5865F2] hover:bg-[#5865F2]/25' 
              : isRole
              ? 'bg-[#5865F2]/20 text-[#C9CDFB] hover:bg-[#5865F2]/30'
              : 'bg-[#5865F2]/20 text-[#C9CDFB] hover:bg-[#5865F2]/30'
          }`}
        >
          {prefix}{match[11]}
        </span>
      );
    } else if (match[12] !== undefined) {
      // Named mention: @Cadet, #general, @everyone, @here
      const tag = match[12];
      const isChannel = tag.startsWith('#');
      elements.push(
        <span
          key={key}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer select-none ${
            isChannel
              ? 'bg-[#5865F2]/15 text-[#5865F2] hover:bg-[#5865F2]/25'
              : 'bg-[#5865F2]/20 text-[#C9CDFB] hover:bg-[#5865F2]/30'
          }`}
        >
          {tag}
        </span>
      );
    } else if (match[13] !== undefined && match[14] !== undefined) {
      // Markdown link: [label](url)
      elements.push(
        <a
          key={key}
          href={match[14]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00A8FC] hover:underline"
        >
          {match[13]}
        </a>
      );
    } else if (match[15] !== undefined) {
      // Raw URL: https://...
      elements.push(
        <a
          key={key}
          href={match[15]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00A8FC] hover:underline break-all"
        >
          {match[15]}
        </a>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

/**
 * Main Discord Markdown renderer component.
 * Supports multi-line blocks:
 * - Code blocks: ```...```
 * - Blockquotes: > text or >>> text
 * - Headers: # text, ## text, ### text
 * - Subtext: -# text
 * - Bullet lists: - item or * item
 * - Plus full inline formatting.
 */
export const DiscordMarkdown: React.FC<DiscordMarkdownProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split lines while handling multi-line code blocks
  const lines = content.split('\n');
  const renderedBlocks: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check code block fences
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
        codeBlockLines = [];
        continue;
      } else {
        inCodeBlock = false;
        renderedBlocks.push(
          <div key={`code-block-${i}`} className="my-2 bg-[#1E1F22] rounded-lg p-2.5 font-mono text-[11px] text-[#E0E1E5] border border-white/5 overflow-x-auto">
            {codeBlockLang && (
              <div className="text-[10px] text-slate-500 font-sans uppercase font-bold mb-1">
                {codeBlockLang}
              </div>
            )}
            <pre className="whitespace-pre">{codeBlockLines.join('\n')}</pre>
          </div>
        );
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Check headers
    if (line.startsWith('# ')) {
      renderedBlocks.push(
        <h1 key={`h1-${i}`} className="text-base font-bold text-white mt-2 mb-1 leading-snug">
          {parseInlineMarkdown(line.slice(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      renderedBlocks.push(
        <h2 key={`h2-${i}`} className="text-sm font-bold text-white mt-1.5 mb-1 leading-snug">
          {parseInlineMarkdown(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      renderedBlocks.push(
        <h3 key={`h3-${i}`} className="text-xs font-bold text-white mt-1 mb-0.5 leading-snug">
          {parseInlineMarkdown(line.slice(4))}
        </h3>
      );
      continue;
    }

    // Check Discord subtext: -# small text
    if (line.startsWith('-# ')) {
      renderedBlocks.push(
        <div key={`subtext-${i}`} className="text-[10px] text-[#949BA4] leading-normal my-0.5">
          {parseInlineMarkdown(line.slice(3))}
        </div>
      );
      continue;
    }

    // Check blockquote: > text
    if (line.startsWith('> ') || line.startsWith('>>> ')) {
      const quoteText = line.startsWith('>>> ') ? line.slice(4) : line.slice(2);
      renderedBlocks.push(
        <div 
          key={`quote-${i}`} 
          className="border-l-4 border-[#4E5058] pl-2.5 my-1 text-[#DBDEE1] text-xs leading-relaxed"
        >
          {parseInlineMarkdown(quoteText)}
        </div>
      );
      continue;
    }

    // Check bullet list: - item or * item
    if (line.match(/^[\s]*[-*]\s+/)) {
      const bulletText = line.replace(/^[\s]*[-*]\s+/, '');
      renderedBlocks.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 my-0.5 text-xs text-[#DBDEE1]">
          <span className="text-[#949BA4] font-bold text-xs select-none">•</span>
          <div className="flex-1">{parseInlineMarkdown(bulletText)}</div>
        </div>
      );
      continue;
    }

    // Regular line / Empty line
    if (line.trim() === '') {
      renderedBlocks.push(<div key={`empty-${i}`} className="h-2" />);
    } else {
      renderedBlocks.push(
        <div key={`line-${i}`} className="text-xs text-[#DBDEE1] leading-relaxed break-words font-sans">
          {parseInlineMarkdown(line)}
        </div>
      );
    }
  }

  // If unclosed code block at end of message
  if (inCodeBlock && codeBlockLines.length > 0) {
    renderedBlocks.push(
      <div key="unclosed-code" className="my-2 bg-[#1E1F22] rounded-lg p-2.5 font-mono text-[11px] text-[#E0E1E5] border border-white/5 overflow-x-auto">
        <pre className="whitespace-pre">{codeBlockLines.join('\n')}</pre>
      </div>
    );
  }

  return <div className={`space-y-0.5 ${className}`}>{renderedBlocks}</div>;
};

export default DiscordMarkdown;
