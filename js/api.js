// api.js – YouTube Data API v3 wrapper with retry, quota tracking, and parallel execution

const API_BASE = 'https://www.googleapis.com/youtube/v3';

// Quota cost per API call (official YouTube Data API v3 quota table)
const QUOTA_COSTS = {
  search:          100,
  videos:            1,
  commentThreads:    1,
  comments:          1,
  channels:          1,
};

const MAX_PARALLEL = 5;
const MAX_RETRIES  = 5;

// Adaptive throttle – if 429 occurs, reduce parallelism temporarily
let currentParallel = MAX_PARALLEL;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class Semaphore {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.queue = [];
  }
  acquire() {
    return new Promise(resolve => {
      if (this.active < this.limit) {
        this.active++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }
  release() {
    this.active--;
    if (this.queue.length > 0) {
      this.active++;
      this.queue.shift()();
    }
  }
}

class YouTubeAPI {
  /**
   * @param {string} apiKey
   * @param {(quota: number) => void} onQuotaUpdate – callback on each API call
   */
  constructor(apiKey, onQuotaUpdate = null) {
    this.apiKey = apiKey;
    this.quotaUsed = 0;
    this.onQuotaUpdate = onQuotaUpdate;
    this.semaphore = new Semaphore(currentParallel);
    this._consecutiveTooMany = 0;
  }

  /** Make a single API request with retry logic */
  async _request(endpoint, params, signal = null) {
    const url = new URL(`${API_BASE}/${endpoint}`);
    url.searchParams.set('key', this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }

    let delay = 1000;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      await this.semaphore.acquire();
      let res;
      try {
        res = await fetch(url.toString(), { signal });
      } catch (fetchErr) {
        this.semaphore.release();
        if (fetchErr.name === 'AbortError') throw fetchErr;
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          delay = Math.min(delay * 2, 16000);
          continue;
        }
        const err = new Error('Network error: ' + fetchErr.message);
        err.code = 'networkError';
        throw err;
      }
      this.semaphore.release();

      if (res.ok) {
        const cost = QUOTA_COSTS[endpoint] ?? 1;
        this.quotaUsed += cost;
        if (this.onQuotaUpdate) this.onQuotaUpdate(this.quotaUsed);
        this._consecutiveTooMany = 0;
        return await res.json();
      }

      // Parse error body
      let errData = {};
      try { errData = await res.json(); } catch {}
      const apiErr = errData.error?.errors?.[0];
      const reason = apiErr?.reason || '';
      const message = errData.error?.message || `HTTP ${res.status}`;

      const err = new Error(message);
      err.status  = res.status;
      err.code    = reason || String(res.status);
      err.details = errData;

      // Non-retryable errors
      if (res.status === 400) throw err; // Bad Request
      if (res.status === 401) throw err; // Unauthorized
      if (res.status === 403) {
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
          err.code = 'quotaExceeded';
          throw err;
        }
        if (reason === 'commentsDisabled' || reason === 'videoNotFound') {
          err.code = reason;
          throw err;
        }
        // Other 403 (referrer restriction, etc.)
        throw err;
      }
      if (res.status === 404) throw err;

      // Retryable: 429, 500, 503
      if (res.status === 429) {
        this._consecutiveTooMany++;
        if (this._consecutiveTooMany >= 3) {
          // Reduce parallelism adaptively
          currentParallel = Math.max(1, currentParallel - 1);
          this.semaphore.limit = currentParallel;
          this._consecutiveTooMany = 0;
        }
      }

      if (attempt < MAX_RETRIES) {
        await sleep(delay);
        delay = Math.min(delay * 2, 16000);
        continue;
      }

      throw err;
    }
  }

  /** Test if the API key is valid with a minimal call */
  async testKey(signal = null) {
    return this._request('videos', {
      part: 'id',
      id: 'dQw4w9WgXcQ',
      maxResults: 1,
    }, signal);
  }

  /**
   * Search for videos matching a query, paginating up to maxResults total.
   * Each page costs 100 quota units.
   * Returns array of video IDs.
   */
  async searchVideos(query, options = {}, signal = null, onPage = null) {
    const {
      lang,
      publishedAfter,
      publishedBefore,
      maxResults = 500,
    } = options;

    const ids = [];
    let pageToken = null;
    let page = 0;

    do {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const params = {
        part: 'id',
        q: query,
        type: 'video',
        order: 'date',
        maxResults: 50,
        relevanceLanguage: lang || undefined,
        publishedAfter,
        publishedBefore,
        pageToken: pageToken || undefined,
      };

      const data = await this._request('search', params, signal);
      page++;

      const pageIds = (data.items || []).map(item => item.id.videoId).filter(Boolean);
      ids.push(...pageIds);

      if (onPage) onPage({ page, found: ids.length });

      pageToken = data.nextPageToken;

      // YouTube API caps effective results at ~500
      if (ids.length >= maxResults) break;

    } while (pageToken);

    return [...new Set(ids)];
  }

  /**
   * Fetch video metadata for up to 50 IDs per call.
   * Returns array of raw video items from the API.
   */
  async getVideoDetails(videoIds, signal = null) {
    const results = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const batch = videoIds.slice(i, i + 50);
      const data = await this._request('videos', {
        part: 'snippet,statistics,contentDetails',
        id: batch.join(','),
        maxResults: 50,
      }, signal);
      results.push(...(data.items || []));
    }
    return results;
  }

  /**
   * Fetch all top-level comment threads for a video.
   * If a thread has more replies than are returned (>5), fetches the rest.
   * Returns array of { thread, replies[] } objects.
   */
  async getComments(videoId, options = {}, signal = null, onProgress = null) {
    const { maxComments = null } = options;

    const threads = [];
    let pageToken = null;

    do {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const data = await this._request('commentThreads', {
        part: 'snippet,replies',
        videoId,
        order: 'time',
        maxResults: 100,
        pageToken: pageToken || undefined,
      }, signal);

      threads.push(...(data.items || []));
      if (onProgress) onProgress(threads.length);

      pageToken = data.nextPageToken;

      if (maxComments && threads.length >= maxComments) break;

    } while (pageToken);

    // For threads that have more replies than returned, fetch them all
    const enriched = [];
    for (const thread of threads) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const topComment = thread.snippet?.topLevelComment;
      const totalReplies = thread.snippet?.totalReplyCount || 0;
      const returnedReplies = thread.replies?.comments?.length || 0;

      let allReplies = thread.replies?.comments || [];

      if (totalReplies > returnedReplies) {
        try {
          allReplies = await this._fetchAllReplies(topComment.id, signal);
        } catch (err) {
          // If fetching replies fails, keep what we have
          if (err.name === 'AbortError') throw err;
        }
      }

      enriched.push({ thread, replies: allReplies });
    }

    return enriched;
  }

  /** Fetch all replies to a top-level comment */
  async _fetchAllReplies(parentId, signal = null) {
    const results = [];
    let pageToken = null;

    do {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const data = await this._request('comments', {
        part: 'snippet',
        parentId,
        maxResults: 100,
        pageToken: pageToken || undefined,
      }, signal);

      results.push(...(data.items || []));
      pageToken = data.nextPageToken;

    } while (pageToken);

    return results;
  }

  /**
   * Fetch channel metadata for given channel IDs (batched by 50).
   * Returns map: channelId → channel item
   */
  async getChannels(channelIds, signal = null) {
    const unique = [...new Set(channelIds)].filter(Boolean);
    const map = new Map();

    for (let i = 0; i < unique.length; i += 50) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const batch = unique.slice(i, i + 50);
      const data = await this._request('channels', {
        part: 'snippet,statistics',
        id: batch.join(','),
        maxResults: 50,
      }, signal);
      for (const item of (data.items || [])) {
        map.set(item.id, item);
      }
    }

    return map;
  }
}

/**
 * Estimate quota cost for a collection run.
 * Used to display an estimate in the UI before starting.
 */
function estimateQuota({ numConditions, numPeriods, numLanguages, estimatedVideosPerSearch = 50, commentsPerVideo = 100 }) {
  const searchCalls  = numConditions * numPeriods * numLanguages; // may paginate
  const searchQuota  = searchCalls * 100 * Math.ceil(estimatedVideosPerSearch / 50);
  const totalVideos  = searchCalls * estimatedVideosPerSearch;
  const videoQuota   = Math.ceil(totalVideos / 50); // batches of 50
  const commentPages = Math.ceil(commentsPerVideo / 100);
  const commentQuota = totalVideos * commentPages;
  const channelQuota = Math.ceil(totalVideos / 50); // one batch per 50 unique channels
  return searchQuota + videoQuota + commentQuota + channelQuota;
}

export { YouTubeAPI, estimateQuota, sleep };
