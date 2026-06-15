/**
 * storage.js — localStorage abstraction
 */
const Storage = (() => {
  const PREFIX = 'iptv_';

  const get = (key, fallback = null) => {
    try {
      const v = localStorage.getItem(PREFIX + key);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  };

  const set = (key, val) => {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; }
    catch { return false; }
  };

  const del = (key) => localStorage.removeItem(PREFIX + key);

  const getLists    = ()      => get('lists', []);
  const saveLists   = (lists) => set('lists', lists);
  const getFavs     = ()      => get('favorites', []);
  const saveFavs    = (favs)  => set('favorites', favs);
  const getEpgCache = (url)   => get('epg_' + btoa(url).slice(0,20), null);
  const setEpgCache = (url, data) => set('epg_' + btoa(url).slice(0,20), { ts: Date.now(), data });
  const getLastList = ()      => get('last_list', null);
  const setLastList = (id)    => set('last_list', id);

  return { get, set, del, getLists, saveLists, getFavs, saveFavs, getEpgCache, setEpgCache, getLastList, setLastList };
})();
