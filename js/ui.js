// ui.js – UI helper functions and DOM utilities

import { t, applyTranslations } from './i18n.js';

// ──────────────────────────────────────────────────────────
// Modal management
// ──────────────────────────────────────────────────────────

function showModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.removeAttribute('hidden');
    el.setAttribute('aria-hidden', 'false');
    // Focus first interactive element
    const focusable = el.querySelector('button, input, select, textarea, [tabindex]');
    if (focusable) setTimeout(() => focusable.focus(), 50);
  }
}

function hideModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.setAttribute('hidden', '');
    el.setAttribute('aria-hidden', 'true');
  }
}

// ──────────────────────────────────────────────────────────
// Section visibility
// ──────────────────────────────────────────────────────────

const SECTIONS = ['search-section', 'progress-section', 'download-section'];

function showSection(id) {
  for (const sec of SECTIONS) {
    const el = document.getElementById(sec);
    if (el) {
      if (sec === id) {
        el.removeAttribute('hidden');
      } else {
        el.setAttribute('hidden', '');
      }
    }
  }
}

// ──────────────────────────────────────────────────────────
// Theme management
// ──────────────────────────────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem('theme');
  const sys   = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const theme = saved || sys;
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.querySelector('.theme-icon').textContent = theme === 'dark' ? '○' : '●';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ──────────────────────────────────────────────────────────
// Search condition row builder
// ──────────────────────────────────────────────────────────

let conditionCount = 0;

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function createSearchConditionRow(data = null, callbacks = {}) {
  conditionCount++;
  const idx = conditionCount;

  const row = document.createElement('div');
  row.className = 'condition-row';
  row.dataset.idx = idx;

  // Use t() for initial text so labels render immediately even before DOM insertion.
  // data-i18n attributes are kept so language-switching updates them correctly.
  row.innerHTML = `
    <div class="condition-header">
      <span class="condition-label" data-i18n="condition_label">${t('condition_label')}</span>
      <span class="condition-num">${idx}</span>
      <div class="condition-actions">
        <button class="btn-ghost btn-sm condition-duplicate" type="button" data-i18n="condition_duplicate">${t('condition_duplicate')}</button>
        <button class="btn-ghost btn-sm btn-danger condition-delete" type="button" data-i18n="condition_delete">${t('condition_delete')}</button>
      </div>
    </div>
    <div class="condition-body">
      <label class="field-label" data-i18n="must_label">${t('must_label')}</label>
      <input class="field-input must-input" type="text"
             data-i18n="must_placeholder" data-i18n-attr="placeholder"
             placeholder="${escapeAttr(t('must_placeholder'))}"
             autocomplete="off" spellcheck="false" />
      <div class="suggestions-row">
        <span class="suggestions-label" data-i18n="related_terms">${t('related_terms')}</span>
        <div class="suggestions-chips"></div>
        <button class="btn-ghost btn-xs edit-dict-btn" type="button" data-i18n="edit_related_terms">${t('edit_related_terms')}</button>
      </div>

      <label class="field-label" data-i18n="any_label">${t('any_label')}</label>
      <input class="field-input any-input" type="text"
             data-i18n="any_placeholder" data-i18n-attr="placeholder"
             placeholder="${escapeAttr(t('any_placeholder'))}"
             autocomplete="off" spellcheck="false" />

      <label class="field-label" data-i18n="not_label">${t('not_label')}</label>
      <input class="field-input not-input" type="text"
             data-i18n="not_placeholder" data-i18n-attr="placeholder"
             placeholder="${escapeAttr(t('not_placeholder'))}"
             autocomplete="off" spellcheck="false" />
    </div>
    <div class="condition-footer">
      <label class="checkbox-label">
        <input class="condition-enabled" type="checkbox" checked />
        <span data-i18n="condition_enable">${t('condition_enable')}</span>
      </label>
    </div>
  `;

  // Populate if data provided
  if (data) {
    row.querySelector('.must-input').value = data.must || '';
    row.querySelector('.any-input').value  = data.any  || '';
    row.querySelector('.not-input').value  = data.not  || '';
    if (data.enabled === false) row.querySelector('.condition-enabled').checked = false;
  }

  // Wire events
  row.querySelector('.condition-delete').addEventListener('click', () => {
    row.remove();
    if (callbacks.onRemove) callbacks.onRemove(row);
  });

  row.querySelector('.condition-duplicate').addEventListener('click', () => {
    if (callbacks.onDuplicate) callbacks.onDuplicate(row);
  });

  row.querySelector('.must-input').addEventListener('input', () => {
    if (callbacks.onMustChange) callbacks.onMustChange(row);
  });

  row.querySelector('.edit-dict-btn').addEventListener('click', () => {
    if (callbacks.onEditDict) callbacks.onEditDict();
  });

  return row;
}

