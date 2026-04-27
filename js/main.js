// main.js – Application controller and collection orchestration

import { initI18n, setLanguage, t, getCurrentLang } from './i18n.js';
import {
  showModal, hideModal, showSection,
  initTheme, toggleTheme,
  createSearchConditionRow, updateSuggestionChips,
  updateProgressUI, appendLogEntry, clearLog,
  showFieldError, clearFieldError,
  openDictEditor,
  updateQuotaEstimate,
} from './ui.js';
import { YouTubeAPI, estimateQuota, sleep } from './api.js';
import { detectLanguage, matchesLanguage } from './language.js';
import { generateZip, downloadBlob, makeZipFilename } from './csv.js';
import {
  initStorage, saveState, loadState, clearState, hasSavedState,
  hasConsent, setConsent,
} from './storage.js';

// ──────────────────────────────────────────────────────────
// Application state
// ──────────────────────────────────────────────────────────

const APP = {
  apiKey: null,
  isCollecting: false,
  isPaused: false,
  isResuming: false,   // true when continuing from a saved IndexedDB state
  abortController: null,

  settings: {
    dateStart:       null,
    dateEnd:         null,
    splitPeriod:     false,
    splitUnit:       'month',
    languages:       ['ja', 'en'],
    commentsPerVideo: null,
  },

  results: {
    videos:       { ja: [], en: [] },
    comments:     { ja: [], en: [] },
    videoCache:   new Map(),   // video_id → normalized video object
    commentCache: new Set(),   // comment_id (dedup)
    channelCache: new Map(),   // channel_id → channel API item
    channelMap:   new Map(),   // for CSV generation: channel_id → {_raw}
  },

  progress: {
    total:           0,
    done:            0,
    quotaUsed:       0,
    startTime:       null,
    currentTask:     '',
    videosJa:        0,
    videosEn:        0,
    commentsJa:      0,
    commentsEn:      0,
    commentsUnknown: 0,
    logs:            [],
  },
};

// Related terms dictionary (loaded from file + localStorage overrides)
let relatedTermsDict = {};
let defaultRelatedTermsDict = {};

// ──────────────────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────────────────

async function init() {
  initTheme();
  initI18n();
  await initStorage();
  await loadRelatedTermsDict();

  setupGlobalEventListeners();
  addSearchConditionRow(); // Start with one row

  // Check for saved state
  const hasSaved = await hasSavedState();
  if (hasSaved) {
    document.getElementById('resume-section').removeAttribute('hidden');
  }

  showModal('api-key-modal');
}

// ──────────────────────────────────────────────────────────
// Related terms dictionary
// ──────────────────────────────────────────────────────────

async function loadRelatedTermsDict() {
  try {
    const res = await fetch('./data/related_terms.json');
    defaultRelatedTermsDict = await res.json();
  } catch {
    defaultRelatedTermsDict = {};
  }

  const saved = localStorage.getItem('related_terms_dict');
  if (saved) {
    try { relatedTermsDict = JSON.parse(saved); }
    catch { relatedTermsDict = defaultRelatedTermsDict; }
  } else {
    relatedTermsDict = defaultRelatedTermsDict;
  }
}

function saveRelatedTermsDict(dict) {
  relatedTermsDict = dict;
  localStorage.setItem('related_terms_dict', JSON.stringify(dict));
  // Refresh all suggestion chips
  document.querySelectorAll('.condition-row').forEach(row => {
    updateSuggestionChips(row, relatedTermsDict);
  });
}

// ──────────────────────────────────────────────────────────
// Search condition row management
// ──────────────────────────────────────────────────────────

function addSearchConditionRow(data = null) {
  const container = document.getElementById('conditions-container');
  const row = createSearchConditionRow(data, {
    onRemove: () => refreshConditionNumbers(),
    onDuplicate: (r) => addSearchConditionRow(extractConditionData(r)),
    onMustChange: (r) => updateSuggestionChips(r, relatedTermsDict),
    onEditDict: () => openDictEditor(
      relatedTermsDict, defaultRelatedTermsDict, saveRelatedTermsDict
    ),
  });
  container.appendChild(row);
  updateSuggestionChips(row, relatedTermsDict);
  updateQuotaEstimateDisplay();
}

