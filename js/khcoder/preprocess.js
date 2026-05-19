// preprocess.js – Text cleaning and duration parsing for KH Coder export

const URL_RE = /https?:\/\/\S+/g;
const MENTION_RE = /@[A-Za-z0-9_\-]+/g;
const WHITESPACE_RE = /[\s　]+/g; // 　 = 全角スペース

/**
 * Clean text for KH Coder:
 * 1. Remove URLs
 * 2. Remove @mentions
 * 3. Replace newlines/tabs with single space (prevents KH Coder paragraph boundary misdetection)
 * 4. Normalize consecutive whitespace
 * 5. Trim
 */
function cleanText(s) {
  if (!s) return '';
  s = s.replace(URL_RE, ' ');
  s = s.replace(MENTION_RE, ' ');
  s = s.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\t/g, ' ');
  s = s.replace(WHITESPACE_RE, ' ');
  return s.trim();
}

/**
 * Convert ISO 8601 duration (e.g. PT1H23M45S) to seconds.
 * Returns 0 on invalid input.
 */
function isoDurationToSec(d) {
  if (!d || !d.startsWith('PT')) return 0;
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

export { cleanText, isoDurationToSec };
