// Service worker: berkas statis di-cache (cepat & bisa dibuka cepat), /api tidak pernah di-cache.
// v3.23: menerima Web Push → menampilkan notifikasi layar HP walau web sudah ditutup (seperti WhatsApp).
const V = 'dimzz-v3.24.0';
const STATIC = ['./', 'index.html', 'app.css', '14-boost.js', '15-roles.js', '13-chat.js', '16-wa.js', '17-push.js', '02-firebase.js', '11-anime-manga.js', '12-dev.js', 'manifest.webmanifest', 'icon-192.png'];
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
self.addEventListener('notificationclick', e => {
  e.notification.close(); const d = e.notification.data || {};
  e.waitUntil((async () => {
    const cl = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }), msg = { type: 'dz-open', c: d.c, n: d.n, k: d.k };
    for (const c of cl) { try { await c.focus(); c.postMessage(msg); return; } catch (x) {} }
    const q = new URLSearchParams({ c: d.c || '', n: d.n || '', k: d.k || '' }); await self.clients.openWindow('./index.html?' + q.toString());
  })());
});
