/* ==== 13-chat.js — Chat global (v3.16: kaca, ketik mudah, pin, bingkai peran): teks, foto dari galeri, stiker. Developer = centang biru + bisa menghapus. ==== */
const Chat = {
  msgs: [], timer: null, sig: '', busy: false, lastSend: 0, imgs: new Map(), pend: new Map(),
  STICKERS: ['😀', '😂', '🤣', '🥹', '😍', '😎', '🤩', '🥳', '😭', '😡', '🤯', '🥶', '🤔', '😴', '🤭', '😇', '🙏', '👍', '👏', '🤝', '💪', '🔥', '❤️', '💔', '🎉', '💯', '👀', '🙈', '🫡', '😅', '🤤', '👋'],
  RE_IMG: /^data:image\/(jpeg|webp|png);base64,/,
  tick: () => '<svg viewBox="0 0 24 24" width="15" height="15" style="flex:none;vertical-align:-3px" role="img" aria-label="Developer terverifikasi"><title>Developer terverifikasi</title><circle cx="12" cy="12" r="11" fill="#1d9bf0"/><path d="M7 12.5l3.2 3.2L17 8.8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  open() {
    const dev = App.isDev();
    Sheet.open({ id: 'chat', title: 'Chat Global', icon: 'fa-comments', grad: 'linear-gradient(135deg,#0ea5e9,#2563eb)', full: true, cls: 'chatp', onClose: () => { clearInterval(this.timer); this.unbind(); },
      head: `<span class="chip" id="ch-live" style="background:#dcfce7;color:#15803d;border-color:#bbf7d0"><span class="dot-ok" style="width:7px;height:7px"></span> LIVE</span>${dev ? '<button class="btn btn-sm btn-danger" id="ch-clear" title="Fitur eksklusif Developer"><i class="fa-solid fa-trash"></i></button>' : ''}`,
      body: `<div id="ch-pin" class="ch-pin hidden"></div><div id="ch-list" style="display:flex;flex-direction:column;gap:8px;flex:1">${loadingHtml('Memuat chat…')}</div>`,
      foot: `<div class="ch-foot">
        <button id="ch-new" class="ch-new hidden" type="button"><i class="fa-solid fa-arrow-down"></i> Pesan baru</button>
        <div id="ch-pnl" class="ch-pnl hidden"><div class="ch-stk">${this.STICKERS.map(s => `<button data-s="${s}">${s}</button>`).join('')}<button id="ch-mk" class="ch-mk" title="Jadikan foto galeri sebagai stiker"><i class="fa-solid fa-plus"></i> Dari galeri</button></div></div>
        <div class="ch-bar">
          <button class="ch-b" id="ch-img" title="Kirim foto" aria-label="Kirim foto"><i class="fa-solid fa-image"></i></button>
          <button class="ch-b" id="ch-stk" title="Stiker" aria-label="Stiker"><i class="fa-regular fa-face-smile"></i></button>
          <textarea id="ch-in" class="ch-in" rows="1" maxlength="300" placeholder="Ketik pesan…" enterkeyhint="send" autocomplete="off" autocapitalize="sentences"></textarea>
          <button class="ch-b ch-go" id="ch-send" aria-label="Kirim" disabled><i class="fa-solid fa-paper-plane"></i></button>
        </div><div class="ch-cnt" id="ch-cnt"></div>
        <input type="file" id="ch-f1" accept="image/*" hidden/><input type="file" id="ch-f2" accept="image/*" hidden/></div>` });
    if (!Ban.on()) { $('ch-list').innerHTML = emptyHtml('fa-plug-circle-xmark', 'Chat global butuh koneksi Firebase.<br>Saat ini web berjalan dalam mode lokal.'); ['ch-in', 'ch-send', 'ch-img', 'ch-stk'].forEach(i => $(i).disabled = true); return; }
    const inp = $('ch-in'), snd = $('ch-send'), cnt = $('ch-cnt'), touch = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    this.fit = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 130) + 'px'; snd.disabled = !inp.value.trim(); const n = inp.value.length; cnt.textContent = n > 240 ? n + '/300' : ''; };
    inp.addEventListener('input', this.fit);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !touch) { e.preventDefault(); this.send(); } });
    snd.onclick = () => this.send();
    const bd = Sheet.$('chat'), nw = $('ch-new');
    bd.addEventListener('scroll', () => { if (bd.scrollHeight - bd.scrollTop - bd.clientHeight < 90) nw.classList.add('hidden'); }, { passive: true });
    nw.onclick = () => { bd.scrollTop = bd.scrollHeight; nw.classList.add('hidden'); };
    const vv = window.visualViewport;
    if (vv) { this._vv = () => { const sh = document.getElementById('sheet-chat'); if (!sh) return; const pn = sh.querySelector('.panel'); sh.style.top = vv.offsetTop + 'px'; sh.style.bottom = 'auto'; sh.style.height = vv.height + 'px'; sh.style.alignItems = 'stretch'; if (pn) { pn.style.height = '100%'; pn.style.maxHeight = '100%'; pn.style.transform = 'none'; } if (bd.scrollHeight - bd.scrollTop - bd.clientHeight < 400) bd.scrollTop = bd.scrollHeight; }; vv.addEventListener('resize', this._vv); vv.addEventListener('scroll', this._vv); this._vv(); setTimeout(this._vv, 300); }
    $('ch-img').onclick = () => $('ch-f1').click(); $('ch-mk').onclick = () => $('ch-f2').click();
    $('ch-f1').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) this.sendImage(f, false); };
    $('ch-f2').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) this.sendImage(f, true); };
    $('ch-stk').onclick = () => $('ch-pnl').classList.toggle('hidden');
    $('ch-pnl').querySelectorAll('[data-s]').forEach(b => b.onclick = () => this.sendSticker(b.dataset.s));
    if (dev) $('ch-clear').onclick = async () => { if (await UI.confirm('Hapus semua pesan?', 'Seluruh riwayat chat global (termasuk foto) akan dihapus untuk semua orang.', { ok: 'Hapus semua', danger: true, icon: 'fa-trash' })) { try { await FB.request('chat/global', null, 'DELETE'); await FB.request('chatimg', null, 'DELETE').catch(() => {}); this.msgs = []; this.imgs.clear(); this.sig = ''; this.render(true); UI.toast('Chat dibersihkan', 'ok'); } catch (e) { UI.toast('Ditolak Firebase — periksa Rules', 'err'); } } };
    this.sig = ''; this.poll(true); clearInterval(this.timer); this.timer = setInterval(() => { if (!document.hidden) this.poll(); }, 2500);
  },
  unbind() { const vv = window.visualViewport; if (vv && this._vv) { vv.removeEventListener('resize', this._vv); vv.removeEventListener('scroll', this._vv); } this._vv = null; },
  async pinLoad() {
    const el = $('ch-pin'); if (!el) return; let p = null; try { p = await Cfg.get('chatpin'); } catch (e) {}
    if (!$('ch-pin')) return;
    if (p && p.text) { el.innerHTML = `<i class="fa-solid fa-thumbtack"></i><div><b>Disematkan Developer</b><span>${esc(p.text)}</span></div>`; el.classList.remove('hidden'); } else el.classList.add('hidden');
  },
  async poll(first) {
    if (this.busy) return; this.busy = true;
    try {
      const d = await FB.request('chat/global', { orderBy: '$key', limitToLast: 120 }, 'GET', undefined, 9000);
      this.msgs = Object.entries(d || {}).map(([id, m]) => ({ id, ...m })).filter(m => m && (m.t || m.s || m.im)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
      /* Batas retensi: ketika Developer sedang aktif, rapikan pesan tertua agar database tidak tumbuh tanpa batas. */
      if (App.isDev() && Object.keys(d || {}).length > 80) {
        const stale = Object.entries(d || {}).sort((a,b) => (a[1].ts || 0) - (b[1].ts || 0)).slice(0, Object.keys(d).length - 80);
        if (stale.length) { /* Hapus pesan lewat node masing-masing; media yatim dibersihkan terpisah. */
          await Promise.all(stale.map(async ([id, m]) => { await FB.request('chat/global/' + id, null, 'DELETE').catch(() => {}); if (m && m.im) await FB.request('chatimg/' + m.im, null, 'DELETE').catch(() => {}); }));
        }
      }
      this.msgs = this.msgs.slice(-80);
      const live = $('ch-live'); if (live) { live.firstElementChild.className = 'dot-ok'; live.style.opacity = 1; }
      this.render(first);
      if (first || (this.pc = (this.pc || 0) + 1) % 6 === 0) this.pinLoad();
    } catch (e) {
      const live = $('ch-live'); if (live) { live.firstElementChild.className = 'dot-bad'; live.style.opacity = .7; }
      if (first) { const l = $('ch-list'); if (l) l.innerHTML = errHtml(e.permission ? 'Rules Firebase belum mengizinkan chat. Tempel Rules terbaru dari firebase-rules-tambahan.json lalu Publish.' : 'Gagal memuat chat. Periksa internet.'); }
    } finally { this.busy = false; }
  },
  dayLabel(ts) { const d = new Date(ts), t = new Date(), y = new Date(Date.now() - 864e5), same = (a, b) => a.toDateString() === b.toDateString(); return same(d, t) ? 'Hari ini' : same(d, y) ? 'Kemarin' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); },
  render(force) {
    const l = $('ch-list'); if (!l) return; const sig = this.msgs.map(m => m.id).join(',') + '|' + App.isDev(); if (sig === this.sig && !force) return;
    const grew = this.sig && this.msgs.length > (this.n || 0); this.sig = sig; this.n = this.msgs.length;
    const body = Sheet.$('chat'), near = body.scrollHeight - body.scrollTop - body.clientHeight < 160, me = String(App.user.username).toLowerCase(), dev = App.isDev();
    let lastDay = '';
    l.innerHTML = this.msgs.length ? this.msgs.map(m => {
      const mine = String(m.u).toLowerCase() === me, isDev = String(m.r).toLowerCase() === 'developer', al = mine ? 'flex-end' : 'flex-start';
      const sep = m.ts && this.dayLabel(m.ts) !== lastDay ? (lastDay = this.dayLabel(m.ts), `<div class="ch-day"><span>${lastDay}</span></div>`) : '';
      const nameRow = `<div class="cn"><b class="cnm ${isDev ? 'dev' : ''}">${esc(m.u)}</b>${isDev ? this.tick() : ''}${Rank.badge(m.r, true)}${dev && !m.pending ? `<button class="cdel" data-del="${esc(m.id)}" data-im="${esc(m.im || '')}" title="Hapus (khusus Developer)"><i class="fa-solid fa-trash"></i></button>` : ''}</div>`;
      const imgTag = (st) => `<img data-im="${esc(m.im)}" alt="" style="display:block;${st}"/>`;
      let inner;
      if (m.s) inner = `<div style="padding:0 6px">${nameRow}</div><div style="font-size:64px;line-height:1.15;padding:0 6px">${esc(m.s)}</div>`;
      else if (m.im && m.ty === 'g') inner = `<div style="padding:0 6px">${nameRow}${imgTag('width:140px;height:140px;object-fit:contain;cursor:zoom-in')}</div>`;
      else {
        const cap = m.t ? `<div class="selectable ctx" style="${m.im ? 'margin-top:6px' : ''}">${esc(m.t)}</div>` : '';
        const ph = m.im ? imgTag('max-width:100%;width:230px;min-height:120px;border-radius:12px;background:rgba(255,255,255,.12);cursor:zoom-in;object-fit:cover') : '';
        inner = `<div class="cb ${mine ? 'me' : ''} ${isDev ? 'dev' : ''} ${m.pending ? 'pend' : ''}" style="--rc:${Rank.color(m.r)}">${nameRow}${ph}${cap}</div>`;
      }
      return `${sep}<div style="display:flex;flex-direction:column;align-items:${al}">${inner}<small class="muted" style="font-size:9.5px;font-weight:700;margin:2px 6px">${m.pending ? 'Mengirim…' : m.ts ? new Date(m.ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}</small></div>`;
    }).join('') : emptyHtml('fa-comments', 'Belum ada pesan. Jadilah yang pertama menyapa!');
    l.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { try { await FB.request('chat/global/' + b.dataset.del, null, 'DELETE'); if (b.dataset.im) { this.imgs.delete(b.dataset.im); FB.request('chatimg/' + b.dataset.im, null, 'DELETE').catch(() => {}); } this.poll(); } catch (e) { UI.toast('Gagal menghapus', 'err'); } });
    l.querySelectorAll('img[data-im]').forEach(im => this.loadImg(im));
    if (near || force) body.scrollTop = body.scrollHeight; else if (grew) { const nw = $('ch-new'); if (nw) nw.classList.remove('hidden'); }
  },
  async loadImg(img) {
    const id = img.dataset.im; let d = this.imgs.get(id);
    if (!d) {
      if (!this.pend.has(id)) this.pend.set(id, FB.request('chatimg/' + id, null, 'GET', undefined, 20000).then(v => { if (typeof v === 'string' && this.RE_IMG.test(v)) this.imgs.set(id, v); return this.imgs.get(id) || null; }).catch(() => null).finally(() => this.pend.delete(id)));
      d = await this.pend.get(id);
    }
    if (!img.isConnected) return;
    if (d) { img.src = d; img.onclick = () => this.view(d); } else { img.alt = 'Gambar tidak tersedia'; img.style.minHeight = '40px'; }
  },
  view(src) {
    if (!this.RE_IMG.test(src)) return;
    const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out';
    const i = document.createElement('img'); i.src = src; i.style.cssText = 'max-width:96vw;max-height:92vh;border-radius:8px;object-fit:contain'; o.appendChild(i); o.onclick = () => o.remove(); document.body.appendChild(o);
  },
  /* Perkecil foto di perangkat (juga membuang data lokasi/EXIF). Foto ≤720px JPEG; stiker 256px persegi. */
  async shrink(file, sticker) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('format')); i.src = url; });
      let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
      if (sticker) { const s = Math.min(w, h); sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s; w = h = 256; } else { const k = Math.min(1, 720 / Math.max(w, h)); w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k)); }
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      if (!sticker) { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
      x.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      let mime = sticker ? 'image/webp' : 'image/jpeg', q = sticker ? .8 : .7, out = c.toDataURL(mime, q);
      if (!out.startsWith('data:' + mime)) mime = out.slice(5, out.indexOf(';'));
      while (out.length > 185000 && (mime === 'image/jpeg' || mime === 'image/webp') && q > .25) { q -= .1; out = c.toDataURL(mime, q); }
      if (out.length > 190000 || !this.RE_IMG.test(out)) throw new Error('besar');
      return out;
    } finally { URL.revokeObjectURL(url); }
  },
  async post(extra, cd) {
    if (Date.now() - this.lastSend < cd) { UI.toast('Pelan-pelan, jangan terlalu cepat', 'warn'); return false; }
    const ban = await Ban.get(userKey(App.user.username)); if (ban && !App.isDev()) { App.showBan(ban); return false; }
    this.lastSend = Date.now();
    await FB.request('chat/global', null, 'POST', { u: App.user.username, k: userKey(App.user.username), r: App.user.role, ts: Date.now(), ...extra });
    await this.poll(); const b = Sheet.$('chat'); if (b) b.scrollTop = b.scrollHeight; return true;
  },
  async send() {
    const i = $('ch-in'), t = i.value.trim(); if (!t) return; i.value = ''; this.fit && this.fit();
    const tmp = { id: '~' + Date.now(), u: App.user.username, r: App.user.role, t: t.slice(0, 300), ts: Date.now(), pending: 1 };
    this.msgs.push(tmp); this.render(true);
    let ok = false;
    try { ok = await this.post({ t: t.slice(0, 300) }, 1200); }
    catch (e) { UI.toast(e.permission ? 'Ditolak Firebase — periksa Rules' : 'Pesan gagal dikirim', 'err'); }
    if (!ok) { this.msgs = this.msgs.filter(m => m !== tmp); this.render(true); i.value = t; this.fit && this.fit(); }
    i.focus();
  },
  async sendSticker(s) {
    try { if (await this.post({ s }, 1000)) $('ch-pnl').classList.add('hidden'); }
    catch (e) { UI.toast(e.permission ? 'Ditolak Firebase — periksa Rules' : 'Stiker gagal dikirim', 'err'); }
  },
  async sendImage(file, sticker) {
    if (!/^image\//.test(file.type)) return UI.toast('Pilih berkas gambar', 'warn');
    if (Date.now() - this.lastSend < 3000) return UI.toast('Pelan-pelan, jangan terlalu cepat', 'warn');
    const i = $('ch-in'), cap = sticker ? '' : i.value.trim(); UI.toast('Mengirim gambar…', 'info', 2000);
    try {
      const data = await this.shrink(file, sticker);
      const r = await FB.request('chatimg', null, 'POST', data, 45000), id = r && r.name; if (!id) throw new Error('gagal');
      this.imgs.set(id, data);
      if (await this.post({ im: id, ty: sticker ? 'g' : 'p', ...(cap ? { t: cap.slice(0, 300) } : {}) }, 0)) { if (cap) i.value = ''; $('ch-pnl').classList.add('hidden'); }
    } catch (e) { UI.toast(e.permission ? 'Ditolak Firebase — periksa Rules' : e.message === 'format' ? 'Format gambar tidak didukung' : e.message === 'besar' ? 'Gambar terlalu besar' : 'Gambar gagal dikirim', 'err'); }
  }
};
Features.reg({ id: 'chat', name: 'Chat Global', cat: 'sosmed', icon: 'fa-comments', grad: 'linear-gradient(135deg,#0ea5e9,#2563eb)', open: () => Chat.open() });
