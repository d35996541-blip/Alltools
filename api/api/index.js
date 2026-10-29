// Satu berkas server (gabungan index + _lib). Setelah diunggah, ganti namanya menjadi api/index.js
const __defs = {};
const __cache = {};
function __req(n){ if(!n.startsWith('.')) return require(n); n=n.split('/').pop().replace(/\.js$/,''); if(!__cache[n]){ const m={exports:{}}; __cache[n]=m; __defs[n](m,m.exports,__req);} return __cache[n].exports; }

__defs['util'] = function(module, exports, require){
// Pembantu bersama untuk semua fungsi server. Nama berawalan "_" tidak dijadikan endpoint oleh Vercel.
const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');
const { Readable } = require('stream');

const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/* ---------- SSRF: hanya alamat publik ---------- */
function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:'); }
  return true;
}
async function assertPublic(u) {
  const url = new URL(u);
  if (!/^https?:$/.test(url.protocol)) throw new Error('protokol tidak diizinkan');
  const host = url.hostname;
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('host tidak diizinkan');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some(a => privateIp(a.address))) throw new Error('host tidak diizinkan');
  return url;
}
async function safeFetch(u, opts = {}, hops = 4, timeout = 15000) {
  let cur = u;
  for (let i = 0; i <= hops; i++) {
    await assertPublic(cur);
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeout);
    let r;
    try { r = await fetch(cur, { ...opts, redirect: 'manual', signal: ctrl.signal }); } finally { clearTimeout(t); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { cur = new URL(r.headers.get('location'), cur).toString(); continue; }
    r.finalUrl = cur;
    return r;
  }
  throw new Error('terlalu banyak pengalihan');
}
// fetch biasa dengan batas waktu (untuk API pihak ketiga yang sudah pasti publik)
async function tfetch(url, opts = {}, timeout = 12000) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeout);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(t); }
}
async function getJSON(url, opts = {}, timeout = 12000) {
  const r = await tfetch(url, { ...opts, headers: { 'User-Agent': UA, Accept: 'application/json', ...(opts.headers || {}) } }, timeout);
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('bukan JSON (HTTP ' + r.status + ')'); }
  if (!r.ok && !(j && typeof j === 'object')) throw new Error('HTTP ' + r.status);
  return j;
}

/* ---------- respons ---------- */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges,Content-Disposition');
}
function json(res, status, obj, cache) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  return res.send(JSON.stringify(obj));
}
const q = (req, k, d = '') => String((req.query && req.query[k] !== undefined ? req.query[k] : d) ?? '');
function body(req) { const b = req.body; if (!b) return {}; if (typeof b === 'string') { try { return JSON.parse(b); } catch (e) { return {}; } } return b; }

/* ---------- penandatanganan tautan stream (supaya /api/stream bukan proxy terbuka) ---------- */
const SECRET = () => process.env.STREAM_SECRET || process.env.XCY_APIKEY || 'dimzz-prozet-ubah-STREAM_SECRET-di-vercel';
function sign(url, ttl = 3 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const sig = crypto.createHmac('sha256', SECRET()).update(url + '|' + exp).digest('base64url');
  return { u: Buffer.from(url).toString('base64url'), e: exp, s: sig };
}
function verify(u64, exp, sig) {
  try {
    const url = Buffer.from(String(u64), 'base64url').toString();
    if (!exp || Number(exp) < Date.now() / 1000) return null;
    const want = crypto.createHmac('sha256', SECRET()).update(url + '|' + exp).digest('base64url');
    const a = Buffer.from(want), b = Buffer.from(String(sig));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return url;
  } catch (e) { return null; }
}
function streamLink(url, extra = {}) {
  const s = sign(url);
  const qs = new URLSearchParams({ u: s.u, e: s.e, s: s.s, ...extra });
  return '/api/stream?' + qs.toString();
}

