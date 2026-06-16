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

  let listeners = {};

  return {
    get: (key) => state[key],
    set: (key, val) => { 
      state[key] = val; 
      if (listeners[key]) {
        listeners[key].forEach(cb => { try { cb(val); } catch(e) { console.error(e); } });
      }
    },
    subscribe: (key, cb) => {
      if (!listeners[key]) listeners[key] = [];
      listeners[key].push(cb);
      return () => {
        listeners[key] = listeners[key].filter(item => item !== cb);
      };
    },
    getAll: () => state
  };
})();
