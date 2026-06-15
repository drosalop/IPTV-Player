/**
 * keyHandler.js — Remote control key management
 * Samsung Tizen 9 / S91F
 */
const KeyHandler = (() => {
  // Key codes
  const KEYS = {
    UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39,
    ENTER: 13, BACK: 10009, RETURN: 88,
    INFO: 457,
    RED: 403, GREEN: 405, YELLOW: 404, BLUE: 406,
    PLAY: 415, PAUSE: 19, PLAY_PAUSE: 10252, STOP: 413,
    REWIND: 412, FAST_FWD: 417,
    NUM_0: 48, NUM_9: 57,
    CH_UP: 427, CH_DOWN: 428,
  };

  let _listeners = {};
  let _initialized = false;

  function init() {
    if (_initialized) return;
    _initialized = true;

    // Register keys with Tizen
    if (window.tizen && tizen.tvinputdevice) {
      const toRegister = [
        'MediaPlay','MediaPause','MediaPlayPause','MediaStop',
        'MediaRewind','MediaFastForward',
        'ColorF0Red','ColorF1Green','ColorF2Yellow','ColorF3Blue',
        'Info','ChannelUp','ChannelDown',
        'Return','Exit'
      ];
      toRegister.forEach(k => {
        try { tizen.tvinputdevice.registerKey(k); } catch(e) {}
      });
    }

    document.addEventListener('keydown', _handleKey);
  }

  function _handleKey(e) {
    const code = e.keyCode;
    e.preventDefault();
    e.stopPropagation();

    // Dispatch to registered listeners (most recently added first)
    const handlers = _listeners[code] || [];
    for (let i = handlers.length - 1; i >= 0; i--) {
      const result = handlers[i](e);
      if (result === true) break; // consumed
    }
  }

  function on(keyName, handler) {
    const code = KEYS[keyName];
    if (!code) return;
    if (!_listeners[code]) _listeners[code] = [];
    _listeners[code].push(handler);
  }

  function off(keyName, handler) {
    const code = KEYS[keyName];
    if (!code || !_listeners[code]) return;
    _listeners[code] = _listeners[code].filter(h => h !== handler);
  }

  // Focus management helpers
  let _focusedEl = null;

  function setFocus(el) {
    if (!el) return;
    if (_focusedEl) _focusedEl.classList.remove('focused');
    _focusedEl = el;
    el.classList.add('focused');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function getFocused() { return _focusedEl; }

  // Navigate within a list of elements
  function navigate(elements, currentIndex, direction) {
    if (!elements || elements.length === 0) return currentIndex;
    let next = currentIndex;
    if (direction === 'up' || direction === 'left')  next = Math.max(0, currentIndex - 1);
    if (direction === 'down' || direction === 'right') next = Math.min(elements.length - 1, currentIndex + 1);
    return next;
  }

  return { init, on, off, setFocus, getFocused, navigate, KEYS };
})();
