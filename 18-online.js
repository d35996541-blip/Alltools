/* ==== 18-online.js — Siapa yang online: detak keaktifan ke Firebase (presence/<username>) + daftar pengguna online ==== */
const Presence = {
  ON_MS: 100000, BEAT_MS: 45000, timer: null, started: false,
  me() { return App.user ? userKey(App.user.username) : ''; },
  async beat(off) {
    if (!Ban.on() || !App.user) return;
    const k = this.me(); if (!k) return;
    try { await FB.request('presence/' + k, null, 'PUT', { u: App.user.username, r: String(App.user.role || 'Gratis'), ts: off ? 0 : Date.now() }, 8000); } catch (e) {}
  },
  start() {
    if (this.started || !Ban.on() || !App.user) return; this.started = true;
    this.beat();
    this.timer = setInterval(() => { if (!document.hidden) this.beat(); }, this.BEAT_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.beat(); else this.beat(true); });
    window.addEventListener('pagehide', () => { this.beat(true); });
  },
  async stop() { clearInterval(this.timer); this.started = false; await this.beat(true); },
  async list() {
    const all = (await FB.request('presence', null, 'GET', undefined, 10000)) || {}, now = Date.now();
    return Object.entries(all).filter(([, v]) => v && v.u && typeof v.ts === 'number').map(([k, v]) => ({ k, u: v.u, r: v.r || 'Gratis', ts: v.ts, on: v.ts > 0 && now - v.ts < this.ON_MS })).sort((a, b) => b.ts - a.ts);
  }
};
setInterval(() => { try { if (App.user && Ban.on()) Presence.start(); } catch (e) {} }, 3000);
try { const _lo = App.logout.bind(App); App.logout = async function () { if (!await UI.confirm('Keluar dari akun?', 'Kamu perlu masuk lagi untuk memakai aplikasi.', { ok: 'Keluar', danger: true, icon: 'fa-right-from-bracket' })) return; try { await Presence.stop(); } catch (e) {} try { if (window.Push) await Push.forget(); } catch (e) {} LS.del('session'); location.reload(); }; } catch (e) {}

const Online = {
  timer: null, tab: 'on',
  ago(ts) { if (!ts) return 'offline'; const s = Math.max(0, Math.floor((Date.now() - ts) / 1000)); if (s < 60) return 'baru saja'; const m = Math.floor(s / 60); if (m < 60) return m + ' menit lalu'; const h = Math.floor(m / 60); if (h < 24) return h + ' jam lalu'; return Math.floor(h / 24) + ' hari lalu'; },
  row(u, me) {
    const hue = (() => { let h = 0; for (const c of u.k) h = (h * 31 + c.charCodeAt(0)) % 360; return h; })();
    return `<div class="on-row"><span class="on-av" style="--h:${hue}">${esc(u.u.charAt(0).toUpperCase())}<i class="on-dot ${u.on ? 'on' : ''}"></i></span><div class="on-mid"><b>${esc(u.u)}${u.k === me ? ' <em>(kamu)</em>' : ''}</b><small>${u.on ? '<span style="color:#22c55e;font-weight:700">Online</span>' : 'Terakhir aktif ' + this.ago(u.ts)}</small></div>${typeof Rank !== 'undefined' ? Rank.badge(u.r, true) : ''}</div>`;
  },
  async draw() {
    const box = $('on-list'); if (!box) return;
    try {
      const l = await Presence.list(), me = Presence.me(), on = l.filter(x => x.on), off = l.filter(x => !x.on && x.ts > Date.now() - 7 * 864e5);
      const cnt = $('on-n'); if (cnt) cnt.textContent = on.length;
      const q = (($('on-q') || {}).value || '').trim().toLowerCase(), f = x => !q || x.u.toLowerCase().includes(q);
      const src = this.tab === 'on' ? on.filter(f) : off.filter(f);
      box.innerHTML = src.length ? src.map(x => this.row(x, me)).join('') : emptyHtml(this.tab === 'on' ? 'fa-user-slash' : 'fa-clock', this.tab === 'on' ? 'Belum ada yang online.' : 'Belum ada riwayat aktif 7 hari terakhir.');
      const t1 = $('on-t1'), t2 = $('on-t2'); if (t1) t1.textContent = 'Online (' + on.length + ')'; if (t2) t2.textContent = 'Terakhir aktif (' + off.length + ')';
    } catch (e) {
      box.innerHTML = errHtml(e.permission ? 'Ditolak Firebase — tempel Rules terbaru (firebase-rules-tambahan.json) lalu Publish.' : 'Gagal memuat daftar online.');
    }
  },
  open() {
    if (!App.isDev()) { UI.toast('Fitur ini khusus Developer.', 'err'); return; }
    Sheet.open({ id: 'online', title: 'Yang Online', icon: 'fa-signal', grad: 'linear-gradient(135deg,#22c55e,#15803d)', onClose: () => { clearInterval(this.timer); },
      body: `<div class="on-hd"><span class="on-big"><i class="on-dot on"></i><b id="on-n">–</b> sedang online</span></div>
      <div class="seg" style="display:flex;gap:6px"><button class="chip on" id="on-t1" type="button">Online</button><button class="chip" id="on-t2" type="button">Terakhir aktif</button></div>
      <input id="on-q" class="inp" placeholder="Cari username…" autocomplete="off"/>
      <div id="on-list" class="on-list">${loadingHtml('Memuat…')}</div>` });
    if (!Ban.on()) { $('on-list').innerHTML = emptyHtml('fa-plug-circle-xmark', 'Fitur ini butuh koneksi Firebase.<br>Saat ini web berjalan dalam mode lokal.'); return; }
    Presence.beat();
    const setTab = t => { this.tab = t; $('on-t1').classList.toggle('on', t === 'on'); $('on-t2').classList.toggle('on', t !== 'on'); this.draw(); };
    $('on-t1').onclick = () => setTab('on'); $('on-t2').onclick = () => setTab('off'); $('on-q').oninput = () => this.draw();
    this.tab = 'on'; this.draw(); clearInterval(this.timer); this.timer = setInterval(() => this.draw(), 15000);
  }
};
Features.reg({ id: 'online', name: 'Yang Online', cat: 'sosmed', devOnly: true, icon: 'fa-signal', grad: 'linear-gradient(135deg,#22c55e,#15803d)', open: () => Online.open() });
