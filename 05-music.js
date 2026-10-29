/* ==== 05-music.js — Pemutar musik gaya YouTube Music (hanya audio, tanpa tampilan video) ==== */
const MOODS = [['Hits Indonesia', 'lagu indonesia terpopuler', '#f43f5e'], ['Pop Santai', 'pop indonesia santai', '#8b5cf6'], ['Galau', 'lagu galau indonesia', '#0ea5e9'], ['Semangat', 'lagu semangat workout', '#f59e0b'], ['Dangdut', 'dangdut terpopuler', '#10b981'], ['Religi', 'lagu religi islami', '#14b8a6'], ['Lo-fi', 'lofi chill beats', '#6366f1'], ['K-Pop', 'kpop hits', '#ec4899'], ['Barat', 'top english hits', '#ef4444'], ['Akustik', 'akustik cover indonesia', '#a16207']];

const Music = {
  q: [], i: -1, shuffle: false, repeat: 0 /*0 off,1 all,2 one*/, tok: 0, mode: 'audio', yt: null, ytTimer: null, fails: 0, cache: new Map(), lyr: null,
  el() { return $('a-music'); },
  fav() { return LS.get('fav', []); }, hist() { return LS.get('hist', []); },
  isFav(id) { return this.fav().some(t => t.id === id); },
  toggleFav(t) { let f = this.fav(); if (f.some(x => x.id === t.id)) f = f.filter(x => x.id !== t.id); else f.unshift(t); LS.set('fav', f.slice(0, 200)); },
  cur() { return this.q[this.i]; },

  init() {
    if (this.inited) return; this.inited = true; const a = this.el();
    Sound.reg('music', () => this.pause(true));
    a.addEventListener('timeupdate', () => this.progress(a.currentTime, a.duration)); a.addEventListener('play', () => this.ui(true)); a.addEventListener('pause', () => this.ui(false));
    a.addEventListener('ended', () => this.onEnd()); a.addEventListener('error', () => { if (a.getAttribute('src')) this.fail('audio'); });
    a.addEventListener('waiting', () => $('np-buf') && ($('np-buf').style.opacity = 1)); a.addEventListener('playing', () => $('np-buf') && ($('np-buf').style.opacity = 0));
    if ('mediaSession' in navigator) { const s = (n, f) => { try { navigator.mediaSession.setActionHandler(n, f); } catch (e) {} }; s('play', () => this.toggle()); s('pause', () => this.toggle()); s('nexttrack', () => this.next()); s('previoustrack', () => this.prev()); s('seekto', d => this.seek(d.seekTime)); }
  },

  /* ----- antrean & pemutaran ----- */
  playList(list, idx) { this.init(); this.q = list.slice(); this.fails = 0; this.playAt(idx); },
  async playAt(i) {
    const t = this.q[i]; if (!t) return; this.i = i; const my = ++this.tok; this.stopYt(); this.lyr = null;
    Sound.play('music'); this.showMini(t); this.ui(false); this.renderNow(); this.setMeta(t);
    const hist = this.hist().filter(x => x.id !== t.id); hist.unshift(t); LS.set('hist', hist.slice(0, 40));
    try {
      let d = t.url ? { url: t.url } : this.cache.get(t.id); if (!d) { d = (await API.get('yt', { a: 'audio', id: t.id }, 45000)); this.cache.set(t.id, d); }
      if (my !== this.tok) return;
      const a = this.el(); this.mode = 'audio'; a.src = API.abs(d.url); a.referrerPolicy = 'no-referrer';
      await a.play(); this.fails = 0; this.preload(i + 1);
    } catch (e) {
      if (my !== this.tok) return;
      if (e && e.name === 'NotAllowedError') { UI.toast('Ketuk tombol putar untuk memulai', 'info'); return; }
      ErrLog.push('audio ' + t.id + ': ' + (e.message || e), 'music');
      this.fallbackYt(t, my);
    }
  },
  preload(i) { const t = this.q[i % this.q.length]; if (t && !this.cache.has(t.id)) API.get('yt', { a: 'audio', id: t.id }, 45000).then(d => this.cache.set(t.id, d)).catch(() => {}); },
  fail() { const t = this.cur(); if (!t) return; ErrLog.push('stream error ' + t.id, 'music'); this.cache.delete(t.id); this.fallbackYt(t, this.tok); },

  /* cadangan terakhir: pemutar tersembunyi (hanya suara; tampilan tetap pemutar musik) */
  fallbackYt(t, my) {
    if (t.url || !/^[\w-]{11}$/.test(t.id)) return this.skipFailed();
    this.loadYtApi().then(() => {
      if (my !== this.tok) return; const a = this.el(); try { a.pause(); a.removeAttribute('src'); } catch (e) {}
      this.mode = 'yt'; $('yt-hidden').innerHTML = '<div id="yt-frame"></div>';
      this.yt = new YT.Player('yt-frame', { width: 200, height: 120, videoId: t.id, playerVars: { autoplay: 1, playsinline: 1, controls: 0, origin: /^https?:/.test(location.protocol) ? location.origin : undefined }, events: {
        onReady: e => { try { e.target.playVideo(); } catch (x) {} }, onStateChange: e => { if (e.data === 1) { this.ui(true); this.fails = 0; } if (e.data === 2) this.ui(false); if (e.data === 0) this.onEnd(); },
        onError: () => this.skipFailed() } });
      clearInterval(this.ytTimer); this.ytTimer = setInterval(() => { try { this.progress(this.yt.getCurrentTime(), this.yt.getDuration()); } catch (e) {} }, 500);
    }).catch(() => this.skipFailed());
  },
  loadYtApi() { return new Promise((res, rej) => { if (window.YT && YT.Player) return res(); const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = rej; window.onYouTubeIframeAPIReady = () => res(); document.head.appendChild(s); setTimeout(() => (window.YT && YT.Player) ? res() : rej(), 9000); }); },
  stopYt() { clearInterval(this.ytTimer); if (this.yt) { try { this.yt.destroy(); } catch (e) {} this.yt = null; } $('yt-hidden').innerHTML = ''; },
  skipFailed() { this.fails++; if (this.fails >= 3) { UI.toast('Lagu tidak bisa diputar. Server musik sedang bermasalah, coba lagi nanti.', 'err', 5000); this.ui(false); return; } UI.toast('Lagu ini gagal dimuat, lanjut ke berikutnya…', 'warn'); setTimeout(() => this.next(true), 500); },

  progress(c, d) { if (!isFinite(d) || !d) d = (this.cur() && this.cur().seconds) || 0; const sk = $('np-seek'); if (sk && document.activeElement !== sk && d) sk.value = Math.round(c / d * 1000); if ($('np-cur')) { $('np-cur').textContent = fmtDur(c); $('np-dur').textContent = fmtDur(d); } this.syncLyrics(c);
    if ('mediaSession' in navigator && d && isFinite(d)) try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(c, d), playbackRate: 1 }); } catch (e) {} },
  seek(s) { if (this.mode === 'yt' && this.yt) try { this.yt.seekTo(s, true); } catch (e) {} else this.el().currentTime = s; },
  playing() { return this.mode === 'yt' ? (this.yt && this.yt.getPlayerState && this.yt.getPlayerState() === 1) : !this.el().paused; },
  toggle() { if (!this.cur()) return; if (this.playing()) this.pause(); else { Sound.play('music'); if (this.mode === 'yt' && this.yt) this.yt.playVideo(); else this.el().play().catch(() => this.playAt(this.i)); } },
  pause(silent) { try { if (this.mode === 'yt' && this.yt) this.yt.pauseVideo(); else this.el().pause(); } catch (e) {} if (!silent) Sound.release('music'); },
  onEnd() { if (this.repeat === 2) { this.seek(0); this.mode === 'yt' ? this.yt.playVideo() : this.el().play(); return; } this.next(true); },
  next(auto) {
    if (!this.q.length) return; let n;
    if (this.shuffle && this.q.length > 1) { do { n = Math.floor(Math.random() * this.q.length); } while (n === this.i); } else { n = this.i + 1; if (n >= this.q.length) { if (this.repeat === 1 || !auto) n = 0; else { return this.autoRadio(); } } }
    this.playAt(n);
  },
  async autoRadio() {
    const t = this.cur(), my = this.tok;
    try {
      if (!t || t.url || this.radioBusy) throw 0; this.radioBusy = true;
      const r = await API.get('ytm', { a: 'radio', id: t.id }, 20000), have = new Set(this.q.map(x => x.id)), add = (r.items || []).filter(x => !have.has(x.id));
      if (!add.length || my !== this.tok) throw 0;
      const at = this.q.length; this.q.push(...add); UI.toast('Memutar lagu serupa…', 'info', 2200); this.playAt(at);
    } catch (e) { if (my === this.tok) { this.ui(false); Sound.release('music'); } }
    finally { this.radioBusy = false; }
  },
  prev() { if (!this.q.length) return; const c = this.mode === 'yt' && this.yt ? this.yt.getCurrentTime() : this.el().currentTime; if (c > 4) return this.seek(0); this.playAt((this.i - 1 + this.q.length) % this.q.length); },
  stop() { this.tok++; this.stopYt(); try { const a = this.el(); a.pause(); a.removeAttribute('src'); a.load(); } catch (e) {} this.q = []; this.i = -1; $('mini').classList.add('hidden'); document.body.classList.remove('has-mini'); const n = $('np'); if (n) n.remove(); Sound.release('music'); if ('mediaSession' in navigator) try { navigator.mediaSession.metadata = null; } catch (e) {} },

  /* ----- tampilan ----- */
  ui(on) { const ic = on ? 'fa-pause' : 'fa-play'; ['mini-ic', 'np-ic'].forEach(id => { const e = $(id); if (e) e.className = 'fa-solid ' + ic; }); if ('mediaSession' in navigator) try { navigator.mediaSession.playbackState = on ? 'playing' : 'paused'; } catch (e) {} },
  showMini(t) { $('mini').classList.remove('hidden'); document.body.classList.add('has-mini'); $('mini-art').src = t.thumb || ''; $('mini-title').textContent = t.title; $('mini-artist').textContent = t.artist || ''; },
  setMeta(t) { if ('mediaSession' in navigator) try { navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist || '', album: t.album || 'Dimzz Musik', artwork: t.thumb ? [{ src: t.thumb, sizes: '512x512' }] : [] }); } catch (e) {} },
  openNow() { if (!this.cur()) return; this.renderNow(true); },
  renderNow(force) {
    const t = this.cur(); if (!t) return; let n = $('np'); if (!n && !force) return;
    if (!n) { n = document.createElement('section'); n.id = 'np'; document.body.appendChild(n); history.pushState({ sheet: 'np' }, ''); Sheet.stack.push({ id: 'np', el: n, onClose: () => {} }); }
    const fav = this.isFav(t.id);
    n.innerHTML = `<div class="bgart" style="background-image:url('${esc(t.thumb)}')"></div>
      <div class="row" style="padding:calc(var(--safe-t) + 12px) 14px 6px;justify-content:space-between"><button class="np-btn" style="font-size:20px;width:42px;height:42px" id="np-close"><i class="fa-solid fa-chevron-down"></i></button><div style="font-size:11px;font-weight:800;letter-spacing:.08em;opacity:.8">SEDANG DIPUTAR</div><button class="np-btn" style="font-size:18px;width:42px;height:42px" id="np-q"><i class="fa-solid fa-list-ul"></i></button></div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 24px;gap:18px" id="np-main">
        <div style="position:relative"><img class="art" src="${esc(t.thumb)}" alt="" onerror="this.style.visibility='hidden'"/><div id="np-buf" style="position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.4);border-radius:20px;opacity:0;transition:.2s;pointer-events:none"><i class="fa-solid fa-circle-notch spin" style="font-size:30px"></i></div></div>
        <div style="width:min(86vw,360px)"><div class="row" style="justify-content:space-between;gap:10px"><div style="min-width:0"><div style="font-weight:800;font-size:19px;line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(t.title)}</div><div style="opacity:.75;font-weight:600;font-size:13px;margin-top:3px">${esc(t.artist || '')}</div></div><button class="np-btn" style="width:42px;height:42px;font-size:20px;color:${fav ? '#fb7185' : '#fff'}" id="np-fav"><i class="fa-${fav ? 'solid' : 'regular'} fa-heart"></i></button></div></div>
      </div>
      <div style="padding:0 26px 6px"><input id="np-seek" type="range" min="0" max="1000" value="0"/><div class="row" style="justify-content:space-between;font-size:11px;font-weight:700;opacity:.75;margin-top:6px"><span id="np-cur">0:00</span><span id="np-dur">${esc(t.duration || '')}</span></div></div>
      <div class="row" style="justify-content:center;gap:4px;padding:2px 10px"><button class="np-btn" id="np-sh" style="font-size:17px;opacity:${this.shuffle ? 1 : .5}"><i class="fa-solid fa-shuffle"></i></button><button class="np-btn" id="np-pv"><i class="fa-solid fa-backward-step"></i></button><button class="np-btn np-play" id="np-pl"><i class="fa-solid ${this.playing() ? 'fa-pause' : 'fa-play'}" id="np-ic"></i></button><button class="np-btn" id="np-nx"><i class="fa-solid fa-forward-step"></i></button><button class="np-btn" id="np-rp" style="font-size:17px;opacity:${this.repeat ? 1 : .5}"><i class="fa-solid ${this.repeat === 2 ? 'fa-1' : 'fa-repeat'}"></i></button></div>
      <div class="row" style="justify-content:center;gap:10px;padding:10px 16px calc(16px + var(--safe-b))"><button class="btn btn-sm" id="np-ly" style="background:rgba(255,255,255,.15);color:#fff;border-color:transparent!important"><i class="fa-solid fa-align-left"></i> Lirik</button><button class="btn btn-sm" id="np-dl" style="background:rgba(255,255,255,.15);color:#fff;border-color:transparent!important"><i class="fa-solid fa-download"></i> Unduh</button></div>`;
    $('np-close').onclick = () => this.closeNow(); $('np-pl').onclick = () => this.toggle(); $('np-nx').onclick = () => this.next(); $('np-pv').onclick = () => this.prev();
    $('np-sh').onclick = () => { this.shuffle = !this.shuffle; this.renderNow(); }; $('np-rp').onclick = () => { this.repeat = (this.repeat + 1) % 3; this.renderNow(); };
    $('np-fav').onclick = () => { this.toggleFav(t); this.renderNow(); }; $('np-seek').oninput = e => { const d = this.mode === 'yt' && this.yt ? this.yt.getDuration() : (this.el().duration || t.seconds || 0); if (d) this.seek(e.target.value / 1000 * d); };
    $('np-q').onclick = () => this.showQueue(); $('np-ly').onclick = () => this.showLyrics(); $('np-dl').onclick = () => { this.closeNow(); Yt.openDl(t.id, t.title); };
  },
  closeNow() { const n = $('np'); if (n) { n.remove(); Sheet.stack = Sheet.stack.filter(s => s.id !== 'np'); if (history.state && history.state.sheet === 'np') history.back(); } },
  showQueue() {
    const main = $('np-main'); main.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:6px 16px;display:block';
    main.innerHTML = `<div style="font-weight:800;margin:6px 0 10px">Antrean (${this.q.length})</div>` + this.q.map((t, k) => `<div class="row" data-k="${k}" style="padding:8px;border-radius:12px;gap:10px;background:${k === this.i ? 'rgba(255,255,255,.18)' : 'transparent'}"><img src="${esc(t.thumb)}" style="width:42px;height:42px;border-radius:9px;object-fit:cover"/><div style="min-width:0;flex:1"><div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div><div style="opacity:.7;font-size:11px">${esc(t.artist || '')}</div></div>${k === this.i ? '<i class="fa-solid fa-chart-simple"></i>' : ''}</div>`).join('');
    main.querySelectorAll('[data-k]').forEach(r => r.onclick = () => { this.playAt(+r.dataset.k); });
  },
  async showLyrics() {
    const t = this.cur(); const main = $('np-main'); main.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:6px 22px;display:block;text-align:center'; main.innerHTML = loadingHtml('Mencari lirik…').replace('class="empty"', 'class="empty" style="color:#fff"');
    try {
      const q = `${t.artist || ''} ${t.title}`.replace(/\(.*?\)|\[.*?\]|official|audio|video|lyrics?|lirik/gi, ' ').replace(/\s+/g, ' ').trim();
      const arr = await fetchJSON('https://lrclib.net/api/search?q=' + encodeURIComponent(q), {}, 9000);
      const r = (Array.isArray(arr) ? arr : []).find(x => x.syncedLyrics) || (arr || []).find(x => x.plainLyrics);
      if (!r) throw new Error('none');
      if (r.syncedLyrics) { this.lyr = r.syncedLyrics.split('\n').map(l => { const m = l.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/); return m ? { t: +m[1] * 60 + +m[2], x: m[3].trim() } : null; }).filter(l => l && l.x); main.innerHTML = this.lyr.map((l, k) => `<div class="ly" data-k="${k}" style="font-size:20px;font-weight:800;line-height:1.5;padding:6px 0;opacity:.4;transition:.25s">${esc(l.x)}</div>`).join(''); }
      else { this.lyr = null; main.innerHTML = `<div style="white-space:pre-wrap;font-weight:700;line-height:1.8;font-size:16px;text-align:center">${esc(r.plainLyrics)}</div>`; }
    } catch (e) {
      try {
        const r = await API.get('ytm', { a: 'lyrics', id: t.id }, 15000);
        if (r.synced && r.synced.length) { this.lyr = r.synced; main.innerHTML = this.lyr.map((l, k) => `<div class="ly" data-k="${k}" style="font-size:20px;font-weight:800;line-height:1.5;padding:6px 0;opacity:.4;transition:.25s">${esc(l.x)}</div>`).join(''); return; }
        if (r.plain) { this.lyr = null; main.innerHTML = `<div style="white-space:pre-wrap;font-weight:700;line-height:1.8;font-size:16px;text-align:center">${esc(r.plain)}</div>`; return; }
      } catch (x) {}
      main.innerHTML = '<div class="empty" style="color:#fff"><i class="fa-solid fa-align-left"></i>Lirik lagu ini belum tersedia.</div>';
    }
  },
  syncLyrics(c) { if (!this.lyr || !$('np-main')) return; let k = 0; for (let j = 0; j < this.lyr.length; j++) if (this.lyr[j].t <= c + .2) k = j; const rows = $('np-main').querySelectorAll('.ly'); rows.forEach((r, j) => { const on = j === k; r.style.opacity = on ? 1 : .4; r.style.transform = on ? 'scale(1.03)' : ''; if (on && r._on !== true) r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r._on = on; }); },

  /* ----- halaman pencarian ----- */
  open() {
    this.init();
    Sheet.open({ id: 'music', title: 'Musik', icon: 'fa-circle-play', grad: 'linear-gradient(135deg,#f43f5e,#be123c)', full: true, onOpen: () => this.home(),
      body: `<div class="ym-hero"><div style="font-weight:800;font-size:19px">Dengarkan apa saja</div><div style="opacity:.8;font-size:12px;font-weight:600;margin:3px 0 12px">Jutaan lagu, hanya audio — hemat kuota & baterai.</div>${searchBar('mu-q', 'Cari lagu, artis, atau album…')}</div><div id="mu-out"></div>` });
    bindSearch('mu-q', () => this.search($('mu-q').value.trim()));
    { const qi = $('mu-q'); if (qi) { const dl = document.createElement('datalist'); dl.id = 'mu-dl'; qi.parentNode.appendChild(dl); qi.setAttribute('list', 'mu-dl'); let tm;
      qi.addEventListener('input', () => { clearTimeout(tm); const v = qi.value.trim(); if (v.length < 2) return; tm = setTimeout(async () => { try { const r = await API.get('ytm', { a: 'suggest', q: v }, 8000); dl.innerHTML = (r.items || []).map(x => `<option value="${esc(x)}"></option>`).join(''); } catch (e) {} }, 350); }); } }
  },
  home() {
    const fav = this.fav(), hist = this.hist(), out = $('mu-out'); if (!out) return;
    out.innerHTML = `<div class="sec-title" style="margin-top:4px">Suasana & genre</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${MOODS.map(([n, q, c], k) => `<button class="mood" style="--c:${c}" data-m="${k}">${n}</button>`).join('')}</div>
      ${hist.length ? `<div class="sec-title">Terakhir diputar</div><div id="mu-hist" class="space-y-2"></div>` : ''}${fav.length ? `<div class="sec-title">Favoritmu <i class="fa-solid fa-heart" style="color:#f43f5e"></i></div><div id="mu-fav"></div>` : ''}`;
    out.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const m = MOODS[+b.dataset.m]; $('mu-q').value = m[0]; this.search(m[1]); });
    if (hist.length) this.renderList($('mu-hist'), hist.slice(0, 8)); if (fav.length) this.renderList($('mu-fav'), fav.slice(0, 30));
    this.loadCharts();
  },
  async loadCharts() {
    try {
      if (!this.charts) this.charts = await API.get('ytm', { a: 'charts', c: 'ID' }, 20000);
      const out = $('mu-out'); if (!out || !this.charts.items || !this.charts.items.length || $('mu-charts') || out.querySelector('#mu-res')) return;
      out.insertAdjacentHTML('beforeend', `<div class="sec-title">${esc(this.charts.title || 'Tangga lagu')}</div><div id="mu-charts"></div>`);
      this.renderList($('mu-charts'), this.charts.items.slice(0, 15));
    } catch (e) { this.charts = null; }
  },
  renderList(el, list) {
    el.innerHTML = list.map((t, k) => `<div class="item" data-k="${k}" style="margin-bottom:8px"><img class="th" src="${esc(t.thumb)}" loading="lazy" alt="" onerror="this.style.visibility='hidden'"/><div style="min-width:0;flex:1"><div class="t">${esc(t.title)}</div><div class="s">${esc(t.artist || '')}${t.duration ? ' · ' + esc(t.duration) : ''}${t.kind === 'Video' ? ' · Video' : ''}</div></div><button class="btn btn-icon btn-ghost" data-fav="${k}" style="color:${this.isFav(t.id) ? '#f43f5e' : '#94a3b8'}"><i class="fa-${this.isFav(t.id) ? 'solid' : 'regular'} fa-heart"></i></button></div>`).join('');
    el.querySelectorAll('.item').forEach(r => r.onclick = e => { if (e.target.closest('[data-fav]')) return; this.playList(list, +r.dataset.k); });
    el.querySelectorAll('[data-fav]').forEach(b => b.onclick = () => { this.toggleFav(list[+b.dataset.fav]); this.renderList(el, list); });
  },
  /* Pencarian lagu lewat ytmusicapi (api/ytm.py). Jika belum aktif / gagal, otomatis pakai API lama agar tetap jalan. */
  async ytmSearch(q) {
    try { const r = await API.get('ytm', { a: 'search', q }, 25000); if (r && r.items && r.items.length) return r.items; } catch (e) { ErrLog.push('ytmusicapi: ' + (e.message || e), 'music'); }
    return (await API.get('yt', { a: 'music', q }, 30000)).items;
  },
  async search(q) {
    if (!q) return this.home(); const out = $('mu-out'); out.innerHTML = loadingHtml('Mencari lagu…');
    try {
      let items;
      const yid = (q.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/) || [])[1];
      if (yid) { const d = await API.get('yt', { a: 'dl', id: yid }, 40000).catch(() => null); items = [{ id: yid, title: (d && d.title) || 'Video YouTube', artist: (d && d.author) || '', duration: '', seconds: (d && d.duration) || 0, thumb: `https://i.ytimg.com/vi/${yid}/hqdefault.jpg`, kind: 'Lagu' }]; }
      else if (/open\.spotify\.com\/.*track/.test(q)) { const m = await fetchJSON('https://open.spotify.com/oembed?url=' + encodeURIComponent(q), {}, 8000); items = await this.ytmSearch(m.title); }
      else items = await this.ytmSearch(q);
      if (!items.length) return void (out.innerHTML = emptyHtml('fa-face-sad-tear', 'Lagu tidak ditemukan. Coba kata kunci lain.'));
      out.innerHTML = `<div class="row" style="justify-content:space-between;margin:2px 0 8px"><div class="sec-title" style="margin:0">Hasil untuk “${esc(q.length > 30 ? q.slice(0, 30) + '…' : q)}”</div><button class="btn btn-sm btn-dark" id="mu-all"><i class="fa-solid fa-play"></i> Putar semua</button></div><div id="mu-res"></div>`;
      this.renderList($('mu-res'), items); $('mu-all').onclick = () => this.playList(items, 0);
    } catch (e) { out.innerHTML = errHtml(e.message || 'Pencarian gagal') + '<div style="text-align:center"><button class="btn" id="mu-retry"><i class="fa-solid fa-rotate"></i> Coba lagi</button></div>'; $('mu-retry').onclick = () => this.search(q); }
  }
};
Features.reg({ id: 'music', name: 'Musik', cat: 'media', icon: 'fa-circle-play', grad: 'linear-gradient(135deg,#f43f5e,#be123c)', open: () => Music.open() });
