// csv.js – CSV/TSV generation, ZIP assembly, and manifest building

// ──────────────────────────────────────────────────────────
// Low-level CSV/TSV helpers
// ──────────────────────────────────────────────────────────

/** Escape a value for CSV (RFC 4180) */
function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Always quote if contains comma, double-quote, newline, or carriage return
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/** Escape a value for TSV (replace tabs and newlines) */
function escapeTsv(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '');
}

/** Build a CSV row string from an array of values */
function csvRow(values) {
  return values.map(escapeCsv).join(',');
}

/** Build a TSV row string from an array of values */
function tsvRow(values) {
  return values.map(escapeTsv).join('\t');
}

/** Convert an array of header+row arrays to a UTF-8 BOM CSV string */
function toCsvString(headers, rows) {
  const bom = '﻿';
  const lines = [csvRow(headers), ...rows.map(r => csvRow(r))];
  return bom + lines.join('\r\n');
}

/** Convert an array of header+row arrays to a UTF-8 BOM TSV string */
function toTsvString(headers, rows) {
  const bom = '﻿';
  const lines = [tsvRow(headers), ...rows.map(r => tsvRow(r))];
  return bom + lines.join('\r\n');
}

// ──────────────────────────────────────────────────────────
// Date helpers
// ──────────────────────────────────────────────────────────

function getYear(isoDate) {
  return isoDate ? isoDate.substring(0, 4) : '';
}

function getYearMonth(isoDate) {
  return isoDate ? isoDate.substring(0, 7) : '';
}

function getQuarter(isoDate) {
  if (!isoDate) return '';
  const month = parseInt(isoDate.substring(5, 7), 10);
  const year  = isoDate.substring(0, 4);
  const q     = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

function nowUtc() {
  return new Date().toISOString();
}

// ──────────────────────────────────────────────────────────
// channel_type detection
// ──────────────────────────────────────────────────────────

const MEDIA_KEYWORDS = ['テレビ', '報道', '新聞', 'ニュース', 'メディア', 'TV', 'news', 'media',
  'broadcast', 'channel', 'network', 'NHK', 'TBS', 'テレ朝', 'フジ', 'CNN', 'BBC', 'Reuters'];
const CORPORATE_KEYWORDS = ['株式会社', '有限会社', '合同会社', '合資会社', 'Co., Ltd.', 'Inc.',
  'Corp.', 'LLC', 'Ltd.', '公式', 'official', 'Official', '企業', 'company'];
const PUBLIC_KEYWORDS = ['省', '庁', '市役所', '区役所', '県', '政府', '国土交通', '警察',
  'government', 'ministry', 'prefecture', 'city', 'municipal', 'public', 'official government'];

function detectChannelType(channelItem) {
  if (!channelItem) return 'unknown';

  const desc = (channelItem.snippet?.description || '').toLowerCase();
  const name = (channelItem.snippet?.title || '').toLowerCase();
  const combined = `${name} ${desc}`;

  for (const kw of PUBLIC_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) return 'public';
  }
  for (const kw of CORPORATE_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) return 'corporate';
  }
  for (const kw of MEDIA_KEYWORDS) {
    if (combined.includes(kw.toLowerCase())) return 'media';
  }

  // Heuristic for individual: sub count < 100k and no strong org signals
  const subCount = parseInt(channelItem.statistics?.subscriberCount || '0', 10);
  if (subCount > 0 && subCount < 100000) {
    return 'individual';
  }

  return 'unknown';
}

// ──────────────────────────────────────────────────────────
// Raw video CSV columns
// ──────────────────────────────────────────────────────────

const VIDEO_CSV_HEADERS = [
  'video_id', 'channel_id', 'published_at', 'title', 'description', 'tags',
  'view_count', 'like_count', 'comment_count', 'category_id',
  'default_language', 'default_audio_language', 'duration',
  'video_language_detected', 'video_language_confidence', 'collected_at',
];

function videoToRawRow(v) {
  return [
    v.video_id, v.channel_id, v.published_at, v.title, v.description,
    JSON.stringify(v.tags || []),
    v.view_count, v.like_count, v.comment_count, v.category_id,
    v.default_language, v.default_audio_language, v.duration,
    v.video_language_detected, v.video_language_confidence,
    v.collected_at,
  ];
}

// ──────────────────────────────────────────────────────────
// Raw comment CSV columns
// ──────────────────────────────────────────────────────────

const COMMENT_CSV_HEADERS = [
  'comment_id', 'video_id', 'parent_id', 'author_channel_id', 'author_display_name',
  'published_at', 'updated_at', 'text', 'like_count', 'reply_count',
  'comment_language_detected', 'comment_language_confidence', 'collected_at',
];

