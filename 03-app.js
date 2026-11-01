/* ==== 03-app.js — aplikasi: login/daftar, intro, beranda, daftar fitur, musik latar, wallpaper, menu ==== */

/* ---------- daftar fitur ---------- */
/* Video latar kartu jam: tetap tampil, tapi otomatis dijeda saat tidak terlihat / ada halaman terbuka / tab disembunyikan (hemat baterai & mulus) */
const HeroVid = {
  on: null, vis: true,
  init() {
    const v = $('hero-video'), h = document.querySelector('.hero'); if (!v || !h) return;
    v.muted = true; if (navigator.connection && navigator.connection.saveData) return;
    const upd = () => { const go = this.vis && !document.hidden && !(window.Sheet && Sheet.stack.length); if (go === this.on) return; this.on = go; if (go) v.play().catch(() => {}); else v.pause(); };
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { this.vis = es[0].isIntersecting; upd(); }, { threshold: .15 }).observe(h);
    document.addEventListener('visibilitychange', upd); setInterval(upd, 1000); upd();
  }
};
const CATS = [['semua', 'Semua'], ['media', 'Media'], ['islami', 'Islami'], ['info', 'Info'], ['sosmed', 'Sosmed'], ['alat', 'Alat'], ['kreasi', 'Kreasi']];
const Features = {
  list: [], flags: {},
  reg(f) { this.list.push(f); },
  get(id) { return this.list.find(f => f.id === id); },
  enabled(f) { return this.flags[f.id] !== false || App.isDev(); },
  open(id, arg) {
    const f = this.get(id); if (!f) return;
    if (!this.enabled(f)) return UI.alert('Fitur dinonaktifkan', 'Developer sedang menonaktifkan "' + f.name + '" untuk sementara.', { type: 'warn' });
    try { f.open(arg); } catch (e) { ErrLog.push(e.message, id); UI.toast('Gagal membuka ' + f.name, 'err'); console.error(e); }
    try { const s = LS.get('usage', {}); s[id] = (s[id] || 0) + 1; LS.set('usage', s); } catch (e) {}
  }
};

/* ---------- musik latar (kaset berputar) ---------- */
const Bgm = {
  el: null, wanted: true,
  init() {
    this.el = $('a-bgm'); this.wanted = !LS.get('bgm_off', false);
    Sound.reg('bgm', () => this.yield());
    const b = $('cassette'); b.onclick = () => this.toggle();
    this.el.addEventListener('play', () => this.ui()); this.el.addEventListener('pause', () => this.ui());
  },
  ui() { const on = !this.el.paused; $('cassette').classList.toggle('playing', on); $('cassette-ic').className = 'fa-solid ' + (on ? 'fa-pause' : 'fa-play'); },
  async start() {
    $('cassette').classList.remove('hidden');
    if (!this.wanted) return this.ui();
    this.el.volume = 0.7;
    try { await this.el.play(); } catch (e) {
      // browser menahan suara otomatis: nyalakan di sentuhan pertama
      const go = () => { document.removeEventListener('pointerdown', go, true); if (this.wanted && !Sound.active.size) this.el.play().catch(() => {}); };
      document.addEventListener('pointerdown', go, true); UI.toast('Ketuk layar untuk memutar musik latar', 'info');
    }
    this.ui();
  },
  yield() { try { this.el.pause(); } catch (e) {} },
  resumeIfWanted() { if (this.wanted && App.user && !Sound.active.size && this.el.paused) this.el.play().catch(() => {}); },
  toggle() { if (this.el.paused) { this.wanted = true; LS.set('bgm_off', false); Sound.active.size && Sound.play('bgm'); this.el.play().catch(() => UI.toast('Gagal memutar musik latar', 'err')); } else { this.wanted = false; LS.set('bgm_off', true); this.el.pause(); } this.ui(); },
  stop() { this.el.pause(); }
};

