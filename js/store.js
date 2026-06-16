/**
 * store.js — Centralized State Manager
 */
const Store = (() => {
  let state = {
    channels: [],
    groups: [],
    currentGroup: '__all__',
    currentList: null,
    groupCountsCache: null
  };

  return {
    get: (key) => state[key],
    set: (key, val) => { state[key] = val; },
    getAll: () => state
  };
})();
