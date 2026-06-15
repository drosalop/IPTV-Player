/**
 * favorites.js — Favorite channels management
 */
const Favorites = (() => {
  let _favIds = new Set();

  function init() {
    _favIds = new Set(Storage.getFavs());
  }

  function toggle(channelId) {
    if (_favIds.has(channelId)) {
      _favIds.delete(channelId);
      _save();
      return false; // removed
    } else {
      _favIds.add(channelId);
      _save();
      return true;  // added
    }
  }

  function isFav(channelId) { return _favIds.has(channelId); }

  function getIds() { return Array.from(_favIds); }

  function _save() { Storage.saveFavs(Array.from(_favIds)); }

  return { init, toggle, isFav, getIds };
})();