function commentToRawRow(c) {
  return [
    c.comment_id, c.video_id, c.parent_id || '',
    c.author_channel_id, c.author_display_name,
    c.published_at, c.updated_at, c.text,
    c.like_count, c.reply_count || '',
    c.comment_language_detected, c.comment_language_confidence,
    c.collected_at,
  ];
}

// ──────────────────────────────────────────────────────────
// KH Coder comment TSV columns
// ──────────────────────────────────────────────────────────

const KH_COMMENT_HEADERS = [
  'text', 'video_id', 'channel_id', 'channel_title', 'channel_type',
  'comment_layer', 'published_year', 'published_quarter', 'year_month',
  'like_count', 'video_title', 'video_language', 'comment_language', 'is_long_comment',
];

function commentToKhRow(c, videoMap, channelMap) {
  const video   = videoMap.get(c.video_id) || {};
  // Use the video's channel (the content creator), not the comment author's channel
  const videoChannelId = video.channel_id || '';
  const channel = channelMap.get(videoChannelId) || {};
  const channelType = detectChannelType(channel._raw);

  const text = (c.text || '').replace(/[\t\n\r]/g, ' ');
  return [
    text,
    c.video_id,
    videoChannelId,  // video's channel (content creator), not comment author
    channel._raw?.snippet?.title || '',
    channelType,
    c.parent_id ? 'reply' : 'top',
    getYear(c.published_at),
    getQuarter(c.published_at),
    getYearMonth(c.published_at),
    c.like_count,
    (video.title || '').replace(/[\t\n\r]/g, ' '),
    video.video_language_detected || '',
    c.comment_language_detected || '',
    (c.text || '').length > 1000 ? 'true' : 'false',
  ];
}

// ──────────────────────────────────────────────────────────
// KH Coder video TSV columns
// ──────────────────────────────────────────────────────────

const KH_VIDEO_HEADERS = [
  'text', 'video_id', 'channel_id', 'channel_title', 'channel_type',
  'published_year', 'published_quarter', 'year_month',
  'view_count', 'like_count', 'comment_count', 'video_language', 'video_type',
];

function videoToKhRow(v, channelMap) {
  const channel = channelMap.get(v.channel_id) || {};
  const channelType = detectChannelType(channel._raw);

  // Concatenate title + description + tags for analysis text
  const tags = Array.isArray(v.tags) ? v.tags.join(' ') : '';

  const text = [v.title, v.description, tags]
    .map(s => (s || '').replace(/[\t\n\r]/g, ' '))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [
    text,
    v.video_id,
    v.channel_id,
    channel._raw?.snippet?.title || '',
    channelType,
    getYear(v.published_at),
    getQuarter(v.published_at),
    getYearMonth(v.published_at),
    v.view_count,
    v.like_count,
    v.comment_count,
    v.video_language_detected || '',
    '', // video_type – intentionally blank for manual entry
  ];
}

// ──────────────────────────────────────────────────────────
// SHA-256 helper (Web Crypto API)
// ──────────────────────────────────────────────────────────

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return 'sha256:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ──────────────────────────────────────────────────────────
// manifest.json builder
// ──────────────────────────────────────────────────────────

async function buildManifest(state, fileList, apiKey) {
  const now = new Date();
  const startedAt = new Date(state.progress.startTime);
  const elapsedSec = Math.round((now - startedAt) / 1000);
  const keyHash = await sha256hex(apiKey);

  const jaVideos   = state.results.videos.ja   || [];
  const enVideos   = state.results.videos.en   || [];
  const jaComments = state.results.comments.ja || [];
  const enComments = state.results.comments.en || [];

  const unknownComments = [...jaComments, ...enComments].filter(
    c => c.comment_language_detected === 'unknown'
  ).length;

  // Count failed videos from log
  const failedVideos = (state.progress.logs || []).filter(l => l.level === 'error' && l.msg.includes('video')).length;

  return {
    tool_version: '0.1.0',
    tool_name: 'YouTube Comment Harvester for KH Coder',
    collection_started_at_utc: startedAt.toISOString(),
    collection_started_at_local: startedAt.toString(),
    collection_completed_at_utc: now.toISOString(),
    elapsed_seconds: elapsedSec,
    search_conditions: state.settings,
    api_key_hash: keyHash,
    summary: {
      total_videos:   jaVideos.length + enVideos.length,
      total_comments: jaComments.length + enComments.length,
      videos_by_language:   { ja: jaVideos.length,   en: enVideos.length },
      comments_by_language: {
        ja: jaComments.length - unknownComments,
        en: enComments.length,
        unknown: unknownComments,
      },
      failed_videos: failedVideos,
      quota_used: state.progress.quotaUsed,
    },
    files: fileList,
  };
}

