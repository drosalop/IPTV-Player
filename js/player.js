/**
 * player.js — AVPlay wrapper optimized for RAW/HD/UHD/4K/8K
 * Samsung Tizen 9 / S91F OLED
 */
const Player = (() => {
  let _current      = null;
  let _overlayTimer = null;
  let _clockTimer   = null;
  let _onChannelChange = null;
  let _state        = 'IDLE'; // IDLE | BUFFERING | PLAYING | ERROR

  const OVERLAY_TIMEOUT = 5000;

  // ── AVPlay stream properties tuned per quality ────────
  function _getStreamProperties(url) {
    // Detect quality from name or URL
    const name = (_current?.name || '').toUpperCase();
    const is8K  = name.includes('8K');
    const is4K  = name.includes('4K') || name.includes('UHD') || name.includes('2160');
    const isHD  = name.includes('FHD') || name.includes('HD') || name.includes('1080');

    // Initial/max buffer in ms — give more buffer for higher quality
    const bufferMs = is8K ? 8000 : is4K ? 6000 : isHD ? 4000 : 3000;

    return JSON.stringify({
      // Initial bitrate to attempt (0 = auto)
      'adaptiveInfo': JSON.stringify({
        'startBitrate': 'HIGHEST',
        'minBitrate': 0,
        'maxBitrate': is8K ? 80000000 : is4K ? 40000000 : isHD ? 20000000 : 10000000,
        'adaptiveResolution': is8K || is4K,
      }),
      'playerBufferingTime': bufferMs,
      'audioOnly': false,
      'seekable': false,
    });
  }

  function init(onChannelChangeCb) {
    _onChannelChange = onChannelChangeCb;
    _bindKeys();
    _startClock();
  }

  // ── PLAY ─────────────────────────────────────────────
  function play(channel, isPreview = false) {
    if (_current && _current.id === channel.id && (_state === 'PLAYING' || _state === 'BUFFERING')) {
      // Ya estamos reproduciendo (o cargando) este canal en preview, solo ampliamos la pantalla sin cortes
      if (!isPreview) {
        const videoLayer = document.getElementById('video-layer');
        if (videoLayer) {
          videoLayer.style.left = '0px';
          videoLayer.style.top = '0px';
          videoLayer.style.width = '1920px';
          videoLayer.style.height = '1080px';
        }
        webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
        _showOverlay(true);
        _scheduleHideOverlay();
        _updateOverlayInfo();
      }
      return;
    }

    _current = channel;
    _setState('BUFFERING');

    if (!isPreview) {
      _showOverlay(true);
      _scheduleHideOverlay();
      _updateOverlayInfo();
    }

    // Pequeño retardo para asegurar que el DOM ya es visible
    setTimeout(() => {
      _safeStop();

      try {
        let playUrl = channel.url;
        if (playUrl.includes('|')) {
          playUrl = playUrl.split('|')[0];
        }

        webapis.avplay.open(playUrl);

        const videoLayer = document.getElementById('video-layer');

        if (isPreview) {
          const box = document.getElementById('preview-box');
          if (box) {
            const r = box.getBoundingClientRect();
            const left = Math.round(r.left);
            const top = Math.round(r.top);
            const w = Math.round(r.width);
            const h = Math.round(r.height);
            
            if (videoLayer) {
              videoLayer.style.left = left + 'px';
              videoLayer.style.top = top + 'px';
              videoLayer.style.width = w + 'px';
              videoLayer.style.height = h + 'px';
            }
            webapis.avplay.setDisplayRect(left, top, w, h);
          }
        } else {
          if (videoLayer) {
            videoLayer.style.left = '0px';
            videoLayer.style.top = '0px';
            videoLayer.style.width = '1920px';
            videoLayer.style.height = '1080px';
          }
          webapis.avplay.setDisplayRect(0, 0, 1920, 1080);
        }
        
        try {
          webapis.avplay.setStreamingProperty("ADAPTIVE_INFO", "STARTBITRATE=HIGHEST");
        } catch(e) {}

        webapis.avplay.setListener({
          onbufferingstart:    () => _onBufferingStart(),
          onbufferingcomplete: () => _onBufferingComplete(),
          oncurrentplaytime:   (t) => _onPlayTime(t),
          onevent:             (type, data) => _onEvent(type, data),
          onerror:             (err) => _onError(err),
          ondrmevent:          () => {},
          onstreamcompleted:   () => {
            // Auto-reconectar si el stream se corta (típico en IPTV)
            setTimeout(() => { if (_current) play(_current); }, 1000);
          }
        });

        // Async prepare for non-blocking UI
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

  function _safeStop() {
    try {
      const s = webapis.avplay.getState();
      if (s !== 'NONE' && s !== 'IDLE') webapis.avplay.stop();
      if (s !== 'NONE') webapis.avplay.close();
    } catch(e) {}
  }

  // ── EVENTS ───────────────────────────────────────────
  function _onBufferingStart()    { _setState('BUFFERING'); }
  function _onBufferingComplete() { _setState('PLAYING'); }
  function _onPlayTime(ms)        { _updateProgress(); }

  function _onEvent(type, data) {
    // EOS on live streams shouldn't happen — reconnect
    if (type === 'PLAYER_MSG_END_OF_STREAM') {
      setTimeout(() => { if (_current) play(_current); }, 1000);
    }
  }

  function _onError(err) {
    console.error('AVPlay error', err);
    _setState('ERROR');
    App.showToast('⚠ Error de reproducción. Reintentando…', 'error');
    // Auto-retry once
    setTimeout(() => { if (_current) play(_current); }, 3000);
  }

  function _setState(s) {
    _state = s;
    const spinner = document.getElementById('buffer-spinner');
    if (spinner) spinner.classList.toggle('hidden', s !== 'BUFFERING');
  }

  // ── OVERLAY ──────────────────────────────────────────
  function _showOverlay(show) {
    document.getElementById('player-overlay')?.classList.toggle('hidden', !show);
  }

  function _scheduleHideOverlay() {
    clearTimeout(_overlayTimer);
    _overlayTimer = setTimeout(() => _showOverlay(false), OVERLAY_TIMEOUT);
  }

  function toggleOverlay() {
    const el = document.getElementById('player-overlay');
    if (!el) return;
    const hidden = el.classList.toggle('hidden');
    if (!hidden) _scheduleHideOverlay();
  }

  function _updateOverlayInfo() {
    if (!_current) return;
    const safe = s => s ? String(s) : '';
    _setText('overlay-ch-name', safe(_current.name));
    _setText('overlay-ch-num',  '#' + ((_current.id || 0) + 1));

    const logoEl = document.getElementById('overlay-logo');
    if (logoEl) logoEl.src = _current.logo || '';

    const now  = EPG.getNow(_current.epgId);
    const next = EPG.getNext(_current.epgId);
    _setText('prog-now-title',  now  ? now.title  : 'Sin datos EPG');
    _setText('prog-now-time',   now  ? _fmtRange(now.start, now.end) : '');
    _setText('prog-next-title', next ? next.title : '—');
    _setText('prog-next-time',  next ? _fmtRange(next.start, next.end) : '');
    _updateProgress();
  }

  function _updateProgress() {
    if (!_current) return;
    const now  = EPG.getNow(_current.epgId);
    const fill = document.getElementById('progress-fill');
    if (!fill || !now?.start || !now?.end) return;
    const pct = ((Date.now() - now.start.getTime()) / (now.end.getTime() - now.start.getTime())) * 100;
    fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
  }

  // ── CLOCK ────────────────────────────────────────────
  function _startClock() {
    const update = () => _setText('overlay-time', new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    update();
    _clockTimer = setInterval(update, 15000);
  }

  // ── KEY BINDINGS ─────────────────────────────────────
  function _bindKeys() {
    KeyHandler.on('INFO', () => { if (_isActive()) { toggleOverlay(); return true; } });

    KeyHandler.on('CH_UP',   () => { if (_isActive()) { _onChannelChange?.('prev'); return true; } });
    KeyHandler.on('CH_DOWN', () => { if (_isActive()) { _onChannelChange?.('next'); return true; } });

    KeyHandler.on('UP', () => {
      if (_isActive()) { _showOverlay(true); _scheduleHideOverlay(); return true; }
    });
    KeyHandler.on('DOWN', () => {
      if (_isActive()) { _showOverlay(true); _scheduleHideOverlay(); return true; }
    });

    KeyHandler.on('BACK', () => {
      if (_isActive()) { 
        App.showView('channels'); 
        setPreviewMode();
        return true; 
      }
    });
    KeyHandler.on('GREEN', () => {
      if (_isActive()) { App.showView('epg'); return true; }
    });
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

  function setPreviewMode() {
    const box = document.getElementById('preview-box');
    const videoLayer = document.getElementById('video-layer');
    if (box && _current) {
      const r = box.getBoundingClientRect();
      const left = Math.round(r.left);
      const top = Math.round(r.top);
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      
      if (videoLayer) {
        videoLayer.style.left = left + 'px';
        videoLayer.style.top = top + 'px';
        videoLayer.style.width = w + 'px';
        videoLayer.style.height = h + 'px';
      }
      
      try {
        webapis.avplay.setDisplayRect(left, top, w, h);
      } catch(e) {}
    }
  }

  function stop() { _safeStop(); _current = null; }
  function getCurrent() { return _current; }
  function getState()   { return _state; }
  function _isActive()  {
    const v = document.getElementById('view-player');
    return v?.classList.contains('active');
  }

  function _setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _fmtRange(s, e) {
    if (!s || !e) return '';
    const f = d => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${f(s)} – ${f(e)}`;
  }

  return { init, play, stop, toggleOverlay, getCurrent, getState, setPreviewMode };
})();