function refreshConditionNumbers() {
  document.querySelectorAll('.condition-row').forEach((row, i) => {
    const numEl = row.querySelector('.condition-num');
    if (numEl) numEl.textContent = i + 1;
  });
}

function extractConditionData(row) {
  return {
    must:    row.querySelector('.must-input')?.value || '',
    any:     row.querySelector('.any-input')?.value  || '',
    not:     row.querySelector('.not-input')?.value  || '',
    enabled: row.querySelector('.condition-enabled')?.checked ?? true,
  };
}

function getActiveConditions() {
  return Array.from(document.querySelectorAll('.condition-row'))
    .filter(row => row.querySelector('.condition-enabled')?.checked !== false)
    .map(extractConditionData)
    .filter(c => c.must.trim() || c.any.trim());
}

function buildAPIQuery(condition) {
  const parts = [];
  if (condition.must.trim()) parts.push(condition.must.trim());
  if (condition.any.trim()) {
    const terms = condition.any.split(/[|\s]+/).filter(Boolean);
    if (terms.length > 1) parts.push(terms.join('|'));
    else if (terms.length === 1) parts.push(terms[0]);
  }
  if (condition.not.trim()) {
    condition.not.split(/\s+/).filter(Boolean).forEach(w => parts.push(`-${w}`));
  }
  return parts.join(' ');
}

// ──────────────────────────────────────────────────────────
// Quota estimate (live update)
// ──────────────────────────────────────────────────────────

function updateQuotaEstimateDisplay() {
  const conditions = getActiveConditions();
  const splitPeriod = document.getElementById('split-period-toggle')?.checked;
  const splitUnit   = document.getElementById('split-unit-select')?.value || 'month';
  const langVal     = document.getElementById('language-select')?.value || 'ja';
  const limitVal    = document.getElementById('comments-limit-select')?.value || 'unlimited';
  const dateStart   = document.getElementById('date-start')?.value;
  const dateEnd     = document.getElementById('date-end')?.value;

  let periods = 1;
  if (splitPeriod && dateStart && dateEnd) {
    const generated = generatePeriods(dateStart, dateEnd, splitUnit);
    periods = generated.length;
  }

  const numLangs = 1;
  const commentsPerVideo = limitVal === 'unlimited' ? 500 : parseInt(limitVal) || 100;

  const estimate = estimateQuota({
    numConditions: Math.max(conditions.length, 1),
    numPeriods: periods,
    numLanguages: numLangs,
    estimatedVideosPerSearch: 50,
    commentsPerVideo,
  });

  updateQuotaEstimate(estimate);
}

// ──────────────────────────────────────────────────────────
// Period generation
// ──────────────────────────────────────────────────────────

function generatePeriods(startDate, endDate, unit) {
  const periods = [];
  let current = new Date(startDate + 'T00:00:00Z');
  const end    = new Date(endDate   + 'T23:59:59Z');

  while (current <= end) {
    const periodStart = new Date(current);
    let periodEnd = new Date(current);

    switch (unit) {
      case 'day':     periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);         break;
      case 'week':    periodEnd.setUTCDate(periodEnd.getUTCDate() + 7);         break;
      case 'month':   periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);       break;
      case 'quarter': periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 3);       break;
      case 'year':    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1); break;
      default:        periodEnd = new Date(end); break;
    }
    periodEnd.setUTCMilliseconds(periodEnd.getUTCMilliseconds() - 1);
    if (periodEnd > end) periodEnd = new Date(end);

    periods.push({
      publishedAfter:  periodStart.toISOString(),
      publishedBefore: periodEnd.toISOString(),
      label: `${periodStart.toISOString().substring(0, 10)} – ${periodEnd.toISOString().substring(0, 10)}`,
    });

    current = new Date(periodEnd);
    current.setUTCMilliseconds(current.getUTCMilliseconds() + 1);
    if (current > end) break;
  }

  return periods;
}

// ──────────────────────────────────────────────────────────
// Event listeners
// ──────────────────────────────────────────────────────────