/* ---------- pencari URL media di JSON apa pun (skema API pihak ketiga berbeda-beda) ---------- */
const MEDIA_RE = /\.(mp4|m4a|mp3|webm|mkv|mov|jpg|jpeg|png|webp|gif|opus|ogg|wav)(\?|#|$)|googlevideo\.com|cdninstagram|fbcdn|tiktokcdn|tikwm\.com\/video|scontent|spotify|dl\.|download|cdn\./i;
function deepUrls(v, out = [], key = '', depth = 0) {
  if (depth > 6 || v === null || v === undefined) return out;
  if (typeof v === 'string') { if (/^https?:\/\//i.test(v.trim())) out.push({ url: v.trim(), key: key.toLowerCase() }); return out; }
  if (Array.isArray(v)) { v.slice(0, 60).forEach(x => deepUrls(x, out, key, depth + 1)); return out; }
  if (typeof v === 'object') Object.entries(v).forEach(([k, x]) => deepUrls(x, out, k, depth + 1));
  return out;
}
const pickStr = (o, keys) => { for (const k of keys) { const v = o && o[k]; if (typeof v === 'string' && v.trim()) return v.trim(); } return ''; };
function deepFind(o, keys, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 5) return '';
  for (const k of keys) { if (typeof o[k] === 'string' && o[k].trim()) return o[k].trim(); }
  for (const v of Object.values(o)) { const r = deepFind(v, keys, depth + 1); if (r) return r; }
  return '';
}
// cek cepat bahwa URL benar-benar berkas media (bukan halaman HTML / error)
async function probeMedia(url, wantTypes = /^(video|audio|image)\/|octet-stream|mpegurl/i) {
  try {
    const r = await safeFetch(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-1', Referer: '' } }, 4, 9000);
    if (r.status !== 200 && r.status !== 206) return null;
    const ct = r.headers.get('content-type') || '';
    try { r.body && r.body.cancel && r.body.cancel(); } catch (e) {}
    if (!wantTypes.test(ct)) return null;
    const cr = r.headers.get('content-range'), cl = r.headers.get('content-length');
    const size = cr ? Number(String(cr).split('/')[1]) : (r.status === 200 ? Number(cl) : 0);
    return { type: ct.split(';')[0], size: size || 0, url: r.finalUrl || url };
  } catch (e) { return null; }
}

/* ---------- rantai penyedia: coba satu per satu sampai ada yang berhasil ---------- */
async function chain(providers, ...args) {
  const errors = [];
  for (const p of providers) {
    const t0 = Date.now();
    try {
      const r = await p.run(...args);
      if (r) return { ok: true, provider: p.name, ms: Date.now() - t0, data: r, errors };
      errors.push(p.name + ': kosong');
    } catch (e) { errors.push(p.name + ': ' + String(e && e.message || e).slice(0, 80)); }
  }
  return { ok: false, errors };
}
// penyedia tambahan dari Environment Variable, mis. BYPASS_APIS = ["https://api.xx/bypass?url={url}"]
function envProviders(name) {
  try { const a = JSON.parse(process.env[name] || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; } catch (e) { return []; }
}
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(vars[k] ?? ''));

/* ---------- pembatas laju sederhana per IP (per instance) ---------- */
const hits = new Map();
function limited(req, max = 40, windowMs = 60000) {
  const ip = String((req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '')).split(',')[0].trim();
  const now = Date.now(); const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}

// alirkan respons upstream ke klien (mendukung Range)
async function pipeUpstream(up, res, headers = {}) {
  const pass = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified'];
  res.status(up.status === 200 || up.status === 206 ? up.status : 502);
  pass.forEach(h => { const v = up.headers.get(h); if (v) res.setHeader(h, v); });
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (!up.body) return res.end();
  await new Promise(resolve => {
    const rs = Readable.fromWeb(up.body);
    rs.on('error', resolve); res.on('close', () => { try { rs.destroy(); } catch (e) {} resolve(); });
    rs.on('end', resolve);
    rs.pipe(res);
  });
}

module.exports = { UA, UA_DESKTOP, privateIp, assertPublic, safeFetch, tfetch, getJSON, cors, json, q, body, sign, verify, streamLink, deepUrls, deepFind, pickStr, probeMedia, chain, envProviders, fill, limited, pipeUpstream, MEDIA_RE };

};

__defs['yt'] = function(module, exports, require){
// YouTube / YouTube Music: pencarian, pemutar audio, unduhan. Semua dijalankan di server (bebas CORS),
// dengan banyak lapis cadangan: InnerTube -> penyedia pihak ketiga (diverifikasi) -> Piped/Invidious.
const U = require('./util');

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const YTM_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30';
const COOKIE = 'CONSENT=YES+cb; SOCS=CAI';

const CLIENTS = {
  WEB: { ctx: { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'id', gl: 'ID' }, ua: U.UA_DESKTOP },
  WEB_REMIX: { ctx: { clientName: 'WEB_REMIX', clientVersion: '1.20250101.01.00', hl: 'id', gl: 'ID' }, ua: U.UA_DESKTOP },
  ANDROID_VR: { ctx: { clientName: 'ANDROID_VR', clientVersion: '1.60.19', deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12L', androidSdkVersion: 32, hl: 'id', gl: 'ID' }, ua: 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip', id: 28 },
  IOS: { ctx: { clientName: 'IOS', clientVersion: '19.45.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.1.0.22B83', hl: 'id', gl: 'ID' }, ua: 'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)', id: 5 },
  ANDROID: { ctx: { clientName: 'ANDROID', clientVersion: '19.44.38', androidSdkVersion: 30, osName: 'Android', osVersion: '11', hl: 'id', gl: 'ID' }, ua: 'com.google.android.youtube/19.44.38 (Linux; U; Android 11) gzip', id: 3 },
  TV_EMBED: { ctx: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', hl: 'id', gl: 'ID' }, ua: 'Mozilla/5.0 (PlayStation; PlayStation 4/12.00) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15', embed: true, id: 85 }
};

async function innertube(client, endpoint, payload, host = 'www.youtube.com', key = INNERTUBE_KEY) {
  const c = CLIENTS[client];
  const context = { client: { ...c.ctx } };
  if (c.embed) context.thirdParty = { embedUrl: 'https://www.google.com' };
  const r = await U.tfetch(`https://${host}/youtubei/v1/${endpoint}?key=${key}&prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': c.ua, 'Accept-Language': 'id,en;q=0.8', Origin: `https://${host}`, Cookie: COOKIE, 'X-Goog-Visitor-Id': '', ...(c.id ? { 'X-YouTube-Client-Name': String(c.id), 'X-YouTube-Client-Version': c.ctx.clientVersion } : {}) },
    body: JSON.stringify({ context, ...payload })
  }, 12000);
  if (!r.ok) throw new Error('InnerTube HTTP ' + r.status);
  return r.json();
}

/* ---------- penelusuran struktur JSON ---------- */
function walk(o, fn, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 40) return;
  if (Array.isArray(o)) { o.forEach(x => walk(x, fn, depth + 1)); return; }
  fn(o);
  Object.values(o).forEach(v => walk(v, fn, depth + 1));
}
const txt = t => !t ? '' : (t.simpleText || (t.runs ? t.runs.map(r => r.text).join('') : '') || '');
const durToSec = s => { const p = String(s || '').split(':').map(Number); if (p.some(isNaN) || !p.length) return 0; return p.reduce((a, n) => a * 60 + n, 0); };
const ytThumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const bigThumb = arr => { const a = (arr || []).filter(x => x && x.url); if (!a.length) return ''; return a[a.length - 1].url.replace(/=w\d+-h\d+.*$/, '=w544-h544-l90-rj'); };

/* ---------- YouTube biasa (video) ---------- */
function parseVideos(j, limit) {
  const out = [], seen = new Set();
  walk(j, o => {
    const v = o.videoRenderer;
    if (!v || !v.videoId || seen.has(v.videoId)) return;
    seen.add(v.videoId);
    const dur = txt(v.lengthText);
    if (!dur) return; // lewati live/premiere tanpa durasi
    out.push({ id: v.videoId, title: txt(v.title), author: txt(v.ownerText) || txt(v.longBylineText), duration: dur, seconds: durToSec(dur), views: txt(v.viewCountText), published: txt(v.publishedTimeText), thumb: ytThumb(v.videoId) });
  });
  return out.slice(0, limit);
}
async function searchVideos(query, limit = 20) {
  const r = await U.chain([
    { name: 'innertube-web', run: async () => { const l = parseVideos(await innertube('WEB', 'search', { query, params: 'EgIQAQ%3D%3D' }), limit); return l.length ? l : null; } },
    { name: 'html-scrape', run: async () => {
      const h = await (await U.tfetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`, { headers: { 'User-Agent': U.UA_DESKTOP, 'Accept-Language': 'id,en;q=0.8', Cookie: COOKIE } }, 12000)).text();
      const m = h.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/); if (!m) throw new Error('tanpa data');
      const l = parseVideos(JSON.parse(m[1]), limit); return l.length ? l : null; } },
    ...['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://api.piped.private.coffee'].map(h => ({ name: 'piped:' + h.slice(8, 24), run: async () => {
      const j = await U.getJSON(`${h}/search?q=${encodeURIComponent(query)}&filter=videos`, {}, 7000);
      const l = ((j && j.items) || []).filter(v => v.url && v.url.includes('v=')).map(v => { const id = v.url.split('v=')[1].split('&')[0]; return { id, title: v.title, author: v.uploaderName || '', duration: '', seconds: v.duration || 0, views: '', published: '', thumb: ytThumb(id) }; });
      return l.length ? l.slice(0, limit) : null; } })),
    ...['https://inv.nadeko.net', 'https://invidious.nerdvpn.de'].map(h => ({ name: 'invidious:' + h.slice(8, 24), run: async () => {
      const a = await U.getJSON(`${h}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {}, 7000);
      const l = (Array.isArray(a) ? a : []).filter(v => v.videoId).map(v => ({ id: v.videoId, title: v.title, author: v.author || '', duration: '', seconds: v.lengthSeconds || 0, views: '', published: '', thumb: ytThumb(v.videoId) }));
      return l.length ? l.slice(0, limit) : null; } }))
  ]);
  if (!r.ok) throw new Error('Pencarian YouTube gagal: ' + r.errors.join(' | '));
  return { items: r.data, provider: r.provider };
}

/* ---------- YouTube Music (lagu) ---------- */
function parseMusic(j, limit) {
  const out = [], seen = new Set();
  const take = r => {
    const cols = r.flexColumns || [];
    const title = txt(cols[0] && cols[0].musicResponsiveListItemFlexColumnRenderer && cols[0].musicResponsiveListItemFlexColumnRenderer.text);
    const runs = (cols[1] && cols[1].musicResponsiveListItemFlexColumnRenderer && cols[1].musicResponsiveListItemFlexColumnRenderer.text && cols[1].musicResponsiveListItemFlexColumnRenderer.text.runs) || [];
    let id = r.playlistItemData && r.playlistItemData.videoId;
    if (!id) walk(r.overlay, o => { if (!id && o.watchEndpoint && o.watchEndpoint.videoId) id = o.watchEndpoint.videoId; });
    if (!id || !title || seen.has(id)) return;
    seen.add(id);
    const parts = runs.map(x => x.text).filter(t => t && t.trim() !== '•');
    const dur = parts.find(p => /^\d{1,2}:\d{2}(:\d{2})?$/.test(p)) || '';
    const kind = /^(Lagu|Song|Video|Album|Playlist|Artis|Artist|Episode|Podcast)$/i.test(parts[0] || '') ? parts[0] : '';
    if (/^(Album|Playlist|Artis|Artist|Podcast|Episode)$/i.test(kind)) return;
    const rest = parts.filter(p => p !== kind && p !== dur);
    const thumbs = r.thumbnail && r.thumbnail.musicThumbnailRenderer && r.thumbnail.musicThumbnailRenderer.thumbnail && r.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails;
    out.push({ id, title, artist: rest[0] || '', album: rest[1] || '', duration: dur, seconds: durToSec(dur), kind: kind || 'Lagu', thumb: bigThumb(thumbs) || ytThumb(id) });
  };
  walk(j, o => { if (o.musicResponsiveListItemRenderer) take(o.musicResponsiveListItemRenderer); });
  return out.slice(0, limit);
}
async function searchMusic(query, limit = 25) {
  const r = await U.chain([
    { name: 'ytmusic', run: async () => { const l = parseMusic(await innertube('WEB_REMIX', 'search', { query }, 'music.youtube.com', YTM_KEY), limit); return l.length ? l : null; } },
    { name: 'ytmusic-lagu', run: async () => { const l = parseMusic(await innertube('WEB_REMIX', 'search', { query, params: 'EgWKAQIIAWoKEAMQBBAJEAoQBQ%3D%3D' }, 'music.youtube.com', YTM_KEY), limit); return l.length ? l : null; } },
    { name: 'youtube-video', run: async () => { const { items } = await searchVideos(query + ' official audio', limit); return items.map(v => ({ id: v.id, title: v.title, artist: v.author, album: '', duration: v.duration, seconds: v.seconds, kind: 'Video', thumb: v.thumb })); } }
  ]);
  if (!r.ok) throw new Error('Pencarian musik gagal: ' + r.errors.join(' | '));
  return { items: r.data, provider: r.provider };
}

/* ---------- ambil stream dari InnerTube ---------- */
function pickFormats(j) {
  const sd = j && j.streamingData; if (!sd) return null;
  const all = [...(sd.formats || []), ...(sd.adaptiveFormats || [])].filter(f => f.url);
  if (!all.length) return null;
  const audio = all.filter(f => /^audio\//.test(f.mimeType || '')).sort((a, b) => ((/mp4/.test(b.mimeType) ? 1 : 0) - (/mp4/.test(a.mimeType) ? 1 : 0)) || (b.bitrate - a.bitrate));
  const prog = all.filter(f => /^video\//.test(f.mimeType || '') && f.audioQuality).sort((a, b) => (b.height || 0) - (a.height || 0));
  const vo = all.filter(f => /^video\/mp4/.test(f.mimeType || '') && !f.audioQuality).sort((a, b) => (b.height || 0) - (a.height || 0));
  return { audio, prog, vo, details: j.videoDetails || {} };
}
async function playerStreams(id) {
  const errs = [];
  for (const c of ['ANDROID_VR', 'IOS', 'TV_EMBED', 'ANDROID']) {
    try {
      const j = await innertube(c, 'player', { videoId: id, contentCheckOk: true, racyCheckOk: true, playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } } });
      const st = j.playabilityStatus && j.playabilityStatus.status;
      if (st && st !== 'OK') { errs.push(c + ':' + st); continue; }
      const f = pickFormats(j);
      if (f && (f.audio.length || f.prog.length)) return { ...f, client: c };
      errs.push(c + ':tanpa-url');
    } catch (e) { errs.push(c + ':' + e.message); }
  }
  throw new Error(errs.join(' | '));
}

/* ---------- penyedia pihak ketiga (pengonversi). Skema tiap API berbeda -> pakai pencari URL umum + verifikasi ---------- */
const TP = {
  audio: [
    'https://api.ryzumi.vip/api/downloader/ytmp3?url={url}',
    'https://api.siputzx.my.id/api/d/ytmp3?url={url}',
    'https://api.vreden.my.id/api/ytmp3?url={url}',
    'https://api.nekolabs.web.id/downloader/youtube/v1?url={url}&format=mp3',
    'https://api.agatz.xyz/api/ytmp3?url={url}'
  ],
  video: [
    'https://api.ryzumi.vip/api/downloader/ytmp4?url={url}&quality=720',
    'https://api.siputzx.my.id/api/d/ytmp4?url={url}',
    'https://api.vreden.my.id/api/ytmp4?url={url}',
    'https://api.nekolabs.web.id/downloader/youtube/v1?url={url}&format=720',
    'https://api.agatz.xyz/api/ytmp4?url={url}'
  ]
};
async function thirdParty(kind, id) {
  const yurl = 'https://www.youtube.com/watch?v=' + id;
  const tpls = [...U.envProviders(kind === 'audio' ? 'YT_AUDIO_APIS' : 'YT_VIDEO_APIS'), ...TP[kind]];
  const attempts = tpls.map(t => async () => {
    const j = await U.getJSON(U.fill(t, { url: yurl, id }), {}, 14000);
    const cands = U.deepUrls(j).filter(c => !/thumb|cover|poster|image|\.jpe?g|\.png|\.webp|avatar/i.test(c.key + c.url)).sort((a, b) => (/download|url|link|mp3|mp4|audio|video/.test(b.key) ? 1 : 0) - (/download|url|link|mp3|mp4|audio|video/.test(a.key) ? 1 : 0));
    for (const c of cands.slice(0, 5)) {
      const p = await U.probeMedia(c.url, kind === 'audio' ? /^audio\/|octet-stream|mpeg|video\/mp4|video\/webm/i : /^video\/|octet-stream/i);
      if (p) return { url: p.url, type: p.type, size: p.size, title: U.deepFind(j, ['title', 'judul']), via: t.split('/')[2] };
    }
    return null;
  });
  // jalankan paralel, ambil yang pertama berhasil
  return new Promise((resolve, reject) => {
    let left = attempts.length; const errs = [];
    attempts.forEach(a => a().then(r => { if (r) resolve(r); else if (!--left) reject(new Error('semua penyedia gagal')); }).catch(e => { errs.push(e.message); if (!--left) reject(new Error('semua penyedia gagal: ' + errs[0])); }));
  });
}

/* ---------- audio untuk pemutar musik ---------- */
async function audioFor(id) {
  if (!/^[\w-]{11}$/.test(id)) throw new Error('id video tidak valid');
  const r = await U.chain([
    // Cobalt milik sendiri (opsional): isi COBALT_URL (+ COBALT_KEY bila perlu) di Environment Variables Vercel
    ...(process.env.COBALT_URL ? [{ name: 'cobalt', run: async () => {
      const base = String(process.env.COBALT_URL).replace(/\/+$/, '');
      const headers = { 'Content-Type': 'application/json' }; if (process.env.COBALT_KEY) headers.Authorization = 'Api-Key ' + process.env.COBALT_KEY;
      const j = await U.getJSON(base + '/', { method: 'POST', headers, body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=' + id, downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' }) }, 25000);
      if (!j || !/^(tunnel|redirect|stream)$/.test(j.status) || !j.url) throw new Error('cobalt ' + ((j && j.error && (j.error.code || j.error)) || (j && j.status) || 'gagal'));
      return { url: j.url, mime: 'audio/mpeg', seconds: 0, title: j.filename || '', via: 'cobalt' };
    } }] : []),
    { name: 'innertube', run: async () => {
      const f = await playerStreams(id);
      const a = f.audio[0] || f.prog[0];
      if (!a) return null;
      return { url: U.streamLink(a.url), mime: (a.mimeType || 'audio/mp4').split(';')[0], seconds: Number(f.details.lengthSeconds) || 0, title: f.details.title || '', via: 'innertube/' + f.client };
    } },
    { name: 'pengonversi', run: async () => {
      const t = await thirdParty('audio', id);
      return { url: U.streamLink(t.url), mime: t.type || 'audio/mpeg', seconds: 0, title: t.title || '', via: t.via };
    } },
    ...['https://pipedapi.kavin.rocks', 'https://pipedapi.adminforge.de', 'https://api.piped.private.coffee'].map(h => ({ name: 'piped', run: async () => {
      const j = await U.getJSON(`${h}/streams/${id}`, {}, 8000);
      const a = (j.audioStreams || []).filter(x => x.url).sort((x, y) => (y.bitrate || 0) - (x.bitrate || 0))[0];
      if (!a) return null;
      return { url: U.streamLink(a.url), mime: a.mimeType || 'audio/mp4', seconds: j.duration || 0, title: j.title || '', via: 'piped' };
    } }))
  ]);
  if (!r.ok) throw new Error('Audio tidak bisa diambil: ' + r.errors.join(' | '));
  return { ...r.data, provider: r.provider };
}

