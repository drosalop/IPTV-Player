/**
 * m3u-worker.js — Web Worker for M3U8 parsing (off main thread)
 * Handles playlists with thousands of channels without blocking UI
 */
self.onmessage = function(e) {
  const { text } = e.data;
  const channels = [];
  const lines = text.split('\n');
  const total = lines.length;
  let meta = {};
  let processed = 0;

  for (let i = 0; i < total; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      meta = parseExtInf(line);
    } else if (!line.startsWith('#') && meta.name) {
      channels.push({ ...meta, url: line, id: channels.length });
      meta = {};
    }

    // Report progress every 2000 lines
    processed++;
    if (processed % 2000 === 0) {
      self.postMessage({ type: 'progress', pct: Math.round((processed / total) * 100) });
    }
  }

  self.postMessage({ type: 'done', channels });
};

function parseExtInf(line) {
  const meta = {};
  const attrReg = /(\S+)="([^"]*)"/g;
  let m;
  while ((m = attrReg.exec(line)) !== null) {
    const key = m[1].toLowerCase().replace('tvg-', '');
    meta[key] = m[2];
  }
  const comma = line.lastIndexOf(',');
  if (comma !== -1) meta.name = line.slice(comma + 1).trim();
  meta.group = meta['group-title'] || 'Sin categoría';
  meta.epgId = meta.id || meta.name;
  return meta;
}