function setupGlobalEventListeners() {
  // Theme
  document.getElementById('theme-toggle')
    .addEventListener('click', toggleTheme);

  // Language
  document.getElementById('lang-toggle')
    .addEventListener('click', () => {
      const next = getCurrentLang() === 'ja' ? 'en' : 'ja';
      setLanguage(next);
    });

  // API key form
  document.getElementById('api-key-form')
    .addEventListener('submit', handleAPIKeySubmit);

  document.getElementById('api-key-input')
    .addEventListener('input', () => clearFieldError('api-key-error'));

  // Show/hide API key
  document.getElementById('api-key-toggle-vis')
    .addEventListener('click', toggleApiKeyVisibility);

  // Add condition
  document.getElementById('add-condition-btn')
    .addEventListener('click', () => addSearchConditionRow());

  // Export/Import conditions
  document.getElementById('export-conditions-btn')
    .addEventListener('click', exportConditions);
  document.getElementById('import-conditions-btn')
    .addEventListener('click', () => document.getElementById('import-conditions-input').click());
  document.getElementById('import-conditions-input')
    .addEventListener('change', importConditions);

  // Start collection
  document.getElementById('start-btn')
    .addEventListener('click', startCollection);

  // Pause/Resume
  document.getElementById('pause-resume-btn')
    .addEventListener('click', togglePause);

  // Abort
  document.getElementById('abort-btn')
    .addEventListener('click', () => showModal('abort-modal'));

  // Abort modal options
  document.getElementById('abort-download-btn')
    .addEventListener('click', () => { hideModal('abort-modal'); abortAndDownload(); });
  document.getElementById('abort-save-btn')
    .addEventListener('click', () => { hideModal('abort-modal'); abortAndSave(); });
  document.getElementById('abort-discard-btn')
    .addEventListener('click', () => { hideModal('abort-modal'); abortAndDiscard(); });
  document.getElementById('abort-cancel-btn')
    .addEventListener('click', () => hideModal('abort-modal'));

  // Quota modal options
  document.getElementById('quota-download-btn')
    .addEventListener('click', () => { hideModal('quota-modal'); abortAndDownload(); });
  document.getElementById('quota-save-btn')
    .addEventListener('click', () => { hideModal('quota-modal'); handleQuotaSave(); });
  document.getElementById('quota-newkey-btn')
    .addEventListener('click', () => { hideModal('quota-modal'); showModal('api-key-modal'); });

  // Consent modal
  document.getElementById('consent-agree-btn')
    .addEventListener('click', () => { setConsent(true); hideModal('consent-modal'); pendingConsentCallback?.(); });
  document.getElementById('consent-deny-btn')
    .addEventListener('click', () => { setConsent(false); hideModal('consent-modal'); pendingConsentCallback?.(); });

  // Download
  document.getElementById('download-btn')
    .addEventListener('click', downloadResults);

  // New collection
  document.getElementById('new-collection-btn')
    .addEventListener('click', () => {
      showSection('search-section');
      resetProgress();
    });

  // Resume
  document.getElementById('resume-btn')
    .addEventListener('click', handleResume);
  document.getElementById('discard-saved-btn')
    .addEventListener('click', async () => {
      await clearState();
      document.getElementById('resume-section').setAttribute('hidden', '');
    });

  // Clear saved data button (in search section)
  document.getElementById('clear-saved-btn')?.addEventListener('click', async () => {
    await clearState();
    alert(t('saved_data_cleared'));
  });

  // Log copy
  document.getElementById('log-copy-btn')
    .addEventListener('click', copyLog);

  // Log toggle
  document.getElementById('log-header')
    .addEventListener('click', toggleLog);

  // Period split toggle
  document.getElementById('split-period-toggle')
    .addEventListener('change', (e) => {
      document.getElementById('split-options').hidden = !e.target.checked;
      updateQuotaEstimateDisplay();
    });

  // Comment limit warning
  document.getElementById('comments-limit-select')
    .addEventListener('change', (e) => {
      document.getElementById('limit-unlimited-warning').hidden = e.target.value !== 'unlimited';
      updateQuotaEstimateDisplay();
    });

  // Live quota estimate updates
  ['date-start', 'date-end', 'language-select', 'split-unit-select'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateQuotaEstimateDisplay);
  });

  // Leave protection
  window.addEventListener('beforeunload', (e) => {
    if (APP.isCollecting) {
      e.preventDefault();
      e.returnValue = t('leave_warning');
    }
  });
}