/* ---------- daftar unduhan video / audio ---------- */
async function downloadsFor(id) {
  if (!/^[\w-]{11}$/.test(id)) throw new Error('id video tidak valid');
  const out = { id, title: '', author: '', thumb: ytThumb(id), duration: 0, formats: [] };
  let meta = null;
  try { meta = await U.getJSON(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`, {}, 6000); } catch (e) {}
  if (meta) { out.title = meta.title; out.author = meta.author_name; }
  const jobs = [
    playerStreams(id).then(f => {
      out.title = out.title || f.details.title; out.author = out.author || f.details.author; out.duration = Number(f.details.lengthSeconds) || 0;
      f.prog.slice(0, 2).forEach(p => out.formats.push({ kind: 'video', label: (p.qualityLabel || (p.height + 'p')), ext: 'mp4', size: Number(p.contentLength) || 0, url: U.streamLink(p.url, { dl: 1 }), src: 'langsung' }));
      const a = f.audio.find(x => /mp4/.test(x.mimeType)) || f.audio[0];
      if (a) out.formats.push({ kind: 'audio', label: 'M4A ' + Math.round((a.bitrate || 0) / 1000) + 'kbps', ext: /mp4/.test(a.mimeType) ? 'm4a' : 'webm', size: Number(a.contentLength) || 0, url: U.streamLink(a.url, { dl: 1 }), src: 'langsung' });
    }).catch(() => {}),
    thirdParty('video', id).then(t => { out.title = out.title || t.title; out.formats.push({ kind: 'video', label: 'MP4 HD', ext: 'mp4', size: t.size, url: U.streamLink(t.url, { dl: 1 }), src: t.via }); }).catch(() => {}),
    thirdParty('audio', id).then(t => { out.formats.push({ kind: 'audio', label: 'MP3', ext: 'mp3', size: t.size, url: U.streamLink(t.url, { dl: 1 }), src: t.via }); }).catch(() => {})
  ];
  await Promise.all(jobs);
  if (!out.formats.length) throw new Error('Tidak ada tautan unduhan yang berhasil diverifikasi. Coba lagi beberapa saat atau video dibatasi.');
  out.formats.sort((a, b) => (a.kind === b.kind ? (b.size - a.size) : (a.kind === 'video' ? -1 : 1)));
  return out;
}

module.exports = { searchVideos, searchMusic, audioFor, downloadsFor, playerStreams, innertube, parseMusic, parseVideos, thirdParty, TP };

};

__defs['social'] = function(module, exports, require){
// TikTok / Instagram / Spotify / game / bypass — semua lewat rantai penyedia + verifikasi hasil.
const U = require('./util');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ================= TikTok: profil ================= */
async function ttProfile(user) {
  const r = await U.chain([
    { name: 'tikwm', run: async () => {
      for (let i = 0; i < 2; i++) {
        const j = await U.getJSON(`https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(user)}`, {}, 10000);
        if (j.code === 0 && j.data && j.data.user) return { user: j.data.user, stats: j.data.stats || {} };
        if (/limit/i.test(String(j.msg))) { await sleep(1200); continue; }
        if (/not exist|not found|invalid|tidak/i.test(String(j.msg))) { const e = new Error('notfound'); e.notfound = true; throw e; }
        break;
      }
      return null; } },
    { name: 'halaman-tiktok', run: async () => {
      const r = await U.safeFetch(`https://www.tiktok.com/@${encodeURIComponent(user)}`, { headers: { 'User-Agent': U.UA_DESKTOP, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html,application/xhtml+xml' } }, 4, 12000);
      const h = await r.text();
      const m = h.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/); if (!m) return null;
      const det = JSON.parse(m[1]).__DEFAULT_SCOPE__ && JSON.parse(m[1]).__DEFAULT_SCOPE__['webapp.user-detail'];
      if (det && det.statusCode === 10221) { const e = new Error('notfound'); e.notfound = true; throw e; }
      if (det && det.statusCode === 10202) { const e = new Error('notfound'); e.notfound = true; throw e; }
      if (det && det.userInfo && det.userInfo.user) return { user: det.userInfo.user, stats: det.userInfo.stats || det.userInfo.statsV2 || {} };
      return null; } },
    ...['https://api.siputzx.my.id/api/stalk/tiktok?username={u}', 'https://api.ryzumi.vip/api/stalk/tiktok?username={u}', 'https://api.vreden.my.id/api/tiktokStalk?query={u}'].map(t => ({ name: 'api:' + t.split('/')[2], run: async () => {
      const j = await U.getJSON(U.fill(t, { u: user }), {}, 10000);
      const d = j.data || j.result || j; const us = d.user || d;
      const st = d.stats || d.statsV2 || us.stats || {};
      if (!(us.uniqueId || us.unique_id || us.username)) return null;
      return { user: { id: us.id || us.uid, uniqueId: us.uniqueId || us.unique_id || us.username, nickname: us.nickname || us.name, signature: us.signature || us.bio || '', verified: us.verified, avatarLarger: us.avatarLarger || us.avatar || us.profilePic }, stats: { followerCount: st.followerCount ?? st.followers, followingCount: st.followingCount ?? st.following, heartCount: st.heartCount ?? st.likes ?? st.heart, videoCount: st.videoCount ?? st.videos } };
    } })),
    { name: 'oembed', run: async () => {
      const j = await U.getJSON(`https://www.tiktok.com/oembed?url=${encodeURIComponent('https://www.tiktok.com/@' + user)}`, {}, 8000);
      if (!j || !j.author_name) return null;
      return { user: { uniqueId: user, nickname: j.author_name, avatarLarger: j.thumbnail_url || '' }, stats: {}, partial: true }; } }
  ]);
  if (r.ok) return { ...r.data, provider: r.provider };
  const nf = r.errors.some(e => /notfound/.test(e));
  const err = new Error(nf ? 'notfound' : 'gagal'); err.status = nf ? 404 : 502; err.detail = r.errors; throw err;
}