/** Update suggestion chips in a condition row based on must-input value */
function updateSuggestionChips(row, dict) {
  const mustInput = row.querySelector('.must-input');
  const chipsContainer = row.querySelector('.suggestions-chips');
  if (!mustInput || !chipsContainer) return;

  const keywords = mustInput.value.trim().split(/\s+/).filter(Boolean);
  const suggestions = new Set();

  for (const kw of keywords) {
    const related = dict[kw] || dict[kw.toLowerCase()] || [];
    related.forEach(s => suggestions.add(s));
  }

  chipsContainer.innerHTML = '';
  if (suggestions.size === 0) {
    chipsContainer.innerHTML = `<span class="no-suggestions" data-i18n="no_related_terms">${t('no_related_terms')}</span>`;
    return;
  }

  for (const term of suggestions) {
    const chip = document.createElement('button');
    chip.className = 'suggestion-chip';
    chip.type = 'button';
    chip.textContent = `+${term}`;
    chip.title = term;
    chip.addEventListener('click', () => {
      const anyInput = row.querySelector('.any-input');
      const existing = anyInput.value.trim();
      anyInput.value = existing ? `${existing}|${term}` : term;
      chip.classList.add('chip-added');
      chip.disabled = true;
    });
    chipsContainer.appendChild(chip);
  }
}

// ──────────────────────────────────────────────────────────
// Progress display
// ──────────────────────────────────────────────────────────

/** Format elapsed seconds as hh:mm:ss or mm:ss */
function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateProgressUI(progress) {
  const pct = progress.total > 0
    ? Math.min(Math.round((progress.done / progress.total) * 100), 99)
    : 0;

  setTextContent('progress-pct', `${pct}%`);
  setProgressBar('progress-bar', pct);

  setTextContent('stat-quota',
    `${(progress.quotaUsed || 0).toLocaleString()} / 10,000`);

  setTextContent('stat-videos-ja',
    String(progress.videosJa || 0));
  setTextContent('stat-videos-en',
    String(progress.videosEn || 0));
  setTextContent('stat-comments-ja',
    String(progress.commentsJa || 0));
  setTextContent('stat-comments-en',
    String(progress.commentsEn || 0));
  setTextContent('stat-comments-unknown',
    String(progress.commentsUnknown || 0));

  const elapsed = progress.startTime
    ? Math.round((Date.now() - progress.startTime) / 1000)
    : 0;
  setTextContent('stat-elapsed', formatDuration(elapsed));

  // Estimated remaining
  if (progress.done > 0 && progress.total > 0) {
    const rate = progress.done / elapsed;
    const remaining = rate > 0 ? Math.round((progress.total - progress.done) / rate) : 0;
    setTextContent('stat-remaining', formatDuration(remaining));
  } else {
    setTextContent('stat-remaining', '--:--');
  }

  if (progress.currentTask) {
    setTextContent('stat-current', progress.currentTask);
  }
}

function setProgressBar(id, pct) {
  const bar = document.getElementById(id);
  if (bar) bar.style.width = `${pct}%`;
}

function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ──────────────────────────────────────────────────────────
// Log display
// ──────────────────────────────────────────────────────────

const MAX_LOG_DISPLAY = 500;

