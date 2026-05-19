// buildCommentsXlsx.js – Generate KH Coder–ready comments Excel file

import { cleanText } from './preprocess.js';

const HEADER_ARGB = 'FFDDDDDD';

function styleHeaderRow(ws, colCount) {
  for (let i = 1; i <= colCount; i++) {
    const cell = ws.getRow(1).getCell(i);
    cell.font = { name: 'Arial', bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ARGB } };
  }
}

/**
 * Build khcoder_comments.xlsx (or khcoder_comments_en.xlsx).
 *
 * Pipeline (matches convert_for_khcoder.py exactly):
 *   1. Language filter: detected === lang AND confidence >= 0.8
 *   2. cleanText() on comment text
 *   3. Length filter: text.length >= 3
 *   4. JOIN video metadata by video_id
 *
 * @param {object[]} comments – raw comment objects
 * @param {object[]} videos   – raw video objects (for JOIN)
 * @param {string}   lang     – 'ja' or 'en'
 * @returns {Promise<{buffer: ArrayBuffer, count: number}>}
 */
async function buildCommentsXlsx(comments, videos, lang = 'ja') {
  // Build video lookup map
  const videoMap = new Map(videos.map(v => [v.video_id, v]));

  // Apply filter + preprocess pipeline
  const rows = [];
  for (const c of comments) {
    if (c.comment_language_detected !== lang) continue;
    if (Number(c.comment_language_confidence) < 0.8) continue;

    const text = cleanText(c.text);
    if (text.length < 3) continue;

    const v = videoMap.get(c.video_id);
    rows.push([
      text,
      c.comment_id,
      c.video_id,
      v ? cleanText(v.title) : '',
      v ? (v.published_at || '').slice(0, 7) : '',
      v ? (Number(v.view_count) || 0) : 0,
      c.published_at || '',
      (c.published_at || '').slice(0, 7),
      c.parent_id ? 1 : 0,
      Number(c.like_count) || 0,
      Number(c.reply_count) || 0,
      c.author_display_name || '',
    ]);
  }

  const COLS = [
    { header: 'text',                 width: 80 },
    { header: 'comment_id',           width: 18 },
    { header: 'video_id',             width: 18 },
    { header: 'video_title',          width: 18 },
    { header: 'video_published_ym',   width: 18 },
    { header: 'video_view_count',     width: 18 },
    { header: 'comment_published_at', width: 18 },
    { header: 'comment_published_ym', width: 18 },
    { header: 'is_reply',             width: 18 },
    { header: 'like_count',           width: 18 },
    { header: 'reply_count',          width: 18 },
    { header: 'author_display_name',  width: 18 },
  ];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('comments');

  ws.columns = COLS.map(c => ({ header: c.header, key: c.header, width: c.width }));
  styleHeaderRow(ws, COLS.length);
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  for (const r of rows) ws.addRow(r);

  // README sheet
  const readme = wb.addWorksheet('README');
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const metaRows = [
    ['KH Coder用 コメント分析ファイル', ''],
    ['', ''],
    ['生成日時', now],
    ['元データ', `yt-harvester ${lang}_comments.csv + ${lang}_videos.csv`],
    ['', ''],
    ['前処理ルール', ''],
    ['  言語フィルタ', `comment_language_detected == '${lang}' かつ confidence >= 0.8`],
    ['  最低文字数', 'クリーニング後3文字以上'],
    ['  改行処理', '\\r\\n, \\n, \\r, \\t を半角スペースに置換'],
    ['  URL除去', 'http(s)://... を半角スペースに置換'],
    ['  メンション除去', '@username 形式を半角スペースに置換'],
    ['  空白正規化', '連続した空白（全角含む）を1つの半角スペースに'],
    ['', ''],
    ['列構成', ''],
    ['  A列: text', '分析対象テキスト（KH Coderが自動認識）'],
    ['  B列以降', '外部変数として利用可能'],
    ['', ''],
    ['KH Coderでの読み込み手順', ''],
    ['  1', 'プロジェクト > 新規 で本ファイルを選択'],
    ['  2', '「分析対象とする列」で text を選択'],
    ['  3', '言語: 日本語 (MeCab) を選択'],
    ['  4', '前処理 > 実行'],
    ['', ''],
    ['注意', 'WindowsのKH Coderの場合、UTF-8指定が必要となる場合あり'],
    ['', 'プロジェクト > 設定 で文字コードをUTF-8に変更'],
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

export { buildCommentsXlsx };