/* ================= TikTok: unduh ================= */
async function ttDownload(url) {
  const r = await U.chain([
    { name: 'tikwm', run: async () => {
      const j = await U.getJSON(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {}, 15000);
      if (j.code !== 0 || !j.data) { if (/limit/i.test(String(j.msg))) { await sleep(1200); const j2 = await U.getJSON(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`, {}, 15000); if (j2.code === 0 && j2.data) return normTikwm(j2.data); } return null; }
      return normTikwm(j.data); } },
    ...['https://api.siputzx.my.id/api/d/tiktok?url={url}', 'https://api.ryzumi.vip/api/downloader/ttdl?url={url}', 'https://api.vreden.my.id/api/tiktok?url={url}'].map(t => ({ name: 'api:' + t.split('/')[2], run: async () => {
      const j = await U.getJSON(U.fill(t, { url }), {}, 12000);
      const c = U.deepUrls(j).filter(x => !/cover|thumb|avatar|image|\.jpe?g|\.webp|\.png/i.test(x.key + x.url));
      const files = []; for (const x of c.slice(0, 6)) { const p = await U.probeMedia(x.url); if (p) files.push({ label: /mp3|music|audio/i.test(x.key + p.type) ? 'MP3' : (/hd/i.test(x.key) ? 'Video HD' : 'Video'), kind: /audio/.test(p.type) ? 'audio' : 'video', url: p.url, ext: /audio/.test(p.type) ? 'mp3' : 'mp4' }); }
      if (!files.length) return null;
      return { title: U.deepFind(j, ['title', 'desc', 'caption']), author: U.deepFind(j, ['unique_id', 'username', 'author']), cover: (U.deepUrls(j).find(x => /cover|thumb/i.test(x.key)) || {}).url || '', files }; } }))
  ]);
  if (!r.ok) throw new Error('Gagal mengambil video TikTok: ' + r.errors.join(' | '));
  r.data.files = r.data.files.map(f => ({ ...f, url: U.streamLink(f.url, { dl: 1 }) }));
  return { ...r.data, provider: r.provider };
}
function normTikwm(d) {
  const abs = u => !u ? '' : (u.startsWith('/') ? 'https://www.tikwm.com' + u : u);
  const files = [];
  if (Array.isArray(d.images) && d.images.length) d.images.forEach((u, i) => files.push({ label: 'Foto ' + (i + 1), kind: 'image', url: abs(u), ext: 'jpg' }));
  if (d.hdplay) files.push({ label: 'Video HD', kind: 'video', url: abs(d.hdplay), ext: 'mp4' });
  if (d.play) files.push({ label: 'Video tanpa watermark', kind: 'video', url: abs(d.play), ext: 'mp4' });
  if (d.wmplay) files.push({ label: 'Video dengan watermark', kind: 'video', url: abs(d.wmplay), ext: 'mp4' });
  if (d.music) files.push({ label: 'MP3', kind: 'audio', url: abs(d.music), ext: 'mp3' });
  return { title: d.title || '', author: (d.author && d.author.unique_id) || '', cover: abs(d.cover), files };
}

/* ================= Instagram: profil ================= */
function igOg(html, user) {
  const og = n => { const m = html.match(new RegExp(`<meta[^>]+property=["']${n}["'][^>]+content=["']([^"']*)["']`, 'i')) || html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${n}["']`, 'i')); return m ? m[1].replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))) : ''; };
  const desc = og('og:description'), title = og('og:title');
  const m = desc.match(/([\d.,KMkm]+)\s*(?:Followers|Pengikut)[^\d]+([\d.,KMkm]+)\s*(?:Following|Mengikuti)[^\d]+([\d.,KMkm]+)\s*(?:Posts|Postingan)/i);
  if (!m && !title) return null;
  const num = s => { s = String(s).trim(); const k = /k$/i.test(s) ? 1e3 : /m$/i.test(s) ? 1e6 : 1; const n = parseFloat(s.replace(/[KkMm]/, '').replace(/\./g, k > 1 ? '.' : '').replace(/,/g, k > 1 ? '.' : '')); return Math.round(n * k); };
  const nm = title.match(/^(.*?)\s*\(@/);
  const bio = (desc.split(/ - /).slice(1).join(' - ') || '').replace(/^See Instagram photos and videos from .*$/i, '');
  return { username: user, fullName: nm ? nm[1] : '', biography: bio, followersCount: m ? num(m[1]) : null, followsCount: m ? num(m[2]) : null, postsCount: m ? num(m[3]) : null, profilePicUrl: og('og:image'), partial: true };
}
async function igProfile(user) {
  const token = process.env.APIFY_TOKEN;
  const r = await U.chain([
    ...(token ? [{ name: 'apify', run: async () => {
      const x = await U.tfetch(`https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [user] }) }, 55000);
      if (x.status === 401 || x.status === 403) { const e = new Error('token'); e.token = true; throw e; }
      if (!x.ok) return null;
      const a = await x.json(); const p = Array.isArray(a) ? a[0] : null;
      if (p && p.username) return p;
      if (p && (p.error || p.errorDescription)) { const e = new Error('notfound'); e.notfound = true; throw e; }
      return null; } }] : []),
    { name: 'web-profile', run: async () => {
      const r = await U.safeFetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(user)}`, { headers: { 'User-Agent': 'Instagram 219.0.0.12.117 Android', 'x-ig-app-id': '936619743392459', Accept: 'application/json' } }, 3, 9000);
      if (r.status === 404) { const e = new Error('notfound'); e.notfound = true; throw e; }
      if (!r.ok) return null; const j = await r.json(); return j && j.data && j.data.user ? j.data.user : null; } },
    { name: 'og-meta', run: async () => {
      const r = await U.safeFetch(`https://www.instagram.com/${encodeURIComponent(user)}/`, { headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Accept-Language': 'en-US,en;q=0.9' } }, 3, 10000);
      if (r.status === 404) { const e = new Error('notfound'); e.notfound = true; throw e; }
      return igOg(await r.text(), user); } },
    ...['https://api.siputzx.my.id/api/stalk/instagram?username={u}', 'https://api.ryzumi.vip/api/stalk/instagram?username={u}', 'https://api.vreden.my.id/api/igstalk?query={u}'].map(t => ({ name: 'api:' + t.split('/')[2], run: async () => {
      const j = await U.getJSON(U.fill(t, { u: user }), {}, 10000); const d = j.data || j.result || j;
      if (!(d && (d.username || d.user_name))) return null;
      return { username: d.username || d.user_name, fullName: d.full_name || d.fullName || d.name, biography: d.biography || d.bio || '', followersCount: d.followers_count ?? d.followers ?? d.follower_count, followsCount: d.following_count ?? d.following, postsCount: d.posts_count ?? d.posts ?? d.media_count, profilePicUrl: d.profile_pic_url_hd || d.profile_pic_url || d.avatar || d.profilePic, verified: d.is_verified, private: d.is_private };
    } }))
  ]);
  if (r.ok) return { profile: r.data, provider: r.provider };
  const nf = r.errors.some(e => /notfound/.test(e)); const tk = r.errors.some(e => /token/.test(e));
  const err = new Error(nf ? 'notfound' : tk ? 'token' : 'gagal'); err.status = nf ? 404 : 502; err.detail = r.errors; throw err;
}

