/* ==== 08-photos-camera.js — Foto (Pinterest), Wallpaper, Kamera dengan filter & efek ==== */
const Photos = {
  items: [], cursor: '', q: '', loading: false, done: false,
  open() {
    Sheet.open({ id: 'photos', title: 'Foto (Pinterest)', icon: 'fa-image', grad: 'linear-gradient(135deg,#ec4899,#be185d)', body: `${searchBar('ph-q', 'Cari foto… contoh: aesthetic, kucing, anime')}<div class="h-scroll">${['Aesthetic', 'Pemandangan', 'Anime', 'Kucing', 'Mobil', 'Kuliner', 'Fashion', 'Quotes', 'Interior', 'Tato'].map(c => `<button class="chip" data-s="${c}">${c}</button>`).join('')}</div><div id="ph-out">${emptyHtml('fa-image', 'Cari ide & foto dari Pinterest. Sentuh foto untuk memperbesar, lalu unduh.')}</div><div id="ph-more" class="empty hidden"></div>` });
    bindSearch('ph-q', () => this.search($('ph-q').value.trim()));
    $('sheet-photos').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { $('ph-q').value = b.dataset.s; this.search(b.dataset.s); });
    const body = Sheet.$('photos'); body.addEventListener('scroll', () => { if (body.scrollTop + body.clientHeight > body.scrollHeight - 500) this.more(); });
  },
  async search(q) {
    if (!q) return; Object.assign(this, { items: [], cursor: '', q, done: false }); $('ph-out').innerHTML = loadingHtml('Mencari foto…'); await this.more(true);
  },
  async more(first) {
    if (this.loading || this.done || !this.q) return; this.loading = true;
    try {
      const j = await API.get('photos', { q: this.q, c: this.cursor }, 30000); this.cursor = j.next; if (!j.next) this.done = true;
      const have = new Set(this.items.map(i => i.id)); const fresh = j.items.filter(i => !have.has(i.id)); const start = this.items.length; this.items.push(...fresh);
      if (first) $('ph-out').innerHTML = '<div class="masonry" id="ph-grid"></div>';
      if (!this.items.length) { $('ph-out').innerHTML = emptyHtml('fa-face-sad-tear', 'Foto tidak ditemukan. Coba kata kunci lain.'); return; }
      $('ph-grid').insertAdjacentHTML('beforeend', fresh.map((p, k) => `<div class="ph" data-i="${start + k}"><img src="${esc(p.thumb)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.closest('.ph').remove()" alt="${esc(p.title)}"/><div class="acts"><button data-dl="${start + k}" aria-label="Unduh"><i class="fa-solid fa-download"></i></button></div></div>`).join(''));
      $('ph-grid').querySelectorAll('.ph:not([data-b])').forEach(e => { e.dataset.b = 1; e.onclick = ev => { const d = ev.target.closest('[data-dl]'); if (d) { ev.stopPropagation(); this.download(+d.dataset.dl, d); } else this.view(+e.dataset.i); }; });
      const m = $('ph-more'); m.classList.toggle('hidden', !this.done); m.textContent = this.done ? 'Sudah semua hasil.' : '';
      if (!first && !fresh.length && !this.done) { this.loading = false; return this.more(); }
    } catch (e) { if (first) $('ph-out').innerHTML = errHtml(e.message || 'Gagal memuat foto') + '<div style="text-align:center"><button class="btn" id="ph-r">Coba lagi</button></div>', $('ph-r').onclick = () => this.search(this.q); else UI.toast('Gagal memuat lagi: ' + e.message, 'warn'); }
    finally { this.loading = false; }
  },
  view(i) {
    const p = this.items[i]; if (!p) return;
    Sheet.open({ id: 'phview', title: 'Foto', icon: 'fa-image', grad: 'linear-gradient(135deg,#ec4899,#be185d)', full: true, body: `<img id="pv-img" src="${esc(p.thumb)}" referrerpolicy="no-referrer" style="width:100%;border-radius:16px;background:#e2e8f0" alt=""/><div style="font-weight:700;font-size:13px">${esc(p.title)}</div><div class="row"><button class="btn btn-pri" style="flex:1" id="pv-dl"><i class="fa-solid fa-download"></i> Unduh</button><button class="btn" style="flex:1" id="pv-wp"><i class="fa-regular fa-image"></i> Jadikan wallpaper</button></div>${p.page ? `<a class="btn" target="_blank" rel="noopener" href="${esc(safeUrl(p.page))}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka sumber</a>` : ''}` });
    const im = new Image(); im.referrerPolicy = 'no-referrer'; im.onload = () => { const e = $('pv-img'); if (e) e.src = p.full; }; im.src = p.full;
    $('pv-dl').onclick = e => this.download(i, e.currentTarget); $('pv-wp').onclick = () => { Wall.set({ type: 'image', value: p.full, dim: 0.15 }); UI.toast('Wallpaper diganti', 'ok'); };
  },
  download(i, btn) { const p = this.items[i]; saveFile(p.dl, safeName(p.title).slice(0, 40) + '.jpg', btn); }
};
Features.reg({ id: 'photos', name: 'Pinterest', cat: 'media', icon: 'fa-image', grad: 'linear-gradient(135deg,#ec4899,#be185d)', open: () => Photos.open() });

/* ---------- Wallpaper ---------- */
const Wallpaper = {
  open() {
    const cur = Wall.get();
    Sheet.open({ id: 'wallpaper', title: 'Ganti Wallpaper', icon: 'fa-regular fa-image'.replace('fa-regular ', ''), grad: 'linear-gradient(135deg,#0ea5e9,#6366f1)', body: `${seg('wp-seg', [['preset', 'Pilihan'], ['upload', 'Dari galeri'], ['online', 'Cari online']], 'preset')}
      <div class="card" style="padding:12px 14px"><div class="row" style="justify-content:space-between"><b style="font-size:12px">Redupkan latar</b><span id="wp-dv" class="muted" style="font-size:11px;font-weight:800">${Math.round((cur.dim || 0) * 100)}%</span></div><input type="range" id="wp-dim" min="0" max="70" value="${Math.round((cur.dim || 0) * 100)}" style="width:100%;margin-top:6px"/></div><div id="wp-out"></div>` });
    { const gi = $('sheet-wallpaper').querySelector('.gi i'); if (gi) gi.className = 'fa-regular fa-image'; }
    bindSeg('wp-seg', k => this.tab(k)); $('wp-dim').oninput = e => { const w = { ...Wall.get(), dim: e.target.value / 100 }; $('wp-dv').textContent = e.target.value + '%'; $('wallpaper-dim').style.opacity = w.dim; clearTimeout(this._t); this._t = setTimeout(() => LS.set('wall', w), 300); };
    this.tab('preset');
  },
  tab(k) {
    const out = $('wp-out');
    if (k === 'preset') {
      out.innerHTML = `<div class="grid grid-cols-3 gap-2"><div class="wp-card" data-d style="background:${GLASS_BG}"><span>Bawaan (kaca)</span></div><div class="wp-card" data-v style="background:#111;display:grid;place-items:center;color:#fff;font-size:26px"><i class="fa-solid fa-film"></i><span>Animasi bawaan</span></div>${GRADS.map(([n, g], i) => `<div class="wp-card" data-g="${i}" style="background:${g}"><span>${n}</span></div>`).join('')}<div class="wp-card" data-n style="background:#e2e8f0;display:grid;place-items:center;font-size:24px;color:#64748b"><i class="fa-solid fa-ban"></i><span style="color:#fff">Polos</span></div></div>`;
      out.querySelector('[data-d]').onclick = () => { Wall.set({ type: 'gradient', value: GLASS_BG, dim: 0, dark: true }); UI.toast('Wallpaper bawaan dipasang', 'ok'); };
      out.querySelector('[data-v]').onclick = () => { Wall.set({ type: 'video', value: CONFIG.ASSETS.DEFAULT_WALLPAPER_VIDEO, dim: Wall.get().dim }); UI.toast('Wallpaper animasi dipasang', 'ok'); };
      out.querySelectorAll('[data-g]').forEach(e => e.onclick = () => { Wall.set({ type: 'gradient', value: GRADS[+e.dataset.g][1], dim: Wall.get().dim, dark: ['Laut','Aurora','Hutan','Malam'].includes(GRADS[+e.dataset.g][0]) }); UI.toast('Wallpaper diganti', 'ok'); });
      out.querySelector('[data-n]').onclick = () => { Wall.set({ type: 'gradient', value: 'linear-gradient(160deg,#e8edf5,#f4efe3)', dim: 0 }); };
    } else if (k === 'upload') {
      out.innerHTML = `<label class="btn btn-pri" style="display:flex;padding:1.2rem;cursor:pointer"><i class="fa-solid fa-upload"></i> Pilih foto dari galeri<input type="file" accept="image/*" id="wp-file" class="hidden"/></label><div class="muted" style="font-size:11px;font-weight:600;margin-top:8px">Foto diperkecil otomatis dan disimpan di perangkat ini saja.</div>`;
      $('wp-file').onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const url = await this.shrink(f); if (Wall.set({ type: 'image', value: url, dim: Wall.get().dim })) UI.toast('Wallpaper dipasang', 'ok'); } catch (x) { UI.toast('Gagal membaca gambar', 'err'); } };
    } else {
      out.innerHTML = `${searchBar('wp-q', 'Cari wallpaper… contoh: anime, alam, galaxy')}<div class="h-scroll" style="margin:8px 0">${['Galaxy', 'Alam', 'Anime', 'Kota malam', 'Minimalis', 'Gunung', 'Pantai', 'Abstrak'].map(c => `<button class="chip" data-s="${c}">${c}</button>`).join('')}</div><div id="wp-res" class="grid grid-cols-3 gap-2"></div>`;
      const go = async q => { if (!q) return; $('wp-res').innerHTML = `<div style="grid-column:1/-1">${loadingHtml('Mencari…')}</div>`; try { const j = await API.get('photos', { q: q + ' wallpaper hd vertical' }, 30000); $('wp-res').innerHTML = j.items.slice(0, 30).map((p, i) => `<div class="wp-card" data-i="${i}" style="background-image:url('${esc(p.thumb)}')"></div>`).join(''); $('wp-res').querySelectorAll('[data-i]').forEach(c => c.onclick = () => this.setUrl(j.items[+c.dataset.i])); } catch (e) { $('wp-res').innerHTML = `<div style="grid-column:1/-1">${errHtml(e.message)}</div>`; } };
      bindSearch('wp-q', () => go($('wp-q').value.trim())); out.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { $('wp-q').value = b.dataset.s; go(b.dataset.s); });
    }
  },
  setUrl(p) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.onload = () => { Wall.set({ type: 'image', value: p.full, dim: Wall.get().dim }); UI.toast('Wallpaper dipasang', 'ok'); }; im.onerror = () => { Wall.set({ type: 'image', value: p.thumb, dim: Wall.get().dim }); UI.toast('Dipasang (resolusi sedang)', 'ok'); }; im.src = p.full; },
  shrink(file, max = 1280) { return new Promise((res, rej) => { const im = new Image(), u = URL.createObjectURL(file); im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.8)); }; im.onerror = rej; im.src = u; }); }
};
Features.reg({ id: 'wallpaper', name: 'Wallpaper', cat: 'kreasi', icon: 'fa-panorama', grad: 'linear-gradient(135deg,#0ea5e9,#6366f1)', open: () => Wallpaper.open() });

