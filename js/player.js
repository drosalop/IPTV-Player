/**
 * player.js — AVPlay wrapper optimized for RAW/HD/UHD/4K/8K
 * Samsung Tizen 9 / S91F OLED
 *
 * Arquitectura:
 *  - view-player activa cuando se reproduce en pantalla completa
 *  - setPreviewMode() encoge el video al preview-box de la vista channels
 *  - Dimensiones y Hz se detectan automáticamente al arrancar
 */
const Player = (() => {
  let _current         = null;
  let _onChannelChange = null;
  let _state           = 'IDLE'; // IDLE | BUFFERING | PLAYING | ERROR

  let _initialized = false;
  // ── INIT ─────────────────────────────────────────────
  function init(onChannelChangeCb) {
    if (_initialized) return;
    _initialized = true;
    _onChannelChange = onChannelChangeCb;
    _bindKeys();
  }

  // ── PLAY ─────────────────────────────────────────────
  function play(ch) {
    if (!ch || !ch.url) return;
    _safeStop();
    _current = ch;
    _setState('BUFFERING');

    App.showView('player');
    showOSD();
    
    // Petición EPG instantánea específica para este canal
    _fetchShortEpg(ch);

    const vl = document.getElementById('video-layer');
    if (vl) {
      vl.style.width  = '100%';
      vl.style.height = '100%';
    }
    const errEl = document.getElementById('player-error');
    if (errEl) errEl.classList.add('hidden');

    // Retraso para que Tizen libere el pipeline anterior
    setTimeout(() => {
      try {
        let playUrl = _current.url;
        if (playUrl.includes('|')) playUrl = playUrl.split('|')[0];

        webapis.avplay.open(playUrl);

        // ── CONFIGURACIÓN CRÍTICA PARA PANTALLA COMPLETA ──
        const vl = document.getElementById('video-layer');
        if (vl) {
          vl.style.width = '1920px';
          vl.style.height = '1080px';
        }

        // PLAYER_DISPLAY_MODE_FULL_SCREEN ignora el aspect ratio y fuerza que llene el rectángulo
        try { webapis.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN'); } catch(e) {}
        
        // El rectángulo debe coincidir exactamente con la resolución CSS de la App (1920x1080)
        try { webapis.avplay.setDisplayRect(0, 0, 1920, 1080); } catch(e) {}

        try {
          const name = (channel.name || '').toUpperCase();
          const is8K = name.includes('8K');
          const is4K = name.includes('4K') || name.includes('UHD') || name.includes('2160');
          const isHD = name.includes('FHD') || name.includes('HD') || name.includes('1080');
          const maxBr = is8K ? 80000000 : is4K ? 40000000 : isHD ? 20000000 : 10000000;
          // Buffer adaptado: 2-3 segundos para evitar cortes
          const bufMs = is8K ? 5000 : is4K ? 4000 : isHD ? 3000 : 3000;

          webapis.avplay.setStreamingProperty('ADAPTIVE_INFO',
            `STARTBITRATE=HIGHEST|MAXBITRATE=${maxBr}|BUFFERLENGTH=${Math.round(bufMs / 1000)}`);
        } catch(e) {}

        webapis.avplay.setListener({
          onbufferingstart:    () => _onBufferingStart(),
          onbufferingcomplete: () => _onBufferingComplete(),
          oncurrentplaytime:   ()  => _updateProgress(),
          onevent:             (type) => {
            if (type === 'PLAYER_MSG_END_OF_STREAM')
              setTimeout(() => { if (_current) play(_current); }, 1000);
          },
          onerror:           (err) => _onError(err),
          ondrmevent:        () => {},
          onstreamcompleted: () => {
            setTimeout(() => { if (_current) play(_current); }, 1000);
          },
        });

        webapis.avplay.prepareAsync(
          () => {
            try { webapis.avplay.play(); } catch(e) { _onError(e); }
          },
          (err) => _onError(err)
        );

      } catch(e) {
        console.error('AVPlay open error', e);
        _onError('OPEN_FAILED');
      }
    }, 50);
  }

  // ── SAFE STOP ────────────────────────────────────────
  function _safeStop() {
    try {
      const vl = document.getElementById('video-layer');
      if (vl) {
        vl.style.width = '0px';
        vl.style.height = '0px';
      }
      const s = webapis.avplay.getState();
      if (s !== 'NONE' && s !== 'IDLE') webapis.avplay.stop();
      if (s !== 'NONE') webapis.avplay.close();
    } catch(e) {}
  }

  // ── EVENTS ───────────────────────────────────────────
  function _onBufferingStart()    { _setState('BUFFERING'); }
  function _onBufferingComplete() { _setState('PLAYING'); }

  function _onError(err) {
    console.error('AVPlay error', err);
    _handleError();
  }

  function _handleError() {
    _safeStop();
    const errEl = document.getElementById('player-error');
    if (errEl) errEl.classList.remove('hidden');
    setTimeout(() => { 
      if (errEl) errEl.classList.add('hidden');
      if (_isActive()) App.showView('channels');
    }, 4000);
  }

  function _setState(s) {
    _state = s;
    const spinner = document.getElementById('buffer-spinner');
    if (spinner) spinner.classList.toggle('hidden', s !== 'BUFFERING');
  }



  // ── KEY BINDINGS ─────────────────────────────────────
  function _bindKeys() {
    KeyHandler.on('CH_UP',   () => { if (_isActive()) { _onChannelChange?.('prev'); return true; } });
    KeyHandler.on('CH_DOWN', () => { if (_isActive()) { _onChannelChange?.('next'); return true; } });

    KeyHandler.on('ENTER', () => { 
      if (_isActive()) { showOSD(); return true; } 
    });

    KeyHandler.on('LEFT', () => {
      if (_isActive()) { _handleSeek(-10000); return true; }
    });

    KeyHandler.on('RIGHT', () => {
      if (_isActive()) { _handleSeek(10000); return true; }
    });

    KeyHandler.on('LONG_OK',()=> { 
      if (_isActive() && _current) { 
        Favorites.toggle(_current.id); 
        return true; 
      } 
    });

    KeyHandler.on('BACK', () => {
      if (_isActive()) {
        // Volver a la lista de canales y parar el video
        stop();
        App.showView('channels');
        return true;
      }
    });

    KeyHandler.on('GREEN', () => { if (_isActive()) { App.showView('epg'); return true; } });

    KeyHandler.on('PLAY_PAUSE', () => {
      if (_isActive()) {
        try {
          const s = webapis.avplay.getState();
          if (s === 'PLAYING') webapis.avplay.pause();
          else webapis.avplay.play();
        } catch(e) {}
        return true;
      }
    });
  }

  // ── SEEK LOGIC ───────────────────────────────────────
  let _seekTimer = null;
  let _seekAccum = 0; // in milliseconds

  function _handleSeek(deltaMs) {
    _seekAccum += deltaMs;
    showOSD();
    
    const badge = document.getElementById('osd-seek');
    if (badge) {
      badge.classList.remove('hidden');
      badge.textContent = _seekAccum > 0 ? `+${_seekAccum/1000}s ⏵⏵` : `⏴⏴ ${_seekAccum/1000}s`;
      // Restart animation
      badge.style.animation = 'none';
      badge.offsetHeight; 
      badge.style.animation = null;
    }

    clearTimeout(_seekTimer);
    _seekTimer = setTimeout(() => {
      const jump = _seekAccum;
      _seekAccum = 0;
      if (badge) badge.classList.add('hidden');
      
      try {
        if (jump > 0) webapis.avplay.jumpForward(jump);
        else if (jump < 0) webapis.avplay.jumpBackward(Math.abs(jump));
      } catch(e) {}
    }, 600); // Wait 600ms for consecutive presses
  }

  // ── OSD ──────────────────────────────────────────────
  let _osdTimer = null;
  let _osdPollInterval = null;

  function showOSD() {
    if (!_current) return;
    const osd = document.getElementById('player-osd');
    if (!osd) return;

    const logo = document.getElementById('osd-logo');
    if (logo) {
      if (_current.logo) { logo.src = _current.logo; logo.style.display = 'block'; }
      else { logo.style.display = 'none'; }
    }

    const num = document.getElementById('osd-num');
    if (num) {
      const idx = (typeof VirtualList !== 'undefined') ? VirtualList.getFocused() + 1 : _current.num;
      if (idx) { num.textContent = idx; num.style.display = 'inline-block'; }
      else { num.style.display = 'none'; }
    }

    const name = document.getElementById('osd-name');
    if (name) name.textContent = _current.name || '';

    _updateEpgOSD();

    osd.classList.remove('hidden');
    clearTimeout(_osdTimer);
    clearInterval(_osdPollInterval);

    // Poll EPG in case it is still loading in background
    _osdPollInterval = setInterval(_updateEpgOSD, 1000);

    _osdTimer = setTimeout(() => {
      osd.classList.add('hidden');
      clearInterval(_osdPollInterval);
    }, 3000);
  }

  function _updateEpgOSD() {
    if (!_current) return;
    const nowEl = document.getElementById('osd-now');
    const nextEl = document.getElementById('osd-next');
    
    let nowP = null;
    let nextP = null;

    // 1. Try global EPG if available
    if (typeof EPG !== 'undefined' && _current.epgId) {
      nowP = EPG.getNow(_current.epgId);
      if (!nextP) nextP = EPG.getNext(_current.epgId);
    }
    
    // 2. Try short EPG fallback
    if (!nowP && _current._shortEpgData) {
      nowP = _current._shortEpgData.nowP;
      nextP = _current._shortEpgData.nextP;
    }

    if (nowP) {
      if (nowEl) nowEl.textContent = `Ahora: ${nowP.title} (${_fmt(nowP.start)} - ${_fmt(nowP.end)})`;
      if (nextEl) nextEl.textContent = nextP ? `Después: ${nextP.title} (${_fmt(nextP.start)} - ${_fmt(nextP.end)})` : '';
    } else {
      if (nowEl) nowEl.textContent = 'Buscando programación...';
      if (nextEl) nextEl.textContent = '';
    }
  }

  async function _fetchShortEpg(ch) {
    if (!ch || !ch.shortEpgUrl) return;
    try {
      const res = await fetch(ch.shortEpgUrl);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.epg_listings && data.epg_listings.length > 0) {
        const now = Date.now();
        let nowP = null;
        let nextP = null;

        for (const item of data.epg_listings) {
          let startMs, endMs;
          if (item.start_timestamp && item.stop_timestamp) {
            startMs = parseInt(item.start_timestamp) * 1000;
            endMs = parseInt(item.stop_timestamp) * 1000;
          } else {
            startMs = new Date(item.start.replace(' ', 'T')).getTime();
            endMs = new Date(item.end.replace(' ', 'T')).getTime();
          }

          if (startMs <= now && endMs >= now) {
            nowP = { title: _b64DecodeUnicode(item.title), start: new Date(startMs), end: new Date(endMs) };
          } else if (startMs > now && !nextP) {
            nextP = { title: _b64DecodeUnicode(item.title), start: new Date(startMs), end: new Date(endMs) };
          }
        }
        
        if (nowP) {
          ch._shortEpgData = { nowP, nextP };
          // If this is still the current channel and OSD is visible, update
          if (_current && _current.id === ch.id) {
            const osd = document.getElementById('player-osd');
            if (osd && !osd.classList.contains('hidden')) {
              _updateEpgOSD();
            }
          }
        }
      }
    } catch (e) {}
  }

  function _b64DecodeUnicode(str) {
    try {
      return decodeURIComponent(atob(str).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
    } catch (e) { return atob(str); }
  }

  function _fmt(d) { return d?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) || ''; }

  // ── UTILS ────────────────────────────────────────────
  function stop()         { _safeStop(); _current = null; }
  function getCurrent()   { return _current; }
  function getState()     { return _state; }
  function _isActive()    { return document.getElementById('view-player')?.classList.contains('active'); }
  return { init, play, stop, getCurrent, getState };
})();
