// buildManifest.js – Generate collection_manifest.json for research reproducibility

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build collection_manifest.json.
 * Separate from the existing manifest.json – this follows the schema in §3.6
 * and is intended for citation in research papers.
 *
 * @param {object} state          – APP state object
 * @param {object} khcoderCounts  – { commentsAfterFilter: number, videosAfterFilter: number }
 * @returns {Promise<string>}     – JSON string
 */
async function buildCollectionManifest(state, khcoderCounts) {
  const now       = new Date().toISOString();
  const startedAt = state.progress.startTime
    ? new Date(state.progress.startTime).toISOString()
    : now;
  const durationSec = state.progress.startTime
    ? Math.round((Date.now() - new Date(state.progress.startTime).getTime()) / 1000)
    : 0;

  const settings = state.settings || {};
  const langs    = settings.languages || ['ja'];
  const targetLanguage =
    langs.includes('ja') && langs.includes('en') ? 'both'
    : langs.includes('en') ? 'en'
    : 'ja';

  const jaVideos   = state.results.videos.ja   || [];
  const enVideos   = state.results.videos.en   || [];
  const jaComments = state.results.comments.ja || [];
  const enComments = state.results.comments.en || [];

  const commentsPerVideo = (settings.commentsPerVideo === null ||
                            settings.commentsPerVideo === 'unlimited')
    ? 'unlimited'
    : Number(settings.commentsPerVideo);

  const searchConditions = settings;
  const conditionsHash   = await sha256hex(JSON.stringify(searchConditions));

  const manifest = {
    schema_version: '1.0',
    tool_version:   '0.1.0',
    generated_at:   now,
    collection: {
      started_at:        startedAt,
      finished_at:       now,
      duration_seconds:  durationSec,
      api_quota_consumed: state.progress.quotaUsed || 0,
    },
    search_conditions: searchConditions,
    filters: {
      target_language:    targetLanguage,
      comments_per_video: commentsPerVideo,
      period: {
        start: settings.dateStart || '',
        end:   settings.dateEnd   || '',
        ...(settings.splitPeriod ? { split_unit: settings.splitUnit } : {}),
      },
    },
    raw_counts: {
      videos_collected:   jaVideos.length + enVideos.length,
      comments_collected: jaComments.length + enComments.length,
    },
    khcoder_export: {
      comments_after_filter: khcoderCounts.commentsAfterFilter,
      videos_after_filter:   khcoderCounts.videosAfterFilter,
      preprocessing: {
        language_filter:       { field: 'comment_language_detected', threshold: 0.8 },
        min_text_length:        3,
        url_removal:            true,
        mention_removal:        true,
        newline_normalization:  true,
      },
    },
    conditions_hash: conditionsHash,
  };

  return JSON.stringify(manifest, null, 2);
}

export { buildCollectionManifest };
