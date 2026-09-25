/**
 * Utility functions for extracting and normalizing player names
 */

/**
 * Extracts ONLY the first name from a full in-game RP name, nickname, or template string,
 * completely stripping any surnames, prefixes, static IDs, or special formatting.
 *
 * Examples:
 * - "Tony Montana" -> "Tony"
 * - "Tony_Montana" -> "Tony"
 * - "Tony-Montana" -> "Tony"
 * - "Иван Иванов" -> "Иван"
 * - "Иван_Иванов" -> "Иван"
 * - "1 | Tony Montana | 142055" -> "Tony"
 * - "[2] Richard Miller" -> "Richard"
 * - "Alex" -> "Alex"
 */
export function extractFirstName(raw: string | null | undefined): string {
  if (!raw) return '';
  let str = String(raw).trim();

  // If formatted with pipes like "1 | Tony Montana | 142055" or "Tony | 142055"
  if (str.includes('|')) {
    const pipeParts = str.split('|').map(s => s.trim()).filter(Boolean);
    // Find the part that contains actual letters (not just numbers or symbols)
    const namePart = pipeParts.find(p => /[a-zA-Zа-яА-ЯёЁ]/.test(p)) || pipeParts[0];
    str = namePart || str;
  }

  // Remove leading prefixes, ranks or brackets like "[1] ", "1. ", "(1) "
  str = str.replace(/^[\[\(\{]?\d+[\]\)\}.:\s_-]+/, '').trim();

  // Remove trailing static or parenthesis like "(142055)", "#142055"
  str = str.replace(/[\(\[\{]?#?\d{3,10}[\)\]\}]?$/, '').trim();

  // Split by whitespace, underscores, hyphens, dots, slashes
  const parts = str.split(/[\s_.\-\/\\]+/).filter(Boolean);
  const firstWord = parts[0] || str;

  // Strip non-letter / non-digit characters from the edges
  return firstWord.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+|[^a-zA-Zа-яА-ЯёЁ0-9]+$/g, '').trim();
}

/**
 * Cleans the first name for Discord channel names (lowercase, latin/cyrillic letters and digits only)
 */
export function sanitizeChannelNamePart(raw: string | null | undefined, fallback = 'игрок'): string {
  const firstName = extractFirstName(raw);
  const cleaned = firstName
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '')
    .slice(0, 15);
  return cleaned || fallback;
}