/* ---------- wallpaper ---------- */
const GRADS = [
  ['Senja', 'linear-gradient(160deg,#fda085,#f6d365 60%,#fbc2eb)'], ['Laut', 'linear-gradient(160deg,#0f2027,#2c5364 60%,#4ca1af)'], ['Aurora', 'linear-gradient(160deg,#0f0c29,#302b63 55%,#24c6dc)'],
  ['Sakura', 'linear-gradient(160deg,#ffd1dc,#f8b6d1 55%,#cdb4db)'], ['Hutan', 'linear-gradient(160deg,#134e5e,#2f8f6b 60%,#a8e063)'], ['Malam', 'linear-gradient(160deg,#0f172a,#1e1b4b 60%,#4c1d95)'],
  ['Mentari', 'linear-gradient(160deg,#ff9a9e,#fecfef 55%,#fad0c4)'], ['Es', 'linear-gradient(160deg,#e0eafc,#cfdef3 60%,#a1c4fd)']
];
const GLASS_BG = 'radial-gradient(60% 50% at 12% 8%,rgba(124,58,237,.8),transparent 62%),radial-gradient(55% 45% at 92% 18%,rgba(14,165,233,.65),transparent 62%),radial-gradient(65% 50% at 72% 96%,rgba(236,72,153,.6),transparent 62%),linear-gradient(160deg,#0b1020,#141a3a)';
const Wall = {
  get() { return LS.get('wall', { type: 'gradient', value: GLASS_BG, dim: 0, dark: true }); },
  isDark(w, cb) { if (w.type === 'gradient') return cb(w.dark !== undefined ? !!w.dark : /#0f|#13|#2c|#302|#1e/i.test(w.value)); if (w.type === 'video') return cb(true); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 12; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 12, 12); const d = g.getImageData(0, 0, 12, 12).data; let l = 0; for (let i = 0; i < d.length; i += 4) l += .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; cb(l / 144 < 120); } catch (e) { cb(!!w.dark); } }; im.onerror = () => cb(!!w.dark); im.src = w.value; },
  apply(w) {
    w = w || this.get(); const el = $('wallpaper'); el.style.background = ''; el.style.backgroundImage = ''; el.innerHTML = '';
    if (w.type === 'video') { el.innerHTML = `<video autoplay muted loop playsinline src="${esc(w.value)}"></video>`; const v = el.firstChild; v.play().catch(() => {}); }
    else if (w.type === 'gradient') el.style.background = w.value;
    else if (w.type === 'image') { el.style.backgroundImage = `url("${String(w.value).replace(/"/g, '%22')}")`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
    $('wallpaper-dim').style.opacity = w.dim || 0;
    this.isDark(w, d => document.body.classList.toggle('dark-wall', d || (w.dim || 0) > .45));
  },
  set(w) { if (!LS.set('wall', w)) { UI.toast('Penyimpanan perangkat penuh, gambar terlalu besar', 'err'); return false; } this.apply(w); return true; }
};

/* ---------- intro layar penuh ---------- */
const Intro = {
  active: false, finish: null,
  /* layar penuh sungguhan (bila didukung browser) — harus dipanggil dari ketukan pengguna */
  fs(on) { try { const d = document, el = d.documentElement; if (on) { if (!d.fullscreenElement && !d.webkitFullscreenElement) { const r = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen && el.webkitRequestFullscreen(); if (r && r.catch) r.catch(() => {}); } } else if (d.fullscreenElement || d.webkitFullscreenElement) { const r = d.exitFullscreen ? d.exitFullscreen() : d.webkitExitFullscreen && d.webkitExitFullscreen(); if (r && r.catch) r.catch(() => {}); } } catch (e) {} },
  /* Dipanggil dari ketukan Masuk: memanaskan video (diam & tanpa suara) supaya langsung siap saat tiba gilirannya setelah animasi centang. */
  prime() { const v = $('intro-video'); if (!v || this.active) return; this.fs(true); try { v.muted = true; v.loop = false; const p = v.play(); const back = () => { if (!this.active) { try { v.pause(); v.currentTime = 0; } catch (e) {} } }; if (p && p.then) p.then(back).catch(() => {}); } catch (e) {} },
  msg(t) { const m = $('intro-msg'); if (!m) return; m.textContent = t || ''; m.classList.toggle('hidden', !t); },
  /* Diputar otomatis (dengan suara) setelah animasi centang berhasil-login, layar penuh. Gagal muat → coba ulang sekali → tampilkan alasannya lalu lanjut ke dasbor. */
  play() {
    return new Promise(resolve => {
      const ov = $('intro'), v = $('intro-video'), A = CONFIG.ASSETS, srcs = [A.INTRO_LOCAL, A.INTRO_VIDEO, A.INTRO_VIDEO + (A.INTRO_VIDEO.includes('?') ? '&' : '?') + 'r=' + Date.now()].filter(Boolean);
      this.active = true; Sound.play('intro'); this.fs(true);
      let idx = -1, seen = false, last = Date.now(), wd = null, ld = null;
      const done = () => { if (!this.active) return; this.active = false; clearInterval(wd); clearTimeout(ld); v.onended = v.onerror = v.onplaying = v.ontimeupdate = v.onprogress = v.onloadeddata = null; try { v.pause(); } catch (e) {} ov.classList.add('hidden'); $('intro-tap').classList.add('hidden'); this.msg(''); document.body.classList.remove('no-scroll'); Sound.release('intro'); Intro.fs(false); resolve(); };
      const fail = () => { if (!this.active) return; clearInterval(wd); $('intro-tap').classList.add('hidden'); const c = v.error ? v.error.code : 0; this.msg('Video intro gagal dimuat' + (c ? ' (kode ' + c + (c === 4 ? ': format/alamat tidak didukung' : c === 3 ? ': gagal diputar' : c === 2 ? ': jaringan' : '') + ')' : '') + '. Melanjutkan…'); setTimeout(done, 3500); };
      const next = () => { if (!this.active) return; if (idx >= srcs.length - 1) return fail(); attempt(idx + 1); };
      const attempt = i => {
        idx = i; seen = false; last = Date.now(); clearInterval(wd); clearTimeout(ld);
        if (i > 0 || v.error || v.networkState === 3 || v.getAttribute('src') !== srcs[0]) { v.src = srcs[i]; try { v.load(); } catch (e) {} }
        try { v.currentTime = 0; } catch (e) {} v.loop = false; v.muted = false; v.volume = 1;
        ld = setTimeout(() => { if (!seen && this.active && i === idx && $('intro-tap').classList.contains('hidden')) this.msg('Memuat video…'); }, 900);
        wd = setInterval(() => { if (!seen && this.active && i === idx && $('intro-tap').classList.contains('hidden') && Date.now() - last > 20000) next(); }, 2000);
        const bad = er => { if (!this.active || i !== idx) return true; if (er && er.name === 'NotSupportedError') { next(); return true; } return !!(er && er.name === 'AbortError'); };
        const p = v.play();
        if (p && p.catch) p.catch(er => {
          if (bad(er)) return;
          v.muted = true; const q = v.play();
          if (q && q.catch) q.catch(er2 => { if (bad(er2)) return; this.msg(''); $('intro-tap').classList.remove('hidden'); });
          const un = () => { document.removeEventListener('pointerdown', un, true); v.muted = false; v.volume = 1; }; document.addEventListener('pointerdown', un, true);
        });
      };
      this.finish = done; ov.classList.remove('hidden'); document.body.classList.add('no-scroll'); $('intro-bar').style.width = '0';
      v.onended = done; v.onerror = () => { if (this.active) next(); };
      v.onprogress = v.onloadeddata = () => { last = Date.now(); };
      const live = () => { seen = true; clearTimeout(ld); this.msg(''); $('intro-tap').classList.add('hidden'); };
      v.ontimeupdate = () => { last = Date.now(); if (v.currentTime > 0.05 && !v.paused) live(); if (v.duration) $('intro-bar').style.width = (v.currentTime / v.duration * 100) + '%'; };
      v.onplaying = live;
      const dbg = $('intro-dbg'); const dt = setInterval(() => { if (!this.active) return clearInterval(dt); if (dbg) dbg.textContent = (idx + 1) + '/' + srcs.length + ' · ' + (v.videoWidth || 0) + '×' + (v.videoHeight || 0) + ' · ' + (isFinite(v.duration) ? v.duration.toFixed(1) : '?') + 'd · rs' + v.readyState + ' ns' + v.networkState + ' e' + (v.error ? v.error.code : 0); }, 400);
      $('intro-tap').onclick = () => { v.muted = false; v.volume = 1; const q = v.play(); if (q && q.then) q.then(() => $('intro-tap').classList.add('hidden')).catch(() => next()); };
      $('intro-skip').onclick = done;
      attempt(0);
    });
  },
  abort() { if (this.active && this.finish) this.finish(); }
};

/* ---------- aplikasi ---------- */
const App = {
  user: null, mode: 'login', busy: false,
  isDev() { return !!this.user && String(this.user.role).toLowerCase() === 'developer'; },

  async boot() {
    Bgm.init(); Wall.apply(); this.bindAuth(); this.bindDock();
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.installEv = e; });
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
    await FB.init();
    const s = getSession(); let found = null;
    try {
      if (s.username) {
        if (FB.mode === 'firebase') found = await FB.restore(s);
        else found = LocalAuth.users().find(u => u.k === userKey(s.username)) || null;
      }
    } catch (e) { if (e.status === undefined || e.status >= 500) found = { username: s.username, role: s.role || 'Gratis' }; /* tanpa internet: percaya sesi */ }
    if (found) { this.user = { username: found.username || found.u, role: found.role, created: found.created }; await this.enter(false); }
    else { LS.del('session'); this.showAuth(); }
  },

  /* ----- layar login ----- */
  bindAuth() {
    $('tab-login').onclick = () => this.setMode('login'); $('tab-register').onclick = () => this.setMode('register');
    $('a-eye').onclick = () => { const i = $('a-pass'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; $('a-pass2').classList.toggle('show', show); $('a-eye').innerHTML = `<i class="fa-regular ${show ? 'fa-eye-slash' : 'fa-eye'}"></i>`; };
    $('auth-form').addEventListener('submit', e => { e.preventDefault(); this.submit(); });
    $('auth-sound').onclick = () => this.toggleAuthSound();
  },
  setMode(m) {
    this.mode = m; const reg = m === 'register';
    $('tab-login').classList.toggle('on', !reg); $('tab-register').classList.toggle('on', reg);
    $('a-pass2-wrap').classList.toggle('hidden', !reg); $('a-hint').classList.toggle('hidden', !reg);
    $('a-submit').firstElementChild.textContent = reg ? 'Buat Akun' : 'Masuk';
    $('a-pass').autocomplete = reg ? 'off' : 'current-password'; $('a-pass').name = reg ? 'sandi_baru' : 'password'; this.authErr('');
  },
  authErr(t) { const e = $('auth-err'); e.textContent = t || ''; e.classList.toggle('hidden', !t); },
  setSoundUi(on) { $('auth-sound').innerHTML = on ? '<i class="fa-solid fa-volume-high"></i><span>Suara aktif</span>' : '<i class="fa-solid fa-volume-xmark"></i><span>Ketuk untuk suara</span>'; },
  showAuth() {
    const a = $('auth'), v = $('auth-video'); a.classList.remove('hidden'); $('cassette').classList.add('hidden');
    v.loop = true; v.muted = false; v.volume = 1;
    const p = v.play();
    const muted = () => { v.muted = true; v.play().catch(() => {}); this.setSoundUi(false);
      const once = () => { document.removeEventListener('pointerdown', once, true); document.removeEventListener('keydown', once, true); if (!a.classList.contains('hidden') && !Intro.active) { v.muted = false; v.volume = 1; v.play().then(() => this.setSoundUi(true)).catch(() => {}); } };
      document.addEventListener('pointerdown', once, true); document.addEventListener('keydown', once, true); };
    if (p && p.then) p.then(() => this.setSoundUi(true)).catch(muted); else muted();
    Sound.reg('auth', () => { try { v.pause(); } catch (e) {} });
  },
  toggleAuthSound() { const v = $('auth-video'); if (v.muted) { v.muted = false; v.volume = 1; v.play().catch(() => {}); this.setSoundUi(true); } else { v.muted = true; this.setSoundUi(false); } },
  hideAuth() { const v = $('auth-video'); $('auth').classList.add('hidden'); try { v.pause(); v.currentTime = 0; } catch (e) {} },

  async submit() {
    if (this.busy) return;
    const username = $('a-user').value.trim(), pw = $('a-pass').value, reg = this.mode === 'register';
    if (!NAME_RE.test(username)) return this.authErr(NAME_HELP);
    if (pw.length < 4) return this.authErr('Kata sandi minimal 4 karakter.');
    if (reg && pw !== $('a-pass2').value) return this.authErr('Konfirmasi kata sandi tidak sama.');
    this.authErr(''); this.busy = true; Intro.prime();
    const btn = $('a-submit'); const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i><span>Memproses…</span>';
    try {
      const r = FB.mode === 'firebase' ? await FB.login(username, pw, this.mode) : LocalAuth.login(username, pw, this.mode);
      this.user = { username: r.user.username || r.user.u, role: r.user.role, created: r.user.created };
      LS.set('session', r.session);
      { const ban = await Ban.get(userKey(this.user.username)); if (ban && !this.isDev()) { Intro.abort(); this.hideAuth(); this.showBan(ban); return; } }
      await this.welcome(r.created);
      this.hideAuth();
      await Intro.play();
      await this.enter(true);
    } catch (e) {
      Intro.abort();
      this.authErr(e.userMessage || (e.message === 'Waktu habis, server lambat' ? e.message : 'Tidak bisa terhubung. Periksa internet lalu coba lagi.'));
      ErrLog.push(e.message, 'auth');
    } finally { this.busy = false; btn.disabled = false; btn.innerHTML = old; }
  },
  async welcome(created) {
    const w = $('welcome'); $('w-title').textContent = created ? 'Akun berhasil dibuat!' : 'Selamat datang kembali!';
    $('w-sub').textContent = created ? `Halo, ${this.user.username}. Akunmu siap dipakai.` : `Senang melihatmu lagi, ${this.user.username}.`;
    const c = $('confetti'); c.innerHTML = ''; const cols = ['#ffd23f', '#f43f5e', '#22c55e', '#38bdf8', '#a78bfa', '#fb923c'];
    for (let i = 0; i < 46; i++) { const p = document.createElement('i'); p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-duration:${1.8 + Math.random() * 1.8}s;animation-delay:${Math.random() * .5}s;transform:rotate(${Math.random() * 360}deg)`; c.appendChild(p); }
    w.classList.remove('hidden'); await sleep(created ? 1900 : 1300); w.classList.add('hidden');
  },

  /* ----- masuk ke dasbor ----- */
  async enter(fresh) {
    { const ban = await Ban.get(userKey(this.user.username)); if (ban && !this.isDev()) { this.hideAuth(); return this.showBan(ban); } }
    this.hideAuth(); $('app').classList.remove('hidden'); $('dock').classList.remove('hidden');
    $('u-name').textContent = this.user.username; $('u-role').textContent = this.user.role;
    $('btn-dev').classList.toggle('hidden', !this.isDev());
    const h = new Date().getHours(); $('u-greet').textContent = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
    HeroVid.init();
this.renderTabs(); this.renderTiles(); { const fq = $('f-q'); if (fq) fq.oninput = e => { this.q = e.target.value.trim(); this.renderTiles(); }; } this.tickClock(); setInterval(() => this.tickClock(), 1000);
    Adzan.init(); this.pollCfg(); setInterval(() => this.pollCfg(), 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.pollCfg(); });
    Bgm.start();
    if (fresh && this.installEv && !LS.get('install_asked')) { LS.set('install_asked', 1); }
  },
  tickClock() { const n = new Date(); $('clock').textContent = n.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':'); $('date').textContent = n.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); Adzan.tick && Adzan.tick(); },

  cat: 'semua',
  renderTabs() { $('cat-tabs').innerHTML = CATS.map(([k, l]) => `<button class="chip ${k === this.cat ? 'on' : ''}" data-c="${k}">${l}</button>`).join(''); $('cat-tabs').querySelectorAll('button').forEach(b => b.onclick = () => { this.cat = b.dataset.c; this.renderTabs(); this.renderTiles(); }); },
  renderTiles() {
    const q = String(this.q || '').toLowerCase(); $('tiles').classList.toggle('searching', !!q);
    const list = Features.list.filter(f => !f.dev && (!f.devOnly || this.isDev()) && (q ? String(f.name).toLowerCase().includes(q) : (this.cat === 'semua' || f.cat === this.cat)));
    const usage = LS.get('usage', {});
    const sorted = this.cat === 'semua' ? [...list] : list;
    $('tiles').innerHTML = (this.cat === 'semua' ? '<div class="sec-title"><i class="fa-solid fa-sparkles" style="color:#f59e0b"></i>Semua fitur</div>' : '') + `<div class="tile-grid">${sorted.map(f => `<button class="tile ${Features.enabled(f) ? '' : 'off'}" data-f="${f.id}" style="--c:${(String(f.grad).match(/#[0-9a-fA-F]{3,8}/) || ['#6366f1'])[0]}">${Ico.has(f.id) ? `<div class="ic ic2">${Ico.svg(f.id, 26)}</div>` : `<div class="ic" style="background:${f.grad}"><i class="fa-solid ${f.icon}"></i></div>`}<span>${esc(f.name)}</span><i class="dot"></i></button>`).join('')}</div>`;
    $('tiles').querySelectorAll('.tile').forEach(t => t.onclick = () => Features.open(t.dataset.f));
  },

  /* ----- konfigurasi global dari Developer ----- */
  async pollCfg() {
    if (!this.user || this.banned) return;
    try {
      if (!this.isDev()) { const ban = await Ban.get(userKey(this.user.username)); if (ban) return this.showBan(ban); }
      const [ann, mt, fl] = await Promise.all([Cfg.get('announcement'), Cfg.get('maintenance'), Cfg.get('flags')]);
      const a = $('announce'); if (ann && ann.on && ann.text) { $('announce-text').textContent = ann.text; a.classList.remove('hidden'); } else a.classList.add('hidden');
      Features.flags = fl && typeof fl === 'object' ? fl : {}; this.renderTiles();
      const on = !!(mt && mt.on) && !this.isDev(); $('maint').classList.toggle('hidden', !on); if (mt && mt.msg) $('maint-msg').textContent = mt.msg;
    } catch (e) {}
  },

  showBan(ban) {
    try { Bgm.stop(); Music.stop(); Adzan.stopRing && Adzan.stopRing(); } catch (e) {}
    while (Sheet.stack.length) Sheet.close(null, true);
    ['app', 'dock', 'cassette', 'mini', 'maint', 'auth', 'intro', 'welcome'].forEach(id => $(id) && $(id).classList.add('hidden'));
    $('ban-reason').textContent = (ban && ban.reason) ? 'Alasan: ' + ban.reason : 'Hubungi admin untuk informasi lebih lanjut.';
    $('ban-wa').href = `https://wa.me/${CONFIG.ADMIN_WA}?text=${encodeURIComponent('Halo Admin, akun saya (' + this.user.username + ') diblokir. Mohon bantuannya.')}`;
    $('banned').classList.remove('hidden'); this.banned = true;
  },
  leave() { LS.del('session'); location.reload(); },

  /* ----- navigasi & menu ----- */
  bindDock() { $('dock').querySelectorAll('button').forEach(b => b.onclick = () => { const n = b.dataset.nav; if (n === 'home') window.scrollTo({ top: 0, behavior: 'smooth' }); else if (n === 'menu') this.openMenu(); else Features.open(n); }); },
  openMenu() {
    const u = this.user; if (!u) return;
    Sheet.open({ id: 'menu', title: 'Akun & Pengaturan', icon: 'fa-user', grad: 'linear-gradient(135deg,#4f46e5,#7c3aed)', body: `
      <div class="card" style="padding:16px;display:flex;gap:12px;align-items:center"><div class="avatar" style="width:54px;height:54px;font-size:22px">${esc(u.username.charAt(0).toUpperCase())}</div><div><b style="font-size:16px">${esc(u.username)}</b><div class="row" style="margin-top:4px"><span class="tag">${esc(u.role)}</span>${this.isDev() ? '<span class="dev-badge">Akses penuh</span>' : ''}</div></div></div>
      <div class="card" style="padding:6px 14px">
        <div class="kv" style="align-items:center"><span><i class="fa-solid fa-music"></i>&nbsp; Musik latar</span><button class="switch ${Bgm.wanted ? 'on' : ''}" id="m-bgm"></button></div>
        <div class="kv" style="align-items:center"><span><i class="fa-solid fa-bolt"></i>&nbsp; Mode ringan (lebih mulus)</span><button class="switch ${document.documentElement.classList.contains('lite') ? 'on' : ''}" id="m-lite"></button></div>
      </div>
      <button class="btn" id="m-wall" style="justify-content:flex-start"><i class="fa-regular fa-image"></i> Ganti wallpaper</button>
      <button class="btn" id="m-adzan" style="justify-content:flex-start"><i class="fa-solid fa-bell"></i> Pengaturan adzan & lokasi</button>
      <button class="btn" id="m-pass" style="justify-content:flex-start"><i class="fa-solid fa-key"></i> Ganti kata sandi</button>
      ${this.installEv ? '<button class="btn" id="m-install" style="justify-content:flex-start"><i class="fa-solid fa-download"></i> Pasang di layar utama</button>' : ''}
      <a class="btn" style="justify-content:flex-start" target="_blank" rel="noopener" href="https://wa.me/${CONFIG.ADMIN_WA}?text=${encodeURIComponent('Halo Admin, saya ingin melaporkan kendala pada web.')}"><i class="fa-solid fa-triangle-exclamation"></i> Lapor masalah ke admin</a>
      <button class="btn btn-danger" id="m-out" style="justify-content:flex-start"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>
      <div class="muted" style="text-align:center;font-size:11px;font-weight:700;margin-top:4px">Dimzz Prozet v${CONFIG.VERSION}</div>`,
      onOpen: el => {
        el.querySelector('#m-bgm').onclick = e => { Bgm.toggle(); e.currentTarget.classList.toggle('on', Bgm.wanted); };
        el.querySelector('#m-lite').onclick = e => { const r = document.documentElement.classList, on = !r.contains('lite'); r.toggle('lite', on); try { localStorage.setItem('dimzz_lite', on ? '1' : '0'); } catch (x) {} e.currentTarget.classList.toggle('on', on); UI.toast(on ? 'Mode ringan aktif' : 'Mode ringan mati (efek penuh)', 'ok'); };
        el.querySelector('#m-wall').onclick = () => Features.open('wallpaper'); el.querySelector('#m-adzan').onclick = () => Features.open('adzan');
        el.querySelector('#m-pass').onclick = () => this.changePass(); el.querySelector('#m-out').onclick = () => this.logout();
        const i = el.querySelector('#m-install'); if (i) i.onclick = () => { this.installEv.prompt(); };
      } });
  },
  async changePass() {
    const p = await UI.prompt('Ganti kata sandi', 'Masukkan kata sandi baru (minimal 4 karakter).', { type: 'password', placeholder: 'Kata sandi baru', ok: 'Simpan' });
    if (p === null) return; if (p.length < 4) return UI.toast('Minimal 4 karakter', 'warn');
    try { if (FB.mode === 'firebase') await FB.changePassword(p); else { const us = LocalAuth.users(), f = us.find(x => x.k === userKey(this.user.username)); if (f) { f.h = sha256Hex(`local|${f.k}|${p}`); LS.set('users', us); } } UI.alert('Kata sandi diperbarui', 'Gunakan kata sandi baru saat masuk berikutnya.', { type: 'ok' }); }
    catch (e) { UI.toast(e.userMessage || 'Gagal menyimpan', 'err'); }
  },
  async logout() {
    if (!await UI.confirm('Keluar dari akun?', 'Kamu perlu masuk lagi untuk memakai aplikasi.', { ok: 'Keluar', danger: true, icon: 'fa-right-from-bracket' })) return;
    try { if (window.Push) await Push.forget(); } catch (e) {}
    LS.del('session'); location.reload();
  }
};