/* ================= Instagram / Facebook / Spotify unduh ================= */
async function genericDownload(kind, url) {
  const map = {
    ig: ['https://api.siputzx.my.id/api/d/igdl?url={url}', 'https://api.ryzumi.vip/api/downloader/igdl?url={url}', 'https://api.vreden.my.id/api/igdownload?url={url}', 'https://api.agatz.xyz/api/instagram?url={url}'],
    sp: ['https://api.siputzx.my.id/api/d/spotify?url={url}', 'https://api.ryzumi.vip/api/downloader/spotify?url={url}', 'https://api.vreden.my.id/api/spotify?url={url}', 'https://api.agatz.xyz/api/spotify?url={url}']
  }[kind];
  const env = U.envProviders(kind === 'ig' ? 'IG_DL_APIS' : 'SPOTIFY_DL_APIS');
  const r = await U.chain([...env, ...map].map(t => ({ name: 'api:' + t.split('/')[2], run: async () => {
    const j = await U.getJSON(U.fill(t, { url }), {}, 14000);
    const c = U.deepUrls(j).filter(x => !/avatar|profile|\.webp\?|thumb|cover|poster/i.test(x.key) || /\.mp4|\.mp3/.test(x.url));
    const files = []; const seen = new Set();
    for (const x of c.slice(0, 10)) {
      if (seen.has(x.url)) continue; seen.add(x.url);
      const p = await U.probeMedia(x.url); if (!p) continue;
      const k = /audio/.test(p.type) ? 'audio' : /video/.test(p.type) ? 'video' : /image/.test(p.type) ? 'image' : 'video';
      if (k === 'image' && kind === 'sp') continue;
      files.push({ label: k === 'audio' ? 'MP3' : k === 'video' ? 'Video' : 'Foto', kind: k, url: p.url, ext: k === 'audio' ? 'mp3' : k === 'video' ? 'mp4' : 'jpg', size: p.size });
      if (files.length >= 8) break;
    }
    if (!files.length) return null;
    const cover = (U.deepUrls(j).find(x => /thumb|cover|image|poster/i.test(x.key)) || {}).url || '';
    return { title: U.deepFind(j, ['title', 'name', 'judul', 'caption']), author: U.deepFind(j, ['artist', 'artists', 'author', 'username']), cover, files };
  } })));
  if (!r.ok) throw new Error('Semua penyedia gagal: ' + r.errors.join(' | '));
  r.data.files = r.data.files.map(f => ({ ...f, url: U.streamLink(f.url, { dl: 1 }) }));
  return { ...r.data, provider: r.provider };
}

/* ================= Cek nickname game ================= */
const nickKeys = ['nickname', 'nickName', 'username', 'userName', 'name', 'in-game-nickname', 'roleName', 'role_name', 'nick'];
function nickFrom(j) {
  const n = U.deepFind(j, nickKeys);
  if (!n) return '';
  try { return decodeURIComponent(n.replace(/\+/g, ' ')).trim(); } catch (e) { return n.trim(); }
}
async function gameNick(game, id, zone) {
  const tpls = game === 'ml' ? [
    'https://api.isan.eu.org/nickname/ml?id={id}&server={zone}',
    'https://api.siputzx.my.id/api/stalk/mlbb?userId={id}&zoneId={zone}',
    'https://api.ryzumi.vip/api/stalk/mlbb?id={id}&zone={zone}',
    'https://api.vreden.my.id/api/mlstalk?id={id}&zone={zone}'
  ] : [
    'https://api.isan.eu.org/nickname/ff?id={id}',
    'https://api.siputzx.my.id/api/stalk/ff?userId={id}',
    'https://api.ryzumi.vip/api/stalk/ff?id={id}',
    'https://api.vreden.my.id/api/ffstalk?id={id}'
  ];
  const r = await U.chain([...U.envProviders(game === 'ml' ? 'ML_APIS' : 'FF_APIS'), ...tpls].map(t => ({ name: t.split('/')[2], run: async () => {
    const j = await U.getJSON(U.fill(t, { id, zone }), {}, 12000);
    const n = nickFrom(j);
    if (n) return { nickname: n, extra: j.data && typeof j.data === 'object' ? j.data : {} };
    if (j && (j.success === false || /not\s*found|invalid|tidak/i.test(String(j.message || j.msg || '')))) { const e = new Error('notfound'); e.notfound = true; throw e; }
    return null; } })));
  if (r.ok) return { ...r.data, provider: r.provider };
  const nf = r.errors.filter(e => /notfound/.test(e)).length >= 1 && r.errors.filter(e => /notfound/.test(e)).length >= Math.ceil(r.errors.length / 3);
  const err = new Error(nf ? 'notfound' : 'gagal'); err.status = nf ? 404 : 502; err.detail = r.errors; throw err;
}

/* ================= Bypass tautan ================= */
const PLAIN_SHORT = /(^|\.)(bit\.ly|tinyurl\.com|t\.co|cutt\.ly|s\.id|rebrand\.ly|is\.gd|v\.gd|shorturl\.at|goo\.gl|ow\.ly|t\.ly|rb\.gy|buff\.ly|lnkd\.in|wa\.me|shope\.ee|s\.shopee\.co\.id|tokopedia\.link|link\.tree|fb\.me|youtu\.be|vt\.tiktok\.com|vm\.tiktok\.com)$/i;
async function expandRedirects(url) {
  const r = await U.safeFetch(url, { headers: { 'User-Agent': U.UA_DESKTOP } }, 8, 12000);
  try { r.body && r.body.cancel && r.body.cancel(); } catch (e) {}
  const final = r.finalUrl || url;
  return final !== url ? final : null;
}
async function bypass(url) {
  let host = ''; try { host = new URL(url).hostname; } catch (e) { throw new Error('URL tidak valid'); }
  const key = process.env.XCY_APIKEY;
  const tpls = [...U.envProviders('BYPASS_APIS'), 'https://api.siputzx.my.id/api/tools/bypass?url={url}', 'https://api.ryzumi.vip/api/tools/bypass?url={url}', 'https://api.vreden.my.id/api/bypass?url={url}'];
  const r = await U.chain([
    ...(PLAIN_SHORT.test(host) ? [{ name: 'perluas-tautan', run: async () => { const f = await expandRedirects(url); return f ? { result: f, note: 'Tautan pendek dibuka langsung oleh server.' } : null; } }] : []),
    ...(key ? [{ name: 'xcy-cpanel', run: async () => {
      const x = await U.tfetch('https://www.xcy-cpanel.my.id/api/respon/endpoint/tools/bypass', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-apikey': key, 'User-Agent': U.UA }, body: JSON.stringify({ url, typelink: 'auto' }) }, 30000);
      const j = await x.json().catch(() => null); if (!j) return null;
      const u = U.deepUrls(j).find(c => /^https?:/.test(c.url) && c.url !== url && !/xcy-cpanel/.test(c.url));
      const res = u ? u.url : U.deepFind(j, ['result', 'destination', 'bypassed']); return res ? { result: res } : null; } }] : []),
    ...tpls.map(t => ({ name: 'api:' + t.split('/')[2], run: async () => {
      const j = await U.getJSON(U.fill(t, { url }), {}, 25000);
      const u = U.deepUrls(j).find(c => c.url !== url && !/api\.(siputzx|ryzumi|vreden)/.test(c.url) && /result|url|link|destination|bypass|data|target/.test(c.key));
      const str = U.deepFind(j, ['result', 'destination', 'bypassed', 'bypassed_url', 'target']);
      const res = u ? u.url : (/^https?:/.test(str) ? str : ''); if (!res || res === url) return null;
      return { result: res }; } })),
    { name: 'perluas-tautan', run: async () => { const f = await expandRedirects(url); return f ? { result: f, note: 'Hanya pengalihan biasa yang bisa dibuka; situs iklan berat butuh API bypass.' } : null; } }
  ]);
  if (!r.ok) throw new Error('Belum ada penyedia yang berhasil. ' + r.errors.slice(0, 4).join(' | '));
  return { ...r.data, provider: r.provider };
}

module.exports = { ttProfile, ttDownload, igProfile, genericDownload, gameNick, bypass, igOg };

};