// ──────────────────────────────────────────────────────────
// API key handling
// ──────────────────────────────────────────────────────────

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key-input');
  const btn   = document.getElementById('api-key-toggle-vis');
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = t('api_key_hide');
  } else {
    input.type = 'password';
    btn.textContent = t('api_key_show');
  }
}

async function handleAPIKeySubmit(e) {
  e.preventDefault();
  clearFieldError('api-key-error');

  const input  = document.getElementById('api-key-input');
  const key    = input.value.trim();
  const submitBtn = document.getElementById('api-key-submit-btn');

  if (!key || key.length < 20 || !key.startsWith('AIza')) {
    showFieldError('api-key-error', t('api_key_error_invalid'));
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = t('api_key_testing');

  try {
    const api = new YouTubeAPI(key);
    await api.testKey();
    APP.apiKey = key;
    hideModal('api-key-modal');
    showSection('search-section');
  } catch (err) {
    let msg = t('api_key_error_generic') + (err.message || '');
    if (err.status === 401) msg = t('api_key_error_401');
    else if (err.status === 403) msg = t('api_key_error_403');
    showFieldError('api-key-error', msg);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t('api_key_verify');
  }
}

// ──────────────────────────────────────────────────────────
// Start / Stop / Pause
// ──────────────────────────────────────────────────────────

async function startCollection() {
  const conditions = getActiveConditions();
  if (conditions.length === 0) {
    alert(t('no_conditions_error'));
    return;
  }

  const dateStart = document.getElementById('date-start').value;
  const dateEnd   = document.getElementById('date-end').value;
  if (!dateStart || !dateEnd) {
    alert(t('no_date_error'));
    return;
  }
  if (dateStart > dateEnd) {
    alert(t('invalid_date_error'));
    return;
  }

  APP.settings = {
    queries: conditions.map(c => ({
      must: c.must,
      any: c.any,
      not: c.not,
      query: buildAPIQuery(c),
    })),
    dateStart,
    dateEnd,
    splitPeriod: document.getElementById('split-period-toggle').checked,
    splitUnit:   document.getElementById('split-unit-select').value,
    languages:   getSelectedLanguages(),
    commentsPerVideo: getCommentLimit(),
    comment_order: 'time',
    comment_depth: 'all_replies',
  };

  if (!APP.isResuming) {
    resetResults();
    resetProgress();
  }
  APP.isResuming = false; // consume the flag
  clearLog();

  APP.isCollecting = true;
  APP.isPaused     = false;
  APP.abortController = new AbortController();

  APP.progress.startTime = Date.now();

  document.getElementById('pause-resume-btn').textContent = t('pause_btn');
  document.getElementById('pause-resume-btn').disabled = false;
  document.getElementById('abort-btn').disabled = false;

  showSection('progress-section');

  // Ticker: update elapsed time every second
  const ticker = setInterval(() => {
    if (!APP.isCollecting) { clearInterval(ticker); return; }
    updateProgressUI(APP.progress);
  }, 1000);
  APP._ticker = ticker;

  addLog('Collection started', 'info');

  try {
    await runCollection();
    if (!APP.abortController.signal.aborted) {
      APP.isCollecting = false;
      clearInterval(APP._ticker);
      addLog('Collection completed', 'info');
      showSection('download-section');
      updateDownloadSummary();
    }
  } catch (err) {
    APP.isCollecting = false;
    clearInterval(APP._ticker);
    if (err.name !== 'AbortError') {
      addLog(`Fatal error: ${err.message}`, 'error');
    }
  }
}

function togglePause() {
  const btn = document.getElementById('pause-resume-btn');
  if (APP.isPaused) {
    APP.isPaused = false;
    btn.textContent = t('pause_btn');
    addLog('Collection resumed', 'info');
  } else {
    APP.isPaused = true;
    btn.textContent = t('resume_collection_btn');
    addLog('Collection paused', 'info');
  }
}

async function waitIfPaused(signal) {
  while (APP.isPaused) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await sleep(500);
  }
}

