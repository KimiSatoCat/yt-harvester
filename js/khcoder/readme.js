// readme.js – Generate khcoder/README.md content

/**
 * Build the khcoder/README.md string included in the ZIP.
 * Explains how to load the xlsx files into KH Coder.
 *
 * @param {object} state – APP state object
 * @returns {string}
 */
function buildKhcoderReadme(state) {
  const settings = state.settings || {};
  const langs    = settings.languages || ['ja'];
  const hasJa    = langs.includes('ja');
  const hasEn    = langs.includes('en');

  const fileTable = [
    '| ファイル | 内容 |',
    '|---------|------|',
    ...(hasJa ? [
      '| `khcoder_comments.xlsx` | 日本語コメント分析用（1行=1コメント、動画情報JOIN済み）|',
      '| `khcoder_videos.xlsx` | 日本語動画メタデータ分析用（1行=1動画、title+description結合）|',
    ] : []),
    ...(hasEn ? [
      '| `khcoder_comments_en.xlsx` | 英語コメント分析用|',
      '| `khcoder_videos_en.xlsx` | 英語動画メタデータ分析用|',
    ] : []),
  ].join('\n');

  return `# KH Coder 向けデータ読み込みガイド

## 収録ファイル

このフォルダには KH Coder で直接読み込み可能な Excel ファイルが含まれています。

${fileTable}

## KH Coder での読み込み手順

### コメント分析の場合

1. KH Coder を起動し、**プロジェクト > 新規** を選択
2. ファイル選択で \`khcoder_comments.xlsx\` を指定
3. 「分析対象とする列」で **text** を選択
4. 言語設定で **日本語 (MeCab)** を選択
5. **前処理 > 実行** をクリック

### 動画メタデータ分析の場合

1. ファイル選択で \`khcoder_videos.xlsx\` を指定（手順は同様）
2. \`text\` 列には動画タイトル＋説明文が結合されています

## 段落の単位について

**H5（セル単位）** を推奨します。1行（セル）＝1コメントまたは1動画として処理されます。

## 外部変数について

B列以降の列は KH Coder の「ツール > 外部変数と見出し」で外部変数として利用可能です。

コメント分析での活用例：
- \`video_published_ym\` — 動画公開年月でコメントをグループ化
- \`is_reply\` — 返信コメント(1)と最上位コメント(0)を区別
- \`video_view_count\` — 動画視聴数による絞り込み

## 適用済み前処理ルール

以下の前処理がデータに適用されています：

- **言語フィルタ**: 言語検出スコア ≥ 0.8 のもののみ
- **最低文字数**: 3文字以上（クリーニング後）
- **URL除去**: http(s):// で始まるURLをスペースに置換
- **メンション除去**: @username 形式をスペースに置換
- **改行正規化**: \\r\\n, \\n, \\r, \\t を半角スペースに置換（KH Coderの段落区切り誤認防止のため必須）

## 文字コードについて（Windows版 KH Coder）

本ファイルは xlsx 形式のため文字コード問題は発生しません。
CSVと異なり、UTF-8の手動設定は不要です。

## 再現性について

ZIPルートの \`collection_manifest.json\` に収集条件・フィルタ条件・件数が記録されています。
論文・学会発表への引用時は同ファイルの \`conditions_hash\` 値を併記してください。
`;
}

export { buildKhcoderReadme };
