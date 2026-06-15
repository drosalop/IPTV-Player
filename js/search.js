/**
 * search.js — Fast debounced search using pre-built index
 */
const Search = (() => {
  let _allChannels = [];
  let _debounceTimer = null;
  let _isOpen = false;

  function init(channels) {
    _allChannels = channels;
  }

  function open() {
    if (_isOpen) return;
    _isOpen = true;
    const bar   = document.getElementById('search-bar');
    const input = document.getElementById('search-input');
    if (!bar || !input) return;
    input.value = '';
    bar.classList.remove('hidden');
    // Focus the input so TV keyboard appears (if available)
    setTimeout(() => input.focus(), 50);
    input.addEventListener('input', _onInput);
    KeyHandler.on('BACK', _onBack);
  }

  function close() {
    if (!_isOpen) return;
    _isOpen = false;
    const bar   = document.getElementById('search-bar');
    const input = document.getElementById('search-input');
    if (bar)   bar.classList.add('hidden');
    if (input) { input.removeEventListener('input', _onInput); input.value = ''; }
    KeyHandler.off('BACK', _onBack);
    // Restore full channel list
    App.renderChannels();
  }

  const _onInput = (e) => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      const q   = e.target.value.trim();
      const res = Playlist.search(_allChannels, q);
      const cnt = document.getElementById('search-count');
      if (cnt) cnt.textContent = q ? res.length + ' canales' : '';
      App.renderChannels(res.length || q ? res : _allChannels);
    }, 120); // 120ms debounce — fast but not every keystroke
  };

  const _onBack = () => {
    if (_isOpen) { close(); return true; }
  };

  function isOpen() { return _isOpen; }

  return { init, open, close, isOpen };
})();
