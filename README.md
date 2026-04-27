# YouTube Comment Harvester for KH Coder

YouTubeの動画メタデータとコメントを収集し，KH Coderへの投入を前提としたCSV/TSVファイルをzipで出力する静的Webツールです．

A static web tool that collects YouTube video metadata and comments, then exports CSV/TSV files ready for KH Coder text analysis.

**[▶ ツールを開く / Open the Tool](https://KimiSatoCat.github.io/yt-harvester/)**

---

## 特徴 / Features

- 完全静的HTML/JS（サーバー不要）– Works entirely in the browser
- 日本語・英語コンテンツを並列収集 – Collects JP & EN content simultaneously
- KH Coder専用TSV形式で出力 – Exports KH Coder-ready TSV with document variables
- ZIP形式で一括ダウンロード – ZIP download with manifest for reproducibility
- APIキーはセッション中のみ保持，保存なし – API key never stored to disk
- 中断・再開機能（IndexedDB）– Interrupt & resume via IndexedDB

---

## はじめに / Getting Started

### 1. YouTube Data API キーの取得

<!-- 📷 IMAGE: Google Cloud Console – プロジェクト選択画面のスクリーンショット -->

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスし，プロジェクトを作成またはすでに持っているプロジェクトを選択します
2. 左メニューの「APIとサービス」→「ライブラリ」を開きます
3. 「YouTube Data API v3」を検索し，有効化します

<!-- 📷 IMAGE: YouTube Data API v3の検索・有効化画面 -->

4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」をクリックします
5. 作成されたAPIキーをコピーします（`AIzaSy` で始まる文字列）

<!-- 📷 IMAGE: APIキー作成完了画面 -->

### 2. HTTPリファラ制限の設定（推奨）

不正利用を防ぐため，作成したAPIキーに **HTTPリファラ制限** を設定することを推奨します．

<!-- 📷 IMAGE: APIキー編集画面 – 「アプリケーションの制限」設定 -->

1. 認証情報ページでAPIキー名をクリックし，編集画面を開きます
2. 「アプリケーションの制限」で「**HTTPリファラー（ウェブサイト）**」を選択します
3. 「ウェブサイトの制限」に以下のようなパターンを追加します：
   ```
   https://your-username.github.io/yt-harvester/*
   ```
4. 「保存」をクリックします

> **Note**: 制限なしのキーでも動作しますが，万一キーが流出した場合に悪用されるリスクがあります．

---

## 使い方 / Usage

### 基本的な流れ

1. ツールを開くとAPIキー入力モーダルが表示されます
2. YouTube Data API v3のキーを入力して「確認して開始」をクリックします
3. **検索条件**を設定します：
   - **必須キーワード（AND）**: すべてのキーワードを含む動画を検索
   - **いずれか（OR）**: いずれかのキーワードを含む動画を検索
   - **除外（NOT）**: 指定したキーワードを含む動画を除外
   - 「＋ 検索条件を追加」で複数の検索クエリを並列実行できます
4. **収集設定**を入力します：
   - 期間（開始日・終了日）
   - 期間分割オプション（500件制限を超える収集のため）
   - 収集対象言語
   - 1動画あたりのコメント数上限
5. 「収集を開始」をクリックすると収集が始まります
6. 完了後，「ZIPをダウンロード」で結果を取得します

### 期間分割について

YouTube Data APIの検索は1クエリあたり約500件が実質的な上限です．長期間の収集では「期間を分割して取得する」オプションを使用することで，各期間500件×期間数の動画を収集できます．

**例**: 2024年1月〜12月を月単位で分割すると，最大 500 × 12 = 6,000 件の動画を収集できます．

### APIクォータについて

YouTube Data API v3の1日あたりクォータは **10,000ユニット** です：

| 操作 | コスト |
|------|--------|
| 動画検索 1ページ（50件） | 100 ユニット |
| 動画詳細取得（50件/回） | 1 ユニット |
| コメント取得（100件/ページ） | 1 ユニット |

クォータが不足した場合，収集を中断してZIP出力するか，翌日のリセット後に再開できます．

---

## 出力ファイル仕様 / Output Files

ZIPファイルの構造：

```
yt-harvest_YYYY-MM-DD_HHMMSS.zip
├── manifest.json           – 収集条件・結果サマリー（再現性確保用）
├── README.txt              – 日英併記のファイル説明
├── raw/
│   ├── ja_videos.csv       – 日本語動画メタデータ（UTF-8 BOM付き）
│   ├── ja_comments.csv     – 日本語コメント生データ
│   ├── en_videos.csv       – 英語動画メタデータ
│   └── en_comments.csv     – 英語コメント生データ
├── khcoder/
│   ├── ja_comments_khcoder.tsv – KH Coder用日本語コメント（TSV）
│   ├── en_comments_khcoder.tsv – KH Coder用英語コメント（TSV）
│   ├── ja_videos_khcoder.tsv   – KH Coder用日本語動画（TSV）
│   └── en_videos_khcoder.tsv   – KH Coder用英語動画（TSV）
└── logs/
    └── collection_log.txt  – 収集ログ（論文方法論セクション用）
```

### KH Coderへの投入手順

1. KH Coderを起動し，「新規プロジェクト」を作成します
2. テキストファイルの読み込みで `khcoder/ja_comments_khcoder.tsv` を選択します
3. 「テキストの前処理」→「実行」をクリックします
4. 文書変数が自動的に読み込まれます（`video_id`, `channel_type`, `published_year` 等）

---

## ローカルでの開発・テスト

ES Modulesを使用しているため，直接 `index.html` をブラウザで開くと動作しません（`file://` プロトコルの制限）．  
GitHub Pages等のHTTPサーバー上で動作させるか，以下のようなローカルサーバーを使用してください：

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code Live Server拡張機能も利用可能
```

---

## 倫理的配慮 / Ethical Considerations

- 本ツールで収集したデータには，YouTubeユーザーの表示名・コメント本文・チャンネルIDが含まれます
- 個人を特定できる情報の無断公開・二次配布には十分ご注意ください
- [YouTube利用規約](https://www.youtube.com/t/terms) および [YouTube APIサービス利用規約](https://developers.google.com/youtube/terms/api-services-tos) に従い，研究目的での使用に限定してください
- 論文・発表における引用時は，データ収集日・収集条件・本ツール名とバージョンを明記してください

---

## ライセンス / License

MIT License – 詳細は [LICENSE](LICENSE) を参照

---

## 謝辞 / Acknowledgements

- [YouTube Data API v3](https://developers.google.com/youtube/v3) – Google LLC
- [JSZip](https://stuk.github.io/jszip/) – Stuart Knightley (MIT License)
- [IBM Plex Sans](https://www.ibm.com/plex/) – IBM Corp (SIL Open Font License)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) – JetBrains s.r.o. (SIL Open Font License)
- [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) – Google (SIL Open Font License)
