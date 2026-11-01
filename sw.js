// Service worker: berkas statis di-cache (cepat & bisa dibuka cepat), /api tidak pernah di-cache.
// v3.23: menerima Web Push → menampilkan notifikasi layar HP walau web sudah ditutup (seperti WhatsApp).
const V = 'dimzz-v3.30.0';
const STATIC = ['./', 'index.html', 'app.css', '14-boost.js', '15-roles.js', '13-chat.js', '16-wa.js', '17-push.js', '18-online.js', '19-icons.js', '02-firebase.js', '11-anime-manga.js', '12-dev.js', 'manifest.webmanifest', 'icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(STATIC).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || r.headers.get('range')) return;
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match('index.html'))));
});

/* ---------- notifikasi layar HP ---------- */
async function show(d) {
  const call = d.k === 'call', tag = (call ? 'call-' : 'chat-') + (d.c || 'x');
  let lines = [d.b || ''], n = 1;
  if (!call && d.k !== 'test') {
    try { const old = await self.registration.getNotifications({ tag }); if (old.length && old[0].data && Array.isArray(old[0].data.l)) { lines = [...old[0].data.l, d.b || ''].slice(-5); n = (old[0].data.cnt || old[0].data.l.length) + 1; } } catch (e) {}
  }
  return self.registration.showNotification((d.t || 'DimzzChat') + (n > 1 ? ' (' + n + ' pesan)' : ''), {
    body: lines.join('\n'), tag: d.k === 'test' ? 'test' : tag, renotify: true, icon: 'icon-192.png', badge: 'icon-192.png', lang: 'id', timestamp: d.ts || Date.now(),
    vibrate: call ? [500, 250, 500, 250, 500, 250, 500] : [200, 100, 200], requireInteraction: call, silent: false,
    actions: (call || d.k === 'test') ? [] : [{ action: 'reply', type: 'text', title: 'Balas', placeholder: 'Ketik balasan…' }, { action: 'open', title: 'Buka' }],
    data: { c: d.c, n: d.n || d.t, k: d.k, l: lines, cnt: n }
  });
}
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { try { d = { b: e.data.text() }; } catch (y) {} }
  e.waitUntil((async () => {
    /* jika webnya sedang terlihat di layar, serahkan ke halaman (agar tidak menampilkan notifikasi untuk chat yang sedang dibuka) */
    const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }), vis = cl.filter(c => c.visibilityState === 'visible');
    if (vis.length) { vis.forEach(c => c.postMessage({ type: 'dz-push', d })); return; }
    await show(d);
  })());
});
self.addEventListener('message', e => { const m = e.data; if (m && m.type === 'dz-show' && m.d) e.waitUntil(show(m.d)); });
/* ---------- balas langsung dari notifikasi ---------- */
const idbGet = () => new Promise(ok => { try { const r = indexedDB.open('dz-sw', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onerror = () => ok(null); r.onsuccess = () => { const g = r.result.transaction('kv').objectStore('kv').get('creds'); g.onsuccess = () => { ok(g.result || null); r.result.close(); }; g.onerror = () => ok(null); }; } catch (e) { ok(null); } });
const uKey = n => String(n || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
const nid = () => Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 5);
async function jf(url, opt) { const r = await fetch(url, opt); if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json().catch(() => null); }
async function replyFromNotif(d, text, old) {
  const cr = await idbGet(); if (!cr || !cr.refresh) throw new Error('nologin');
  const t = String(text || '').trim().slice(0, 1000); if (!t || !d.c) throw new Error('kosong');
  const tk = await jf('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(cr.apiKey), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cr.refresh }) });
  const auth = '?auth=' + encodeURIComponent(tk.id_token), me = cr.key || uKey(cr.u), ts = Date.now(), id = nid(), pv = t.slice(0, 60), g = String(d.c).startsWith('g:');
  const db = (p, o) => jf(cr.db + '/' + p + '.json' + auth, o);
  const up = {}; let rec = [], title = d.n || d.t || 'Chat';
  if (g) {
    const gid = d.c.slice(2), info = await db('wa/g/' + gid); if (!info || !info.m || !info.m[me]) throw new Error('bukan anggota');
    title = info.n || title; rec = Object.keys(info.m);
    up['gm/' + gid + '/' + id] = { k: me, ts, t };
    rec.forEach(k => { up['ib/' + k + '/g:' + gid] = { u: info.n, g: 1, t: (cr.name + ': ' + pv).slice(0, 70), ts, k: me }; });
  } else {
    const other = d.c, pair = [me, other].sort().join('__'); rec = [other];
    up['dm/' + pair + '/' + id] = { k: me, ts, t, to: other };
    up['ib/' + me + '/' + other] = { u: d.n || other, t: pv, ts, k: me };
    up['ib/' + other + '/' + me] = { u: cr.name, t: pv, ts, k: me };
  }
  await db('wa', { method: 'PATCH', body: JSON.stringify(up) });
  /* beri tahu penerima lewat server push */
  try {
    const subs = []; await Promise.all(rec.filter(k => k && k !== me).slice(0, 30).map(async k => { const x = await db('wa/ps/' + k).catch(() => null); Object.values(x || {}).filter(v => v && v.e && v.p && v.a).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 4).forEach(v => subs.push({ endpoint: v.e, keys: { p256dh: v.p, auth: v.a } })); }));
    if (subs.length) await jf(cr.api + '/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: tk.id_token, subs: subs.slice(0, 25), p: g ? { t: title, n: title, b: (cr.name + ': ' + pv).slice(0, 140), c: 'g:' + d.c.slice(2), k: 'msg' } : { t: cr.name, n: cr.name, b: pv.slice(0, 140), c: me, k: 'msg' } }) });
  } catch (e) {}
  return { title, t };
}
async function openChat(d) {
  const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }), msg = { type: 'dz-open', c: d.c, n: d.n, k: d.k };
  for (const c of cl) { try { await c.focus(); c.postMessage(msg); return; } catch (x) {} }
  const q = new URLSearchParams({ c: d.c || '', n: d.n || '', k: d.k || '' }); await self.clients.openWindow('./index.html?' + q.toString());
}
self.addEventListener('notificationclick', e => {
  const n = e.notification, d = n.data || {};
  if (e.action === 'reply' && e.reply && String(e.reply).trim()) {
    e.waitUntil((async () => {
      const keep = (body, extra) => self.registration.showNotification(n.title, Object.assign({ body, tag: n.tag, renotify: false, silent: true, icon: 'icon-192.png', badge: 'icon-192.png', lang: 'id', timestamp: Date.now(), data: d, actions: [{ action: 'reply', type: 'text', title: 'Balas', placeholder: 'Ketik balasan…' }, { action: 'open', title: 'Buka' }] }, extra || {}));
      try {
        const r = await replyFromNotif(d, e.reply);
        const lines = [...(Array.isArray(d.l) ? d.l : [n.body]), 'Kamu: ' + r.t].slice(-5); d.l = lines;
        await keep(lines.join('\n'));
      } catch (x) {
        if (x && x.message === 'nologin') { n.close(); return openChat(d); }
        await keep((n.body ? n.body + '\n' : '') + '⚠️ Balasan gagal terkirim. Ketuk Buka untuk membalas di web.', { silent: false });
      }
    })());
    return;
  }
  n.close();
  e.waitUntil(openChat(d));
});
