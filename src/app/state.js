const listeners = new Set();
const ACTIVE_CHARACTER_STORAGE_KEY = 'dd_active_character';

const state = {
  user: null,
  profile: null,
  characters: [],
  activeCharacterId: null,
  offline: false,
  cache: {
    items: [],
    resources: [],
    journal: [],
    wallet: null,
    tags: []
  }
};

function getStorageKey(userId) {
  return userId ? `${ACTIVE_CHARACTER_STORAGE_KEY}:${userId}` : ACTIVE_CHARACTER_STORAGE_KEY;
}

export function normalizeCharacterId(id) {
  if (id === null || id === undefined || id === '') return null;
  return String(id);
}

export function getStoredActiveCharacterId(userId) {
  if (typeof localStorage === 'undefined') return null;
  return normalizeCharacterId(localStorage.getItem(getStorageKey(userId)));
}

export function setStoredActiveCharacterId(userId, id) {
  if (typeof localStorage === 'undefined') return;
  const key = getStorageKey(userId);
  const normalized = normalizeCharacterId(id);
  if (normalized) {
    localStorage.setItem(key, normalized);
  } else {
    localStorage.removeItem(key);
  }
}

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((cb) => cb(state));
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setActiveCharacter(id) {
  state.activeCharacterId = normalizeCharacterId(id);
  setStoredActiveCharacterId(state.user?.id, state.activeCharacterId);
  listeners.forEach((cb) => cb(state));
}

export function resetSessionState() {
  state.user = null;
  state.profile = null;
  state.characters = [];
  state.activeCharacterId = null;
  state.cache = {
    items: [],
    resources: [],
    journal: [],
    wallet: null,
    tags: []
  };
  listeners.forEach((cb) => cb(state));
}

export function updateCache(section, data) {
  state.cache[section] = data;
  listeners.forEach((cb) => cb(state));
}
