/* ==== 17-push.js — v3.23 Notifikasi layar HP (Web Push), seperti WhatsApp: pesan & panggilan tetap muncul walau web/aplikasi sudah ditutup.
   Alur: perangkat penerima mendaftar (langganan push) → disimpan di Firebase wa/ps/<user>/<id> → saat pengirim mengirim pesan,
   server (/api/push) mengirim notifikasi terenkripsi lewat layanan push browser → service worker (sw.js) menampilkannya di layar HP. ==== */
const Push = {
  pending: null,
  ok() { try { return !!(window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window); } catch (e) { return false; } },
  perm() { try { return Notification.permission; } catch (e) { return 'denied'; } },
  enabled() { return this.ok() && this.perm() === 'granted' && LS.get('push_on', 1) !== 0; },
  why() {
    if (this.ok()) return '';
    if (!window.isSecureContext) return 'Notifikasi butuh alamat https.';
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'Di iPhone/iPad: buka menu Bagikan → "Tambah ke Layar Utama", lalu buka dari ikon itu.';
    return 'Browser ini belum mendukung notifikasi.';
  },
  b64(k) { const s = (k + '='.repeat((4 - k.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'), r = atob(s); return Uint8Array.from(r, c => c.charCodeAt(0)); },
  async hash(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return btoa(String.fromCharCode(...new Uint8Array(d).slice(0, 9))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  async reg() {
    let r = await navigator.serviceWorker.getRegistration(); if (!r) r = await navigator.serviceWorker.register('sw.js');
    return await Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('Service worker belum siap, muat ulang web lalu coba lagi')), 10000))]) || r;
  },
  me: () => userKey(App.user.username),

  /* daftarkan perangkat ini untuk akun yang sedang masuk */
  async sync(ask, force) {
    if (!this.ok()) throw new Error(this.why());
    if (FB.mode !== 'firebase' || !FB.st.idToken) throw new Error('Butuh koneksi Firebase');
    if (this.perm() === 'default' && ask) await Notification.requestPermission();
    if (this.perm() !== 'granted') throw Object.assign(new Error(this.perm() === 'denied' ? 'Izin notifikasi diblokir. Buka pengaturan situs di browser lalu izinkan Notifikasi.' : 'Izin notifikasi belum diberikan'), { denied: 1 });
    const reg = await this.reg(), j0 = await API.get('push', { a: 'key' }, 15000), want = this.b64(j0.key);
    let sub = await reg.pushManager.getSubscription();
    if (sub && (force || LS.get('push_vk') !== j0.key)) { await sub.unsubscribe().catch(() => {}); sub = null; await sleep(1200); } /* kunci server berubah → langganan lama ditolak */
    if (sub) { const have = new Uint8Array((sub.options && sub.options.applicationServerKey) || []); if (have.length && (have.length !== want.length || have.some((v, i) => v !== want[i]))) { await sub.unsubscribe().catch(() => {}); sub = null; } }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want });
    const j = sub.toJSON(); if (!j.endpoint || !j.keys) throw new Error('Langganan tidak lengkap');
    const id = await this.hash(j.endpoint), me = this.me();
    await FB.request(`wa/ps/${me}/${id}`, null, 'PUT', { e: j.endpoint, p: j.keys.p256dh, a: j.keys.auth, ts: Date.now() });
    LS.set('push_id', { u: me, id }); LS.set('push_vk', j0.key); this.prune(me).catch(() => {}); return sub;
  },
  /* simpan hanya 3 perangkat terbaru per akun (sisanya hasil percobaan lama) */
  async prune(me) { const d = await FB.request('wa/ps/' + me, null, 'GET', undefined, 8000).catch(() => null), es = Object.entries(d || {}).sort((a, b) => ((b[1] && b[1].ts) || 0) - ((a[1] && a[1].ts) || 0)); await Promise.all(es.slice(3).map(([id]) => FB.request(`wa/ps/${me}/${id}`, null, 'DELETE').catch(() => {}))); },
  async dropEndpoint(me, ep) { const d = await FB.request('wa/ps/' + me, null, 'GET', undefined, 8000).catch(() => null); await Promise.all(Object.entries(d || {}).filter(([, x]) => x && x.e === ep).map(([id]) => FB.request(`wa/ps/${me}/${id}`, null, 'DELETE').catch(() => {}))); },
  async enable() { LS.set('push_on', 1); try { await this.sync(true); return true; } catch (e) { throw e; } },
  async disable() { LS.set('push_on', 0); await this.forget(); try { const r = await navigator.serviceWorker.getRegistration(), s = r && await r.pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch (e) {} },
  async forget() { const p = LS.get('push_id'); if (!p || !p.id) return; try { await Promise.race([FB.request(`wa/ps/${p.u}/${p.id}`, null, 'DELETE'), sleep(3500)]); } catch (e) {} LS.del('push_id'); },
  auto() { if (this.enabled()) setTimeout(() => this.sync(false).catch(() => {}), 2500); },

  /* kirim notifikasi ke daftar pengguna (dipanggil setelah pesan berhasil terkirim) */
  async notify(keys, p) {
    try {
      keys = [...new Set(keys)].filter(k => k && k !== this.me()).slice(0, 30); if (!keys.length || FB.mode !== 'firebase' || !FB.st.idToken) return;
      const subs = [];
      await Promise.all(keys.map(async k => { const d = await FB.request('wa/ps/' + k, null, 'GET', undefined, 8000).catch(() => null); Object.values(d || {}).filter(x => x && x.e).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 4).forEach(x => { if (x && x.e && x.p && x.a) subs.push({ endpoint: x.e, keys: { p256dh: x.p, auth: x.a } }); }); }));
      if (subs.length) await API.post('push', { token: await FB.token(), subs: subs.slice(0, 25), p }, 15000);
    } catch (e) {}
  },
  /* tes: kirim ke langganan perangkat ini (diambil langsung dari browser) dan tampilkan laporan lengkap */
  async test() {
    const me = this.me(), P0 = { t: 'DimzzChat', b: 'Tes notifikasi berhasil ✅ Kamu akan menerima pesan seperti ini walau web ditutup.', c: me, n: 'DimzzChat', k: 'test' }, info = [];
    const one = async force => {
      const sub = await this.sync(true, force), j = sub.toJSON(); const r = await API.post('push', { token: await FB.token(), subs: [{ endpoint: j.endpoint, keys: j.keys }], p: P0 }, 20000);
      return { r, j, gone: !r.sent && ((r.gone || []).includes(j.endpoint) || (r.why || []).some(w => w.status === 410)) };
    };
    let x; try { x = await one(false); if (x.gone) { await this.dropEndpoint(me, x.j.endpoint); x = await one(true); } }
    catch (e) { info.push('Server error: ' + (e.message || e)); await UI.alert('Tes notifikasi gagal', info.join('\n'), { type: 'err' }); throw Object.assign(new Error('Tes gagal'), { shown: 1 }); }
    const r = x.r, db = await this.mine();
    info.push('Izin notifikasi: ' + this.perm(), 'Layanan push: ' + new URL(x.j.endpoint).hostname, 'Tersimpan di database: ' + db.length + ' perangkat', 'Versi server: ' + (r.v || 'LAMA — api/index.js belum diperbarui'), 'Diterima server: ' + (r.n === undefined ? '?' : r.n), 'Berhasil dikirim: ' + r.sent, 'Ditolak: ' + r.failed);
    (r.why || []).forEach(w => info.push('Alasan: HTTP ' + w.status + (w.detail ? ' · ' + w.detail : '')));
    if (!r.sent) {
      if (x.gone) info.push('', 'Google menolak langganan baru ini. Biasanya karena Chrome / Layanan Google Play di HP dibatasi. Coba: Setelan Android → Aplikasi → Chrome → Baterai → "Tidak dibatasi"; matikan Penghemat Data; lalu hapus data situs ini (Chrome → Setelan situs) dan masuk lagi.');
      await UI.alert('Tes notifikasi gagal', info.join('\n'), { type: 'err' }); throw Object.assign(new Error('Tes gagal'), { shown: 1 });
    }
    return r;
  },
  async mine() { const d = await FB.request('wa/ps/' + this.me(), null, 'GET', undefined, 8000).catch(() => null); return Object.values(d || {}).filter(x => x && x.e).sort((a, b) => (b.ts || 0) - (a.ts || 0)).map(x => ({ endpoint: x.e, keys: { p256dh: x.p, auth: x.a } })); },

  /* ketuk notifikasi → buka chat-nya */
  open(d) { if (!d) return; if (!App.user) { this.pending = d; return; } if (d.k === 'call') return; WA.deep(d.c, d.n); },
  afterEnter() { this.auto(); if (this.pending) { const p = this.pending; this.pending = null; setTimeout(() => this.open(p), 700); } },
  init() {
    try { const q = new URLSearchParams(location.search); if (q.get('c')) { this.pending = { c: q.get('c'), n: q.get('n') || '', k: q.get('k') || '' }; history.replaceState(history.state, '', location.pathname); } } catch (e) {}
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', e => {
      const m = e.data; if (!m) return;
      if (m.type === 'dz-open') this.open(m);
      /* web sedang terbuka: tampilkan notifikasi layar HP hanya jika pengguna tidak sedang membuka chat itu */
      else if (m.type === 'dz-push') { const d = m.d || {}, inChat = !document.hidden && WA.C && WA.C.id === d.c; if ((inChat || d.k === 'call') && d.k !== 'test') return; if (d.k !== 'test') WA.beep(); navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({ type: 'dz-show', d }); }
    });
  }
};
Push.init();
(function () { const e1 = App.enter; App.enter = async function (f) { const r = await e1.call(this, f); try { Push.afterEnter(); } catch (x) {} return r; }; })();
