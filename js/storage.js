// storage.js – IndexedDB persistence for collection resume and consent management

const DB_NAME    = 'yt-harvester';
const DB_VERSION = 1;
const STORE_NAME = 'collection_state';
const STATE_KEY  = 'current';

let db = null;

/** Open (or create) the IndexedDB database */
async function openDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/** Serialize state for storage (convert Map/Set to arrays) */
function serializeState(state) {
  return {
    searchConditions: state.searchConditions,
    settings: state.settings,
    results: {
      videos: state.results.videos,
      comments: state.results.comments,
      videoCache:   Array.from(state.results.videoCache.entries()),
      commentCache: Array.from(state.results.commentCache),
      channelCache: Array.from((state.results.channelCache || new Map()).entries()),
      // channelMap stores raw API items – serialize similarly
      channelMap:   Array.from((state.results.channelMap || new Map()).entries()),
    },
    progress: {
      ...state.progress,
      logs: (state.progress.logs || []).slice(-500), // cap log size
    },
    savedAt: Date.now(),
  };
}

/** Deserialize state from storage (restore Map/Set) */
function deserializeState(raw) {
  return {
    searchConditions: raw.searchConditions || [],
    settings: raw.settings || {},
    results: {
      videos:       raw.results?.videos   || { ja: [], en: [] },
      comments:     raw.results?.comments || { ja: [], en: [] },
      videoCache:   new Map(raw.results?.videoCache   || []),
      commentCache: new Set(raw.results?.commentCache || []),
      channelCache: new Map(raw.results?.channelCache || []),
      channelMap:   new Map(raw.results?.channelMap   || []),
    },
    progress: raw.progress || {},
    savedAt: raw.savedAt,
  };
}

/**
 * Save collection state to IndexedDB.
 * Only called when the user has given consent.
 */
async function saveState(state) {
  try {
    const database = await openDB();
    const serialized = serializeState(state);
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(serialized, STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    // Non-fatal – log but don't crash the collection
    console.warn('Failed to save state to IndexedDB:', err);
  }
}

/**
 * Load saved collection state from IndexedDB.
 * Returns null if no saved state exists.
 */
async function loadState() {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = (e) => {
        const raw = e.target.result;
        resolve(raw ? deserializeState(raw) : null);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch {
    return null;
  }
}

/** Delete saved collection state from IndexedDB */
async function clearState() {
  try {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  } catch {
    // Ignore
  }
}

/** Check whether a saved state exists */
async function hasSavedState() {
  try {
    const state = await loadState();
    return state !== null;
  } catch {
    return false;
  }
}

/** Initialize storage module (just opens the DB to ensure it's ready) */
async function initStorage() {
  try {
    await openDB();
  } catch (err) {
    console.warn('IndexedDB unavailable:', err);
  }
}

// ──────────────────────────────────────────────────────────
// Consent management (stored in localStorage, not IndexedDB)
// ──────────────────────────────────────────────────────────

function hasConsent() {
  return localStorage.getItem('idb_consent') === 'true';
}

function setConsent(agreed) {
  if (agreed) {
    localStorage.setItem('idb_consent', 'true');
  } else {
    localStorage.removeItem('idb_consent');
  }
}

export { initStorage, saveState, loadState, clearState, hasSavedState, hasConsent, setConsent };