// ──────────────────────────────────────────────────────────
// Main collection loop
// ──────────────────────────────────────────────────────────

async function runCollection() {
  const { settings } = APP;
  const signal = APP.abortController.signal;

  const api = new YouTubeAPI(APP.apiKey, (quota) => {
    APP.progress.quotaUsed = quota;
    updateProgressUI(APP.progress);
  });

  const periods = settings.splitPeriod
    ? generatePeriods(settings.dateStart, settings.dateEnd, settings.splitUnit)
    : [{ publishedAfter:  settings.dateStart + 'T00:00:00Z',
         publishedBefore: settings.dateEnd   + 'T23:59:59Z',
         label: `${settings.dateStart} – ${settings.dateEnd}` }];

  const totalTasks = settings.queries.length * settings.languages.length * periods.length;
  APP.progress.total = totalTasks;

  for (const lang of settings.languages) {
    for (const condition of settings.queries) {
      if (signal.aborted) return;

      for (const period of periods) {
        if (signal.aborted) return;
        await waitIfPaused(signal);

        APP.progress.currentTask = `${condition.query || condition.must} (${lang}) | ${period.label}`;
        updateProgressUI(APP.progress);

        addLog(`Searching: "${condition.query}" [${lang}] ${period.label}`);

        try {
          await collectForConditionPeriodLang(api, condition, period, lang, signal);
        } catch (err) {
          if (err.name === 'AbortError') throw err;
          if (err.code === 'quotaExceeded') {
            addLog('Quota exceeded', 'error');
            APP.abortController.abort();
            showModal('quota-modal');
            throw new DOMException('Aborted', 'AbortError');
          }
          addLog(`Error in period ${period.label}: ${err.message}`, 'error');
        }

        APP.progress.done++;
        updateProgressUI(APP.progress);

        // Periodic IndexedDB save
        if (hasConsent()) {
          await saveState(APP).catch(() => {});
        }
      }
    }
  }
}

async function collectForConditionPeriodLang(api, condition, period, lang, signal) {
  // 1. Search for video IDs
  const videoIds = await api.searchVideos(
    condition.query,
    { lang, publishedAfter: period.publishedAfter, publishedBefore: period.publishedBefore },
    signal,
    ({ found }) => {
      APP.progress.currentTask = `${condition.query} (${lang}) — searching... ${found} videos`;
      updateProgressUI(APP.progress);
    }
  );
  addLog(`Found ${videoIds.length} video IDs`, 'info');

  // 2. Filter out already-cached video IDs
  const newVideoIds = videoIds.filter(id => !APP.results.videoCache.has(id));

  // 3. Fetch video metadata for new IDs
  if (newVideoIds.length > 0) {
    const rawVideos = await api.getVideoDetails(newVideoIds, signal);
    for (const raw of rawVideos) {
      const normalized = normalizeVideo(raw, lang);
      APP.results.videoCache.set(normalized.video_id, normalized);
      APP.results.videos[lang].push(normalized);
      if (lang === 'ja') APP.progress.videosJa++;
      else APP.progress.videosEn++;
    }
    updateProgressUI(APP.progress);
  }

  // 4. Fetch channel info for new channels (batched)
  const newChannelIds = [...new Set(
    videoIds
      .map(id => APP.results.videoCache.get(id)?.channel_id)
      .filter(id => id && !APP.results.channelCache.has(id))
  )];
  if (newChannelIds.length > 0) {
    const channelMap = await api.getChannels(newChannelIds, signal);
    for (const [id, item] of channelMap) {
      APP.results.channelCache.set(id, item);
      APP.results.channelMap.set(id, { _raw: item });
    }
  }

  // 5. Fetch comments for each video (with parallelism via Promise.all)
  const COMMENT_PARALLEL = 5;
  for (let i = 0; i < videoIds.length; i += COMMENT_PARALLEL) {
    if (signal.aborted) return;
    await waitIfPaused(signal);

    const batch = videoIds.slice(i, i + COMMENT_PARALLEL);
    await Promise.all(batch.map(videoId => fetchAndStoreComments(api, videoId, lang, signal)));
    updateProgressUI(APP.progress);
  }
}