// ──────────────────────────────────────────────────────────
// README.txt builder (bilingual)
// ──────────────────────────────────────────────────────────

function buildReadmeTxt(state) {
  const s = state.settings;
  const jaV = (state.results.videos.ja   || []).length;
  const enV = (state.results.videos.en   || []).length;
  const jaC = (state.results.comments.ja || []).length;
  const enC = (state.results.comments.en || []).length;

  return `=== YouTube Comment Harvester for KH Coder ===
Version: 0.1.0
https://github.com/

--- 収集条件 / Collection Conditions ---
期間 / Period:    ${s.dateStart} ～ ${s.dateEnd}
言語 / Language:  ${(s.languages || []).join(', ')}
期間分割 / Split: ${s.splitPeriod ? s.splitUnit : 'none'}
コメント上限 / Comment limit: ${s.commentsPerVideo ?? 'unlimited'}

--- 結果サマリー / Summary ---
日本語動画 / Japanese videos:    ${jaV}
英語動画   / English videos:     ${enV}
日本語コメント / Japanese comments: ${jaC}
英語コメント   / English comments:  ${enC}

--- ファイル構成 / File Structure ---
raw/ja_videos.csv       - 日本語動画メタデータ
raw/ja_comments.csv     - 日本語コメント（生データ）
raw/en_videos.csv       - 英語動画メタデータ
raw/en_comments.csv     - 英語コメント（生データ）
khcoder/ja_comments_khcoder.tsv - KH Coder用日本語コメントTSV
khcoder/en_comments_khcoder.tsv - KH Coder用英語コメントTSV
khcoder/ja_videos_khcoder.tsv   - KH Coder用日本語動画TSV
khcoder/en_videos_khcoder.tsv   - KH Coder用英語動画TSV
logs/collection_log.txt         - 収集ログ

--- KH Coderへの投入手順 / How to use with KH Coder ---
1. KH Coderを起動し、新規プロジェクトを作成します
2. 分析テキスト選択画面で khcoder/ フォルダ内のTSVファイルを選択します
3. 「テキストの前処理」を実行します
4. 文書変数として video_id, channel_type, published_year 等が利用可能です

--- 倫理的配慮 / Ethical Considerations ---
- 本データにはYouTubeユーザーの表示名・コメント本文が含まれます
- 個人が特定可能な形での公開・二次配布には十分ご注意ください
- YouTubeの利用規約に従い、研究目的での利用に限定してください
- 論文・発表における引用時はデータ収集日・条件を明記してください

収集日時 / Collected: ${new Date().toISOString()}
`;
}

// ──────────────────────────────────────────────────────────
// Log formatter
// ──────────────────────────────────────────────────────────

function buildCollectionLog(logs) {
  const header = `=== YouTube Comment Harvester – Collection Log ===\n`;
  const lines = (logs || []).map(l => {
    const ts = l.ts ? new Date(l.ts).toISOString() : '';
    const level = (l.level || 'info').toUpperCase().padEnd(5);
    return `[${ts}] ${level} ${l.msg}`;
  });
  return header + lines.join('\n');
}

// ──────────────────────────────────────────────────────────
// Main ZIP generation function
// ──────────────────────────────────────────────────────────

/**
 * Generate the output ZIP file using JSZip.
 * @param {object} state – application state
 * @param {string} apiKey – to hash for manifest
 * @param {Function} onProgress – (pct: 0-100) => void
 * @returns {Promise<Blob>} – ZIP blob
 */
