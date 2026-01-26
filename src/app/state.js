const listeners = new Set();

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
  state.activeCharacterId = id;
  listeners.forEach((cb) => cb(state));
}

export function updateCache(section, data) {
  state.cache[section] = data;
  listeners.forEach((cb) => cb(state));
}