async function fetchAndStoreComments(api, videoId, lang, signal) {
  try {
    addLog(`Fetching comments for ${videoId}`, 'info');

    const enriched = await api.getComments(
      videoId,
      { maxComments: APP.settings.commentsPerVideo },
      signal
    );

    const now = new Date().toISOString();

    for (const { thread, replies } of enriched) {
      // Top-level comment
      const top = thread.snippet?.topLevelComment;
      if (top && !APP.results.commentCache.has(top.id)) {
        const normalized = normalizeComment(top, videoId, null, now);
        normalized.reply_count = thread.snippet?.totalReplyCount || 0;
        APP.results.commentCache.add(top.id);
        APP.results.comments[lang].push(normalized);
        incrementCommentCount(lang, normalized.comment_language_detected);
      }

      // Replies
      for (const reply of replies) {
        if (!APP.results.commentCache.has(reply.id)) {
          const normalized = normalizeComment(reply, videoId, top?.id, now);
          APP.results.commentCache.add(reply.id);
          APP.results.comments[lang].push(normalized);
          incrementCommentCount(lang, normalized.comment_language_detected);
        }
      }
    }

    addLog(`${videoId}: ${enriched.length} threads`, 'info');
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (err.code === 'quotaExceeded') throw err;
    if (err.code === 'commentsDisabled') {
      addLog(`${videoId}: ${t('error_comments_disabled')}`, 'warn');
    } else if (err.code === 'videoNotFound' || err.status === 404) {
      addLog(`${videoId}: ${t('error_video_not_found')}`, 'warn');
    } else if (err.status === 403) {
      addLog(`${videoId}: 403 – ${err.message}`, 'warn');
    } else {
      addLog(`${videoId}: ${err.message}`, 'error');
    }
  }
}

function incrementCommentCount(videoLang, detectedLang) {
  // Count by collection language (which file the comment goes into)
  if (videoLang === 'ja') APP.progress.commentsJa++;
  else APP.progress.commentsEn++;
  // Additionally track how many had undetected language
  if (detectedLang === 'unknown') APP.progress.commentsUnknown++;
}

// ──────────────────────────────────────────────────────────
// Data normalization
// ──────────────────────────────────────────────────────────

function normalizeVideo(raw, lang) {
  const s = raw.snippet || {};
  const st = raw.statistics || {};
  const cd = raw.contentDetails || {};
  const now = new Date().toISOString();

  const textForLangDetect = `${s.title || ''} ${(s.description || '').substring(0, 200)}`;
  const langResult = detectLanguage(textForLangDetect);

  return {
    video_id:                  raw.id,
    channel_id:                s.channelId || '',
    published_at:              s.publishedAt || '',
    title:                     s.title || '',
    description:               s.description || '',
    tags:                      s.tags || [],
    view_count:                st.viewCount    || '0',
    like_count:                st.likeCount    || '0',
    comment_count:             st.commentCount || '0',
    category_id:               s.categoryId || '',
    default_language:          s.defaultLanguage || '',
    default_audio_language:    s.defaultAudioLanguage || '',
    duration:                  cd.duration || '',
    video_language_detected:   langResult.lang,
    video_language_confidence: langResult.confidence.toFixed(2),
    collected_at:              now,
  };
}

function normalizeComment(raw, videoId, parentId, collectedAt) {
  const s = raw.snippet || {};
  const text = s.textOriginal || s.textDisplay || '';
  const langResult = detectLanguage(text);

  return {
    comment_id:                  raw.id,
    video_id:                    videoId,
    parent_id:                   parentId || '',
    author_channel_id:           s.authorChannelId?.value || '',
    author_display_name:         s.authorDisplayName || '',
    published_at:                s.publishedAt || '',
    updated_at:                  s.updatedAt || '',
    text,
    like_count:                  s.likeCount || 0,
    reply_count:                 s.totalReplyCount || '',
    comment_language_detected:   langResult.lang,
    comment_language_confidence: langResult.confidence.toFixed(2),
    collected_at:                collectedAt,
    channel_id:                  s.authorChannelId?.value || '',
  };
}