async function generateZip(state, apiKey, onProgress = null) {
  if (typeof JSZip === 'undefined') {
    throw new Error('JSZip library not loaded');
  }

  const zip = new JSZip();

  const { videos, comments } = state.results;
  const langs  = state.settings?.languages || ['ja'];
  const hasJa  = langs.includes('ja');
  const hasEn  = langs.includes('en');

  const jaVideos   = hasJa ? (videos.ja   || []) : [];
  const enVideos   = hasEn ? (videos.en   || []) : [];
  const jaComments = hasJa ? (comments.ja || []) : [];
  const enComments = hasEn ? (comments.en || []) : [];

  // Build channel map from video data (channel raw info stored during collection)
  const channelMap = state.results.channelMap || new Map();

  // Build video map for KH Coder cross-reference
  const videoMap = new Map();
  for (const v of [...jaVideos, ...enVideos]) {
    videoMap.set(v.video_id, v);
  }

  if (onProgress) onProgress(5);

  // ── raw/ ─────────────────────────────────────────────────
  const rawFolder = zip.folder('raw');
  const fileList  = [];

  if (hasJa) {
    rawFolder.file('ja_videos.csv',
      toCsvString(VIDEO_CSV_HEADERS, jaVideos.map(videoToRawRow)));
    rawFolder.file('ja_videos.json',
      JSON.stringify(jaVideos, null, 2));
    fileList.push(
      { path: 'raw/ja_videos.csv',  rows: jaVideos.length },
      { path: 'raw/ja_videos.json', rows: jaVideos.length },
    );
  }
  if (hasEn) {
    rawFolder.file('en_videos.csv',
      toCsvString(VIDEO_CSV_HEADERS, enVideos.map(videoToRawRow)));
    rawFolder.file('en_videos.json',
      JSON.stringify(enVideos, null, 2));
    fileList.push(
      { path: 'raw/en_videos.csv',  rows: enVideos.length },
      { path: 'raw/en_videos.json', rows: enVideos.length },
    );
  }

  if (onProgress) onProgress(20);

  if (hasJa) {
    rawFolder.file('ja_comments.csv',
      toCsvString(COMMENT_CSV_HEADERS, jaComments.map(commentToRawRow)));
    rawFolder.file('ja_comments.json',
      JSON.stringify(jaComments, null, 2));
    fileList.push(
      { path: 'raw/ja_comments.csv',  rows: jaComments.length },
      { path: 'raw/ja_comments.json', rows: jaComments.length },
    );
  }

  if (onProgress) onProgress(40);

  if (hasEn) {
    rawFolder.file('en_comments.csv',
      toCsvString(COMMENT_CSV_HEADERS, enComments.map(commentToRawRow)));
    rawFolder.file('en_comments.json',
      JSON.stringify(enComments, null, 2));
    fileList.push(
      { path: 'raw/en_comments.csv',  rows: enComments.length },
      { path: 'raw/en_comments.json', rows: enComments.length },
    );
  }

  if (onProgress) onProgress(55);

  // ── khcoder/ ─────────────────────────────────────────────
  const khFolder = zip.folder('khcoder');

  if (hasJa) {
    khFolder.file('ja_comments_khcoder.tsv',
      toTsvString(KH_COMMENT_HEADERS, jaComments.map(c => commentToKhRow(c, videoMap, channelMap))));
    khFolder.file('ja_videos_khcoder.tsv',
      toTsvString(KH_VIDEO_HEADERS, jaVideos.map(v => videoToKhRow(v, channelMap))));
    fileList.push(
      { path: 'khcoder/ja_comments_khcoder.tsv', rows: jaComments.length },
      { path: 'khcoder/ja_videos_khcoder.tsv',   rows: jaVideos.length },
    );
  }
  if (hasEn) {
    khFolder.file('en_comments_khcoder.tsv',
      toTsvString(KH_COMMENT_HEADERS, enComments.map(c => commentToKhRow(c, videoMap, channelMap))));
    khFolder.file('en_videos_khcoder.tsv',
      toTsvString(KH_VIDEO_HEADERS, enVideos.map(v => videoToKhRow(v, channelMap))));
    fileList.push(
      { path: 'khcoder/en_comments_khcoder.tsv', rows: enComments.length },
      { path: 'khcoder/en_videos_khcoder.tsv',   rows: enVideos.length },
    );
  }

  if (onProgress) onProgress(80);

  // ── logs/ ─────────────────────────────────────────────────
  const logsFolder = zip.folder('logs');
  logsFolder.file('collection_log.txt', buildCollectionLog(state.progress.logs));

  // ── root files ───────────────────────────────────────────
  zip.file('README.txt', buildReadmeTxt(state));

  const manifest = await buildManifest(state, fileList, apiKey);
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  if (onProgress) onProgress(90);

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });

  if (onProgress) onProgress(100);
  return blob;
}

/**
 * Trigger a browser download for a Blob.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Generate a ZIP filename based on collection start time.
 * Format: yt-harvest_YYYY-MM-DD_HHMMSS.zip
 */
function makeZipFilename(startTime) {
  const d = startTime ? new Date(startTime) : new Date();
  const date = d.toISOString().split('T')[0];
  const time = d.toTimeString().substring(0, 8).replace(/:/g, '');
  return `yt-harvest_${date}_${time}.zip`;
}

export { generateZip, downloadBlob, makeZipFilename, detectChannelType };
