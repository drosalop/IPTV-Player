/**
 * epg.js — XMLTV EPG loader and renderer
 */
const EPG = (() => {
  let _programs = {};   // { channelId: [{start, end, title, desc, category}] }
  let _channels = {};   // { channelId: {name, logo} }
  let _offsetMs = 0;    // EPG view offset in ms

  const SLOT_W = 200;   // px per 30 min
  const ROW_H  = 72;

  // ── LOAD & PARSE XMLTV ──────────────────────────────
  async function load(url) {
    if (!url) return false;

    // Check cache (12h)
    const cached = Storage.getEpgCache(url);
    if (cached && Date.now() - cached.ts < 12 * 3600 * 1000) {
      _programs = cached.data.programs;
      _channels = cached.data.channels;
      return true;
    }

    try {
      const res  = await fetch(url);
      const text = await res.text();
      const xml  = new DOMParser().parseFromString(text, 'text/xml');
      _parseXMLTV(xml);
      Storage.setEpgCache(url, { programs: _programs, channels: _channels });
      return true;
    } catch (e) {
      console.error('EPG load error', e);
      return false;
    }
  }

  function _parseXMLTV(xml) {
    _programs = {};
    _channels = {};

    xml.querySelectorAll('channel').forEach(ch => {
      const id   = ch.getAttribute('id');
      const name = ch.querySelector('display-name')?.textContent || id;
      const logo = ch.querySelector('icon')?.getAttribute('src') || '';
      _channels[id] = { name, logo };
    });

    xml.querySelectorAll('programme').forEach(prog => {
      const chId = prog.getAttribute('channel');
      const start = _parseXMLTVDate(prog.getAttribute('start'));
      const end   = _parseXMLTVDate(prog.getAttribute('stop'));
      const title = prog.querySelector('title')?.textContent || '';
      const desc  = prog.querySelector('desc')?.textContent  || '';
      const cat   = prog.querySelector('category')?.textContent || '';
      if (!_programs[chId]) _programs[chId] = [];
      _programs[chId].push({ start, end, title, desc, cat });
    });
  }

  function _parseXMLTVDate(str) {
    // Format: YYYYMMDDHHmmss +0200
    if (!str) return null;
    const s = str.trim();
    const dt = new Date(
      `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}${s.slice(14).replace(' ','')}`
    );
    return isNaN(dt) ? null : dt;
  }

  // ── QUERY ────────────────────────────────────────────
  function getNow(epgId) {
    const now = Date.now();
    return ((_programs[epgId] || []).find(p => p.start && p.end &&
      p.start.getTime() <= now && p.end.getTime() >= now)) || null;
  }

  function getNext(epgId) {
    const now  = Date.now();
    const prog = (_programs[epgId] || []).filter(p => p.start && p.start.getTime() > now);
    return prog.length ? prog[0] : null;
  }

  function getForChannel(epgId, fromMs, toMs) {
    return (_programs[epgId] || []).filter(p =>
      p.start && p.end && p.end.getTime() > fromMs && p.start.getTime() < toMs
    );
  }

  // ── RENDER EPG GRID ──────────────────────────────────
  function render(channels, containerId, chColId, timelineId) {
    const grid    = document.getElementById(containerId);
    const chCol   = document.getElementById(chColId);
    const timeline = document.getElementById(timelineId);
    if (!grid || !chCol || !timeline) return;

    const viewStart = Date.now() + _offsetMs;
    const viewEnd   = viewStart + 3 * 3600 * 1000; // 3h window

    // Build timeline
    timeline.innerHTML = '';
    let t = viewStart - (viewStart % (30 * 60 * 1000)); // round to 30min
    while (t < viewEnd) {
      const slot = document.createElement('div');
      slot.className = 'epg-time-slot';
      slot.textContent = _fmt(new Date(t));
      timeline.appendChild(slot);
      t += 30 * 60 * 1000;
    }

    // Build channel col and grid rows
    chCol.innerHTML = '';
    grid.innerHTML  = '';

    channels.forEach(ch => {
      // Channel label
      const row = document.createElement('div');
      row.className = 'epg-channel-row';
      const logo = document.createElement('img');
      logo.className = 'epg-ch-logo';
      logo.src = ch.logo || '';
      logo.onerror = () => { logo.style.display = 'none'; };
      const name = document.createElement('span');
      name.className = 'epg-ch-name';
      name.textContent = ch.name;
      row.appendChild(logo);
      row.appendChild(name);
      chCol.appendChild(row);

      // Programs row
      const gridRow = document.createElement('div');
      gridRow.className = 'epg-row';
      const progs = getForChannel(ch.epgId, viewStart, viewEnd);

      if (progs.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'epg-prog';
        empty.style.width = (SLOT_W * 6) + 'px';
        empty.innerHTML = '<span class="epg-prog-title" style="color:var(--text-dim)">Sin datos EPG</span>';
        gridRow.appendChild(empty);
      } else {
        progs.forEach(p => {
          const ps = Math.max(p.start.getTime(), viewStart);
          const pe = Math.min(p.end.getTime(),   viewEnd);
          const w  = ((pe - ps) / (30 * 60 * 1000)) * SLOT_W;
          const isNow = p.start.getTime() <= Date.now() && p.end.getTime() >= Date.now();

          const el = document.createElement('div');
          el.className = 'epg-prog' + (isNow ? ' now-prog' : '');
          el.style.width = Math.max(w, 40) + 'px';
          el.dataset.title = p.title;
          el.dataset.desc  = p.desc;
          el.dataset.start = p.start.getTime();
          el.dataset.end   = p.end.getTime();
          el.innerHTML = `
            <span class="epg-prog-title">${p.title}</span>
            <span class="epg-prog-time">${_fmt(p.start)} – ${_fmt(p.end)}</span>
          `;
          el.addEventListener('click', () => _showDetail(p, ch));
          gridRow.appendChild(el);
        });
      }
      grid.appendChild(gridRow);
    });

    // Now-line
    const nowOffset = ((Date.now() - viewStart) / (30 * 60 * 1000)) * SLOT_W;
    if (nowOffset >= 0 && nowOffset < SLOT_W * 6) {
      const line = document.createElement('div');
      line.className = 'epg-now-line';
      line.style.left = nowOffset + 'px';
      grid.style.position = 'relative';
      grid.appendChild(line);
    }
  }

  function _showDetail(prog, ch) {
    const el = document.getElementById('epg-detail');
    if (!el) return;
    el.innerHTML = `
      <div class="epg-detail-title">${prog.title}</div>
      <div class="epg-detail-time">${_fmt(prog.start)} – ${_fmt(prog.end)} · ${ch.name}</div>
      <div class="epg-detail-desc">${prog.desc || 'Sin descripción disponible'}</div>
    `;
  }

  function shiftOffset(deltaMs) {
    _offsetMs += deltaMs;
  }
  function resetOffset() { _offsetMs = 0; }

  function _fmt(d) {
    if (!d) return '';
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  return { load, getNow, getNext, render, shiftOffset, resetOffset, getForChannel };
})();