// ──────────────────────────────────────────────────────────
// Abort handling
// ──────────────────────────────────────────────────────────

async function abortAndDownload() {
  APP.abortController?.abort();
  APP.isCollecting = false;
  showSection('download-section');
  updateDownloadSummary();
}

async function abortAndSave() {
  if (!hasConsent()) {
    pendingConsentCallback = async () => {
      if (hasConsent()) {
        APP.abortController?.abort();
        APP.isCollecting = false;
        await saveState(APP);
        alert(t('saved_data_cleared').replace('削除', '保存'));
        showSection('search-section');
      } else {
        showSection('search-section');
      }
    };
    showModal('consent-modal');
    return;
  }
  APP.abortController?.abort();
  APP.isCollecting = false;
  await saveState(APP);
  showSection('search-section');
}

async function abortAndDiscard() {
  APP.abortController?.abort();
  APP.isCollecting = false;
  resetResults();
  showSection('search-section');
}

// ──────────────────────────────────────────────────────────
// Quota exceeded handling
// ──────────────────────────────────────────────────────────

let pendingConsentCallback = null;

async function handleQuotaSave() {
  if (!hasConsent()) {
    pendingConsentCallback = async () => {
      if (hasConsent()) {
        await saveState(APP);
        alert('データを保存しました。クォータリセット後に再開できます。');
      }
      showSection('search-section');
    };
    showModal('consent-modal');
    return;
  }
  await saveState(APP);
  showSection('search-section');
}

// ──────────────────────────────────────────────────────────
// Resume
// ──────────────────────────────────────────────────────────

async function handleResume() {
  const saved = await loadState();
  if (!saved) return;

  // Restore state
  APP.settings  = saved.settings;
  APP.results   = saved.results;
  APP.progress  = saved.progress;

  // Restore UI from settings
  restoreUIFromSettings(saved.settings);

  APP.isResuming = true; // skip resetResults on next startCollection()
  document.getElementById('resume-section').setAttribute('hidden', '');
  showSection('search-section');
}

function restoreUIFromSettings(settings) {
  if (settings.dateStart)
    document.getElementById('date-start').value = settings.dateStart;
  if (settings.dateEnd)
    document.getElementById('date-end').value = settings.dateEnd;
  if (settings.splitPeriod) {
    document.getElementById('split-period-toggle').checked = true;
    document.getElementById('split-options').hidden = false;
  }
  if (settings.splitUnit)
    document.getElementById('split-unit-select').value = settings.splitUnit;
  if (settings.languages) {
    const langVal = settings.languages[0] === 'en' ? 'en' : 'ja';
    document.getElementById('language-select').value = langVal;
  }

  // Restore conditions
  const container = document.getElementById('conditions-container');
  container.innerHTML = '';
  for (const q of settings.queries || []) {
    addSearchConditionRow({
      must: q.must, any: q.any, not: q.not, enabled: true,
    });
  }
}

// ──────────────────────────────────────────────────────────
// Download
// ──────────────────────────────────────────────────────────

async function downloadResults() {
  const btn = document.getElementById('download-btn');
  btn.disabled = true;
  btn.textContent = t('download_preparing');

  try {
    const blob = await generateZip(APP, APP.apiKey, (pct) => {
      btn.textContent = `${t('download_preparing')} ${pct}%`;
    });
    const filename = makeZipFilename(APP.progress.startTime);
    downloadBlob(blob, filename);
    // Clean up saved state if completed normally
    await clearState();
  } catch (err) {
    alert('ZIP生成エラー: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = t('download_zip');
  }
}

function updateDownloadSummary() {
  const jaV = APP.results.videos.ja.length;
  const enV = APP.results.videos.en.length;
  const jaC = APP.results.comments.ja.length;
  const enC = APP.results.comments.en.length;

  document.getElementById('dl-stat-videos').textContent = (jaV + enV).toLocaleString();
  document.getElementById('dl-stat-comments').textContent = (jaC + enC).toLocaleString();
  document.getElementById('dl-stat-quota').textContent = APP.progress.quotaUsed.toLocaleString();

  const elapsed = APP.progress.startTime
    ? Math.round((Date.now() - APP.progress.startTime) / 1000)
    : 0;
  const { formatDuration } = { formatDuration: (s) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }};
  document.getElementById('dl-stat-elapsed').textContent = formatDuration(elapsed);
}