/* ---------- Kamera: filter + efek animasi ---------- */
const CAM_FILTERS = [
  ['normal', 'Normal', 'none'], ['cantik', 'Cantik ✨', 'brightness(1.08) saturate(1.1)', { smooth: 1, tint: ['rgba(255,190,205,.16)', 'soft-light'] }], ['cerah', 'Cerah', 'brightness(1.12) contrast(1.06) saturate(1.2)'],
  ['pastel', 'Pastel', 'brightness(1.14) contrast(.88) saturate(.95)', { tint: ['rgba(255,190,220,.2)', 'soft-light'] }], ['hangat', 'Hangat', 'sepia(.22) saturate(1.4) hue-rotate(-8deg) brightness(1.04)', { tint: ['rgba(255,150,60,.14)', 'soft-light'] }],
  ['dingin', 'Dingin', 'saturate(1.2) hue-rotate(-12deg) brightness(1.03)', { tint: ['rgba(60,140,255,.16)', 'soft-light'] }], ['cinema', 'Sinema', 'contrast(1.2) saturate(1.1) brightness(.95)', { tint: ['rgba(0,120,160,.18)', 'soft-light'], bars: 1 }],
  ['vintage', 'Vintage', 'sepia(.6) contrast(1.1) brightness(.96) saturate(1.3)', { grain: 1 }], ['bw', 'Hitam Putih', 'grayscale(1) contrast(1.18)'], ['drama', 'Drama', 'contrast(1.38) saturate(1.3) brightness(.92)', { vig: 1 }],
  ['neon', 'Neon', 'saturate(2.3) contrast(1.22) hue-rotate(18deg)', { tint: ['rgba(255,0,200,.14)', 'overlay'] }], ['sunset', 'Sunset', 'sepia(.3) saturate(1.7) hue-rotate(-18deg)', { tint: ['rgba(255,90,60,.22)', 'soft-light'] }], ['vhs', 'VHS', 'contrast(1.2) saturate(1.5) brightness(1.02)', { scan: 1, grain: 1 }]
];
const CAM_FX = [['none', 'Tanpa', '🚫'], ['glitch', 'Glitch', '📺'], ['pixel', 'Mosaik', '🟦'], ['kaleido', 'Cermin', '🪞'], ['pulse', 'Denyut', '💓'], ['echo', 'Bayangan', '👻'], ['leak', 'Cahaya', '🌈'], ['bokeh', 'Bokeh', '🔮'], ['snow', 'Salju', '❄️'], ['hearts', 'Hati', '💖'], ['sparkle', 'Kilau', '✨'], ['confetti', 'Konfeti', '🎉'], ['bubble', 'Gelembung', '🫧'], ['polaroid', 'Polaroid', '📸'], ['strobe', 'Disko', '🪩']];
const Cam = {
  stream: null, facing: 'user', res: 'hd', fi: 0, fx: 'none', mirror: true, grid: false, timer: 0, torch: false, raf: 0, parts: [], rec: null, chunks: [], recStart: 0, last: null, mode: 'photo', busy: false, tab: 'filter', prev: null, t0: 0, smooth: 0.6,
  RES: { sd: [640, 480, 'SD'], hd: [1280, 720, 'HD'], fhd: [1920, 1080, 'FHD'] },
  supportsFilter: (() => { try { return 'filter' in CanvasRenderingContext2D.prototype; } catch (e) { return false; } })(),
  async open() {
    if (!$('cam')) { const el = document.createElement('section'); el.id = 'cam'; document.body.appendChild(el); this.build(el); history.pushState({ sheet: 'cam' }, ''); Sheet.stack.push({ id: 'cam', el, onClose: () => this.close(true) }); }
    Sound.play('cam'); Sound.reg('cam', () => {}); this.t0 = performance.now(); await this.start();
  },
  build(el) {
    el.innerHTML = `<div class="cam-stage"><video id="cam-v" playsinline muted autoplay class="hidden"></video><canvas id="cam-c"></canvas><div id="cam-grid" class="hidden" style="position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(to right,transparent 33%,rgba(255,255,255,.35) 33%,rgba(255,255,255,.35) calc(33% + 1px),transparent calc(33% + 1px),transparent 66%,rgba(255,255,255,.35) 66%,rgba(255,255,255,.35) calc(66% + 1px),transparent calc(66% + 1px)),linear-gradient(to bottom,transparent 33%,rgba(255,255,255,.35) 33%,rgba(255,255,255,.35) calc(33% + 1px),transparent calc(33% + 1px),transparent 66%,rgba(255,255,255,.35) 66%,rgba(255,255,255,.35) calc(66% + 1px),transparent calc(66% + 1px))"></div>
      <div id="cam-count" class="hidden" style="position:absolute;inset:0;display:grid;place-items:center;font-size:9rem;font-weight:800;text-shadow:0 0 30px #000;pointer-events:none"></div><div id="cam-msg" class="hidden" style="position:absolute;inset:0;display:grid;place-items:center;padding:28px;text-align:center;background:rgba(0,0,0,.85);font-size:13px;font-weight:600;line-height:1.6;z-index:5"></div>
      <div class="cam-top"><button class="btn btn-icon" style="background:rgba(0,0,0,.45);color:#fff;border:0!important" id="cam-x"><i class="fa-solid fa-xmark"></i></button><div class="row"><span id="cam-rec" class="hidden chip" style="background:#dc2626;color:#fff;border:0"><i class="fa-solid fa-circle" style="font-size:7px"></i><span id="cam-rt">00:00</span></span><span id="cam-badge" class="chip" style="background:rgba(0,0,0,.45);color:#fff;border:0">HD</span></div><button class="btn btn-icon hidden" id="cam-torch" style="background:rgba(0,0,0,.45);color:#fff;border:0!important"><i class="fa-solid fa-bolt"></i></button></div>
      <div class="cam-side"><button id="cs-flip"><i class="fa-solid fa-camera-rotate"></i><small>Balik</small></button><button id="cs-timer"><i class="fa-solid fa-stopwatch"></i><small id="cs-tl">Timer</small></button><button id="cs-res"><i class="fa-solid fa-expand"></i><small id="cs-rl">HD</small></button><button id="cs-mirror"><i class="fa-solid fa-left-right"></i><small>Cermin</small></button><button id="cs-grid"><i class="fa-solid fa-table-cells"></i><small>Grid</small></button></div></div>
      <div class="cam-bottom"><div class="row" style="justify-content:center;gap:18px;font-size:11px;font-weight:800;margin-bottom:2px"><button id="ct-filter" class="chip on" style="background:transparent;border:0;color:#fff;font-weight:800">FILTER</button><button id="ct-fx" class="chip" style="background:transparent;border:0;color:#9ca3af;font-weight:800">EFEK</button></div>
        <div class="fx-row" id="cam-fx"></div>
        <div class="row" style="justify-content:space-around;padding:0 12px"><button id="cam-th" class="btn btn-icon" style="background:rgba(255,255,255,.15);border:0!important;overflow:hidden;color:#fff;width:48px;height:48px"><i class="fa-regular fa-image"></i></button><div class="row" style="flex-direction:column;gap:6px"><button class="shutter" id="cam-sh"><i></i></button><div class="row" style="gap:16px;font-size:11px;font-weight:800"><button id="cm-photo" style="border:0;background:none;color:var(--acc)">FOTO</button><button id="cm-video" style="border:0;background:none;color:#9ca3af">VIDEO</button></div></div><div style="width:48px"></div></div></div>
      <div id="cam-res" class="hidden" style="position:absolute;inset:0;z-index:8;background:rgba(0,0,0,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:16px"><div id="cam-resm" style="max-width:100%;max-height:68vh;display:flex"></div><div class="row"><button class="btn btn-acc" id="cr-save"><i class="fa-solid fa-download"></i> Simpan</button><button class="btn" id="cr-share"><i class="fa-solid fa-share-nodes"></i> Bagikan</button><button class="btn" id="cr-close">Tutup</button></div></div>`;
    const on = (id, f) => $(id).onclick = f;
    on('cam-x', () => Sheet.close('cam')); on('cs-flip', () => { this.facing = this.facing === 'user' ? 'environment' : 'user'; this.start(); }); on('cs-timer', () => { this.timer = this.timer === 0 ? 3 : this.timer === 3 ? 10 : 0; this.sync(); });
    on('cs-res', () => { this.res = this.res === 'hd' ? 'fhd' : this.res === 'fhd' ? 'sd' : 'hd'; this.start(); }); on('cs-mirror', () => { this.mirror = !this.mirror; this.sync(); }); on('cs-grid', () => { this.grid = !this.grid; this.sync(); });
    on('cam-torch', () => this.toggleTorch()); on('cam-sh', () => this.shutter()); on('cm-photo', () => this.setMode('photo')); on('cm-video', () => this.setMode('video'));
    on('ct-filter', () => this.setTab('filter')); on('ct-fx', () => this.setTab('fx')); on('cam-th', () => this.showLast());
    on('cr-close', () => $('cam-res').classList.add('hidden')); on('cr-save', () => this.save()); on('cr-share', () => this.share());
    this.setTab('filter'); this.sync();
  },
  setTab(t) { this.tab = t; $('ct-filter').style.color = t === 'filter' ? '#fff' : '#9ca3af'; $('ct-fx').style.color = t === 'fx' ? '#fff' : '#9ca3af'; const list = t === 'filter' ? CAM_FILTERS.map((f, i) => [i, f[1], null, f[0]]) : CAM_FX.map(f => [f[0], f[1], f[2]]);
    $('cam-fx').innerHTML = list.map(([k, n, e, id]) => { const on = t === 'filter' ? k === this.fi : k === this.fx; return `<button class="fx ${on ? 'on' : ''}" data-k="${k}" style="border:0;background:none;color:#fff"><div class="dot" style="${t === 'filter' ? 'background:' + this.swatch(id) : ''}">${e || ''}</div>${n}</button>`; }).join('');
    $('cam-fx').querySelectorAll('.fx').forEach(b => b.onclick = () => { if (t === 'filter') this.fi = +b.dataset.k; else { this.fx = b.dataset.k; this.parts = []; this.prev = null; } this.setTab(t); }); },
  swatch(id) { const m = { normal: '#9ca3af', cantik: '#fbcfe8', cerah: '#fde68a', pastel: '#fbcfe8', hangat: '#fdba74', dingin: '#93c5fd', cinema: '#0e7490', vintage: '#a16207', bw: '#4b5563', drama: '#7c2d12', neon: '#d946ef', sunset: '#fb7185', vhs: '#6366f1' }; return m[id] || '#999'; },
  sync() { const on = (id, v) => $(id).classList.toggle('on', !!v); on('cs-mirror', this.mirror); on('cs-grid', this.grid); on('cs-timer', this.timer); $('cs-tl').textContent = this.timer ? this.timer + ' dtk' : 'Timer'; $('cs-rl').textContent = this.RES[this.res][2]; $('cam-grid').classList.toggle('hidden', !this.grid); },
  setMode(m) { this.mode = m; $('cm-photo').style.color = m === 'photo' ? 'var(--acc)' : '#9ca3af'; $('cm-video').style.color = m === 'video' ? 'var(--acc)' : '#9ca3af'; $('cam-sh').classList.toggle('vid', m === 'video'); },
  msg(t) { const m = $('cam-msg'); if (!t) return m.classList.add('hidden'); m.innerHTML = t; m.classList.remove('hidden'); },
  async start() {
    this.stopRec(true); this.stopStream(); this.msg('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return this.msg('Browser tidak mendukung kamera, atau halaman tidak dibuka lewat HTTPS.');
    const [w, h] = this.RES[this.res]; let err = null;
    for (const c of [{ video: { facingMode: { ideal: this.facing }, width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: 30 } }, audio: false }, { video: { facingMode: this.facing }, audio: false }, { video: true, audio: false }]) {
      try { this.stream = await navigator.mediaDevices.getUserMedia(c); break; } catch (e) { err = e; if (['NotAllowedError', 'SecurityError'].includes(e.name)) break; }
    }
    if (!this.stream) { const n = err && err.name; return this.msg(n === 'NotAllowedError' ? '📷 Izin kamera ditolak.<br><br>Buka pengaturan aplikasi/browser → izinkan <b>Kamera</b>, lalu buka lagi.' : n === 'NotFoundError' ? 'Kamera tidak ditemukan di perangkat ini.' : 'Kamera tidak bisa dibuka: ' + (n || 'galat tidak dikenal')); }
    const v = $('cam-v'); v.srcObject = this.stream; await v.play().catch(() => {});
    const tr = this.stream.getVideoTracks()[0], s = tr.getSettings ? tr.getSettings() : {}, caps = tr.getCapabilities ? tr.getCapabilities() : {};
    this.mirror = (s.facingMode || this.facing) === 'user'; this.sync(); const px = Math.max(s.width || 0, s.height || 0); $('cam-badge').textContent = (px >= 1900 ? 'FHD' : px >= 1200 ? 'HD' : 'SD') + (px ? ` ${s.width}×${s.height}` : ''); $('cam-torch').classList.toggle('hidden', !caps.torch);
    this.loop();
  },
  stopStream() { cancelAnimationFrame(this.raf); if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; } this.torch = false; },
  close(fromSheet) { this.stopRec(true); this.stopStream(); const el = $('cam'); if (el) el.remove(); Sheet.stack = Sheet.stack.filter(s => s.id !== 'cam'); Sound.release('cam'); if (!fromSheet && history.state && history.state.sheet === 'cam') history.back(); },
  async toggleTorch() { const t = this.stream && this.stream.getVideoTracks()[0]; if (!t) return; this.torch = !this.torch; try { await t.applyConstraints({ advanced: [{ torch: this.torch }] }); $('cam-torch').classList.toggle('on', this.torch); } catch (e) { this.torch = false; UI.toast('Senter tidak didukung', 'warn'); } },

  /* ----- render ----- */
  loop() {
    const v = $('cam-v'), c = $('cam-c'); if (!this.stream || !c) return;
    if (v.videoWidth) {
      const sc = Math.min(1, 1920 / Math.max(v.videoWidth, v.videoHeight)), W = Math.round(v.videoWidth * sc), H = Math.round(v.videoHeight * sc);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; this.prev = null; }
      this.draw(c.getContext('2d'), v, W, H, (performance.now() - this.t0) / 1000);
    }
    this.raf = requestAnimationFrame(() => this.loop());
  },
  draw(g, v, W, H, t) {
    const f = CAM_FILTERS[this.fi], css = f[2], o = f[3] || {}, fx = this.fx, sf = this.supportsFilter;
    const base = (filter, alpha = 1) => { g.save(); if (this.mirror) { g.translate(W, 0); g.scale(-1, 1); } if (fx === 'pulse') { const z = 1 + .05 * Math.sin(t * 5) * (Math.sin(t * 1.3) > 0 ? 1 : .4); g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2); } g.globalAlpha = alpha; if (sf) g.filter = filter; g.drawImage(v, 0, 0, W, H); g.restore(); if (sf) g.filter = 'none'; };
    if (fx === 'echo' && this.prev) { g.globalAlpha = 1; g.drawImage(this.prev, 0, 0, W, H); }
    if (o.smooth && sf) { base(`blur(${(2.4 * this.smooth).toFixed(1)}px) ${css}`); base(css, .5); } else base(css === 'none' ? 'none' : css, fx === 'echo' && this.prev ? .6 : 1);
    if (!sf) $('cam-c').style.filter = css === 'none' ? '' : css;
    if (o.tint) { g.save(); g.globalCompositeOperation = o.tint[1]; g.fillStyle = o.tint[0]; g.fillRect(0, 0, W, H); g.restore(); }
    if (o.vig) this.vig(g, W, H); if (o.scan) { g.save(); g.fillStyle = 'rgba(0,0,0,.13)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1.5); g.restore(); } if (o.grain) this.grain(g, W, H);
    if (o.bars) { g.fillStyle = '#000'; const b = H * .1; g.fillRect(0, 0, W, b); g.fillRect(0, H - b, W, b); }
    if (fx === 'glitch') this.glitch(g, W, H, t); else if (fx === 'pixel') this.pixel(g, W, H); else if (fx === 'kaleido') this.kaleido(g, W, H);
    else if (fx === 'leak') this.leak(g, W, H, t); else if (fx === 'bokeh') this.bokeh(g, W, H, t); else if (fx === 'strobe') this.strobe(g, W, H, t);
    else if (['snow', 'hearts', 'sparkle', 'confetti', 'bubble'].includes(fx)) this.particles(g, W, H, fx);
    if (fx === 'polaroid') this.polaroid(g, W, H);
    if (fx === 'echo') { if (!this.prev) this.prev = document.createElement('canvas'); if (this.prev.width !== W) { this.prev.width = W; this.prev.height = H; } this.prev.getContext('2d').drawImage(g.canvas, 0, 0); }
  },
  vig(g, W, H) { const r = Math.hypot(W, H) / 2, gr = g.createRadialGradient(W / 2, H / 2, r * .45, W / 2, H / 2, r); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.62)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); },
  grain(g, W, H) { g.save(); g.globalAlpha = .07; for (let i = 0; i < 90; i++) { g.fillStyle = Math.random() > .5 ? '#fff' : '#000'; g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 2 + Math.random() * 3); } g.restore(); },
  glitch(g, W, H, t) {
    const src = g.canvas; if (!this.tmp) this.tmp = document.createElement('canvas'); const tc = this.tmp; if (tc.width !== W) { tc.width = W; tc.height = H; } tc.getContext('2d').drawImage(src, 0, 0);
    const shift = Math.sin(t * 9) > .55 ? 10 : 3; g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .55; if (this.supportsFilter) g.filter = 'hue-rotate(160deg) saturate(2)'; g.drawImage(tc, shift, 0); if (this.supportsFilter) g.filter = 'hue-rotate(-100deg) saturate(2)'; g.drawImage(tc, -shift, 0); g.restore(); if (this.supportsFilter) g.filter = 'none';
    if (Math.random() < .35) for (let i = 0; i < 3; i++) { const y = Math.random() * H, h = 8 + Math.random() * H * .08, dx = (Math.random() - .5) * W * .12; g.drawImage(tc, 0, y, W, h, dx, y, W, h); }
  },
  pixel(g, W, H) { const s = Math.max(10, Math.round(W / 56)); if (!this.tmp) this.tmp = document.createElement('canvas'); const tc = this.tmp; tc.width = Math.ceil(W / s); tc.height = Math.ceil(H / s); const x = tc.getContext('2d'); x.drawImage(g.canvas, 0, 0, tc.width, tc.height); g.imageSmoothingEnabled = false; g.drawImage(tc, 0, 0, tc.width, tc.height, 0, 0, W, H); g.imageSmoothingEnabled = true; },
  kaleido(g, W, H) { if (!this.tmp) this.tmp = document.createElement('canvas'); const tc = this.tmp; if (tc.width !== W) { tc.width = W; tc.height = H; } tc.getContext('2d').drawImage(g.canvas, 0, 0); g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(tc, 0, 0, W / 2, H, 0, 0, W / 2, H); g.restore(); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(W / 2 - 1, 0, 2, H); },
  leak(g, W, H, t) { g.save(); g.globalCompositeOperation = 'screen'; const gr = g.createLinearGradient(W * (.5 + .5 * Math.sin(t * .8)) - W * .6, 0, W * (.5 + .5 * Math.sin(t * .8)) + W * .4, H); gr.addColorStop(0, 'rgba(255,0,120,0)'); gr.addColorStop(.35, 'rgba(255,120,40,.45)'); gr.addColorStop(.6, 'rgba(80,200,255,.35)'); gr.addColorStop(1, 'rgba(120,0,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); },
  bokeh(g, W, H, t) { if (this.parts.length < 18) this.parts.push({ x: Math.random() * W, y: Math.random() * H, r: W * (.02 + Math.random() * .05), a: .15 + Math.random() * .3, vx: (Math.random() - .5) * .6, vy: -.2 - Math.random() * .5, c: ['255,230,150', '255,170,210', '170,220,255'][Math.floor(Math.random() * 3)] }); g.save(); g.globalCompositeOperation = 'screen'; this.parts.forEach(p => { p.x += p.vx; p.y += p.vy; if (p.y < -p.r) { p.y = H + p.r; p.x = Math.random() * W; } const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); gr.addColorStop(0, `rgba(${p.c},${p.a})`); gr.addColorStop(1, `rgba(${p.c},0)`); g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.3); g.fill(); }); g.restore(); },
  strobe(g, W, H, t) { const k = Math.floor(t * 6) % 6, cols = ['255,0,100', '0,200,255', '255,220,0', '120,255,80', '180,80,255', '255,140,0']; g.save(); g.globalCompositeOperation = 'overlay'; g.fillStyle = `rgba(${cols[k]},.38)`; g.fillRect(0, 0, W, H); g.restore(); },
  polaroid(g, W, H) { const b = Math.round(W * .05), bb = Math.round(H * .14); g.fillStyle = '#fafafa'; g.fillRect(0, 0, W, b); g.fillRect(0, 0, b, H); g.fillRect(W - b, 0, b, H); g.fillRect(0, H - bb, W, bb); g.fillStyle = '#334155'; g.font = `700 ${Math.round(bb * .28)}px 'Plus Jakarta Sans',sans-serif`; g.textAlign = 'center'; g.fillText(new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, H - bb * .42); },
  particles(g, W, H, kind) {
    const size = Math.max(W, H) / 30, cfg = { snow: ['❄️', '❅', '•'], hearts: ['❤️', '💖', '💗'], sparkle: ['✨', '⭐', '✦'], confetti: ['🎊', '🎉', '▮'], bubble: ['🫧', '○'] }[kind];
    if (this.parts.length < 26 && Math.random() < .5) { const up = kind === 'hearts' || kind === 'bubble'; this.parts.push({ x: Math.random() * W, y: up ? H + size : -size, vy: (up ? -1 : 1) * (1.2 + Math.random() * 2.4), s: size * (.6 + Math.random() * .9), life: 1, e: cfg[Math.floor(Math.random() * cfg.length)], ph: Math.random() * 6, col: kind === 'confetti' ? `hsl(${Math.random() * 360},90%,60%)` : '#fff', sp: kind === 'sparkle' }); }
    this.parts = this.parts.filter(p => p.life > 0 && p.y > -p.s * 2 && p.y < H + p.s * 2);
    g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; this.parts.forEach(p => { p.y += p.sp ? 0 : p.vy; p.x += Math.sin(p.y / 40 + p.ph) * 1.1; p.life -= p.sp ? .02 : .003; g.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); g.fillStyle = p.col; g.font = `${p.s}px serif`; g.fillText(p.e, p.x, p.y); }); g.restore();
  },

  /* ----- foto & video ----- */
  async shutter() {
    if (!this.stream || this.busy) return; if (this.mode === 'video' && this.rec) return this.stopRec();
    if (this.timer) { this.busy = true; const el = $('cam-count'); el.classList.remove('hidden'); for (let n = this.timer; n > 0; n--) { el.textContent = n; await sleep(1000); if (!this.stream) { this.busy = false; el.classList.add('hidden'); return; } } el.classList.add('hidden'); this.busy = false; }
    this.mode === 'video' ? this.startRec() : this.photo();
  },
  photo() { const c = $('cam-c'), fl = document.createElement('div'); fl.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:.85;pointer-events:none;transition:opacity .3s;z-index:6'; c.parentElement.appendChild(fl); setTimeout(() => { fl.style.opacity = 0; setTimeout(() => fl.remove(), 300); }, 40); c.toBlob(b => b && this.setLast(b, 'image/jpeg', 'jpg'), 'image/jpeg', .95); },
  async startRec() {
    if (!window.MediaRecorder) return UI.toast('Perekam video tidak didukung', 'err');
    const out = $('cam-c').captureStream(30); let at = null;
    try { const a = await navigator.mediaDevices.getUserMedia({ audio: true }); at = a.getAudioTracks()[0]; out.addTrack(at); } catch (e) { UI.toast('Mikrofon tidak diizinkan: video tanpa suara', 'warn'); }
    this.audioTrack = at; const mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
    try { this.rec = new MediaRecorder(out, { mimeType: mime || undefined, videoBitsPerSecond: this.res === 'fhd' ? 8e6 : 5e6 }); } catch (e) { try { this.rec = new MediaRecorder(out); } catch (x) { return UI.toast('Gagal merekam', 'err'); } }
    this.chunks = []; this.rec.ondataavailable = e => e.data && e.data.size && this.chunks.push(e.data);
    this.rec.onstop = () => { clearInterval(this.rt); $('cam-rec') && $('cam-rec').classList.add('hidden'); $('cam-sh') && $('cam-sh').classList.remove('rec'); if (this.audioTrack) { this.audioTrack.stop(); this.audioTrack = null; } const type = (this.rec && this.rec.mimeType) || mime || 'video/webm', blob = new Blob(this.chunks, { type }); this.rec = null; if (!this.discard && blob.size) this.setLast(blob, type, /mp4/.test(type) ? 'mp4' : 'webm'); this.discard = false; };
    this.rec.start(1000); this.recStart = Date.now(); $('cam-rec').classList.remove('hidden'); $('cam-sh').classList.add('rec');
    this.rt = setInterval(() => { const s = Math.floor((Date.now() - this.recStart) / 1000); $('cam-rt').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }, 500);
  },
  stopRec(discard) { if (!this.rec) return; this.discard = !!discard; try { this.rec.stop(); } catch (e) {} },
  setLast(blob, type, ext) { if (this.last) URL.revokeObjectURL(this.last.url); this.last = { blob, type, ext, url: URL.createObjectURL(blob), name: `dimzz-${Date.now()}.${ext}` }; $('cam-th').innerHTML = type.startsWith('image') ? `<img src="${this.last.url}" style="width:100%;height:100%;object-fit:cover" alt=""/>` : '<i class="fa-solid fa-film"></i>'; this.showLast(); },
  showLast() { if (!this.last) return UI.toast('Belum ada hasil', 'info'); $('cam-resm').innerHTML = this.last.type.startsWith('image') ? `<img src="${this.last.url}" style="max-width:100%;max-height:68vh;border-radius:14px" alt=""/>` : `<video src="${this.last.url}" controls playsinline autoplay loop style="max-width:100%;max-height:68vh;border-radius:14px"></video>`; $('cam-res').classList.remove('hidden'); },
  save() { const l = this.last; if (!l) return; const a = document.createElement('a'); a.href = l.url; a.download = l.name; document.body.appendChild(a); a.click(); a.remove(); UI.toast('Tersimpan ke folder Unduhan', 'ok'); },
  async share() { const l = this.last; if (!l) return; try { const f = new File([l.blob], l.name, { type: l.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'Dimzz Prozet' }); else this.save(); } catch (e) {} }
};
Features.reg({ id: 'camera', name: 'Kamera', cat: 'kreasi', icon: 'fa-camera', grad: 'linear-gradient(135deg,#f97316,#db2777)', open: () => Cam.open() });