__defs['misc'] = function(module, exports, require){
// Berita real-time, foto (Pinterest/Bing), AI, pembaca artikel, MangaDex, stream/unduh.
const U = require('./util');

/* ================= BERITA (RSS dari banyak sumber, digabung & diurutkan menurut waktu) ================= */
const GN = (topic) => `https://news.google.com/rss/headlines/section/topic/${topic}?hl=id&gl=ID&ceid=ID:id`;
const FEEDS = {
  terbaru: ['https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id', 'https://www.antaranews.com/rss/terkini.xml', 'https://www.cnnindonesia.com/rss', 'https://rss.detik.com/index.php/detikcom', 'https://feeds.bbci.co.uk/indonesia/rss.xml'],
  nasional: [GN('NATION'), 'https://www.cnnindonesia.com/nasional/rss', 'https://www.antaranews.com/rss/politik.xml', 'https://www.antaranews.com/rss/hukum.xml'],
  dunia: [GN('WORLD'), 'https://www.cnnindonesia.com/internasional/rss', 'https://www.antaranews.com/rss/dunia.xml', 'https://feeds.bbci.co.uk/indonesia/dunia/rss.xml'],
  ekonomi: [GN('BUSINESS'), 'https://www.cnnindonesia.com/ekonomi/rss', 'https://www.antaranews.com/rss/ekonomi.xml'],
  olahraga: [GN('SPORTS'), 'https://www.cnnindonesia.com/olahraga/rss', 'https://www.antaranews.com/rss/olahraga.xml', 'https://www.antaranews.com/rss/bola.xml'],
  teknologi: [GN('TECHNOLOGY'), 'https://www.cnnindonesia.com/teknologi/rss', 'https://www.antaranews.com/rss/tekno.xml'],
  hiburan: [GN('ENTERTAINMENT'), 'https://www.cnnindonesia.com/hiburan/rss', 'https://www.antaranews.com/rss/hiburan.xml'],
  kesehatan: [GN('HEALTH'), 'https://www.cnnindonesia.com/gaya-hidup/rss', 'https://www.antaranews.com/rss/lifestyle.xml']
};
const unCdata = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const decodeEnt = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
const strip = s => decodeEnt(unCdata(s)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (x, n) => { const m = x.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i')); return m ? m[1] : ''; };
const attr = (x, n, a) => { const m = x.match(new RegExp(`<${n}\\s[^>]*${a}=["']([^"']+)["']`, 'i')); return m ? decodeEnt(m[1]) : ''; };
function parseRss(xml, feed) {
  const host = (() => { try { return new URL(feed).hostname.replace(/^(www|rss|feeds)\./, ''); } catch (e) { return ''; } })();
  const names = { 'cnnindonesia.com': 'CNN Indonesia', 'antaranews.com': 'ANTARA', 'detik.com': 'detikcom', 'bbci.co.uk': 'BBC Indonesia', 'news.google.com': 'Google Berita' };
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).map(it => {
    let title = strip(tag(it, 'title')), source = strip(tag(it, 'source')) || names[host] || host;
    if (host === 'news.google.com') { const m = title.match(/^(.*) - ([^-]+)$/); if (m) { title = m[1]; source = source || m[2]; } }
    const link = strip(tag(it, 'link')) || attr(it, 'link', 'href');
    const desc = strip(tag(it, 'description'));
    const imgM = (unCdata(tag(it, 'description')).match(/<img[^>]+src=["']([^"']+)["']/i) || [])[1];
    const img = attr(it, 'enclosure', 'url') || attr(it, 'media:content', 'url') || attr(it, 'media:thumbnail', 'url') || imgM || '';
    const ts = Date.parse(strip(tag(it, 'pubDate')) || strip(tag(it, 'dc:date')));
    return { title, link, source, summary: host === 'news.google.com' ? '' : desc.slice(0, 220), img: /^https?:/.test(img) && !/\.(mp4|mp3)(\?|$)/.test(img) ? img : '', ts: isNaN(ts) ? 0 : ts };
  }).filter(x => x.title && /^https?:/.test(x.link));
}
async function news(cat, query) {
  const feeds = query ? [`https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`] : (FEEDS[cat] || FEEDS.terbaru);
  const res = await Promise.allSettled(feeds.map(async f => {
    const r = await U.tfetch(f, { headers: { 'User-Agent': U.UA_DESKTOP, Accept: 'application/rss+xml,application/xml,text/xml,*/*' } }, 9000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return parseRss(await r.text(), f);
  }));
  const seen = new Set(); let items = [];
  res.forEach(r => { if (r.status === 'fulfilled') r.value.forEach(x => { const k = x.title.toLowerCase().slice(0, 60); if (!seen.has(k)) { seen.add(k); items.push(x); } }); });
  const now = Date.now();
  items = items.filter(x => !x.ts || x.ts < now + 3600e3).sort((a, b) => b.ts - a.ts).slice(0, 60);
  if (!items.length) throw new Error('Semua sumber berita tidak merespons');
  return { items, updated: now, sources: res.filter(r => r.status === 'fulfilled').length + '/' + feeds.length };
}

/* ================= ARTIKEL (mode baca) ================= */
function gnDecode(link) {
  try {
    const id = (link.match(/\/articles\/([^?]+)/) || [])[1]; if (!id) return null;
    const buf = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1');
    const m = buf.match(/https?:\/\/[\x21-\x7e]+/); return m ? m[0].replace(/[^\x21-\x7e].*$/, '') : null;
  } catch (e) { return null; }
}
async function article(url) {
  if (/news\.google\.com/.test(url)) { const u = gnDecode(url); if (!u) throw new Error('gnews'); url = u; }
  const r = await U.safeFetch(url, { headers: { 'User-Agent': U.UA_DESKTOP, 'Accept-Language': 'id,en;q=0.8' } }, 5, 14000);
  const h = (await r.text()).slice(0, 2_500_000);
  const title = strip((h.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) || [])[1] || tag(h, 'title'));
  const image = (h.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '';
  const body = h.replace(/<(script|style|noscript|nav|header|footer|aside|form|iframe)[\s\S]*?<\/\1>/gi, '');
  const art = (body.match(/<article[\s\S]*?<\/article>/i) || [body])[0];
  const ps = (art.match(/<p[\s>][\s\S]*?<\/p>/gi) || []).map(strip).filter(t => t.length > 60 && !/^(baca juga|simak juga|advertisement|iklan|copyright)/i.test(t));
  if (ps.length < 2) throw new Error('isi artikel tidak terbaca');
  return { title, image, paragraphs: ps.slice(0, 60), url: r.finalUrl || url };
}

/* ================= FOTO: Pinterest -> Bing -> Openverse ================= */
const IMG_UA = { 'User-Agent': U.UA_DESKTOP, 'Accept-Language': 'id,en;q=0.8' };
async function pinterest(q, bookmark) {
  const data = { options: { query: q, scope: 'pins', page_size: 40, bookmarks: bookmark ? [bookmark] : undefined, field_set_key: 'unauth_react', no_fetch_context_on_resource: false }, context: {} };
  const url = `https://www.pinterest.com/resource/BaseSearchResource/get/?source_url=${encodeURIComponent('/search/pins/?q=' + q)}&data=${encodeURIComponent(JSON.stringify(data))}&_=${Date.now()}`;
  const j = await U.getJSON(url, { headers: { ...IMG_UA, 'X-Requested-With': 'XMLHttpRequest', 'X-Pinterest-AppState': 'active', 'X-Pinterest-PWS-Handler': 'www/search/[scope].js', Accept: 'application/json, text/javascript, */*, q=0.01' } }, 11000);
  const rr = j.resource_response || {};
  const res = (rr.data && rr.data.results) || [];
  const items = res.filter(p => p && p.images).map(p => { const im = p.images; const o = im.orig || im['736x'] || im['474x'] || {}; const t = im['474x'] || im['236x'] || im['736x'] || o; return { id: String(p.id), thumb: t.url, full: o.url, w: o.width || 0, h: o.height || 0, title: p.grid_title || p.title || p.description || q, page: p.id ? 'https://www.pinterest.com/pin/' + p.id + '/' : '' }; }).filter(x => x.thumb && x.full);
  if (!items.length) return null;
  const bm = (rr.bookmark) || (j.resource && j.resource.options && j.resource.options.bookmarks && j.resource.options.bookmarks[0]) || '';
  return { items, next: bm && bm !== '-end-' ? bm : '' };
}
async function bing(q, offset) {
  const url = `https://www.bing.com/images/async?q=${encodeURIComponent(q)}&first=${offset}&count=35&mmasync=1&adlt=strict&qft=+filterui:imagesize-large`;
  const h = await (await U.tfetch(url, { headers: IMG_UA }, 11000)).text();
  const items = []; const re = /\sm="([^"]+)"/g; let m;
  while ((m = re.exec(h))) {
    try { const o = JSON.parse(decodeEnt(m[1])); if (o.murl && o.turl) items.push({ id: o.cid || o.murl, thumb: o.turl, full: o.murl, w: 0, h: 0, title: strip(o.t || q), page: o.purl || '' }); } catch (e) {}
  }
  if (!items.length) return null;
  return { items, next: String(offset + 35) };
}
async function openverse(q, page) {
  const j = await U.getJSON(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=30&page=${page}&mature=false`, {}, 10000);
  const items = (j.results || []).filter(i => i.url).map(i => ({ id: i.id, thumb: i.thumbnail || i.url, full: i.url, w: i.width || 0, h: i.height || 0, title: i.title || q, page: i.foreign_landing_url || i.url }));
  return items.length ? { items, next: String(page + 1) } : null;
}
async function photos(q, cursor, src) {
  const [kind, val] = String(cursor || '').split('~');
  const provs = {
    pinterest: () => pinterest(q, val), bing: () => bing(q, Number(val) || 0), openverse: () => openverse(q, Number(val) || 1)
  };
  const order = src && provs[src] ? [src] : ['pinterest', 'bing', 'openverse'];
  const start = kind && provs[kind] ? [kind] : order;
  const errs = [];
  for (const k of start) {
    try { const r = await provs[k](); if (r) return { ...r, source: k, next: r.next ? k + '~' + r.next : '' }; errs.push(k + ': kosong'); } catch (e) { errs.push(k + ': ' + e.message); }
  }
  if (kind) { // lanjutan gagal -> coba sumber lain dari awal tidak masuk akal, tandai selesai
    return { items: [], next: '', source: kind };
  }
  throw new Error('Semua sumber foto gagal: ' + errs.join(' | '));
}

/* ================= AI ================= */
const SYS = 'Kamu adalah Asisten Dimzz: asisten cerdas yang menjawab dalam bahasa Indonesia yang jelas, ramah, ringkas, dan akurat. Jika tidak yakin, katakan terus terang. Gunakan format rapi (daftar/paragraf pendek) bila perlu.';
async function ai(messages) {
  const msgs = [{ role: 'system', content: SYS }, ...messages.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 4000) }))];
  const last = msgs[msgs.length - 1].content;
  const okTxt = s => typeof s === 'string' && s.trim().length > 1 ? s.trim() : null;
  const key = process.env.XCY_APIKEY, orKey = process.env.OPENROUTER_KEY;
  const r = await U.chain([
    ...(orKey ? [{ name: 'openrouter', run: async () => {
      const x = await U.tfetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + orKey }, body: JSON.stringify({ model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free', messages: msgs }) }, 40000);
      const j = await x.json(); return okTxt(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content); } }] : []),
    { name: 'pollinations', run: async () => {
      const x = await U.tfetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai', messages: msgs }) }, 35000);
      if (!x.ok) throw new Error('HTTP ' + x.status);
      const j = await x.json(); return okTxt(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content); } },
    ...(key ? [{ name: 'xcy-qwen', run: async () => {
      const x = await U.tfetch('https://www.xcy-cpanel.my.id/api/respon/endpoint/ai/qween', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-apikey': key }, body: JSON.stringify({ prompt: SYS + '\n\n' + last }) }, 40000);
      const j = await x.json().catch(() => null); return okTxt(U.deepFind(j, ['result', 'response', 'answer', 'message', 'text'])); } }] : []),
    { name: 'pollinations-get', run: async () => {
      const x = await U.tfetch(`https://text.pollinations.ai/${encodeURIComponent(last.slice(0, 1500))}?system=${encodeURIComponent(SYS)}`, {}, 35000);
      return x.ok ? okTxt(await x.text()) : null; } },
    ...['https://api.siputzx.my.id/api/ai/gpt3?prompt={sys}&content={q}', 'https://api.ryzumi.vip/api/ai/chatgpt?text={q}&prompt={sys}'].map(t => ({ name: t.split('/')[2], run: async () => {
      const j = await U.getJSON(U.fill(t, { q: last.slice(0, 1500), sys: SYS }), {}, 30000);
      return okTxt(typeof j.data === 'string' ? j.data : typeof j.result === 'string' ? j.result : U.deepFind(j, ['result', 'response', 'answer', 'message', 'text', 'data'])); } }))
  ]);
  if (!r.ok) throw new Error('Semua layanan AI sedang sibuk: ' + r.errors.join(' | '));
  return { text: r.data, provider: r.provider };
}