// ──────────────────────────────────────────────────────────
// Condition import/export
// ──────────────────────────────────────────────────────────

function exportConditions() {
  const conditions = getActiveConditions().map(c => ({
    must: c.must, any: c.any, not: c.not,
    query: buildAPIQuery(c),
  }));
  const data = {
    queries:         conditions,
    dateStart:       document.getElementById('date-start').value,
    dateEnd:         document.getElementById('date-end').value,
    splitPeriod:     document.getElementById('split-period-toggle').checked,
    splitUnit:       document.getElementById('split-unit-select').value,
    languages:       getSelectedLanguages(),
    commentsPerVideo: getCommentLimit(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'conditions.json');
}

async function importConditions(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!confirm(t('import_confirm'))) return;

    // Restore conditions
    const container = document.getElementById('conditions-container');
    container.innerHTML = '';
    for (const q of data.queries || []) {
      addSearchConditionRow({ must: q.must, any: q.any, not: q.not });
    }
    if (data.dateStart) document.getElementById('date-start').value = data.dateStart;
    if (data.dateEnd)   document.getElementById('date-end').value   = data.dateEnd;
    if (data.splitPeriod !== undefined) {
      document.getElementById('split-period-toggle').checked = data.splitPeriod;
      document.getElementById('split-options').hidden = !data.splitPeriod;
    }
    if (data.splitUnit) document.getElementById('split-unit-select').value = data.splitUnit;
    if (data.languages) {
      const val = data.languages[0] === 'en' ? 'en' : 'ja';
      document.getElementById('language-select').value = val;
    }
    updateQuotaEstimateDisplay();
  } catch {
    alert(t('import_error'));
  }
}

// ──────────────────────────────────────────────────────────
// Log helpers
// ──────────────────────────────────────────────────────────

function addLog(msg, level = 'info') {
  const entry = { ts: Date.now(), msg, level };
  APP.progress.logs.push(entry);
  appendLogEntry(entry);
}

function copyLog() {
  const lines = APP.progress.logs.map(l => {
    const ts = new Date(l.ts).toISOString();
    return `[${ts}] ${(l.level || 'info').toUpperCase().padEnd(5)} ${l.msg}`;
  });
  navigator.clipboard.writeText(lines.join('\n')).then(() => {
    const btn = document.getElementById('log-copy-btn');
    const orig = btn.textContent;
    btn.textContent = t('log_copied');
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

function toggleLog() {
  const entries = document.getElementById('log-entries');
  const arrow   = document.getElementById('log-arrow');
  const isOpen  = !entries.hidden;
  entries.hidden = isOpen;
  if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

// ──────────────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────────────

function getSelectedLanguages() {
  const val = document.getElementById('language-select').value;
  return val === 'en' ? ['en'] : ['ja'];
}

function getCommentLimit() {
  const val = document.getElementById('comments-limit-select').value;
  return val === 'unlimited' ? null : parseInt(val, 10);
}

function resetResults() {
  APP.results = {
    videos:       { ja: [], en: [] },
    comments:     { ja: [], en: [] },
    videoCache:   new Map(),
    commentCache: new Set(),
    channelCache: new Map(),
    channelMap:   new Map(),
  };
}

function resetProgress() {
  APP.progress = {
    total:           0,
    done:            0,
    quotaUsed:       0,
    startTime:       null,
    currentTask:     '',
    videosJa:        0,
    videosEn:        0,
    commentsJa:      0,
    commentsEn:      0,
    commentsUnknown: 0,
    logs:            [],
  };
  updateProgressUI(APP.progress);
}

// ──────────────────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