function appendLogEntry(entry) {
  const ts = new Date(entry.ts || Date.now()).toISOString().substring(11, 19);
  const html = `<span class="log-ts">${ts}</span><span class="log-msg">${escapeHtml(entry.msg)}</span>`;

  // Write to all log containers (progress section + download section)
  for (const containerId of ['log-entries', 'log-entries-dl']) {
    const container = document.getElementById(containerId);
    if (!container) continue;
    while (container.children.length >= MAX_LOG_DISPLAY) {
      container.removeChild(container.firstChild);
    }
    const div = document.createElement('div');
    div.className = `log-entry log-${entry.level || 'info'}`;
    div.innerHTML = html;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clearLog() {
  for (const id of ['log-entries', 'log-entries-dl']) {
    const container = document.getElementById(id);
    if (container) container.innerHTML = '';
  }
}

// ──────────────────────────────────────────────────────────
// Error display in forms
// ──────────────────────────────────────────────────────────

function showFieldError(containerId, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.textContent = message;
  container.removeAttribute('hidden');
}

function clearFieldError(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.textContent = '';
    container.setAttribute('hidden', '');
  }
}

// ──────────────────────────────────────────────────────────
// Related terms dictionary editor
// ──────────────────────────────────────────────────────────

function openDictEditor(dict, defaultDict, onSave) {
  const modal = document.getElementById('dict-editor-modal');
  if (!modal) return;

  const textarea = modal.querySelector('#dict-editor-textarea');
  if (!textarea) return;

  // Convert dict to editable text format: "key: val1, val2"
  const lines = Object.entries(dict).map(([k, v]) => `${k}: ${v.join(', ')}`);
  textarea.value = lines.join('\n');

  showModal('dict-editor-modal');

  // Wire save
  const saveBtn = modal.querySelector('#dict-save-btn');
  if (saveBtn) {
    const newHandler = () => {
      const parsed = parseDictText(textarea.value);
      onSave(parsed);
      hideModal('dict-editor-modal');
    };
    saveBtn.replaceWith(saveBtn.cloneNode(true)); // Remove old listeners
    modal.querySelector('#dict-save-btn').addEventListener('click', newHandler, { once: true });
  }

  // Wire reset
  const resetBtn = modal.querySelector('#dict-reset-btn');
  if (resetBtn) {
    resetBtn.onclick = () => {
      const lines = Object.entries(defaultDict).map(([k, v]) => `${k}: ${v.join(', ')}`);
      textarea.value = lines.join('\n');
    };
  }

  // Wire cancel
  const cancelBtn = modal.querySelector('#dict-cancel-btn');
  if (cancelBtn) {
    cancelBtn.onclick = () => hideModal('dict-editor-modal');
  }
}

function parseDictText(text) {
  const dict = {};
  for (const line of text.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx < 1) continue;
    const key  = line.substring(0, colonIdx).trim();
    const vals = line.substring(colonIdx + 1).split(',').map(s => s.trim()).filter(Boolean);
    if (key && vals.length) dict[key] = vals;
  }
  return dict;
}

// ──────────────────────────────────────────────────────────
// Quota estimate display
// ──────────────────────────────────────────────────────────

function updateQuotaEstimate(estimate) {
  const el = document.getElementById('quota-estimate-value');
  if (el) el.textContent = (estimate || 0).toLocaleString();

  const bar = document.getElementById('quota-estimate-bar');
  if (bar) {
    const pct = Math.min((estimate / 10000) * 100, 100);
    bar.style.width = `${pct}%`;
    bar.className = 'quota-bar-fill' + (pct > 80 ? ' quota-bar-danger' : pct > 50 ? ' quota-bar-warn' : '');
  }
}

export {
  showModal, hideModal, showSection,
  initTheme, applyTheme, toggleTheme,
  createSearchConditionRow, updateSuggestionChips,
  updateProgressUI, formatDuration,
  appendLogEntry, clearLog,
  showFieldError, clearFieldError,
  openDictEditor, parseDictText,
  updateQuotaEstimate,
};