/* ================= MANGADEX ================= */
async function mangadex(path) {
  if (!/^\/(manga|at-home\/server|chapter|cover|author)(\/|\?|$)/.test(path)) { const e = new Error('path tidak diizinkan'); e.status = 400; throw e; }
  const r = await U.tfetch('https://api.mangadex.org' + path, { headers: { 'User-Agent': 'DimzzProzet/2.0', Accept: 'application/json' } }, 20000);
  return { status: r.status, body: await r.text(), cache: path.startsWith('/at-home') ? 'no-store' : 's-maxage=120, stale-while-revalidate=600' };
}

/* ================= STREAM / UNDUH (hanya tautan bertanda tangan) ================= */
async function stream(req, res) {
  const url = U.verify(U.q(req, 'u'), U.q(req, 'e'), U.q(req, 's'));
  if (!url) return U.json(res, 403, { error: 'tautan tidak valid / kedaluwarsa' });
  const headers = { 'User-Agent': /googlevideo/.test(url) ? 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L) gzip' : U.UA_DESKTOP, Accept: '*/*' };
  if (req.headers.range) headers.Range = req.headers.range;
  let up;
  try { up = await U.safeFetch(url, { headers }, 5, 55000); } catch (e) { return U.json(res, 502, { error: 'sumber tidak merespons' }); }
  if (up.status >= 400) return U.json(res, 502, { error: 'sumber menolak (HTTP ' + up.status + ')' });
  const extra = { 'Cache-Control': 'private, max-age=3600', 'Accept-Ranges': 'bytes' };
  if (U.q(req, 'dl')) {
    const name = U.q(req, 'name', 'unduhan').replace(/[^\w\-. ()\[\]]+/g, '_').slice(0, 90);
    extra['Content-Disposition'] = `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;
  }
  return U.pipeUpstream(up, res, extra);
}

/* ================= PROXY umum (GET, publik, maks 3 MB) ================= */
async function proxy(req, res) {
  const target = U.q(req, 'url');
  if (!/^https?:\/\//i.test(target)) return U.json(res, 400, { error: 'url tidak valid' });
  try {
    const r = await U.safeFetch(target, { headers: { 'User-Agent': U.UA, Accept: '*/*', 'Accept-Language': 'id,en;q=0.8' } });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3 * 1024 * 1024) return U.json(res, 413, { error: 'terlalu besar' });
    res.status(r.status).setHeader('Content-Type', r.headers.get('content-type') || 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.send(buf);
  } catch (e) { return U.json(res, 502, { error: 'gagal mengambil: ' + (e.message || e) }); }
}

module.exports = { news, parseRss, article, photos, ai, mangadex, stream, proxy, FEEDS };

};

__defs['health'] = function(module, exports, require){
// Pemeriksaan kesehatan semua penyedia (dipakai Panel Dev). Tidak mengubah data apa pun.
const U = require('./util');
const YT = require('./yt'), S = require('./social'), M = require('./misc');
const T = (label, fn) => async () => { const t0 = Date.now(); try { const d = await fn(); return { label, ok: !!d, ms: Date.now() - t0, detail: typeof d === 'string' ? d : '' }; } catch (e) { return { label, ok: false, ms: Date.now() - t0, detail: String(e.message || e).slice(0, 160) }; } };
const tpl = async (t, vars) => { const j = await U.getJSON(U.fill(t, vars), {}, 12000); const u = U.deepUrls(j); return (u.length || Object.keys(j || {}).length) ? 'merespons' : ''; };

async function run(group) {
  const vid = 'dQw4w9WgXcQ', yurl = 'https://www.youtube.com/watch?v=' + vid;
  const sets = {
    youtube: [
      T('YouTube Music · cari lagu', async () => (await YT.searchMusic('tulus hati hati di jalan', 5)).provider),
      T('YouTube · cari video', async () => (await YT.searchVideos('lofi', 5)).provider),
      T('Audio · InnerTube (stream)', async () => { const f = await YT.playerStreams(vid); return f.client; }),
      ...YT.TP.audio.map(t => T('Pengonversi MP3 · ' + t.split('/')[2], () => tpl(t, { url: yurl, id: vid }))),
      ...YT.TP.video.map(t => T('Pengonversi MP4 · ' + t.split('/')[2], () => tpl(t, { url: yurl, id: vid })))
    ],
    sosmed: [
      T('TikTok · profil', async () => (await S.ttProfile('tiktok')).provider),
      T('TikTok · unduh (tikwm)', async () => { const j = await U.getJSON('https://www.tikwm.com/api/?url=https://www.tiktok.com/@tiktok/video/7106594312292453675', {}, 12000); return j.code === 0 ? 'ok' : j.msg; }),
      T('Instagram · profil', async () => (await S.igProfile('instagram')).provider),
      T('Instagram · unduh API', () => tpl('https://api.siputzx.my.id/api/d/igdl?url={url}', { url: 'https://www.instagram.com/p/C0000000000/' })),
      T('Spotify · unduh API', () => tpl('https://api.siputzx.my.id/api/d/spotify?url={url}', { url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' })),
      T('Game ML · nickname', async () => (await S.gameNick('ml', '1234567', '1234')).provider),
      T('Game FF · nickname', async () => (await S.gameNick('ff', '12345678')).provider),
      T('Bypass · perluas tautan', async () => (await S.bypass('https://tinyurl.com/yfwv4ccn')).provider)
    ],
    konten: [
      T('Berita · terbaru', async () => { const r = await M.news('terbaru'); return r.sources + ' sumber, ' + r.items.length + ' berita'; }),
      T('Foto · Pinterest/Bing', async () => (await M.photos('pemandangan')).source),
      T('AI · asisten', async () => (await M.ai([{ role: 'user', content: 'Halo' }])).provider),
      T('MangaDex', async () => { const r = await M.mangadex('/manga?limit=1'); return r.status === 200 ? 'ok' : ''; }),
      T('Jadwal sholat (aladhan)', async () => { const j = await U.getJSON('https://api.aladhan.com/v1/timings?latitude=-6.2&longitude=106.8&method=20', {}, 9000); return j.code === 200 ? 'ok' : ''; }),
      T('Al-Quran (equran.id)', async () => { const j = await U.getJSON('https://equran.id/api/v2/surat', {}, 9000); return (j.data || []).length ? 'ok' : ''; })
    ]
  };
  const list = group && sets[group] ? sets[group] : Object.values(sets).flat();
  return Promise.all(list.map(f => f()));
}
module.exports = { run };

};

// Satu pintu untuk semua fungsi server (batas 12 fungsi paket gratis Vercel). Diakses lewat /api/<nama> (lihat "rewrites" di vercel.json).
// Rahasia opsional di Vercel > Settings > Environment Variables:
//   STREAM_SECRET (wajib diganti, acak panjang) · APIFY_TOKEN · XCY_APIKEY · OPENROUTER_KEY
//   YT_AUDIO_APIS / YT_VIDEO_APIS / IG_DL_APIS / SPOTIFY_DL_APIS / BYPASS_APIS / ML_APIS / FF_APIS  (JSON array URL, pakai {url} {id} {zone})
const U = __req('./_lib/util');
const YT = __req('./_lib/yt'), S = __req('./_lib/social'), M = __req('./_lib/misc'), H = __req('./_lib/health');

const ok = (res, data, cache) => U.json(res, 200, { ok: true, ...data }, cache);
const fail = (res, e, status) => U.json(res, status || e.status || 502, { ok: false, error: e.message || String(e), detail: e.detail });

const H_ = {
  ping: async (req, res) => ok(res, { app: 'dimzz-alltools', v: '3.0', time: Date.now() }),

  // YouTube & YouTube Music
  async yt(req, res) {
    const a = U.q(req, 'a'), qq = U.q(req, 'q').slice(0, 200), id = U.q(req, 'id');
    try {
      if (a === 'search') return ok(res, await YT.searchVideos(qq, 24), 's-maxage=120');
      if (a === 'music') return ok(res, await YT.searchMusic(qq, 30), 's-maxage=120');
      if (a === 'audio') return ok(res, await YT.audioFor(id));
      if (a === 'dl') return ok(res, await YT.downloadsFor(id));
    } catch (e) { return fail(res, e); }
    return U.json(res, 400, { ok: false, error: 'aksi tidak dikenal' });
  },
  async stream(req, res) { return M.stream(req, res); },

  async tiktok(req, res) {
    const a = U.q(req, 'a', 'profile');
    try {
      if (a === 'dl') { const u = U.q(req, 'url'); if (!/tiktok\.com|vt\.tiktok|vm\.tiktok/i.test(u)) return U.json(res, 400, { ok: false, error: 'link TikTok tidak valid' }); return ok(res, await S.ttDownload(u)); }
      const user = U.q(req, 'user').replace(/^@/, '');
      if (!/^[A-Za-z0-9._]{2,24}$/.test(user)) return U.json(res, 400, { ok: false, error: 'username tidak valid' });
      return ok(res, await S.ttProfile(user), 's-maxage=300');
    } catch (e) { return fail(res, e); }
  },
  async instagram(req, res) {
    const a = U.q(req, 'a', 'profile');
    try {
      if (a === 'dl') { const u = U.q(req, 'url'); if (!/instagram\.com/i.test(u)) return U.json(res, 400, { ok: false, error: 'link Instagram tidak valid' }); return ok(res, await S.genericDownload('ig', u)); }
      const user = U.q(req, 'user').replace(/^@/, '').toLowerCase();
      if (!/^[A-Za-z0-9._]{1,30}$/.test(user)) return U.json(res, 400, { ok: false, error: 'username tidak valid' });
      return ok(res, await S.igProfile(user), 's-maxage=600');
    } catch (e) { return fail(res, e); }
  },
  async spotify(req, res) {
    const u = U.q(req, 'url');
    if (!/open\.spotify\.com\/(intl-[a-z]+\/)?track\//i.test(u)) return U.json(res, 400, { ok: false, error: 'gunakan link lagu Spotify (bukan album/playlist)' });
    try { return ok(res, await S.genericDownload('sp', u)); } catch (e) { return fail(res, e); }
  },
  async game(req, res) {
    const g = U.q(req, 'g'), id = U.q(req, 'id').trim(), zone = U.q(req, 'zone').trim();
    if (g === 'ml' && !(/^\d{5,12}$/.test(id) && /^\d{3,6}$/.test(zone))) return U.json(res, 400, { ok: false, error: 'User ID 5–12 angka, Zone ID 3–6 angka' });
    if (g === 'ff' && !/^\d{7,13}$/.test(id)) return U.json(res, 400, { ok: false, error: 'Player ID FF 7–13 angka' });
    if (g !== 'ml' && g !== 'ff') return U.json(res, 400, { ok: false, error: 'game tidak dikenal' });
    try { return ok(res, await S.gameNick(g, id, zone)); } catch (e) { return fail(res, e); }
  },
  async bypass(req, res) {
    const u = U.q(req, 'url').trim();
    if (!/^https?:\/\/[^\s]+\.[^\s]+/i.test(u)) return U.json(res, 400, { ok: false, error: 'URL tidak valid' });
    try { return ok(res, await S.bypass(u)); } catch (e) { return fail(res, e); }
  },

  async news(req, res) { try { return ok(res, await M.news(U.q(req, 'cat', 'terbaru'), U.q(req, 'q').slice(0, 100)), 'no-store'); } catch (e) { return fail(res, e); } },
  async article(req, res) { try { const u = U.q(req, 'url'); if (!/^https?:\/\//i.test(u)) return U.json(res, 400, { ok: false, error: 'url tidak valid' }); return ok(res, await M.article(u), 's-maxage=600'); } catch (e) { return fail(res, e, 422); } },
  async photos(req, res) { const qq = U.q(req, 'q').trim().slice(0, 120); if (!qq) return U.json(res, 400, { ok: false, error: 'kata kunci kosong' }); try { const r = await M.photos(qq, U.q(req, 'c'), U.q(req, 'src')); r.items = r.items.map(x => ({ ...x, dl: U.streamLink(x.full, { dl: 1 }) })); return ok(res, r, 's-maxage=120'); } catch (e) { return fail(res, e); } },
  async ai(req, res) { const b = U.body(req); const msgs = Array.isArray(b.messages) ? b.messages : [{ role: 'user', content: U.q(req, 'q') }]; if (!msgs.length || !String(msgs[msgs.length - 1].content || '').trim()) return U.json(res, 400, { ok: false, error: 'pesan kosong' }); try { return ok(res, await M.ai(msgs)); } catch (e) { return fail(res, e); } },
  async mangadex(req, res) {
    try { const r = await M.mangadex(U.q(req, 'path')); res.status(r.status).setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', r.cache); return res.send(r.body); }
    catch (e) { return fail(res, e); }
  },
  async proxy(req, res) { return M.proxy(req, res); },
  async health(req, res) { try { return ok(res, { results: await H.run(U.q(req, 'g')), time: Date.now() }); } catch (e) { return fail(res, e); } }
};

module.exports = async (req, res) => {
  U.cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const name = U.q(req, 'fn');
  const fn = H_[name];
  if (!fn) return U.json(res, 404, { ok: false, error: 'endpoint tidak dikenal' });
  const heavy = ['yt', 'tiktok', 'instagram', 'spotify', 'game', 'bypass', 'photos', 'ai', 'article'].includes(name);
  if (heavy && U.limited(req, name === 'yt' ? 90 : 40)) return U.json(res, 429, { ok: false, error: 'terlalu banyak permintaan, coba lagi sebentar' });
  try { return await fn(req, res); } catch (e) { return fail(res, e, 500); }
};
module.exports.handlers = H_;
