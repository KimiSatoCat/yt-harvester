// language.js – Language detection for Japanese and English text
// Uses Unicode character range analysis. No external dependencies.

// Unicode ranges
const RANGES = {
  hiragana:   [0x3040, 0x309F],
  katakana:   [0x30A0, 0x30FF],
  katakanaHW: [0xFF65, 0xFF9F], // half-width katakana
  cjkUnified: [0x4E00, 0x9FFF],
  cjkExtA:    [0x3400, 0x4DBF],
  cjkExtB:    [0x20000, 0x2A6DF],
  cjkCompat:  [0xF900, 0xFAFF],
  latin:      [0x0041, 0x007A], // A-z (non-contiguous, checked separately)
  latinExt:   [0x00C0, 0x024F],
  cyrillic:   [0x0400, 0x04FF],
  arabic:     [0x0600, 0x06FF],
  korean:     [0xAC00, 0xD7AF],
  hangul:     [0x1100, 0x11FF],
};

function inRange(cp, range) {
  return cp >= range[0] && cp <= range[1];
}

function isLatinChar(cp) {
  return (cp >= 0x41 && cp <= 0x5A) || // A-Z
         (cp >= 0x61 && cp <= 0x7A) || // a-z
         inRange(cp, RANGES.latinExt);
}

function isJapaneseChar(cp) {
  return inRange(cp, RANGES.hiragana) ||
         inRange(cp, RANGES.katakana) ||
         inRange(cp, RANGES.katakanaHW) ||
         inRange(cp, RANGES.cjkUnified) ||
         inRange(cp, RANGES.cjkExtA) ||
         inRange(cp, RANGES.cjkCompat);
}

/**
 * Detect the primary language of a text string.
 * Returns { lang: 'ja' | 'en' | 'ko' | 'ar' | 'ru' | 'unknown', confidence: 0–1 }
 *
 * For this tool, the primary distinction is ja vs en, with other languages
 * classified as 'unknown' to avoid false positives.
 */
function detectLanguage(text) {
  if (!text || typeof text !== 'string') {
    return { lang: 'unknown', confidence: 0 };
  }

  // Strip URLs, hashtags, mentions, numbers for cleaner analysis
  const cleaned = text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/#\S+/g, '')
    .replace(/@\S+/g, '')
    .replace(/\d+/g, '')
    .trim();

  if (cleaned.length < 3) {
    return { lang: 'unknown', confidence: 0 };
  }

  let japanese = 0;
  let latin = 0;
  let korean = 0;
  let arabic = 0;
  let cyrillic = 0;
  let total = 0;

  for (const char of cleaned) {
    const cp = char.codePointAt(0);
    if (cp <= 0x007F) {
      // ASCII range – count letters only
      if (isLatinChar(cp)) { latin++; total++; }
    } else if (isJapaneseChar(cp)) {
      japanese++; total++;
    } else if (isLatinChar(cp)) {
      latin++; total++;
    } else if (inRange(cp, RANGES.korean) || inRange(cp, RANGES.hangul)) {
      korean++; total++;
    } else if (inRange(cp, RANGES.arabic)) {
      arabic++; total++;
    } else if (inRange(cp, RANGES.cyrillic)) {
      cyrillic++; total++;
    }
    // Ignore punctuation, symbols, emoji in counting
  }

  if (total === 0) {
    return { lang: 'unknown', confidence: 0 };
  }

  const jaRatio  = japanese / total;
  const enRatio  = latin    / total;
  const koRatio  = korean   / total;

  // Japanese: even a small amount of hiragana/katakana is a strong signal
  if (jaRatio >= 0.08) {
    return { lang: 'ja', confidence: Math.min(jaRatio * 2.5, 1) };
  }

  // Korean
  if (koRatio >= 0.15) {
    return { lang: 'ko', confidence: Math.min(koRatio * 2, 1) };
  }

  // Arabic
  if (arabic / total >= 0.2) {
    return { lang: 'ar', confidence: Math.min((arabic / total) * 2, 1) };
  }

  // Cyrillic (Russian etc.)
  if (cyrillic / total >= 0.2) {
    return { lang: 'ru', confidence: Math.min((cyrillic / total) * 2, 1) };
  }

  // Latin script (primarily English for this tool's use case)
  // CJK without hiragana/katakana could be Chinese – classify as unknown
  const cjkOnly = japanese > 0 && (japanese - countKanaChars(cleaned)) > 0;
  if (enRatio >= 0.4) {
    return { lang: 'en', confidence: Math.min(enRatio, 1) };
  }

  return { lang: 'unknown', confidence: 0 };
}

/** Count hiragana + katakana characters (strong Japanese markers) */
function countKanaChars(text) {
  let count = 0;
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (inRange(cp, RANGES.hiragana) || inRange(cp, RANGES.katakana) || inRange(cp, RANGES.katakanaHW)) {
      count++;
    }
  }
  return count;
}

/**
 * Determine if a text matches the expected language.
 * Used to filter videos after search – more permissive than strict equality.
 */
function matchesLanguage(text, expectedLang) {
  if (!text) return false;
  const result = detectLanguage(text);
  if (result.lang === expectedLang) return true;
  // Allow unknown language through (short text, emoji-only, etc.)
  if (result.lang === 'unknown') return true;
  return false;
}

export { detectLanguage, matchesLanguage };
