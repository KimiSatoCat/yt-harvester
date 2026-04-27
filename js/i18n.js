// i18n module – UI translations for Japanese and English

const TRANSLATIONS = {
  ja: {
    // App title
    app_title: 'YouTube Comment Harvester for KH Coder',
    app_subtitle: 'YouTubeコメント収集・KH Coder出力ツール',

    // Header
    theme_toggle_dark: 'ダーク',
    theme_toggle_light: 'ライト',
    lang_toggle: 'EN',

    // API key modal
    api_key_modal_title: 'YouTube Data API キー入力',
    api_key_modal_desc: 'Google Cloud ConsoleでAPIキーを取得してください。キーはこのセッション中のみメモリに保持され、どこにも保存されません。',
    api_key_placeholder: 'AIzaSy...',
    api_key_show: '表示',
    api_key_hide: '非表示',
    api_key_verify: 'APIキーを確認して開始',
    api_key_testing: '確認中...',
    api_key_error_invalid: 'APIキーの形式が正しくありません（AIzaSy... で始まる39文字程度の文字列）',
    api_key_error_401: 'APIキーが無効です。Google Cloud ConsoleでAPIキーを確認してください。',
    api_key_error_403: 'アクセスが拒否されました。YouTube Data API v3が有効化されているか、リファラ制限の設定を確認してください。',
    api_key_error_generic: 'APIキーの確認に失敗しました: ',
    api_key_howto: 'APIキーの取得方法',
    api_key_referrer_note: '※ セキュリティのため、HTTPリファラ制限付きキーの使用を推奨します（READMEを参照）',
    resume_available: '前回の途中データがあります',
    resume_btn: '途中から再開',
    resume_or_new: 'または新しく収集を開始',
    discard_saved: '保存データを破棄',

    // Search conditions section
    section_search: '検索条件',
    add_condition: '＋ 検索条件を追加',
    export_conditions: '条件をエクスポート',
    import_conditions: '条件をインポート',
    condition_label: '検索条件',
    condition_duplicate: '複製',
    condition_delete: '削除',
    condition_enable: 'この条件を有効化',
    must_label: '必須キーワード（AND）',
    must_placeholder: '',
    any_label: 'いずれか（OR）— | または半角スペース区切り',
    any_placeholder: '',
    not_label: '除外（NOT）— 半角スペース区切り',
    not_placeholder: '',
    related_terms: '関連語提案:',
    no_related_terms: '関連語なし',

    // Settings section
    section_settings: '収集設定',
    date_range: '期間',
    date_start: '開始日',
    date_end: '終了日',
    split_period: '期間を分割して取得する（1クエリ500件制限を回避）',
    split_unit: '分割単位',
    split_day: '日',
    split_week: '週',
    split_month: '月',
    split_quarter: '四半期',
    split_year: '年',
    language: '収集対象言語',
    lang_ja: '日本語のみ',
    lang_en: '英語のみ',
    comment_limit: '1動画あたりのコメント取得数',
    limit_100: '100件',
    limit_500: '500件',
    limit_1000: '1000件',
    limit_5000: '5000件',
    limit_unlimited: '制限なし（全件）',
    limit_unlimited_warning: '⚠ 「制限なし」選択中：コメント数の多い動画ではAPIクォータを大量消費します',
    quota_estimate: 'クォータ消費見積り:',
    quota_daily_limit: '/ 10,000（1日上限）',

    // Start button
    start_collection: '収集を開始',
    no_conditions_error: '有効な検索条件を少なくとも1つ入力してください',
    no_date_error: '開始日と終了日を入力してください',
    invalid_date_error: '開始日は終了日より前にしてください',

    // Progress section
    section_progress: '収集中...',
    progress_rate: '進捗',
    progress_quota: 'クォータ消費',
    progress_videos: '動画数',
    progress_comments: 'コメント数',
    progress_elapsed: '経過時間',
    progress_remaining: '推定残り時間',
    progress_current: '処理中',
    progress_ja: '日本語',
    progress_en: '英語',
    progress_unknown: '不明',
    pause_btn: '一時停止',
    resume_collection_btn: '再開',
    abort_btn: '中断',
    log_title: '詳細ログ（クリックで展開）',
    log_copy: 'ログをコピー',
    log_copied: 'コピーしました',

    // Abort modal
    abort_modal_title: '収集を中断しますか？',
    abort_option_download: 'ここまでのデータをZIPで出力',
    abort_option_save: '再開可能な状態で保存（IndexedDB）',
    abort_option_discard: '破棄して終了',
    abort_cancel: 'キャンセル（収集を続ける）',

    // Quota exceeded modal
    quota_modal_title: 'APIクォータ超過',
    quota_modal_desc: '本日のYouTube Data APIクォータ（10,000ユニット/日）を超過しました。クォータはUTC 0:00にリセットされます。',
    quota_option_download: '今すぐZIPで出力して終了',
    quota_option_save: '翌日のクォータリセット後に再開するため保存',
    quota_option_newkey: '別のAPIキーで続行',

    // Consent modal
    consent_modal_title: 'ローカルデータ保存の確認',
    consent_modal_body: '収集途中のYouTubeコメントデータ（投稿者表示名・コメント本文・チャンネルID等）が、あなたのブラウザのローカルストレージ（IndexedDB）に一時保存されます。本データは外部に送信されず、本ツール以外からアクセスされません。収集完了またはブラウザのキャッシュクリアで削除されます。',
    consent_agree: '同意して保存を有効化',
    consent_deny: '拒否（保存なし）',

    // Download section
    section_download: '収集完了',
    download_summary: '収集結果サマリー',
    download_total_videos: '動画総数',
    download_total_comments: 'コメント総数',
    download_elapsed: '収集時間',
    download_quota: '消費クォータ',
    download_zip: 'ZIPをダウンロード',
    download_preparing: 'ZIP生成中...',
    download_new_collection: '新しい収集を開始',
    clear_saved_data: '保存データを削除',
    saved_data_cleared: '保存データを削除しました',

    // Errors
    error_network: 'ネットワークエラー。インターネット接続を確認してください。',
    error_comments_disabled: 'コメントが無効化されています（スキップ）',
    error_video_not_found: '動画が見つかりません（スキップ）',
    error_collection: '収集中にエラーが発生しました',
    error_referrer: '403エラー: リファラ制限の設定を確認してください。Google Cloud Consoleでこのツールのドメインを許可リストに追加するか、制限なしキーを使用してください。',

    // Leave warning
    leave_warning: '収集中です。ページを離れると収集データが失われます。本当に離れますか？',

    // Import/Export
    import_confirm: '現在の検索条件を読み込んだ内容で上書きしますか？',
    import_error: '条件ファイルの読み込みに失敗しました。JSON形式を確認してください。',

    // Related terms editor
    edit_related_terms: '関連語辞書を編集',
    related_terms_editor_title: '関連語辞書',
    related_terms_editor_desc: '各行: キーワード → 関連語（カンマ区切り）。変更はlocalStorageに保存されます。',
    related_terms_save: '保存',
    related_terms_reset: 'デフォルトに戻す',
    related_terms_cancel: 'キャンセル',

    // Misc
    unknown: '不明',
    calculating: '計算中...',
    completed: '完了',
    skipped: 'スキップ',
    videos_unit: '件',
    comments_unit: '件',
  },

  en: {
    app_title: 'YouTube Comment Harvester for KH Coder',
    app_subtitle: 'Collect YouTube data & export for KH Coder analysis',

    theme_toggle_dark: 'Dark',
    theme_toggle_light: 'Light',
    lang_toggle: 'JA',

    api_key_modal_title: 'Enter YouTube Data API Key',
    api_key_modal_desc: 'Get an API key from Google Cloud Console. The key is stored only in memory for this session and never saved anywhere.',
    api_key_placeholder: 'AIzaSy...',
    api_key_show: 'Show',
    api_key_hide: 'Hide',
    api_key_verify: 'Verify Key & Start',
    api_key_testing: 'Verifying...',
    api_key_error_invalid: 'Invalid API key format (should start with AIzaSy..., ~39 characters)',
    api_key_error_401: 'Invalid API key. Please check your key in Google Cloud Console.',
    api_key_error_403: 'Access denied. Make sure YouTube Data API v3 is enabled and check your referrer restrictions.',
    api_key_error_generic: 'Failed to verify API key: ',
    api_key_howto: 'How to get an API key',
    api_key_referrer_note: '* For security, we recommend using an API key with HTTP referrer restrictions (see README)',
    resume_available: 'Previous collection data found',
    resume_btn: 'Resume Previous Session',
    resume_or_new: 'Or start a new collection',
    discard_saved: 'Discard saved data',

    section_search: 'Search Conditions',
    add_condition: '+ Add Search Condition',
    export_conditions: 'Export Conditions',
    import_conditions: 'Import Conditions',
    condition_label: 'Condition',
    condition_duplicate: 'Duplicate',
    condition_delete: 'Delete',
    condition_enable: 'Enable this condition',
    must_label: 'Required keywords (AND)',
    must_placeholder: '',
    any_label: 'Any of these (OR) — separate with | or space',
    any_placeholder: '',
    not_label: 'Exclude (NOT) — space separated',
    not_placeholder: '',
    related_terms: 'Suggestions:',
    no_related_terms: 'No suggestions',

    section_settings: 'Collection Settings',
    date_range: 'Date Range',
    date_start: 'Start Date',
    date_end: 'End Date',
    split_period: 'Split by period (bypass 500-result limit per query)',
    split_unit: 'Split unit',
    split_day: 'Day',
    split_week: 'Week',
    split_month: 'Month',
    split_quarter: 'Quarter',
    split_year: 'Year',
    language: 'Target language',
    lang_ja: 'Japanese only',
    lang_en: 'English only',
    comment_limit: 'Comments per video',
    limit_100: '100',
    limit_500: '500',
    limit_1000: '1,000',
    limit_5000: '5,000',
    limit_unlimited: 'Unlimited (all comments)',
    limit_unlimited_warning: '⚠ Unlimited selected: heavy API quota usage for videos with many comments',
    quota_estimate: 'Estimated quota:',
    quota_daily_limit: '/ 10,000 (daily limit)',

    start_collection: 'Start Collection',
    no_conditions_error: 'Please add at least one valid search condition',
    no_date_error: 'Please enter start and end dates',
    invalid_date_error: 'Start date must be before end date',

    section_progress: 'Collecting...',
    progress_rate: 'Progress',
    progress_quota: 'Quota used',
    progress_videos: 'Videos',
    progress_comments: 'Comments',
    progress_elapsed: 'Elapsed',
    progress_remaining: 'Est. remaining',
    progress_current: 'Processing',
    progress_ja: 'Japanese',
    progress_en: 'English',
    progress_unknown: 'Unknown',
    pause_btn: 'Pause',
    resume_collection_btn: 'Resume',
    abort_btn: 'Abort',
    log_title: 'Detailed Log (click to expand)',
    log_copy: 'Copy Log',
    log_copied: 'Copied',

    abort_modal_title: 'Abort collection?',
    abort_option_download: 'Export collected data as ZIP',
    abort_option_save: 'Save for later resumption (IndexedDB)',
    abort_option_discard: 'Discard and exit',
    abort_cancel: 'Cancel (continue collecting)',

    quota_modal_title: 'API Quota Exceeded',
    quota_modal_desc: "Today's YouTube Data API quota (10,000 units/day) has been exceeded. Quota resets at UTC 00:00.",
    quota_option_download: 'Export as ZIP and finish',
    quota_option_save: 'Save to resume after quota reset tomorrow',
    quota_option_newkey: 'Continue with a different API key',

    consent_modal_title: 'Local Data Storage Consent',
    consent_modal_body: 'Collected YouTube comment data (display names, comment text, channel IDs, etc.) will be temporarily stored in your browser\'s local storage (IndexedDB). This data is not transmitted externally and cannot be accessed outside this tool. It will be deleted upon completion or when you clear browser cache.',
    consent_agree: 'Agree & Enable Storage',
    consent_deny: 'Deny (no storage)',

    section_download: 'Collection Complete',
    download_summary: 'Summary',
    download_total_videos: 'Total videos',
    download_total_comments: 'Total comments',
    download_elapsed: 'Collection time',
    download_quota: 'Quota used',
    download_zip: 'Download ZIP',
    download_preparing: 'Generating ZIP...',
    download_new_collection: 'Start New Collection',
    clear_saved_data: 'Delete Saved Data',
    saved_data_cleared: 'Saved data has been deleted',

    error_network: 'Network error. Please check your internet connection.',
    error_comments_disabled: 'Comments are disabled (skipped)',
    error_video_not_found: 'Video not found (skipped)',
    error_collection: 'An error occurred during collection',
    error_referrer: '403 Error: Check your referrer restriction settings. Add this tool\'s domain to the allowlist in Google Cloud Console, or use an unrestricted key.',

    leave_warning: 'Collection is in progress. Leaving will lose collected data. Are you sure?',

    import_confirm: 'Overwrite current search conditions with imported data?',
    import_error: 'Failed to parse conditions file. Please check the JSON format.',

    edit_related_terms: 'Edit Related Terms',
    related_terms_editor_title: 'Related Terms Dictionary',
    related_terms_editor_desc: 'Each line: keyword → related terms (comma-separated). Changes are saved to localStorage.',
    related_terms_save: 'Save',
    related_terms_reset: 'Reset to Default',
    related_terms_cancel: 'Cancel',

    unknown: 'Unknown',
    calculating: 'Calculating...',
    completed: 'Completed',
    skipped: 'Skipped',
    videos_unit: '',
    comments_unit: '',
  },
};

let currentLang = 'ja';

function initI18n() {
  const saved = localStorage.getItem('ui_lang');
  const sys = navigator.language?.startsWith('en') ? 'en' : 'ja';
  currentLang = saved || sys;
  document.documentElement.lang = currentLang;
  applyTranslations();
  // Sync the lang-toggle button text with the current language
  // (data-i18n is not used on this button so we set it manually)
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = TRANSLATIONS[currentLang]?.lang_toggle ?? 'EN';
}

function setLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  localStorage.setItem('ui_lang', lang);
  applyTranslations();
  // Update lang toggle button text
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = TRANSLATIONS[lang].lang_toggle;
}

function t(key) {
  return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS.ja[key] ?? key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const val = t(key);
    if (attr) {
      el.setAttribute(attr, val);
    } else {
      el.textContent = val;
    }
  });
}

function getCurrentLang() {
  return currentLang;
}

export { initI18n, setLanguage, t, applyTranslations, getCurrentLang };
