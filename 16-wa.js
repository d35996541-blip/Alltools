/* ==== 16-wa.js — v3.20 DimzzChat: chat pribadi, grup, status (teks/foto/video), saluran, centang biru, profil & pengaturan ala WhatsApp.
   Tanpa Meta Bisnis & tanpa tab "Fitur". Data di Firebase (node wa/...) — tempel Rules baru dari firebase-rules-tambahan.json. ==== */
const WA = {
  S: { dn: {}, ph: '', ib: {}, vf: {}, vq: null, users: [], um: {}, rl: {}, bl: {}, prof: {}, tab: 'chat', q: '', f: 'all', st: { me: [], o: [] }, ch: {}, fol: {}, seen: LS.get('wa_seen', {}), rd: LS.get('wa_rd', {}) },
  C: null, av: new Map(), md: new Map(), pend: new Map(), cn: {}, lastSend: 0,
  BG: ['#128c7e', '#7c3aed', '#db2777', '#ea580c', '#2563eb', '#0f172a'],
  WP: [['#efeae2,#efeae2', '#0b141a,#0b141a'], ['#d9f5e8,#bfe9d6', '#0b141a,#0f2a24'], ['#dbeafe,#c7d2fe', '#0b1020,#16224a'], ['#fae8ff,#fbcfe8', '#1a0b1f,#3b0f3a'], ['#ffedd5,#fde68a', '#1f1405,#3a2a08'], ['#eef2f7,#e5e9f0', '#0e1116,#141922']],
  EMO: ['😀', '😂', '🥹', '😍', '😘', '😎', '🤔', '😭', '😡', '👍', '🙏', '👏', '🔥', '❤️', '🎉', '😴'],
  TK: '<svg class="wa-tk" viewBox="0 0 24 24" width="15" height="15" role="img" aria-label="Terverifikasi"><title>Terverifikasi</title><circle cx="12" cy="12" r="11" fill="#1d9bf0"/><path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  me: () => userKey(App.user.username),
  rq: (p, q, m, b, t) => FB.request(p, q, m, b, t),
  pair: (a, b) => [a, b].sort().join('__'),
  nid: () => Date.now().toString(36).padStart(9, '0') + Math.random().toString(36).slice(2, 5),
  dt(ts) { const a = this.dl(ts), b = this.hm(ts); return a === b ? a : a + ' ' + b; },
  hm: ts => new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':'),
  dl(ts) { const d = new Date(ts); if (d.toDateString() === new Date().toDateString()) return this.hm(ts); if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return 'Kemarin'; return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' }); },
  myName() { return this.S.dn[this.me()] || App.user.username; },
  uname(k) { return this.S.dn[k] || this.S.um[k] || k; },
  isV(k) { return !!this.S.vf[k] || this.S.rl[k] === 'developer'; },
  nm(k, n) { return esc((!/^[gc]:/.test(k) && this.S.dn[k]) || n || this.uname(k)) + (this.isV(k) ? this.TK : ''); },
  hue(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; },
  mt: (ty, id) => ty === 'v' ? `<video data-im="${esc(id)}" controls playsinline preload="metadata"></video>` : ty === 'a' ? `<audio data-im="${esc(id)}" controls preload="metadata"></audio>` : `<img data-im="${esc(id)}" alt="">`,
  errMsg: e => e.permission ? 'Ditolak Firebase — tempel Rules terbaru (firebase-rules-tambahan.json) lalu Publish' : (e.message === 'format' ? 'Format gambar tidak didukung' : e.message === 'besar' ? 'Gambar terlalu besar' : e.message || 'Gagal'),
  avatar(k, n, sz = 46, ex = '') { return `<span class="wa-av ${ex}" data-k="${esc(k)}" style="--s:${sz}px;--h:${this.hue(k)}">${String(k).startsWith('g:') ? '<i class="fa-solid fa-user-group"></i>' : String(k).startsWith('c:') ? '<i class="fa-solid fa-bullhorn"></i>' : esc(String(n || k).charAt(0).toUpperCase())}</span>`; },
  avGet(k) { if (this.av.has(k)) return Promise.resolve(this.av.get(k)); const key = 'a' + k; if (!this.pend.has(key)) this.pend.set(key, this.rq('wa/av/' + k, null, 'GET', undefined, 9000).then(v => { v = typeof v === 'string' && Chat.RE_IMG.test(v) ? v : null; this.av.set(k, v); return v; }).catch(() => null).finally(() => this.pend.delete(key))); return this.pend.get(key); },
  hydrate(root) {
    root.querySelectorAll('.wa-av[data-k]:not([data-d])').forEach(async el => { el.dataset.d = 1; const k = el.dataset.k; if (/^[gc]:/.test(k)) return; const v = await this.avGet(k); if (v && el.isConnected) { el.style.backgroundImage = `url(${v})`; el.textContent = ''; el.classList.add('has'); } });
    root.querySelectorAll('[data-im]:not([data-d])').forEach(el => this.media(el));
  },
  async media(el) {
    el.dataset.d = 1; const id = el.dataset.im; let v = this.md.get(id);
    if (!v) { try { v = await this.rq('wa/md/' + id, null, 'GET', undefined, 30000); if (typeof v === 'string' && /^data:(image|video|audio)\//.test(v)) this.md.set(id, v); else v = null; } catch (e) { v = null; } }
    if (!el.isConnected) return; if (v) { el.src = v; if (el.tagName === 'IMG' && !el.closest('[data-nolb]')) el.onclick = () => Chat.view(v); } else el.alt = 'Media tidak tersedia';
  },
  beep() { if (!LS.get('wa_snd', 1)) return; try { const a = this.ac || (this.ac = new (window.AudioContext || window.webkitAudioContext)()), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(.18, a.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + .35); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + .4); } catch (e) {} },
  async users(force) { if (!force && this.S.users.length && Date.now() - (this.S.ut || 0) < 60000) return this.S.users; const l = await FB.listUsers(); this.S.dn = (await this.rq('wa/dn').catch(() => null)) || this.S.dn; this.S.users = l; this.S.ut = Date.now(); l.forEach(u => { const k = userKey(u.username); this.S.um[k] = u.username; this.S.rl[k] = String(u.role).toLowerCase(); }); return l; },
  prefs() { const dk = LS.get('wa_dk', 0), wp = this.WP[LS.get('wa_wp', 0)] || this.WP[0], fz = LS.get('wa_fz', 15); document.querySelectorAll('.panel.wap').forEach(p => { p.classList.toggle('dk', !!dk); p.style.setProperty('--wp', `linear-gradient(160deg,${dk ? wp[1] : wp[0]})`); p.style.setProperty('--fz', fz + 'px'); }); },
  sheet(o) { return Sheet.open({ title: 'DimzzChat', icon: 'fa-comment-dots', full: true, cls: 'wap', bodyCls: 'wa-body custom-scrollbar', ...o, onOpen: el => { el.addEventListener('click', e => { const b = e.target.closest('[data-x]'); if (b) Sheet.close(b.dataset.x); }); this.prefs(); o.on && o.on(el); } }); },
  top: (t, x, ex = '') => `<div class="wa-top">${x ? `<button class="wa-ib" data-x="${x}" aria-label="Kembali"><i class="fa-solid fa-arrow-left"></i></button>` : ''}<h2>${t}</h2>${ex}</div>`,
  home: (t, ico, brand) => `<div class="wa-top home"><h2 class="${brand ? 'brand' : ''}">${t}</h2>${ico || ''}</div>`,
  mnb: '<button class="wa-ib" data-mn aria-label="Menu"><i class="fa-solid fa-ellipsis-vertical"></i></button>',
  menu(v, items) { const b = v.querySelector('[data-mn]'); if (b) b.onclick = e => { e.stopPropagation(); this.pop(b, items); }; },
  fav() { return LS.get('wa_fav', {}); },
  togFav(k) { const f = this.fav(); if (f[k]) delete f[k]; else f[k] = 1; LS.set('wa_fav', f); UI.toast(f[k] ? 'Ditambahkan ke favorit' : 'Dihapus dari favorit', 'ok'); },
  readAll() { for (const [k, e] of Object.entries(this.S.ib)) if (e && e.ts && this.unread(k, e)) this.S.rd[k] = e.ts; LS.set('wa_rd', this.S.rd); this.drawList(); this.badge(); UI.toast('Semua chat ditandai dibaca', 'ok'); },
  settings() { this.sheet({ id: 'wast', body: '<div id="wst-v"></div>', on: () => this.v_me($('wst-v')) }); },
  switchAcc() { App.logout(); },
  pop(anchor, items) { document.querySelectorAll('.wa-pop').forEach(x => x.remove()); const p = document.createElement('div'); p.className = 'wa-pop'; p.innerHTML = items.map((it, i) => `<button data-i="${i}">${it[0]}</button>`).join(''); anchor.closest('.panel').appendChild(p); p.onclick = e => { const b = e.target.closest('button'); if (b) { p.remove(); items[+b.dataset.i][1](); } }; setTimeout(() => document.addEventListener('click', () => p.remove(), { once: true }), 0); },
  vvFit(id) { const v = window.visualViewport; if (!v || !matchMedia('(pointer:coarse)').matches) return () => {}; const f = () => { const sh = $('sheet-' + id); if (!sh) return; const pn = sh.querySelector('.panel'); sh.style.top = v.offsetTop + 'px'; sh.style.bottom = 'auto'; sh.style.height = v.height + 'px'; sh.style.alignItems = 'stretch'; if (pn) { pn.style.height = '100%'; pn.style.maxHeight = '100%'; } const b = Sheet.$(id); if (b && b.scrollHeight - b.scrollTop - b.clientHeight < 400) b.scrollTop = b.scrollHeight; }; v.addEventListener('resize', f); v.addEventListener('scroll', f); f(); setTimeout(f, 300); return () => { v.removeEventListener('resize', f); v.removeEventListener('scroll', f); }; },
  async prep(file) { if (/^audio\//.test(file.type)) { if (file.size > 1200000) throw new Error('VN maksimal 1,2 MB.'); return { ty: 'a', data: await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); }) }; } if (/^video\//.test(file.type)) { if (file.size > 3200000) throw new Error('Video maksimal ±3 MB (sekitar 10 detik). Pangkas dulu videonya.'); return { ty: 'v', data: await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); }) }; } if (/^image\//.test(file.type)) return { ty: 'p', data: await Chat.shrink(file, false) }; throw new Error('Pilih foto, video, atau audio'); },
  async upload(file) { const { ty, data } = await this.prep(file); const r = await this.rq('wa/md', null, 'POST', data, 90000); if (!r || !r.name) throw new Error('Gagal mengunggah'); this.md.set(r.name, data); return { ty, im: r.name }; },
  async okSend() { if (Date.now() - this.lastSend < 600) { UI.toast('Pelan-pelan', 'warn'); return false; } const ban = await Ban.get(this.me()); if (ban && !App.isDev()) { App.showBan(ban); return false; } this.lastSend = Date.now(); return true; },

  /* ---------- pintu masuk ---------- */
  async open() {
    if (!Ban.on()) return UI.alert('Butuh Firebase', 'DimzzChat memakai database Firebase. Saat ini web berjalan dalam mode lokal.', { type: 'warn' });
    if (!await this.gate()) return;
    this.S.tab = 'chat'; this.S.ib_ready = 0;
    this.sheet({ id: 'wa', body: '<div id="wa-v" class="wa-v"></div>', onClose: () => { clearInterval(this.t1); clearInterval(this.stTimer); },
      foot: `<nav class="wa-nav">${[['chat', 'fa-message', 'Chat'], ['upd', 'fa-circle-notch', 'Pembaruan'], ['kom', 'fa-user-group', 'Komunitas'], ['call', 'fa-phone', 'Panggilan']].map(([k, i, l]) => `<button data-t="${k}" class="${k === 'chat' ? 'on' : ''}"><i class="fa-solid ${i}"></i><span>${l}</span><b class="wa-bd hidden" id="wa-bd-${k}"></b></button>`).join('')}</nav>`,
      on: el => { el.querySelectorAll('.wa-nav [data-t]').forEach(b => b.onclick = () => this.go(b.dataset.t)); this.boot(); } });
  },
  async deep(id, name) { if (!id || !Ban.on()) return; if (!await this.gate()) return; if (!Sheet.isOpen('wa')) await this.open(); if (Sheet.isOpen('wa') && !(this.C && this.C.id === id)) this.openChat(id, name || this.uname(id)); },
  async boot() {
    this.av.clear(); this.go('chat');
    try { await this.users(true); } catch (e) {}
    await Promise.all([this.loadMeta(), this.pollIb()]);
    this.paintPP(); clearInterval(this.t1); this.t1 = setInterval(() => { if (!document.hidden && Sheet.isOpen('wa')) this.pollIb(); }, 4000);
  },
  async loadMeta() { const me = this.me(), g = p => this.rq(p).catch(() => null); const [vf, bl, pf, vq] = await Promise.all([g('wa/vf'), g('wa/bl/' + me), g('wa/prof/' + me), g('wa/vq/' + me)]); this.S.vf = vf || {}; this.S.bl = bl || {}; this.S.prof = pf || {}; this.S.vq = vq; },
  async paintPP() { const me = this.me(), v = await this.avGet(me); if (v) { LS.set('wa_pp', { k: me, v }); this.pp(); } },
  pp() { const p = LS.get('wa_pp'), el = $('u-avatar'); if (!el || !App.user) return; if (!(p && p.k === this.me() && Chat.RE_IMG.test(p.v))) { el.innerHTML = `<span class="u-ini">${esc(this.myName().charAt(0).toUpperCase())}</span>`; return; } el.innerHTML = `<img src="${p.v}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"/>`; },
  go(t) { if (t === 'me') { const b = $('wst-v'); if (b) this.v_me(b); return; } if (t !== 'upd') clearInterval(this.stTimer); this.S.tab = t; document.querySelectorAll('.wa-nav [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t)); const v = $('wa-v'); if (v) this['v_' + t](v); Sheet.$('wa') && (Sheet.$('wa').scrollTop = 0); },

  /* ---------- daftar chat (riwayat) ---------- */
  async pollIb() {
    try {
      const me = this.me(), [ib, vf] = await Promise.all([this.rq('wa/ib/' + me), this.rq('wa/vf').catch(() => null)]); this.S.vf = vf || this.S.vf; const n = ib || {}; let fresh = false;
      if (this.S.ib_ready) for (const [k, e] of Object.entries(n)) { const o = this.S.ib[k]; if (e.k !== me && (!o || e.ts > o.ts) && !(this.C && this.C.id === k)) fresh = true; }
      this.S.ib = n; this.S.ib_ready = 1; if (fresh) this.beep();
      if (this.S.tab === 'chat') this.drawList(); this.badge();
    } catch (e) {}
  },
  unread(k, e) { return e.k !== this.me() && e.ts > (this.S.rd[k] || 0); },
  badge() { const n = Object.entries(this.S.ib).filter(([k, e]) => e && e.ts && !this.S.bl[k] && this.unread(k, e)).length, b = $('wa-bd-chat'); if (b) { b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hidden', !n); } },
  async cnt(k, e) { const me = this.me(), c = this.cn[k]; if (c && c.ts === e.ts) return c.n; const d = await this.rq(k.startsWith('g:') ? 'wa/gm/' + k.slice(2) : 'wa/dm/' + this.pair(me, k), { orderBy: '$key', limitToLast: 30 }), rd = this.S.rd[k] || 0, n = Object.values(d || {}).filter(m => m.k !== me && m.ts > rd).length; this.cn[k] = { ts: e.ts, n }; return n; },
  v_chat(v) {
    v.innerHTML = `${this.home('DimzzChat', '<button class="wa-ib" id="wa-cm" aria-label="Status baru"><i class="fa-solid fa-camera"></i></button>' + this.mnb, 1)}${Push.ok() && Push.perm() === 'default' && LS.get('push_on', 1) !== 0 && !LS.get('push_ask') ? '<div class="wa-pn" id="wa-pn"><i class="fa-solid fa-bell"></i><span>Aktifkan notifikasi agar pesan tetap muncul di layar HP walau web ditutup.</span><button class="btn btn-sm btn-pri" id="wa-pn-y">Aktifkan</button><button class="wa-ib sm" id="wa-pn-x" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></div>' : ''}<div class="wa-sr"><i class="fa-solid fa-magnifying-glass"></i><input id="wa-q" type="text" placeholder="Cari chat…" autocomplete="off" value="${esc(this.S.q)}"/></div><div class="wa-fl">${[['all', 'Semua'], ['u', 'Belum dibaca'], ['f', 'Favorit'], ['g', 'Grup']].map(([k, l]) => `<button data-f="${k}" class="${this.S.f === k ? 'on' : ''}">${l}</button>`).join('')}</div><div id="wa-l"></div><button class="wa-fab" id="wa-new" aria-label="Chat baru"><i class="fa-solid fa-comment-medical"></i></button>`;
    this.menu(v, [['Grup baru', () => this.newGroup()], ['Baca semua', () => this.readAll()], ['Pengaturan', () => this.settings()], ['Alihkan akun', () => this.switchAcc()]]);
    $('wa-cm').onclick = () => this.addSt();
    $('wa-q').oninput = e => { this.S.q = e.target.value; this.drawList(); };
    v.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { this.S.f = b.dataset.f; v.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); this.drawList(); });
    $('wa-new').onclick = () => this.newChat(); this.drawList();
    const py = $('wa-pn-y'); if (py) { py.onclick = async () => { py.disabled = true; try { await Push.enable(); UI.toast('Notifikasi aktif', 'ok'); } catch (e) { UI.toast(e.message || 'Gagal mengaktifkan notifikasi', 'err'); } const b = $('wa-pn'); if (b) b.remove(); LS.set('push_ask', 1); }; $('wa-pn-x').onclick = () => { LS.set('push_ask', 1); $('wa-pn').remove(); }; }
  },
  drawList() {
    const L = $('wa-l'); if (!L) return; const me = this.me(), q = this.S.q.toLowerCase(), f = this.S.f, fv = this.fav();
    const a = Object.entries(this.S.ib).filter(([k, e]) => e && e.ts && !this.S.bl[k] && (!q || String(e.u).toLowerCase().includes(q)) && (f === 'all' || (f === 'g' && k.startsWith('g:')) || (f === 'f' && fv[k]) || (f === 'u' && this.unread(k, e)))).sort((x, y) => y[1].ts - x[1].ts);
    L.innerHTML = a.length ? a.map(([k, e]) => { const un = this.unread(k, e), tick = e.k === me && !k.startsWith('g:') ? '<i class="fa-solid fa-check-double wa-tk2"></i> ' : ''; return `<button class="wa-row" data-id="${esc(k)}" data-n="${esc(e.u)}">${this.avatar(k, e.u, 52)}<span class="wa-m"><span class="wa-l1"><b>${this.nm(k, e.u)}</b><small class="${un ? 'un' : ''}">${this.dl(e.ts)}</small></span><span class="wa-l2"><span class="wa-pv">${tick}${esc(e.t || '')}</span>${un ? `<i class="wa-n" data-c="${esc(k)}">•</i>` : ''}</span></span></button>`; }).join('') : emptyHtml(f === 'f' ? 'fa-star' : 'fa-comments', f === 'f' ? 'Belum ada favorit.<br>Buka chat lalu pilih “Favoritkan” di menu ⋮.' : 'Belum ada chat.<br>Ketuk tombol hijau untuk mulai ngobrol.');
    L.querySelectorAll('.wa-row').forEach(b => b.onclick = () => this.openChat(b.dataset.id, b.dataset.n));
    this.hydrate(L); a.filter(([k, e]) => this.unread(k, e)).slice(0, 8).forEach(([k, e]) => this.cnt(k, e).then(n => { const b = L.querySelector(`[data-c="${k}"]`); if (b) b.textContent = n > 99 ? '99+' : n || '•'; }).catch(() => {}));
  },
  async newChat() {
    this.sheet({ id: 'wan', body: `${this.top('Chat baru', 'wan')}<div class="wa-sr"><i class="fa-solid fa-magnifying-glass"></i><input id="wn-q" type="text" placeholder="Cari username…" autocomplete="off"/></div><button class="wa-row" id="wn-g"><span class="wa-av ic" style="--s:46px"><i class="fa-solid fa-user-group"></i></span><span class="wa-m"><b>Grup baru</b></span></button><div id="wn-l">${loadingHtml()}</div>`,
      on: async () => {
        $('wn-g').onclick = () => this.newGroup();
        let us = []; try { us = await this.users(); } catch (e) { return void ($('wn-l').innerHTML = this.errBox(e)); }
        const me = this.me(), draw = q => { const box = $('wn-l'); if (!box) return; const dg = q.replace(/\D/g, ''); const l = us.filter(u => { const k = userKey(u.username); return k !== me && !this.S.bl[k] && (!q || (u.username + ' ' + (this.S.dn[k] || '')).toLowerCase().includes(q)); }).sort((a, b) => this.uname(userKey(a.username)).localeCompare(this.uname(userKey(b.username))));
          box.innerHTML = (dg.length >= 8 ? `<button class="wa-row" id="wn-ph"><span class="wa-av ic" style="--s:46px"><i class="fa-solid fa-phone"></i></span><span class="wa-m"><b>Cari nomor ${esc(this.fmtPh(this.normPh(dg)))}</b><small class="muted">Ketuk untuk mencari pemilik nomor</small></span></button>` : '') + (l.length ? l.map(u => { const k = userKey(u.username); return `<button class="wa-row" data-k="${esc(k)}" data-n="${esc(this.uname(k))}">${this.avatar(k, this.uname(k))}<span class="wa-m"><b>${this.nm(k, this.uname(k))}</b><small class="muted">@${esc(u.username)}</small></span></button>`; }).join('') : (dg.length >= 8 ? '' : emptyHtml('fa-user-slash', 'Tidak ada pengguna.')));
          box.querySelectorAll('.wa-row[data-k]').forEach(b => b.onclick = () => { Sheet.close('wan', true); this.openChat(b.dataset.k, b.dataset.n); }); this.hydrate(box);
          const pb = $('wn-ph'); if (pb) pb.onclick = async () => { try { const k = await this.rq('wa/pi/' + this.normPh(dg)); if (!k) return UI.toast('Nomor ini belum terdaftar di DimzzChat', 'warn'); if (k === me) return UI.toast('Itu nomormu sendiri', 'info'); await this.users(true).catch(() => {}); Sheet.close('wan', true); this.openChat(k, this.uname(k)); } catch (e) { UI.toast(this.errMsg(e), 'err'); } }; };
        draw(''); $('wn-q').oninput = e => draw(e.target.value.toLowerCase());
      } });
  },
  async newGroup() {
    this.sheet({ id: 'wag', body: `${this.top('Grup baru', 'wag')}<div style="padding:12px"><input id="wg-n" type="text" maxlength="40" placeholder="Nama grup" autocomplete="off"/></div><div class="wa-sec">Pilih anggota (maks. 49)</div><div id="wg-l">${loadingHtml()}</div><div style="padding:12px"><button class="btn btn-pri" id="wg-go" style="width:100%"><i class="fa-solid fa-check"></i> Buat grup</button></div>`,
      on: async () => {
        let us = []; try { us = (await this.users()).filter(u => userKey(u.username) !== this.me()); } catch (e) {}
        $('wg-l').innerHTML = us.map(u => `<label class="wa-row"><input type="checkbox" value="${esc(userKey(u.username))}" style="width:20px;height:20px;flex:none"/>${this.avatar(userKey(u.username), u.username, 40)}<span class="wa-m"><b>${esc(u.username)}</b></span></label>`).join('') || emptyHtml('fa-user-slash', 'Belum ada pengguna lain.'); this.hydrate($('wg-l'));
        $('wg-go').onclick = async () => {
          const n = $('wg-n').value.trim(), sel = [...$('wg-l').querySelectorAll('input:checked')].map(i => i.value).slice(0, 49); if (!n) return UI.toast('Isi nama grup', 'warn'); if (!sel.length) return UI.toast('Pilih minimal 1 anggota', 'warn');
          const me = this.me(), gid = this.nid(), ts = Date.now(), m = { [me]: 'a' }; sel.forEach(k => m[k] = 'm');
          try { await this.rq('wa/g/' + gid, null, 'PUT', { n, o: me, ts, m }); const up = {}; Object.keys(m).forEach(k => up[`ib/${k}/g:${gid}`] = { u: n, g: 1, t: this.myName() + ' membuat grup', ts, k: me }); await this.rq('wa', null, 'PATCH', up); Sheet.close('wag', true); Sheet.close('wan', true); this.openChat('g:' + gid, n); } catch (e) { UI.toast(this.errMsg(e), 'err'); }
        };
      } });
  },

  /* ---------- percakapan (pribadi & grup) ---------- */
  async openChat(id, name) {
    const me = this.me(), g = id.startsWith('g:'); if (g) { const gi = await this.rq('wa/g/' + id.slice(2)).catch(() => null); if (!gi || !gi.m || !gi.m[me]) return UI.toast('Grup privat: kamu bukan anggota grup ini.', 'err'); } const C = this.C = { id, g, name: name || this.uname(id), other: g ? null : id, gid: g ? id.slice(2) : null, pair: g ? null : this.pair(me, id), msgs: [], prd: 0, n: 0, info: null }; let off = () => {};
    this.sheet({ id: 'wac', onClose: () => { clearInterval(C.t); off(); if (this.C === C) this.C = null; this.drawList(); this.badge(); },
      body: `<div class="wa-top wa-ch"><button class="wa-ib" data-x="wac" aria-label="Kembali"><i class="fa-solid fa-arrow-left"></i></button><button class="wa-ct" id="wc-ti">${this.avatar(id, C.name, 40)}<span><b>${this.nm(id, C.name)}</b><small>${g ? 'Ketuk untuk info grup' : 'Ketuk untuk profil'}</small></span></button>${g ? '' : '<button class="wa-ib" id="wc-cv" aria-label="Video call"><i class="fa-solid fa-video"></i></button><button class="wa-ib" id="wc-ca" aria-label="Telepon suara"><i class="fa-solid fa-phone"></i></button>'}<button class="wa-ib" id="wc-mn" aria-label="Menu"><i class="fa-solid fa-ellipsis-vertical"></i></button></div><div id="wc-l" class="wa-ml">${loadingHtml('Memuat…')}</div>`,
      foot: `<div id="wc-emo" class="wa-emo hidden">${this.EMO.map(x => `<button type="button">${x}</button>`).join('')}</div><div class="wa-cb"><div class="wa-pill"><button class="wa-ib" id="wc-em" aria-label="Emoji"><i class="fa-regular fa-face-smile"></i></button><textarea id="wc-in" rows="1" maxlength="1000" placeholder="Ketik pesan" enterkeyhint="send" autocomplete="off"></textarea><button class="wa-ib" id="wc-at" aria-label="Lampirkan"><i class="fa-solid fa-paperclip"></i></button><button class="wa-ib" id="wc-cm" aria-label="Kamera"><i class="fa-solid fa-camera"></i></button></div><button class="wa-go" id="wc-go" aria-label="Kirim atau rekam"><i class="fa-solid fa-microphone"></i></button></div><input type="file" id="wc-f" accept="image/*,video/*,audio/*" hidden/><input type="file" id="wc-cf" accept="image/*" capture="environment" hidden/>`,
      on: () => {
        off = this.vvFit('wac'); const inp = $('wc-in'), go = $('wc-go'), touch = matchMedia('(pointer:coarse)').matches;
        inp.oninput = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; if (!(this.rec && this.rec.state === 'recording')) go.innerHTML = inp.value.trim() ? '<i class="fa-solid fa-paper-plane"></i>' : '<i class="fa-solid fa-microphone"></i>'; };
        inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !touch) { e.preventDefault(); if (inp.value.trim()) this.send(); } }; go.onclick = () => inp.value.trim() ? this.send() : this.recordVN();
        const pick = async f => { if (!f) return; if (!await this.okSend()) return; UI.toast('Mengirim…', 'info', 1800); try { await this.send(await this.upload(f), inp.value.trim()); inp.value = ''; inp.oninput(); } catch (x) { UI.toast(this.errMsg(x), 'err'); } };
        $('wc-at').onclick = () => $('wc-f').click(); $('wc-cm').onclick = () => $('wc-cf').click();
        $('wc-f').onchange = e => { const f = e.target.files[0]; e.target.value = ''; pick(f); }; $('wc-cf').onchange = e => { const f = e.target.files[0]; e.target.value = ''; pick(f); };
        $('wc-em').onclick = () => $('wc-emo').classList.toggle('hidden'); $('wc-emo').onclick = e => { const b = e.target.closest('button'); if (!b) return; inp.value += b.textContent; inp.oninput(); inp.focus(); };
        $('wc-ti').onclick = () => g ? this.ginfo() : this.profile(id, C.name);
        if (!g) { $('wc-ca').onclick = () => this.startCall('a'); $('wc-cv').onclick = () => this.startCall('v'); }
        $('wc-mn').onclick = e => { e.stopPropagation(); const fv = [this.fav()[id] ? 'Hapus dari favorit' : 'Favoritkan', () => this.togFav(id)]; this.pop(e.currentTarget, g ? [['Info grup', () => this.ginfo()], fv, ['Keluar grup', () => this.leave()]] : [['Lihat profil', () => this.profile(id, C.name)], fv, ['Blokir', () => this.block(id)], ['Cek Rules', () => this.diag()], ['Hapus dari daftar', async () => { await this.rq(`wa/ib/${me}/${id}`, null, 'DELETE').catch(() => {}); Sheet.close('wac'); this.pollIb(); }]]); };
        $('wc-l').onclick = e => { const b = e.target.closest('.wa-b'); if (!b || e.target.closest('img,video,audio,.wa-act')) return; const was = b.classList.contains('sel'); document.querySelectorAll('.wa-b.sel').forEach(x => x.classList.remove('sel')); if (!was) b.classList.add('sel'); };
        $('wc-l').addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a) return; const b = a.closest('.wa-b'), m = C.msgs.find(x => x.id === b.dataset.id); if (!m) return; if (a.dataset.a === 'c') copyText(m.t || ''); else this.del(m); });
        this.pollC(true); clearInterval(C.t); C.t = setInterval(() => { if (!document.hidden) this.pollC(); }, 2000);
      } });
  },
  async pollC(first) {
    const C = this.C; if (!C || C.busy) return; C.busy = 1;
    try {
      const me = this.me(), d = await this.rq(C.g ? 'wa/gm/' + C.gid : 'wa/dm/' + C.pair, { orderBy: '$key', limitToLast: 60 }, 'GET', undefined, 9000); if (this.C !== C) return;
      const srv = Object.entries(d || {}).map(([id, m]) => ({ id, ...m })).filter(m => m && m.k && (m.t || m.im)), pend = C.msgs.filter(m => m.pending && !srv.some(s => s.id === m.id));
      C.msgs = [...srv, ...pend].sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : 1));
      if (!C.g) C.prd = (await this.rq('wa/rd/' + C.pair + '/' + C.other).catch(() => 0)) || 0; else if (first || ++C.n % 8 === 0) C.info = (await this.rq('wa/g/' + C.gid).catch(() => null)) || C.info;
      const inN = C.msgs.filter(m => m.k !== me).length; if (!first && inN > (C.inN || 0)) this.beep(); C.inN = inN;
      this.drawC(first); this.markRead();
    } catch (e) { if (first) { const l = $('wc-l'); if (l) l.innerHTML = this.errBox(e); } } finally { C.busy = 0; }
  },
  markRead() { const C = this.C, me = this.me(), inc = C.msgs.filter(m => m.k !== me); if (!inc.length) return; const mx = Math.max(...inc.map(m => m.ts)); if (mx > (this.S.rd[C.id] || 0)) { this.S.rd[C.id] = mx; LS.set('wa_rd', this.S.rd); if (!C.g) this.rq('wa/rd/' + C.pair + '/' + me, null, 'PUT', mx).catch(() => {}); } },
  drawC(force) {
    const C = this.C, l = $('wc-l'); if (!l) return; const me = this.me(), sig = C.msgs.map(m => m.id + (m.pending ? 'p' : '') + (m.ts <= C.prd ? 'r' : '')).join(); if (sig === C.sig && !force) return; C.sig = sig;
    const body = Sheet.$('wac'), near = body.scrollHeight - body.scrollTop - body.clientHeight < 160; let day = '';
    l.innerHTML = C.msgs.length ? C.msgs.map(m => {
      const mine = m.k === me, d = Chat.dayLabel(m.ts), sep = d !== day ? (day = d, `<div class="ch-day"><span>${d}</span></div>`) : '', can = mine || App.isDev() || (C.g && C.info && C.info.m && C.info.m[me] === 'a');
      const st = !mine ? '' : m.pending ? '<i class="fa-regular fa-clock"></i>' : !C.g && m.ts <= C.prd ? '<i class="fa-solid fa-check-double rd"></i>' : '<i class="fa-solid fa-check"></i>';
      return `${sep}<div class="wa-b ${mine ? 'me' : ''}" data-id="${esc(m.id)}">${C.g && !mine ? `<b class="wa-sn" style="--h:${this.hue(m.k)}">${this.nm(m.k)}</b>` : ''}${m.im ? this.mt(m.ty, m.im) : ''}${m.t ? `<span class="selectable">${esc(m.t).replace(/\n/g, '<br>')}</span>` : ''}<small>${this.hm(m.ts)} ${st}</small><span class="wa-act">${m.t ? '<button data-a="c"><i class="fa-regular fa-copy"></i> Salin</button>' : ''}${can && !m.pending ? '<button data-a="d"><i class="fa-regular fa-trash-can"></i> Hapus</button>' : ''}</span></div>`;
    }).join('') : emptyHtml('fa-comment-dots', 'Belum ada pesan.<br>Sapa dulu yuk 👋');
    this.hydrate(l); if (near || force) body.scrollTop = body.scrollHeight;
  },
  async recordVN() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return UI.toast('Browser tidak mendukung rekaman suara. Gunakan Chrome HTTPS.', 'warn');
    if (!await this.okSend()) return;
    const btn = $('wc-go'); if (!btn) return;
    if (this.rec && this.rec.state === 'recording') { this.rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
      const rec = this.rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = async () => { clearTimeout(this.recTimer); stream.getTracks().forEach(t => t.stop()); btn.classList.remove('recording'); { const ii = $('wc-in'); if (ii && ii.oninput) ii.oninput(); } if (!chunks.length) return; try { const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); const f = new File([blob], 'voice-note.' + (blob.type.includes('mp4') ? 'm4a' : 'webm'), { type: blob.type }); const up = await this.upload(f); await this.send(up, ''); } catch (e) { UI.toast(this.errMsg(e), 'err'); } };
      rec.start(); this.recTimer = setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 45000); btn.innerHTML = '<i class="fa-solid fa-stop"></i>';  btn.classList.add('recording'); UI.toast('Merekam VN… Tekan tombol merah untuk berhenti.', 'info');
    } catch (e) { UI.toast('Izin mikrofon ditolak atau tidak tersedia.', 'err'); }
  },
  async send(extra, text) {
    const C = this.C, i = $('wc-in'); const t = (extra ? text : i.value).trim(); if (!t && !extra) return; if (!extra && !await this.okSend()) return; if (!extra) { i.value = ''; i.oninput(); }
    const me = this.me(), id = this.nid(), ts = Date.now(), m = { k: me, ts, ...(t ? { t: t.slice(0, 1000) } : {}), ...(extra || {}) }; if (!C.g) m.to = C.other;
    const pv = ((extra ? (extra.ty === 'v' ? '🎬 Video' : extra.ty === 'a' ? '🎤 Voice note' : '📷 Foto') + (t ? ' ' : '') : '') + t).slice(0, 60), up = { [`${C.g ? 'gm/' + C.gid : 'dm/' + C.pair}/${id}`]: m };
    if (C.g) { const mem = C.info && C.info.m ? Object.keys(C.info.m) : [me]; mem.forEach(k => up[`ib/${k}/g:${C.gid}`] = { u: C.info ? C.info.n : C.name, g: 1, t: (this.myName() + ': ' + pv).slice(0, 70), ts, k: me }); }
    else { up[`ib/${me}/${C.other}`] = { u: C.name, t: pv, ts, k: me }; up[`ib/${C.other}/${me}`] = { u: this.myName(), t: pv, ts, k: me }; }
    C.msgs.push({ id, ...m, pending: 1 }); this.drawC(true);
    try { await this.rq('wa', null, 'PATCH', up); } catch (e) { C.msgs = C.msgs.filter(x => x.id !== id); this.drawC(true); UI.toast(e.permission ? 'Pesan tidak terkirim (kamu diblokir atau Rules belum dipasang)' : 'Pesan gagal dikirim', 'err'); if (!extra) { i.value = t; i.oninput(); } return; }
    try { const gm = C.g ? (C.info && C.info.m ? Object.keys(C.info.m) : []) : [C.other], gn = C.info ? C.info.n : C.name; Push.notify(gm, C.g ? { t: gn, n: gn, b: (this.myName() + ': ' + pv).slice(0, 140), c: 'g:' + C.gid, k: 'msg' } : { t: this.myName(), n: this.myName(), b: pv.slice(0, 140), c: me, k: 'msg' }); } catch (e) {}
    this.pollC(); this.pollIb();
  },
  async del(m) { const C = this.C; if (!await UI.confirm('Hapus pesan?', 'Pesan dihapus untuk semua orang di chat ini.', { ok: 'Hapus', danger: true, icon: 'fa-trash' })) return; try { await this.rq((C.g ? 'wa/gm/' + C.gid : 'wa/dm/' + C.pair) + '/' + m.id, null, 'DELETE'); if (m.im) this.rq('wa/md/' + m.im, null, 'DELETE').catch(() => {}); C.msgs = C.msgs.filter(x => x.id !== m.id); this.drawC(true); } catch (e) { UI.toast('Gagal menghapus', 'err'); } },
  async block(k) { if (!await UI.confirm('Blokir ' + this.uname(k) + '?', 'Dia tidak bisa mengirim pesan lagi dan chatnya disembunyikan.', { ok: 'Blokir', danger: true, icon: 'fa-ban' })) return; try { await this.rq(`wa/bl/${this.me()}/${k}`, null, 'PUT', 1); this.S.bl[k] = 1; Sheet.close('wac'); this.pollIb(); UI.toast('Diblokir', 'ok'); } catch (e) { UI.toast(this.errMsg(e), 'err'); } },
  async profile(k, n) {
    this.sheet({ id: 'wap1', body: `${this.top('Profil', 'wap1')}<div class="wa-pf">${this.avatar(k, n, 96, 'big')}<b>${this.nm(k, n)}</b><small id="pf-ab">…</small></div>`, on: async () => { this.hydrate($('sb-wap1')); const p = await this.rq('wa/prof/' + k).catch(() => null); const a = $('pf-ab'); if (a) a.textContent = (p && p.b) || 'Hai! Saya pakai DimzzChat'; } });
  },
  async ginfo() {
    const C = this.C, me = this.me(); C.info = (await this.rq('wa/g/' + C.gid).catch(() => null)) || C.info; if (!C.info) return UI.toast('Info grup tidak tersedia', 'err');
    const draw = () => { const i = C.info, adm = i.m[me] === 'a', ms = Object.entries(i.m); const b = $('sb-wai'); if (!b) return; b.innerHTML = `${this.top('Info grup', 'wai')}<div class="wa-pf">${this.avatar('g:' + C.gid, i.n, 96, 'big')}<b>${esc(i.n)}</b><small>${ms.length} anggota</small></div>${adm ? '<button class="wa-row" id="gi-add"><span class="wa-av ic" style="--s:46px"><i class="fa-solid fa-user-plus"></i></span><span class="wa-m"><b>Tambah anggota</b></span></button>' : ''}${ms.map(([k, r]) => `<div class="wa-row" style="cursor:default">${this.avatar(k, this.uname(k), 40)}<span class="wa-m"><b>${this.nm(k)}</b>${r === 'a' ? '<small class="muted">Admin</small>' : ''}</span>${adm && k !== me && k !== i.o ? `<button class="btn btn-sm btn-danger" data-rm="${esc(k)}">Keluarkan</button>` : ''}</div>`).join('')}<div style="padding:12px"><button class="btn btn-danger" id="gi-lv" style="width:100%"><i class="fa-solid fa-right-from-bracket"></i> Keluar grup</button></div>`; this.hydrate(b);
      $('gi-lv').onclick = () => this.leave(); const ad = $('gi-add'); if (ad) ad.onclick = async () => { const u = await UI.prompt('Tambah anggota', 'Ketik username persis.', { placeholder: 'username' }); if (!u) return; const k = userKey(u.trim()); await this.users().catch(() => {}); if (!this.S.um[k]) return UI.toast('Username tidak ditemukan', 'warn'); if (i.m[k]) return UI.toast('Sudah jadi anggota', 'warn'); if (ms.length >= 50) return UI.toast('Grup penuh (50)', 'warn'); try { await this.rq('wa', null, 'PATCH', { [`g/${C.gid}/m/${k}`]: 'm', [`ib/${k}/g:${C.gid}`]: { u: i.n, g: 1, t: 'Kamu ditambahkan ke grup', ts: Date.now(), k: me } }); i.m[k] = 'm'; draw(); } catch (e) { UI.toast(this.errMsg(e), 'err'); } };
      b.querySelectorAll('[data-rm]').forEach(x => x.onclick = async () => { const k = x.dataset.rm; try { await this.rq('wa', null, 'PATCH', { [`g/${C.gid}/m/${k}`]: null, [`ib/${k}/g:${C.gid}`]: null }); delete i.m[k]; draw(); } catch (e) { UI.toast(this.errMsg(e), 'err'); } }); };
    this.sheet({ id: 'wai', body: '', on: draw });
  },
  async leave() {
    const C = this.C, me = this.me(); if (!await UI.confirm('Keluar grup?', 'Kamu tidak akan menerima pesan grup ini lagi.', { ok: 'Keluar', danger: true, icon: 'fa-right-from-bracket' })) return;
    const up = { [`g/${C.gid}/m/${me}`]: null, [`ib/${me}/g:${C.gid}`]: null }, m = (C.info && C.info.m) || {}; if (m[me] === 'a' && !Object.entries(m).some(([k, r]) => k !== me && r === 'a')) { const nx = Object.keys(m).find(k => k !== me); if (nx) up[`g/${C.gid}/m/${nx}`] = 'a'; }
    try { await this.rq('wa', null, 'PATCH', up); Sheet.close('wai'); Sheet.close('wac'); this.pollIb(); } catch (e) { UI.toast(this.errMsg(e), 'err'); }
  },

  /* ---------- gerbang masuk: nomor telepon + nama kontak ---------- */
  normPh(s) { let d = String(s || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d; },
  fmtPh: p => p ? '+' + String(p).replace(/^(\d{2})(\d{3,4})(\d{3,4})(\d*)$/, '$1 $2-$3-$4').replace(/-$/, '') : '',
  errBox: e => e && e.permission ? '<div class="empty" style="color:#b91c1c"><i class="fa-solid fa-triangle-exclamation"></i>Rules Firebase belum dipasang atau menolak akses.<br><button class="btn btn-pri btn-sm" data-diag style="margin-top:10px">Cek Rules</button></div>' : errHtml(WA.errMsg(e || {})),
  async gate() {
    const me = this.me(); if (LS.get('wa_on_' + me)) { this.S.ph = LS.get('wa_ph_' + me, ''); return true; }
    try { const [ph, dn] = await Promise.all([this.rq('wa/ph/' + me), this.rq('wa/dn/' + me)]); if (ph && dn) { LS.set('wa_on_' + me, 1); LS.set('wa_ph_' + me, ph); this.S.ph = ph; this.S.dn[me] = dn; return true; } }
    catch (e) { if (e.permission) { this.diag(); return false; } UI.toast('Gagal memeriksa akun, periksa internet', 'err'); return false; }
    this.onboard(); return false;
  },
  onboard() {
    let ph = '';
    this.sheet({ id: 'waon', body: '<div class="wa-on"><div class="wa-lg"><i class="fa-solid fa-comment-dots"></i></div><h1>Selamat datang di DimzzChat</h1><p id="on-p"></p><div id="on-b"></div></div>',
      on: () => {
        const b = $('on-b'), p = $('on-p');
        const s1 = () => { p.textContent = 'Masukkan nomor teleponmu agar teman bisa menemukanmu.'; b.innerHTML = `<div class="wa-fd"><span>+62</span><input id="on-ph" type="tel" inputmode="tel" placeholder="812 3456 7890" value="${esc(ph.replace(/^62/, ''))}" autocomplete="tel"/></div><button class="btn btn-pri" id="on-n" style="width:100%">Lanjut <i class="fa-solid fa-arrow-right"></i></button><small>Nomor dipakai untuk pencarian kontak. Tanpa kode SMS.</small>`; $('on-ph').focus();
          $('on-n').onclick = async () => { let d = $('on-ph').value.replace(/\D/g, '').replace(/^0+/, ''); if (d.startsWith('62')) d = d.slice(2); if (d.length < 8 || d.length > 13) return UI.toast('Nomor tidak valid (8–13 angka setelah +62)', 'warn'); const n = $('on-n'); n.disabled = true; try { const ex = await this.rq('wa/pi/62' + d); if (ex && ex !== this.me()) { n.disabled = false; return UI.toast('Nomor ini sudah dipakai akun lain', 'err'); } } catch (e) { n.disabled = false; return UI.toast(this.errMsg(e), 'err'); } ph = '62' + d; s2(); }; };
        const s2 = () => { p.textContent = 'Terakhir, masukkan nama kontakmu. Nama ini yang dilihat temanmu.'; b.innerHTML = `<div class="wa-fd"><i class="fa-solid fa-id-card"></i><input id="on-nm" type="text" maxlength="30" placeholder="Nama kontak" value="${esc(App.user.username)}" autocomplete="name"/></div><div class="row" style="gap:8px"><button class="btn" id="on-b1" style="flex:1">Kembali</button><button class="btn btn-pri" id="on-go" style="flex:2">Mulai <i class="fa-solid fa-check"></i></button></div><small>Nomormu: ${esc(this.fmtPh(ph))}</small>`; $('on-nm').focus(); $('on-b1').onclick = s1;
          $('on-go').onclick = async () => { const nm = $('on-nm').value.trim(); if (nm.length < 2) return UI.toast('Nama minimal 2 huruf', 'warn'); const me = this.me(), g = $('on-go'); g.disabled = true; try { await this.rq('wa', null, 'PATCH', { [`ph/${me}`]: ph, [`pi/${ph}`]: me, [`dn/${me}`]: nm }); LS.set('wa_on_' + me, 1); LS.set('wa_ph_' + me, ph); this.S.ph = ph; this.S.dn[me] = nm; Sheet.close('waon', true); this.open(); } catch (e) { g.disabled = false; UI.toast(this.errMsg(e), 'err'); } }; };
        s1();
      } });
  },
  async diag() {
    const me = this.me(), T = [['Daftar centang biru', 'wa/vf'], ['Saluran', 'wa/c'], ['Status', 'wa/st'], ['Nama kontak', 'wa/dn'], ['Chat masuk', 'wa/ib/' + me], ['Nomor telepon', 'wa/ph/' + me], ['Panggilan', 'wa/ic/' + me], ['Notifikasi layar HP', 'wa/ps/' + me]];
    this.sheet({ id: 'wadg', body: `${this.top('Cek Rules Firebase', 'wadg')}<div id="dg-l" style="padding:14px">${loadingHtml('Memeriksa…')}</div>`, on: async () => {
      const r = []; for (const [l, p] of T) { try { await this.rq(p, { shallow: true }); r.push([l, 1]); } catch (e) { r.push([l, 0]); } } const bad = r.some(x => !x[1]), b = $('dg-l'); if (!b) return;
      b.innerHTML = `<div class="card" style="padding:6px 14px">${r.map(([l, o]) => `<div class="kv"><span>${esc(l)}</span><b style="color:${o ? '#16a34a' : '#dc2626'}">${o ? '✓ OK' : '✗ Ditolak'}</b></div>`).join('')}</div>` + (bad ? `<div class="banner" style="margin-top:12px"><i class="fa-solid fa-circle-info" style="margin-top:2px"></i><div><b>Cara memperbaiki:</b><br>1. Buka Firebase Console → <b>Realtime Database</b> (bukan Firestore) → tab <b>Rules</b>.<br>2. Hapus semua isinya, tempel seluruh isi <b>firebase-rules-tambahan.json</b> dari zip v3.21.<br>3. Tekan <b>Publish</b>, lalu tutup dan buka lagi web ini.</div></div>` : '<div class="banner" style="margin-top:12px"><i class="fa-solid fa-circle-check" style="margin-top:2px"></i><div>Semua Rules terpasang. Silakan tutup halaman ini dan buka DimzzChat lagi.</div></div>') + '<div style="padding:12px 0"><button class="btn btn-pri" id="dg-re" style="width:100%">Periksa ulang</button></div>';
      $('dg-re').onclick = () => { Sheet.close('wadg', true); this.diag(); }; } });
  },

  /* ---------- panggilan suara & video (WebRTC; sinyal lewat Firebase) ---------- */
  ICE: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' }] },
  K: null, ringing: null,
  tone(fr, d) { try { const a = this.ac || (this.ac = new (window.AudioContext || window.webkitAudioContext)()), o = a.createOscillator(), g = a.createGain(); o.frequency.value = fr; g.gain.setValueAtTime(.0001, a.currentTime); g.gain.exponentialRampToValueAtTime(.22, a.currentTime + .03); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + d); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + d + .05); } catch (e) {} },
  rtOn() { this.rtOff(); const f = () => { this.tone(440, .25); setTimeout(() => this.tone(520, .25), 300); }; f(); this.rt = setInterval(f, 1800); },
  rtOff() { clearInterval(this.rt); },
  ov() { const o = $('wacall'); if (o) o.remove(); const n = document.createElement('div'); n.id = 'wacall'; document.body.appendChild(n); return n; },
  ovClose() { const o = $('wacall'); if (o) o.remove(); },
  setSt(t) { const e = $('wk-st'); if (e) e.textContent = t; },
  startCalls() { if (this.cpt) return; this.cpt = setInterval(() => { if (document.hidden || !App.user || this.K || this.ringing || FB.mode !== 'firebase' || !FB.st.idToken) return; this.icPoll(); }, 2500); },
  async icPoll() {
    const me = this.me(); let e; try { if (!this.blOk) { this.S.bl = (await this.rq('wa/bl/' + me)) || {}; this.blOk = 1; } e = await this.rq('wa/ic/' + me, null, 'GET', undefined, 6000); } catch (x) { return; }
    if (!e || !e.f) return; if (Date.now() - e.ts > 45000) return void this.rq('wa/ic/' + me, null, 'DELETE').catch(() => {});
    if (this.S.bl[e.f] || this.K || this.ringing) return; this.ring(e);
  },
  startCall(ty) { const C = this.C; if (!C || C.g) return; this.callTo(C.other, C.name, ty); },
  callTo(k, name, ty) {
    if (this.K || this.ringing) return UI.toast('Sedang dalam panggilan', 'warn');
    if (!navigator.mediaDevices || !window.RTCPeerConnection) return UI.alert('Tidak didukung', 'Browsermu belum mendukung panggilan suara/video.', { type: 'warn' });
    this.callBegin({ pair: this.pair(this.me(), k), other: k, name, ty, out: true });
  },
  addCall(K, dur) { const key = 'wa_calls_' + this.me(), l = LS.get(key, []); l.unshift({ k: K.other, n: K.name, ty: K.ty, o: K.out ? 1 : 0, d: dur || 0, ts: Date.now() }); LS.set(key, l.slice(0, 50)); if (this.S.tab === 'call' && $('wa-v')) this.v_call($('wa-v')); },
  ring(e) {
    const pair = e.p, from = e.f, name = e.n || this.uname(from), me = this.me(); this.ringing = e; Sound.play('call');
    const ov = this.ov(); ov.className = 'wacall ring';
    ov.innerHTML = `<div class="wk-info">${this.avatar(from, name, 120, 'big pulse')}<h3>${esc(name)}</h3><small>${e.ty === 'v' ? 'Panggilan video masuk…' : 'Panggilan suara masuk…'}</small></div><div class="wk-btns"><button class="wk-b red" id="wk-rj"><i class="fa-solid fa-phone-slash"></i><span>Tolak</span></button><button class="wk-b grn" id="wk-ac"><i class="fa-solid ${e.ty === 'v' ? 'fa-video' : 'fa-phone'}"></i><span>Terima</span></button></div>`; this.hydrate(ov);
    this.rtOn(); try { navigator.vibrate && navigator.vibrate([400, 200, 400]); } catch (x) {}
    const stop = () => { clearInterval(this.rw); this.rtOff(); this.ringing = null; };
    this.rw = setInterval(async () => { const c = await this.rq('wa/cl/' + pair, null, 'GET', undefined, 6000).catch(() => undefined); if (c === undefined) return; if (!c || c.st === 'e' || Date.now() - e.ts > 45000) { stop(); this.addCall({ other: from, name, ty: e.ty, out: false }, 0); this.ovClose(); Sound.release('call'); this.rq('wa/ic/' + me, null, 'DELETE').catch(() => {}); } }, 1500);
    $('wk-rj').onclick = () => { stop(); this.ovClose(); Sound.release('call'); this.rq('wa/cl/' + pair, null, 'PATCH', { st: 'e', by: 'n' }).catch(() => {}); this.rq('wa/ic/' + me, null, 'DELETE').catch(() => {}); };
    $('wk-ac').onclick = () => { stop(); this.callBegin({ pair, other: from, name, ty: e.ty, out: false }); };
  },
  async callBegin(K) {
    this.K = K; const me = this.me(), vid = K.ty === 'v'; K.t = Date.now(); K.seen = {}; Sound.play('call');
    const ov = this.ov(); ov.className = 'wacall' + (vid ? ' vid' : '');
    ov.innerHTML = `<video id="wk-rv" class="wk-rv" autoplay playsinline></video>${vid ? '<video id="wk-lv" class="wk-lv" autoplay playsinline muted></video>' : ''}<div class="wk-info" id="wk-in">${this.avatar(K.other, K.name, 110, 'big')}<h3>${esc(K.name)}</h3><small id="wk-st">${K.out ? 'Memanggil…' : 'Menyambungkan…'}</small></div><div class="wk-btns"><button class="wk-b" id="wk-mu"><i class="fa-solid fa-microphone"></i><span>Bisukan</span></button>${vid ? '<button class="wk-b" id="wk-cm"><i class="fa-solid fa-video"></i><span>Kamera</span></button><button class="wk-b" id="wk-fl"><i class="fa-solid fa-camera-rotate"></i><span>Balik</span></button>' : ''}<button class="wk-b red" id="wk-end"><i class="fa-solid fa-phone-slash"></i><span>Akhiri</span></button></div>`; this.hydrate(ov);
    $('wk-end').onclick = () => this.callEnd('Panggilan diakhiri', true);
    const tg = (id, key, on, off) => { const b = $(id); if (!b) return; b.onclick = () => { K[key] = !K[key]; b.classList.toggle('off', K[key]); b.querySelector('i').className = 'fa-solid ' + (K[key] ? off : on); const tr = key === 'mu' ? K.local.getAudioTracks() : K.local.getVideoTracks(); tr.forEach(t => t.enabled = !K[key]); }; };
    try { K.local = await navigator.mediaDevices.getUserMedia({ audio: true, video: vid ? { facingMode: 'user' } : false }); }
    catch (e) { this.callEnd(vid ? 'Izin kamera/mikrofon ditolak' : 'Izin mikrofon ditolak', !K.out, 1); return; }
    if (this.K !== K) { K.local.getTracks().forEach(t => t.stop()); return; }
    tg('wk-mu', 'mu', 'fa-microphone', 'fa-microphone-slash'); tg('wk-cm', 'cm', 'fa-video', 'fa-video-slash');
    const fl = $('wk-fl'); if (fl) fl.onclick = async () => { try { K.fm = K.fm === 'environment' ? 'user' : 'environment'; const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: K.fm } }), nt = ns.getVideoTracks()[0], sd = K.pc.getSenders().find(s => s.track && s.track.kind === 'video'); if (sd) await sd.replaceTrack(nt); K.local.getVideoTracks().forEach(t => { t.stop(); K.local.removeTrack(t); }); K.local.addTrack(nt); $('wk-lv').srcObject = K.local; $('wk-lv').style.transform = K.fm === 'user' ? 'scaleX(-1)' : 'none'; } catch (e) { UI.toast('Tidak bisa membalik kamera', 'warn'); } };
    const lv = $('wk-lv'); if (lv) lv.srcObject = K.local;
    const pc = K.pc = new RTCPeerConnection(this.ICE), rv = $('wk-rv'); K.remote = new MediaStream(); rv.srcObject = K.remote;
    K.local.getTracks().forEach(t => pc.addTrack(t, K.local));
    pc.ontrack = e => { if (e.track && !K.remote.getTracks().includes(e.track)) K.remote.addTrack(e.track); rv.play && rv.play().catch(() => {}); };
    pc.onicecandidate = e => { if (e.candidate) this.rq(`wa/cc/${K.pair}/${me}/${this.nid()}`, null, 'PUT', e.candidate.toJSON()).catch(() => {}); };
    pc.onconnectionstatechange = () => { const s = pc.connectionState; if (s === 'connected') this.callUp(); else if (s === 'failed') this.callEnd('Koneksi gagal (jaringan memblokir panggilan)', true); };
    try {
      if (K.out) {
        await this.rq('wa/cc/' + K.pair, null, 'DELETE').catch(() => {});
        await pc.setLocalDescription(await pc.createOffer());
        await this.rq('wa/cl/' + K.pair, null, 'PUT', { f: me, t: K.other, ty: K.ty, st: 'r', ts: Date.now(), o: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
        await this.rq('wa/ic/' + K.other, null, 'PUT', { f: me, ty: K.ty, ts: Date.now(), p: K.pair, n: this.myName() }); this.rtOn(); try { Push.notify([K.other], { t: this.myName(), n: this.myName(), b: K.ty === 'v' ? '📹 Panggilan video masuk' : '📞 Panggilan suara masuk', c: me, k: 'call' }); } catch (x) {}
      } else {
        const c = await this.rq('wa/cl/' + K.pair); if (!c || !c.o || c.st === 'e') throw new Error('Panggilan sudah berakhir');
        await pc.setRemoteDescription(c.o); K.hasRd = 1; await pc.setLocalDescription(await pc.createAnswer());
        await this.rq('wa/cl/' + K.pair, null, 'PATCH', { a: { type: pc.localDescription.type, sdp: pc.localDescription.sdp }, st: 'a' }); this.rq('wa/ic/' + me, null, 'DELETE').catch(() => {});
      }
    } catch (e) { this.callEnd(e.permission ? 'Rules belum dipasang (ketuk Cek Rules di menu chat)' : e.message || 'Gagal memulai panggilan', true, 0); return; }
    K.poll = setInterval(() => this.callPoll(), 1200);
  },
  async callPoll() {
    const K = this.K; if (!K || K.busy) return; K.busy = 1;
    try {
      const c = await this.rq('wa/cl/' + K.pair, null, 'GET', undefined, 6000); if (this.K !== K) return;
      if (!c || c.st === 'e') return void this.callEnd(K.up ? 'Panggilan berakhir' : K.out ? (c && c.by === 'n' ? 'Panggilan ditolak' : 'Tidak dijawab') : 'Panggilan berakhir', false);
      if (K.out && c.a && !K.hasRd) { await K.pc.setRemoteDescription(c.a); K.hasRd = 1; this.setSt('Menyambungkan…'); }
      if (K.hasRd) { const cs = await this.rq('wa/cc/' + K.pair + '/' + K.other, null, 'GET', undefined, 6000); for (const [id, cd] of Object.entries(cs || {})) if (!K.seen[id]) { K.seen[id] = 1; await K.pc.addIceCandidate(cd).catch(() => {}); } }
      if (K.out && !K.up && c.st === 'r' && Date.now() - K.t > 45000) this.callEnd('Tidak dijawab', true);
    } catch (e) {} finally { K.busy = 0; }
  },
  callUp() { const K = this.K; if (!K || K.up) return; K.up = 1; K.tu = Date.now(); this.rtOff(); const o = $('wacall'); if (o) o.classList.add('live'); clearInterval(K.tm); this.setSt('00:00'); K.tm = setInterval(() => this.setSt(fmtDur((Date.now() - K.tu) / 1000)), 1000); },
  async callEnd(msg, notify, quiet) {
    const K = this.K; if (!K) return; this.K = null; clearInterval(K.poll); clearInterval(K.tm); this.rtOff(); Sound.release('call');
    try { K.local && K.local.getTracks().forEach(t => t.stop()); K.pc && K.pc.close(); } catch (e) {}
    const me = this.me(), dur = K.up ? Math.round((Date.now() - K.tu) / 1000) : 0; if (!quiet) this.addCall(K, dur);
    if (notify) this.rq('wa/cl/' + K.pair, null, 'PATCH', { st: 'e', by: K.up ? 'x' : K.out ? 'c' : 'n' }).catch(() => {});
    this.rq('wa/ic/' + (K.out ? K.other : me), null, 'DELETE').catch(() => {});
    if (K.out && !quiet) { this.logCall(K, dur); setTimeout(() => { this.rq('wa/cl/' + K.pair, null, 'DELETE').catch(() => {}); this.rq('wa/cc/' + K.pair, null, 'DELETE').catch(() => {}); }, 5000); }
    const o = $('wacall'); if (o) { o.classList.remove('live'); o.querySelectorAll('.wk-btns').forEach(x => x.remove()); this.setSt(msg + (dur ? ' · ' + fmtDur(dur) : '')); setTimeout(() => { if (o.isConnected && !this.K && !this.ringing) o.remove(); }, 1700); }
  },
  async logCall(K, dur) {
    const me = this.me(), id = this.nid(), ts = Date.now(), t = (K.ty === 'v' ? '🎥 Video call' : '📞 Panggilan suara') + (dur ? ' · ' + fmtDur(dur) : ' · tak terjawab');
    try { await this.rq('wa', null, 'PATCH', { [`dm/${K.pair}/${id}`]: { k: me, to: K.other, ts, t }, [`ib/${me}/${K.other}`]: { u: K.name, t, ts, k: me }, [`ib/${K.other}/${me}`]: { u: this.myName(), t, ts, k: me } }); } catch (e) {}
    if (this.C && this.C.id === K.other) this.pollC();
  },

  /* ---------- Pembaruan: status + saluran ---------- */
  v_upd(v) {
    v.innerHTML = `${this.home('Pembaruan', this.mnb)}<div class="wa-h3">Status</div><div class="wa-stg" id="wa-st">${loadingHtml()}</div><div class="wa-h3">Saluran <button class="wa-jl" id="wa-ex"><i class="fa-solid fa-table-cells-large"></i> Jelajahi</button></div><div id="wa-ch">${loadingHtml()}</div><button class="wa-fab sm" id="wa-pen" aria-label="Status teks"><i class="fa-solid fa-pen"></i></button><button class="wa-fab" id="wa-cam" aria-label="Tambah status"><i class="fa-solid fa-camera"></i></button>`;
    this.menu(v, [['Buat saluran', () => this.newChannel()], ['Pengaturan', () => this.settings()], ['Alihkan akun', () => this.switchAcc()]]);
    $('wa-ex').onclick = () => this.explore(); $('wa-pen').onclick = () => this.composeSt(); $('wa-cam').onclick = () => this.addSt();
    this.loadSt(); this.loadCh(); clearInterval(this.stTimer); this.stTimer = setInterval(() => { if (!document.hidden && this.S.tab === 'upd') this.loadSt(); }, 60000);
  },
  async loadSt() {
    let d = {}; try { d = (await this.rq('wa/st')) || {}; } catch (e) {} const now = Date.now(), me = this.me(), mine = [], o = [];
    for (const [k, v] of Object.entries(d)) { const all = Object.entries(v || {}).map(([id, s]) => ({ id, ...s })), live = all.filter(s => now - s.ts < 864e5).sort((a, b) => a.ts - b.ts); if (k === me) all.filter(s => now - s.ts >= 864e5).forEach(s => { this.rq(`wa/st/${me}/${s.id}`, null, 'DELETE').catch(() => {}); this.rq(`wa/sv/${me}/${s.id}`, null, 'DELETE').catch(() => {}); if (s.m) this.rq('wa/md/' + s.m, null, 'DELETE').catch(() => {}); }); if (!live.length || this.S.bl[k]) continue; k === me ? mine.push(...live) : o.push([k, live]); }
    o.sort((a, b) => b[1][b[1].length - 1].ts - a[1][a[1].length - 1].ts); this.S.st = { me: mine, o }; const box = $('wa-st'); if (!box) return;
    const pv = l => { const s = l[l.length - 1]; return s.ty === 't' ? `<div class="pv t" style="background:${esc(s.bg || '#128c7e')}"><span>${esc((s.t || '').slice(0, 60))}</span></div>` : s.ty === 'v' ? '<div class="pv v"><i class="fa-solid fa-play"></i></div>' : `<img class="pv" data-im="${esc(s.m)}" alt="">`; };
    box.innerHTML = `<button class="wa-sc2 add" id="st-add"><span class="wa-addav">${this.avatar(me, this.myName(), 56)}<i class="fa-solid fa-plus"></i></span><b>Tambah Status</b></button>${mine.length ? `<button class="wa-sc2" id="st-me" data-nolb>${pv(mine)}<span class="wa-rg on">${this.avatar(me, this.myName(), 34)}</span><b>Status saya</b></button>` : ''}${o.map(([k, l]) => `<button class="wa-sc2" data-k="${esc(k)}" data-nolb>${pv(l)}<span class="wa-rg ${l.some(s => s.ts > (this.S.seen[k] || 0)) ? 'on' : 'seen'}">${this.avatar(k, this.uname(k), 34)}</span><b>${this.nm(k)}</b></button>`).join('')}`;
    this.hydrate(box); $('st-add').onclick = () => this.addSt(); const sm = $('st-me'); if (sm) sm.onclick = () => this.viewSt(me, mine); box.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => this.viewSt(b.dataset.k, (o.find(x => x[0] === b.dataset.k) || [0, []])[1]));
  },
  /* pilih jenis status: teks, galeri, kamera */
  addSt() {
    this.sheet({ id: 'wasa', body: `${this.top('Tambah status', 'wasa')}<div class="wa-qk wa-qk2"><button id="sa-t"><i class="fa-solid fa-pen"></i><span>Teks</span></button><button id="sa-g"><i class="fa-regular fa-image"></i><span>Galeri</span></button><button id="sa-c"><i class="fa-solid fa-camera"></i><span>Kamera</span></button></div><div class="wa-sub" style="text-align:center;padding:18px 24px">Status hilang otomatis setelah 24 jam.<br>Foto atau video (maks. ±3 MB).</div><input type="file" id="sa-f" accept="image/*,video/*" hidden/><input type="file" id="sa-cf" accept="image/*,video/*" capture="environment" hidden/>`,
      on: () => { const go = f => { if (!f) return; Sheet.close('wasa', true); this.composeSt(f); }; $('sa-t').onclick = () => { Sheet.close('wasa', true); this.composeSt(); }; $('sa-g').onclick = () => $('sa-f').click(); $('sa-c').onclick = () => $('sa-cf').click(); $('sa-f').onchange = e => { const f = e.target.files[0]; e.target.value = ''; go(f); }; $('sa-cf').onchange = e => { const f = e.target.files[0]; e.target.value = ''; go(f); }; } });
  },
  stTime(ts) { const d = new Date(ts), p = n => String(n).padStart(2, '0'), n = new Date(); return (d.toDateString() === n.toDateString() ? 'Hari ini' : d.toDateString() === new Date(n - 864e5).toDateString() ? 'Kemarin' : d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' })) + ' ' + p(d.getHours()) + '.' + p(d.getMinutes()); },
  /* kirim pesan pribadi tanpa membuka chat (dipakai balasan status) */
  async quickDM(k, text) {
    if (!await this.okSend()) return false; const me = this.me(), id = this.nid(), ts = Date.now(), pair = this.pair(me, k), t = String(text).slice(0, 1000), pv = t.replace(/\s+/g, ' ').slice(0, 60);
    try { await this.rq('wa', null, 'PATCH', { [`dm/${pair}/${id}`]: { k: me, to: k, ts, t }, [`ib/${me}/${k}`]: { u: this.uname(k), t: pv, ts, k: me }, [`ib/${k}/${me}`]: { u: this.myName(), t: pv, ts, k: me } }); }
    catch (e) { UI.toast(e.permission ? 'Pesan tidak terkirim (kamu diblokir atau Rules belum dipasang)' : 'Pesan gagal dikirim', 'err'); return false; }
    try { Push.notify([k], { t: this.myName(), n: this.myName(), b: pv, c: me, k: 'msg' }); } catch (e) {} return true;
  },

  /* ---------- penampil status — tata letak seperti WhatsApp ---------- */
  viewSt(k, items) {
    const me = this.me(), own = k === me, DUR = 6000, seen = this.S.seen[k] || 0; let i = Math.max(0, items.findIndex(s => s.ts > seen)), raf = 0, last = 0, el = 0, dur = DUR, hold = false, typing = false, menu = false, ovl = false, vid = null, ready = false, wd = null, off = () => {}; const liked = this.lk || (this.lk = new Set()), vw = this.vw || (this.vw = new Set());
    const paused = () => hold || typing || menu || ovl || !ready, upd = () => { if (!vid || !ready) return; if (paused()) vid.pause(); else { const p = vid.play(); if (p && p.catch) p.catch(() => { vid.muted = true; vid.play().catch(() => {}); }); } };
    const paint = p => document.querySelectorAll('#wsv .pb i').forEach((x, j) => { x.style.width = (j < i ? 100 : j === i ? Math.min(100, p * 100) : 0) + '%'; });
    const stop = () => { cancelAnimationFrame(raf); raf = 0; clearTimeout(wd); };
    const nx = () => { if (i >= items.length - 1) return Sheet.close('wasv'); i++; show(); }, pv = () => { i = Math.max(0, i - 1); show(); };
    const tick = t => { raf = requestAnimationFrame(tick); if (vid && ready) { if (vid.duration) { el = vid.currentTime * 1000; dur = vid.duration * 1000; } } else if (!paused()) el += Math.min(100, Math.max(0, t - last)); last = t; paint(dur ? el / dur : 0); if (!vid && ready && el >= dur) nx(); };
    const snip = s => s.t ? '“' + s.t.slice(0, 40) + (s.t.length > 40 ? '…' : '') + '”' : s.ty === 'v' ? 'video' : 'foto';
    const reply = async txt => { txt = String(txt || '').trim(); const s = items[i]; if (!txt || !s) return; const inp = $('wsr'); if (await this.quickDM(k, txt + '\n↩ Membalas status ' + snip(s))) { if (inp) { inp.value = ''; inp.blur(); } const b = $('wsb'); if (b) b.classList.remove('has'); UI.toast('Balasan terkirim', 'ok', 1400); } };
    const show = () => {
      stop(); const s = items[i]; if (!s) return Sheet.close('wasv'); const c = $('wsc'); if (!c) return;
      el = 0; dur = DUR; ready = false; vid = null; last = performance.now(); this.S.seen[k] = Math.max(this.S.seen[k] || 0, s.ts); LS.set('wa_seen', this.S.seen);
      $('wst').textContent = this.stTime(s.ts); paint(0); const cap = $('wcap'); cap.textContent = s.ty !== 't' && s.t ? s.t : ''; cap.classList.toggle('hidden', !cap.textContent);
      const hb = $('wsh'); if (hb) { hb.classList.toggle('on', liked.has(k + s.id)); hb.firstElementChild.className = liked.has(k + s.id) ? 'fa-solid fa-heart' : 'fa-regular fa-heart'; }
      if (own) this.rq(`wa/sv/${me}/${s.id}`, { shallow: true }).then(d => { const n = $('wsv-n'); if (n && items[i] === s) n.textContent = Object.keys(d || {}).length; }).catch(() => {});
      else if (!vw.has(k + s.id)) { vw.add(k + s.id); this.rq(`wa/sv/${k}/${s.id}/${me}`, null, 'PUT', Date.now()).catch(() => {}); }
      if (s.ty === 't') { const n = String(s.t || '').length; c.innerHTML = `<div class="wsx-t" style="background:${esc(s.bg || this.BG[0])};font-size:${n <= 40 ? 34 : n <= 100 ? 27 : 21}px"><span>${esc(s.t || '')}</span></div>`; ready = true; }
      else {
        c.innerHTML = `<div class="wsx-ld"><i class="fa-solid fa-circle-notch spin"></i></div>${s.ty === 'v' ? `<video data-im="${esc(s.m)}" class="wsx-m" playsinline preload="auto"></video>` : `<img data-im="${esc(s.m)}" class="wsx-m" alt="">`}`;
        const m = c.querySelector('.wsx-m'), go = () => { if (items[i] !== s || ready) return; ready = true; last = performance.now(); const l = c.querySelector('.wsx-ld'); if (l) l.remove(); upd(); };
        if (s.ty === 'v') { vid = m; m.onloadeddata = go; m.onended = nx; } else m.onload = go;
        this.hydrate(c);
        wd = setTimeout(() => { if (ready || items[i] !== s) return; vid = null; ready = true; dur = 3000; last = performance.now(); const l = c.querySelector('.wsx-ld'); if (l) l.innerHTML = '<small>Media tidak tersedia</small>'; }, 9000);
      }
      raf = requestAnimationFrame(tick);
    };
    const viewers = async () => { const s = items[i]; if (!s) return; ovl = true; upd(); let d = {}; try { d = (await this.rq(`wa/sv/${me}/${s.id}`)) || {}; } catch (e) {} const es = Object.entries(d).sort((a, b) => b[1] - a[1]);
      this.sheet({ id: 'wasw', cls: 'wap', onClose: () => { ovl = false; upd(); }, body: this.top('Dilihat oleh ' + es.length, 'wasw') + (es.map(([u, ts]) => `<div class="wa-row" style="cursor:default">${this.avatar(u, this.uname(u), 40)}<span class="wa-m"><b>${this.nm(u)}</b><small class="muted">${this.stTime(ts)}</small></span></div>`).join('') || emptyHtml('fa-eye-slash', 'Belum ada yang melihat.')), on: e => this.hydrate(e) }); };
    const bar = own ? `<div class="wsx-bar own"><button id="wsw" type="button"><i class="fa-regular fa-eye"></i><b id="wsv-n">0</b><span>Dilihat · ketuk untuk melihat</span></button></div>`
      : `<div class="wsx-bar" id="wsb"><div class="wsx-in"><input id="wsr" type="text" placeholder="Balas" maxlength="500" autocomplete="off" enterkeyhint="send"/><span class="wsx-em">${['😍', '😂', '😮'].map(e => `<button type="button" data-e="${e}">${e}</button>`).join('')}</span></div><button class="wsx-c" id="wsh" type="button" aria-label="Suka"><i class="fa-regular fa-heart"></i></button><button class="wsx-c go" id="wss" type="button" aria-label="Kirim"><i class="fa-solid fa-paper-plane"></i></button></div>`;
    this.sheet({ id: 'wasv', cls: 'wap wasv', onClose: () => { stop(); off(); },
      body: `<div id="wsv"><div id="wsc"></div><div id="wsz"></div><div class="pb">${items.map(() => '<span><i></i></span>').join('')}</div><div class="wsh"><button class="wsx-b" data-x="wasv" aria-label="Kembali"><i class="fa-solid fa-arrow-left"></i></button>${this.avatar(k, own ? this.myName() : this.uname(k), 40)}<span class="wsi"><b>${own ? 'Status saya' : this.nm(k)}</b><small id="wst"></small></span><button class="wsx-b" id="wsm" type="button" aria-label="Menu"><i class="fa-solid fa-ellipsis-vertical"></i></button></div><div class="wsx-cap hidden" id="wcap"></div>${bar}</div>`,
      on: () => {
        off = this.vvFit('wasv'); this.hydrate($('wsv')); const z = $('wsz'), root = $('wsv'); let sx = 0, sy = 0, moved = false, ht = null;
        z.onpointerdown = e => { sx = e.clientX; sy = e.clientY; moved = false; try { z.setPointerCapture(e.pointerId); } catch (x) {} ht = setTimeout(() => { hold = true; upd(); root.classList.add('holding'); }, 230); };
        z.onpointermove = e => { if (Math.abs(e.clientY - sy) > 14 || Math.abs(e.clientX - sx) > 14) { moved = true; clearTimeout(ht); } };
        const fin = e => { clearTimeout(ht); const was = hold; hold = false; root.classList.remove('holding'); upd(); const dy = e.clientY - sy, dx = e.clientX - sx; if (dy > 110 && Math.abs(dx) < 90) return Sheet.close('wasv'); if (own && dy < -80 && Math.abs(dx) < 90) return viewers(); if (moved || was) return; const r = z.getBoundingClientRect(); if (e.clientX - r.left < r.width * .3) pv(); else nx(); };
        z.onpointerup = fin; z.onpointercancel = () => { clearTimeout(ht); hold = false; root.classList.remove('holding'); upd(); };
        $('wsm').onclick = e => { e.stopPropagation(); const s = items[i]; menu = true; upd(); const done = () => { menu = false; upd(); };
          this.pop(e.currentTarget, own ? [['<i class="fa-solid fa-eye"></i> Dilihat oleh', () => viewers()], ['<i class="fa-regular fa-trash-can"></i> Hapus status', async () => { ovl = true; upd(); const okk = s && await UI.confirm('Hapus status?', 'Status ini akan dihapus untuk semua orang.', { ok: 'Hapus', danger: true, icon: 'fa-trash' }); if (!okk) { ovl = false; upd(); return; } await this.rq(`wa/st/${me}/${s.id}`, null, 'DELETE').catch(() => {}); this.rq(`wa/sv/${me}/${s.id}`, null, 'DELETE').catch(() => {}); if (s.m) this.rq('wa/md/' + s.m, null, 'DELETE').catch(() => {}); Sheet.close('wasv'); this.loadSt(); }]]
            : [['<i class="fa-regular fa-comment"></i> Kirim pesan', () => { Sheet.close('wasv'); this.openChat(k, this.uname(k)); }], ...(s && s.t ? [['<i class="fa-regular fa-copy"></i> Salin teks', () => copyText(s.t)]] : [])]);
          setTimeout(() => document.addEventListener('click', done, { once: true }), 0); };
        if (own) $('wsw').onclick = viewers;
        else {
          const inp = $('wsr'), b = $('wsb'); inp.onfocus = () => { typing = true; upd(); }; inp.onblur = () => { typing = false; upd(); }; inp.oninput = () => b.classList.toggle('has', !!inp.value.trim());
          inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); reply(inp.value); } }; $('wss').onclick = () => reply(inp.value);
          b.querySelectorAll('[data-e]').forEach(x => { x.onpointerdown = e => e.preventDefault(); x.onclick = () => reply(x.dataset.e); });
          $('wsh').onclick = async () => { const s = items[i]; if (!s || liked.has(k + s.id)) return; if (await this.quickDM(k, '❤️\n↩ Menyukai status ' + snip(s))) { liked.add(k + s.id); const h = $('wsh'); h.classList.add('on'); h.firstElementChild.className = 'fa-solid fa-heart'; UI.toast('Disukai', 'ok', 1200); } };
        }
        show();
      } });
  },
  composeSt(file0) {
    let bg = this.BG[0], file = null;
    this.sheet({ id: 'wasc', body: `${this.top('Status baru', 'wasc')}<div class="wa-sc" id="wsc-p" style="background:${bg}"><textarea id="wsc-t" maxlength="200" placeholder="Ketik status…"></textarea><div id="wsc-pv"></div></div><div class="wa-sw" id="wsc-bg">${this.BG.map((b, i) => `<button style="background:${b}" data-b="${i}" aria-label="Warna ${i + 1}"></button>`).join('')}</div><div class="row" style="padding:12px;gap:10px"><button class="btn" id="wsc-f" style="flex:1"><i class="fa-regular fa-image"></i> Foto / Video</button><button class="btn btn-pri" id="wsc-s" style="flex:1"><i class="fa-solid fa-paper-plane"></i> Kirim</button></div><input type="file" id="wsc-i" accept="image/*,video/*" hidden/>`,
      on: () => {
        $('wsc-bg').querySelectorAll('button').forEach(b => b.onclick = () => { bg = this.BG[+b.dataset.b]; $('wsc-p').style.background = bg; });
        $('wsc-f').onclick = () => $('wsc-i').click();
        const setF = async f => { if (!f) return; try { const p = await this.prep(f); file = f; $('wsc-pv').innerHTML = p.ty === 'v' ? `<video src="${p.data}" controls playsinline></video>` : `<img src="${p.data}" alt="">`; $('wsc-t').placeholder = 'Tambahkan keterangan…'; $('wsc-p').classList.add('med'); } catch (x) { UI.toast(this.errMsg(x), 'err'); } };
        $('wsc-i').onchange = e => { const f = e.target.files[0]; e.target.value = ''; setF(f); }; if (file0) setF(file0);
        $('wsc-s').onclick = async () => {
          const t = $('wsc-t').value.trim(); if (!t && !file) return UI.toast('Tulis sesuatu atau pilih foto/video', 'warn'); if (!await this.okSend()) return; const b = $('wsc-s'); b.disabled = true; b.innerHTML = '<i class="fa-solid fa-circle-notch spin"></i> Mengirim…';
          try { const s = file ? await this.upload(file) : null, id = this.nid(); await this.rq(`wa/st/${this.me()}/${id}`, null, 'PUT', { ty: s ? s.ty === 'v' ? 'v' : 'p' : 't', ...(t ? { t } : {}), ...(s ? { m: s.im } : { bg }), ts: Date.now() }); Sheet.close('wasc'); UI.toast('Status terkirim', 'ok'); this.loadSt(); } catch (e) { UI.toast(this.errMsg(e), 'err'); b.disabled = false; b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Kirim'; }
        };
      } });
  },
  chRow([id, c], f) { return `<button class="wa-row" data-c="${esc(id)}">${this.avatar('c:' + id, c.n, 52)}<span class="wa-m"><span class="wa-l1"><b>${esc(c.n)}${this.isV(c.o) ? this.TK : ''}</b>${f ? '' : `<small>${this.dl(c.ts)}</small>`}</span><span class="wa-l2"><span class="wa-pv">${esc(c.d || 'Saluran DimzzChat')}</span>${f ? '<span class="wa-fo">Ikuti</span>' : ''}</span></span></button>`; },
  async loadCh() {
    const me = this.me(); try { const [a, f] = await Promise.all([this.rq('wa/c'), this.rq('wa/cu/' + me)]); this.S.ch = a || {}; this.S.fol = f || {}; } catch (e) { const b = $('wa-ch'); if (b) b.innerHTML = this.errBox(e); return; }
    const box = $('wa-ch'); if (!box) return; const es = Object.entries(this.S.ch).sort((a, b) => b[1].ts - a[1].ts), mine = es.filter(([id]) => this.S.fol[id]), oth = es.filter(([id]) => !this.S.fol[id]).slice(0, 5);
    box.innerHTML = (mine.length ? mine.map(e => this.chRow(e)).join('') : '<div class="muted" style="padding:4px 16px 8px;font-size:13px;font-weight:500;line-height:1.5">Belum mengikuti saluran. Ketuk <b>Jelajahi</b> untuk menemukan saluran.</div>') + (oth.length ? '<div class="wa-sub">Temukan saluran</div>' + oth.map(e => this.chRow(e, 1)).join('') : '');
    box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => this.openChannel(b.dataset.c));
  },
  explore() {
    const es = Object.entries(this.S.ch || {}).sort((a, b) => b[1].ts - a[1].ts);
    this.sheet({ id: 'wax', body: `${this.top('Jelajahi saluran', 'wax')}<div>${es.length ? es.map(e => this.chRow(e, !this.S.fol[e[0]])).join('') : emptyHtml('fa-bullhorn', 'Belum ada saluran.<br>Buat yang pertama lewat menu ⋮.')}</div>`, on: el => el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => this.openChannel(b.dataset.c)) });
  },
  async newChannel() {
    const n = await UI.prompt('Buat saluran', 'Nama saluran (maks. 40 huruf)', { placeholder: 'Contoh: Info Terbaru', ok: 'Lanjut' }); if (!n || !n.trim()) return; const d = await UI.prompt('Deskripsi', 'Boleh dikosongkan', { placeholder: 'Tentang saluran ini', ok: 'Buat' }); if (d === null) return;
    const me = this.me(), id = this.nid(); try { await this.rq('wa/c/' + id, null, 'PUT', { n: n.trim().slice(0, 40), d: (d || '').trim().slice(0, 100), o: me, ou: this.myName(), ts: Date.now() }); await this.rq('wa', null, 'PATCH', { [`cf/${id}/${me}`]: 1, [`cu/${me}/${id}`]: 1 }); UI.toast('Saluran dibuat', 'ok'); await this.loadCh(); this.openChannel(id); } catch (e) { UI.toast(this.errMsg(e), 'err'); }
  },
  async openChannel(cid) {
    const me = this.me(); let c = this.S.ch[cid] || (await this.rq('wa/c/' + cid).catch(() => null)); if (!c) return UI.toast('Saluran tidak ditemukan', 'err'); let posts = [], sig = '', t = null, off = () => {}; const isOwner = () => c.o === me, own = () => isOwner() || !!(c.ad && c.ad[me]), fol = () => !!this.S.fol[cid];
    const head = async () => { const h = $('wch-h'); if (!h) return; const f = await this.rq('wa/cf/' + cid, { shallow: true }).catch(() => ({})); h.innerHTML = `<b>${esc(c.n)}${this.isV(c.o) ? this.TK : ''}</b><small>${Object.keys(f || {}).length} pengikut · oleh ${esc(c.ou || c.o)}</small>`; const bt = $('wch-f'); if (bt) { bt.textContent = fol() ? 'Mengikuti' : 'Ikuti'; bt.classList.toggle('btn-pri', !fol()); } };
    const poll = async () => { try { const d = await this.rq('wa/cp/' + cid, { orderBy: '$key', limitToLast: 50 }, 'GET', undefined, 9000); posts = Object.entries(d || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.ts - b.ts); } catch (e) { return; } const l = $('wch-l'); if (!l) return; const s = posts.map(p => p.id).join(); if (s === sig) return; sig = s;
      l.innerHTML = posts.length ? posts.map(p => `<div class="wa-b ch" data-id="${esc(p.id)}">${p.im ? this.mt(p.ty, p.im) : ''}${p.t ? `<span class="selectable">${esc(p.t).replace(/\n/g, '<br>')}</span>` : ''}<small>${this.dt(p.ts)}</small></div>`).join('') : emptyHtml('fa-bullhorn', 'Belum ada kiriman.'); this.hydrate(l); const b = Sheet.$('wach'); if (b) b.scrollTop = b.scrollHeight;
      if (own()) l.querySelectorAll('.wa-b').forEach(x => x.onclick = async e => { if (e.target.closest('img,video')) return; if (await UI.confirm('Hapus kiriman?', '', { ok: 'Hapus', danger: true })) { await this.rq(`wa/cp/${cid}/${x.dataset.id}`, null, 'DELETE').catch(() => {}); poll(); } }); };
    this.sheet({ id: 'wach', onClose: () => { clearInterval(t); off(); this.loadCh(); },
      body: `<div class="wa-top wa-ch"><button class="wa-ib" data-x="wach" aria-label="Kembali"><i class="fa-solid fa-arrow-left"></i></button>${this.avatar('c:' + cid, c.n, 40)}<span class="wa-ct" id="wch-h" style="flex-direction:column;align-items:flex-start;gap:0"></span>${isOwner() ? '<button class="wa-ib" id="wch-admin" title="Admin saluran"><i class="fa-solid fa-user-shield"></i></button>' : (!own() ? '<button class="btn btn-sm" id="wch-f">Ikuti</button>' : '')}</div><div id="wch-l" class="wa-ml">${loadingHtml()}</div>`,
      foot: own() ? `<div class="wa-cb"><button class="wa-ib" id="wch-at"><i class="fa-solid fa-paperclip"></i></button><textarea id="wch-in" rows="1" maxlength="1000" placeholder="Tulis kiriman untuk pengikut"></textarea><button class="wa-go" id="wch-go"><i class="fa-solid fa-paper-plane"></i></button></div><input type="file" id="wch-fi" accept="image/*,video/*" hidden/>` : '',
      on: () => {
        off = this.vvFit('wach'); head(); poll(); t = setInterval(() => { if (!document.hidden) poll(); }, 4000);
        const bt = $('wch-f'); if (bt) bt.onclick = async () => { const f = fol(); try { await this.rq('wa', null, 'PATCH', { [`cf/${cid}/${me}`]: f ? null : 1, [`cu/${me}/${cid}`]: f ? null : 1 }); if (f) delete this.S.fol[cid]; else this.S.fol[cid] = 1; head(); } catch (e) { UI.toast(this.errMsg(e), 'err'); } };
        if (own()) { const adm = $('wch-admin'); if (adm && isOwner()) adm.onclick = async () => { const u = await UI.prompt('Admin saluran', 'Masukkan username untuk memberi atau mencabut izin admin.'); if (!u) return; const k = userKey(u.trim()); await this.users(true); if (!this.S.um[k]) return UI.toast('Username tidak ditemukan', 'warn'); const add = !(c.ad && c.ad[k]); try { await this.rq(`wa/c/${cid}/ad/${k}`, null, add ? 'PUT' : 'DELETE', add ? 1 : undefined); c.ad = c.ad || {}; if (add) c.ad[k] = 1; else delete c.ad[k]; UI.toast(add ? 'Admin ditambahkan' : 'Admin dicabut', 'ok'); } catch (e) { UI.toast(this.errMsg(e), 'err'); } }; const inp = $('wch-in'), post = async extra => { const tx = inp.value.trim(); if (!tx && !extra) return; if (!await this.okSend()) return; try { await this.rq(`wa/cp/${cid}/${this.nid()}`, null, 'PUT', { ...(tx ? { t: tx } : {}), ...(extra || {}), ts: Date.now() }); inp.value = ''; poll(); } catch (e) { UI.toast(this.errMsg(e), 'err'); } }; $('wch-go').onclick = () => post(); $('wch-at').onclick = () => $('wch-fi').click(); $('wch-fi').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { UI.toast('Mengunggah…', 'info', 1800); await post(await this.upload(f)); } catch (x) { UI.toast(this.errMsg(x), 'err'); } }; }
      } });
  },

  /* ---------- Komunitas (grup) ---------- */
  v_kom(v) {
    const gs = Object.entries(this.S.ib).filter(([k, e]) => k.startsWith('g:') && e && e.ts && !this.S.bl[k]).sort((a, b) => b[1].ts - a[1].ts);
    v.innerHTML = `${this.home('Komunitas', this.mnb)}<button class="wa-row" id="kom-new"><span class="wa-av sq" style="--s:52px"><i class="fa-solid fa-users"></i></span><span class="wa-m"><b>Komunitas baru</b><small class="muted">Buat grup untuk mengumpulkan teman</small></span></button><div class="wa-h3">Grup kamu</div>${gs.length ? gs.map(([k, e]) => `<button class="wa-row" data-id="${esc(k)}" data-n="${esc(e.u)}">${this.avatar(k, e.u, 52)}<span class="wa-m"><span class="wa-l1"><b>${this.nm(k, e.u)}</b><small>${this.dl(e.ts)}</small></span><span class="wa-l2"><span class="wa-pv">${esc(e.t || '')}</span></span></span></button>`).join('') : emptyHtml('fa-user-group', 'Belum ada grup.<br>Ketuk “Komunitas baru” untuk membuatnya.')}`;
    this.menu(v, [['Pengaturan', () => this.settings()], ['Alihkan akun', () => this.switchAcc()]]);
    $('kom-new').onclick = () => this.newGroup(); v.querySelectorAll('.wa-row[data-id]').forEach(b => b.onclick = () => this.openChat(b.dataset.id, b.dataset.n)); this.hydrate(v);
  },

  /* ---------- Panggilan ---------- */
  async keypad() {
    const n = await UI.prompt('Keypad', 'Masukkan nomor telepon pengguna DimzzChat', { placeholder: '0812…', ok: 'Cari' }); if (!n) return; const ph = this.normPh(n);
    try { const k = await this.rq('wa/pi/' + ph); if (!k) return UI.toast('Nomor ini belum terdaftar di DimzzChat', 'warn'); if (k === this.me()) return UI.toast('Itu nomormu sendiri', 'info'); await this.users(true).catch(() => {}); this.openChat(k, this.uname(k)); } catch (e) { UI.toast(this.errMsg(e), 'err'); }
  },
  v_call(v) {
    const me = this.me(), key = 'wa_calls_' + me, log = LS.get(key, []).slice(0, 30), us = (this.S.users || []).filter(u => { const k = userKey(u.username); return k !== me && !this.S.bl[k]; }), lim = this.S.cMore ? us.length : 5;
    v.innerHTML = `${this.home('Panggilan', this.mnb)}<div class="wa-qk"><button id="cl-tl"><i class="fa-solid fa-phone"></i><span>Telepon</span></button><button id="cl-kp"><i class="fa-solid fa-table-cells"></i><span>Keypad</span></button><button id="cl-fv"><i class="fa-regular fa-star"></i><span>Favorit</span></button></div>`
      + (log.length ? `<div class="wa-h3">Terbaru</div>${log.map((c, i) => `<div class="wa-row${!c.o && !c.d ? ' miss' : ''}">${this.avatar(c.k, c.n, 48)}<span class="wa-m"><b>${this.nm(c.k, c.n)}</b><small class="muted">${c.o ? '↗' : '↙'} ${esc(this.stTime(c.ts))}${c.d ? ' · ' + fmtDur(c.d) : ''}</small></span><button class="wa-ib ln" data-cb="${i}" aria-label="Hubungi"><i class="fa-solid ${c.ty === 'v' ? 'fa-video' : 'fa-phone'}"></i></button></div>`).join('')}` : '')
      + `<div class="wa-h3">Mulai menelepon${us.length > 5 ? `<button class="wa-jl" id="cl-mr">${this.S.cMore ? 'Sedikit' : 'Lainnya'}</button>` : ''}</div>${us.slice(0, lim).map(u => { const k = userKey(u.username); return `<div class="wa-row">${this.avatar(k, this.uname(k), 48)}<span class="wa-m"><b>${this.nm(k, this.uname(k))}</b></span><button class="wa-ib ln" data-cp="${esc(k)}" data-ty="a" aria-label="Telepon suara"><i class="fa-solid fa-phone"></i></button><button class="wa-ib ln" data-cp="${esc(k)}" data-ty="v" aria-label="Video call"><i class="fa-solid fa-video"></i></button></div>`; }).join('') || emptyHtml('fa-user-slash', 'Belum ada pengguna lain.')}`;
    this.menu(v, [['Hapus riwayat panggilan', () => { LS.set(key, []); this.v_call(v); }], ['Pengaturan', () => this.settings()], ['Alihkan akun', () => this.switchAcc()]]);
    $('cl-tl').onclick = () => this.newChat(); $('cl-kp').onclick = () => this.keypad(); $('cl-fv').onclick = () => { this.S.f = 'f'; this.go('chat'); };
    const mr = $('cl-mr'); if (mr) mr.onclick = () => { this.S.cMore = !this.S.cMore; this.v_call(v); };
    v.querySelectorAll('[data-cb]').forEach(b => b.onclick = () => { const c = log[+b.dataset.cb]; this.callTo(c.k, c.n, c.ty); });
    v.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => this.callTo(b.dataset.cp, this.uname(b.dataset.cp), b.dataset.ty)); this.hydrate(v);
  },

  /* ---------- Pengaturan: profil, centang biru, preferensi ---------- */
  v_me(v) {
    const u = App.user, me = this.me(), p = this.S.prof || {}, dk = LS.get('wa_dk', 0), wp = LS.get('wa_wp', 0), fz = LS.get('wa_fz', 15), vf = this.isV(me), pend = this.S.vq && this.S.vq.st === 'p', sw = (id, on) => `<button class="switch ${on ? 'on' : ''}" id="${id}"></button>`;
    v.innerHTML = `${this.top('Pengaturan', 'wast')}<div class="wa-pf"><span style="position:relative">${this.avatar(me, this.myName(), 92, 'big')}<button class="wa-cam" id="me-pp" aria-label="Ganti foto profil"><i class="fa-solid fa-camera"></i></button></span><b>${this.nm(me, this.myName())}</b><small id="me-ab">${esc(p.b || 'Hai! Saya pakai DimzzChat')}</small></div>
      <div class="wa-it"><i class="fa-solid fa-phone"></i><span><b>${esc(this.fmtPh(this.S.ph) || '-')}</b><small>Nomor telepon</small></span></div>
      <button class="wa-it" id="me-nm"><i class="fa-solid fa-id-card"></i><span><b>Nama kontak</b><small>${esc(this.myName())}</small></span></button>
      <button class="wa-it" id="me-ed"><i class="fa-solid fa-pen"></i><span><b>Info saya</b><small>Ubah tulisan di bawah namamu</small></span></button>
      ${vf ? `<div class="wa-vc ok">${this.TK}<span>Akunmu sudah terverifikasi (centang biru).</span></div>` : `<div class="wa-vc"><div class="wa-vh">${this.TK}<b>Centang Biru</b><em>Rp1.000</em></div><p>Centang biru tampil di samping namamu di chat, grup, dan saluran. Tanya info &amp; bayar lewat Developer; setelah dikonfirmasi, Developer mengaktifkannya di akunmu.</p><div class="row"><a class="btn btn-pri" target="_blank" rel="noopener" href="${Roles.wa('Halo Dev, saya ' + u.username + ' (DimzzChat) mau beli centang biru Rp1.000. Mohon infonya.')}"><i class="fa-brands fa-whatsapp"></i> Info &amp; bayar ke Dev</a><button class="btn" id="me-vq" ${pend ? 'disabled' : ''}>${pend ? 'Menunggu Dev…' : 'Ajukan'}</button></div></div>`}
      <div class="wa-sec">Chat</div>
      <div class="wa-it"><i class="fa-solid fa-moon"></i><span><b>Tema gelap</b></span>${sw('me-dk', dk)}</div>
      <div class="wa-it" style="flex-wrap:wrap"><i class="fa-regular fa-image"></i><span><b>Wallpaper chat</b></span><div class="wa-wp">${this.WP.map((w, i) => `<button data-w="${i}" class="${i === wp ? 'on' : ''}" style="background:linear-gradient(160deg,${w[0]})"></button>`).join('')}</div></div>
      <div class="wa-it"><i class="fa-solid fa-text-height"></i><span><b>Ukuran huruf</b></span><div class="wa-fz">${[[13, 'Kecil'], [15, 'Sedang'], [17, 'Besar']].map(([n, l]) => `<button data-z="${n}" class="${n === fz ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="wa-sec">Notifikasi &amp; privasi</div>
      <div class="wa-it"><i class="fa-solid fa-mobile-screen-button"></i><span><b>Notifikasi layar HP</b><small id="me-pn-s">${esc(Push.ok() ? (Push.perm() === 'denied' ? 'Diblokir di pengaturan browser' : Push.enabled() ? 'Aktif — pesan & panggilan muncul walau web ditutup' : 'Mati') : Push.why())}</small></span>${sw('me-pn', Push.enabled())}</div>
      ${Push.enabled() ? '<button class="wa-it" id="me-pt"><i class="fa-solid fa-vial"></i><span><b>Kirim notifikasi tes</b><small>Tekan, lalu tutup web untuk mencoba</small></span></button>' : ''}
      <div class="wa-it"><i class="fa-solid fa-bell"></i><span><b>Suara pesan masuk</b></span>${sw('me-sn', LS.get('wa_snd', 1))}</div>
      <button class="wa-it" id="me-bl"><i class="fa-solid fa-ban"></i><span><b>Akun diblokir</b><small>${Object.keys(this.S.bl).length} akun</small></span></button>
      <div class="wa-sec">Bantuan</div>
      <a class="wa-it" target="_blank" rel="noopener" href="${Roles.wa('Halo Dev, saya butuh bantuan soal DimzzChat.')}"><i class="fa-brands fa-whatsapp"></i><span><b>Hubungi Developer</b></span></a>
      <div class="muted" style="text-align:center;font-size:11px;font-weight:700;padding:14px">DimzzChat · v${esc(CONFIG.VERSION)}</div>`;
    this.hydrate(v);
    $('me-pp').onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { const f = i.files[0]; if (!f) return; try { const d = await Chat.shrink(f, true); await this.rq('wa/av/' + me, null, 'PUT', d); this.av.set(me, d); LS.set('wa_pp', { k: me, v: d }); this.pp(); this.go('me'); UI.toast('Foto profil diganti', 'ok'); } catch (e) { UI.toast(this.errMsg(e), 'err'); } }; i.click(); };
    $('me-nm').onclick = async () => { const n = await UI.prompt('Nama kontak', 'Nama yang dilihat temanmu', { value: this.myName(), ok: 'Simpan' }); if (n === null) return; const t = n.trim().slice(0, 30); if (t.length < 2) return UI.toast('Nama minimal 2 huruf', 'warn'); try { await this.rq('wa/dn/' + me, null, 'PUT', t); this.S.dn[me] = t; this.go('me'); } catch (e) { UI.toast(this.errMsg(e), 'err'); } };
    $('me-ed').onclick = async () => { const b = await UI.prompt('Info saya', 'Tulisan singkat di profilmu', { value: p.b || '', placeholder: 'Hai! Saya pakai DimzzChat', ok: 'Simpan' }); if (b === null) return; try { await this.rq('wa/prof/' + me, null, 'PUT', { b: b.trim().slice(0, 80), ts: Date.now() }); this.S.prof = { b: b.trim().slice(0, 80) }; this.go('me'); } catch (e) { UI.toast(this.errMsg(e), 'err'); } };
    const vq = $('me-vq'); if (vq) vq.onclick = async () => { try { await this.rq('wa/vq/' + me, null, 'PUT', { u: u.username, ts: Date.now(), st: 'p' }); this.S.vq = { st: 'p' }; UI.toast('Permintaan dikirim ke Developer', 'ok'); this.go('me'); } catch (e) { UI.toast(this.errMsg(e), 'err'); } };
    $('me-dk').onclick = e => { const on = !e.currentTarget.classList.contains('on'); e.currentTarget.classList.toggle('on', on); LS.set('wa_dk', on ? 1 : 0); this.prefs(); };
    $('me-pn').onclick = async e => { const b = e.currentTarget, s = $('me-pn-s'); if (!Push.ok()) return UI.toast(Push.why(), 'warn'); b.disabled = true; try { if (Push.enabled()) { await Push.disable(); b.classList.remove('on'); s.textContent = 'Mati'; } else { await Push.enable(); b.classList.add('on'); s.textContent = 'Aktif — pesan & panggilan muncul walau web ditutup'; UI.toast('Notifikasi aktif', 'ok'); } this.go('me'); } catch (x) { b.classList.remove('on'); s.textContent = x.denied ? 'Diblokir / belum diizinkan' : 'Mati'; UI.toast(x.message || 'Gagal', 'err'); } b.disabled = false; };
    const pt = $('me-pt'); if (pt) pt.onclick = async () => { pt.disabled = true; try { await Push.test(); UI.toast('Tes terkirim — notifikasi akan muncul sebentar lagi', 'ok'); } catch (x) { if (!x.shown) UI.toast(x.message || 'Gagal mengirim tes', 'err'); } pt.disabled = false; };
    $('me-sn').onclick = e => { const on = !e.currentTarget.classList.contains('on'); e.currentTarget.classList.toggle('on', on); LS.set('wa_snd', on ? 1 : 0); if (on) this.beep(); };
    v.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { LS.set('wa_wp', +b.dataset.w); v.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('on', x === b)); this.prefs(); });
    v.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { LS.set('wa_fz', +b.dataset.z); v.querySelectorAll('[data-z]').forEach(x => x.classList.toggle('on', x === b)); this.prefs(); });
    $('me-bl').onclick = () => this.blocked();
  },
  blocked() {
    const draw = () => { const b = $('sb-wabl'); if (!b) return; const ks = Object.keys(this.S.bl); b.innerHTML = this.top('Akun diblokir', 'wabl') + (ks.length ? ks.map(k => `<div class="wa-row" style="cursor:default">${this.avatar(k, this.uname(k), 40)}<span class="wa-m"><b>${esc(this.uname(k))}</b></span><button class="btn btn-sm" data-u="${esc(k)}">Buka blokir</button></div>`).join('') : emptyHtml('fa-ban', 'Tidak ada akun yang diblokir.')); this.hydrate(b); b.querySelectorAll('[data-u]').forEach(x => x.onclick = async () => { try { await this.rq(`wa/bl/${this.me()}/${x.dataset.u}`, null, 'DELETE'); delete this.S.bl[x.dataset.u]; draw(); this.pollIb(); } catch (e) { UI.toast(this.errMsg(e), 'err'); } }); };
    this.sheet({ id: 'wabl', body: '', on: draw });
  }
};

/* ---------- Panel Developer: konfirmasi centang biru ---------- */
Dev.t_centang = async function (box) {
  let vq = {}, vf = {}; try { [vq, vf] = await Promise.all([FB.request('wa/vq'), FB.request('wa/vf')]); } catch (e) { return void (box.innerHTML = errHtml(this.warnRules(e).replace('config/', 'wa/'))); } vq = vq || {}; vf = vf || {};
  const act = async (k, on) => { try { if (on) { await FB.request('wa/vf/' + k, null, 'PUT', { by: WA.myName(), ts: Date.now() }); await FB.request('wa/vq/' + k, null, 'DELETE').catch(() => {}); } else await FB.request('wa/vf/' + k, null, 'DELETE'); UI.toast(on ? 'Centang biru diberikan' : 'Centang biru dicabut', 'ok'); this.t_centang(box); } catch (e) { UI.alert('Gagal', this.warnRules(e), { type: 'err' }); } };
  box.innerHTML = `<div class="banner"><i class="fa-solid fa-circle-info" style="margin-top:2px"></i><div>Setujui hanya setelah pembayaran Rp1.000 diterima. Pengguna lihat centang biru di chat, grup, dan saluran.</div></div><div class="row"><input id="cb-u" class="inp" placeholder="Beri langsung: username"/><button class="btn btn-pri btn-sm" id="cb-go">Beri</button></div><div class="sec-title">Permintaan (${Object.keys(vq).length})</div><div class="card" style="padding:6px 14px">${Object.entries(vq).map(([k, r]) => `<div class="kv" style="align-items:center"><span>${esc(r.u || k)}<br><small class="muted">${new Date(r.ts).toLocaleString('id-ID')}</small></span><span class="row"><button class="btn btn-sm btn-pri" data-ok="${esc(k)}">Setujui</button><button class="btn btn-sm" data-no="${esc(k)}">Tolak</button></span></div>`).join('') || '<div class="muted" style="padding:10px;font-size:12px">Tidak ada permintaan.</div>'}</div><div class="sec-title">Sudah terverifikasi (${Object.keys(vf).length})</div><div class="card" style="padding:6px 14px">${Object.keys(vf).map(k => `<div class="kv" style="align-items:center"><span>${esc(k)}</span><button class="btn btn-sm btn-danger" data-rv="${esc(k)}">Cabut</button></div>`).join('') || '<div class="muted" style="padding:10px;font-size:12px">Belum ada.</div>'}</div>`;
  box.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => act(b.dataset.ok, 1)); box.querySelectorAll('[data-rv]').forEach(b => b.onclick = () => act(b.dataset.rv, 0)); box.querySelectorAll('[data-no]').forEach(b => b.onclick = async () => { await FB.request('wa/vq/' + b.dataset.no, null, 'DELETE').catch(() => {}); this.t_centang(box); });
  $('cb-go').onclick = () => { const k = userKey(($('cb-u').value || '').trim()); if (k) act(k, 1); };
};

/* foto profil muncul di bilah atas setelah masuk */
(function () { const e1 = App.enter; App.enter = async function (f) { const r = await e1.call(this, f); try { WA.pp(); WA.startCalls(); WA.paintPP(); } catch (x) {} return r; }; })();
document.addEventListener('click', e => { if (e.target.closest('[data-diag]')) WA.diag(); });
Features.reg({ id: 'wa', name: 'DimzzChat', cat: 'sosmed', icon: 'fa-comment-dots', grad: 'linear-gradient(135deg,#25d366,#0b8f6a)', open: () => WA.open() });
