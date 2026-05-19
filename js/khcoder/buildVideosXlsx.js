// buildVideosXlsx.js – Generate KH Coder–ready videos Excel file

import { cleanText, isoDurationToSec } from './preprocess.js';

const HEADER_ARGB = 'FFDDDDDD';

function styleHeaderRow(ws, colCount) {
  for (let i = 1; i <= colCount; i++) {
    const cell = ws.getRow(1).getCell(i);
    cell.font = { name: 'Arial', bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } };
  }
}

/**
 * Build khcoder_videos.xlsx (or khcoder_videos_en.xlsx).
 *
 * Pipeline (matches convert_for_khcoder.py exactly):
 *   1. Language filter: detected === lang AND confidence >= 0.8
 *   2. cleanText() on title and description, join with space
 *   3. Length filter: combined text.length >= 3
 *
 * @param {object[]} videos – raw video objects
 * @param {string}   lang   – 'ja' or 'en'
 * @returns {Promise<{buffer: ArrayBuffer, count: number}>}
 */
async function buildVideosXlsx(videos, lang = 'ja') {
  const rows = [];
  for (const v of videos) {
    if (v.video_language_detected !== lang) continue;
    if (Number(v.video_language_confidence) < 0.8) continue;

    const titleClean = cleanText(v.title);
    const descClean  = cleanText(v.description);
    const text = (titleClean + ' ' + descClean).trim();
    if (text.length < 3) continue;

    rows.push([
      text,
      v.video_id,
      v.channel_id,
      v.published_at || '',
      (v.published_at || '').slice(0, 7),
      Number(v.view_count)    || 0,
      Number(v.like_count)    || 0,
      Number(v.comment_count) || 0,
      isoDurationToSec(v.duration),
      v.category_id || '',
    ]);
  }

  const COLS = [
    { header: 'text',          width: 80 },
    { header: 'video_id',      width: 18 },
    { header: 'channel_id',    width: 18 },
    { header: 'published_at',  width: 18 },
    { header: 'published_ym',  width: 18 },
    { header: 'view_count',    width: 18 },
    { header: 'like_count',    width: 18 },
    { header: 'comment_count', width: 18 },
    { header: 'duration_sec',  width: 18 },
    { header: 'category_id',   width: 18 },
  ];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('videos');

  ws.columns = COLS.map(c => ({ header: c.header, key: c.header, width: c.width }));
  styleHeaderRow(ws, COLS.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const r of rows) ws.addRow(r);

  // README sheet
  const readme = wb.addWorksheet('README');
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const metaRows = [
    ['KH Coder用 動画メタデータ分析ファイル', ''],
    ['', ''],
    ['生成日時', now],
    ['元データ', `yt-harvester ${lang}_videos.csv`],
    ['', ''],
    ['分析対象テキスト', 'title + description を半角スペースで結合'],
    ['', ''],
    ['前処理ルール', ''],
    ['  言語フィルタ', `video_language_detected == '${lang}' かつ confidence >= 0.8`],
    ['  最低文字数', 'クリーニング後3文字以上'],
    ['  改行・URL・メンション処理', 'コメント側と同一'],
    ['', ''],
    ['派生列', ''],
    ['  duration_sec', 'ISO 8601形式（PT1M56S等）を秒に換算'],
    ['  published_ym', '公開日のYYYY-MM部分のみ'],
    ['', ''],
    ['件数', String(rows.length)],
  ];

  for (const r of metaRows) readme.addRow(r);
  readme.getColumn(1).width = 30;
  readme.getColumn(2).width = 60;
  for (let i = 1; i <= metaRows.length; i++) {
    readme.getRow(i).getCell(1).font = { name: 'Arial', bold: true };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return { buffer, count: rows.length };
}

export { buildVideosXlsx };
