/* ==== 21-tok.js — Dimzz Play v1: feed video vertikal, like/komentar/follow/unggah, LIVE (WebRTC + signaling Firebase), centang biru otomatis untuk Developer ==== */
const VF_SVG = '<svg class="tk-vf" viewBox="0 0 24 24" aria-label="Terverifikasi"><path fill="#1d9bf0" d="M12 1.8l2.4 1.7 2.9-.2 1.2 2.7 2.6 1.3-.3 2.9L22.2 12l-1.4 2.5.3 2.9-2.6 1.3-1.2 2.7-2.9-.2L12 22.2l-2.4-1.7-2.9.2-1.2-2.7-2.6-1.3.3-2.9L1.8 12l1.4-2.5-.3-2.9 2.6-1.3 1.2-2.7 2.9.2z"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M7.8 12.3l3 3 5.4-6"/></svg>';

const Tok = {
  tab: 'fy', vids: [], fol: {}, roleC: {}, verif: {}, io: null, live: null, view: null, root: null,
  on() { return FB.mode === 'firebase' && !!FB.st.idToken; },
  me() { return { uid: FB.st.uid, u: App.user.username }; },
  async db(p, q, m, b) { return FB.request(p, q, m || 'GET', b); },
  /* centang biru: Developer otomatis (role hanya bisa diberikan lewat Console/Developer, tidak bisa dipalsukan pengguna) + daftar tok/verif yang hanya bisa ditulis Developer */
  async isVf(uid, key) {
    if (this.roleC[uid] === undefined) { try { this.roleC[uid] = String(await this.db('users/' + uid + '/role') || ''); } catch (e) { this.roleC[uid] = ''; } }
    return this.roleC[uid].toLowerCase() === 'developer' || !!this.verif[key];
  },
  async open() {
    if (!this.on()) return UI.alert('Perlu Firebase', 'Dimzz Play butuh akun online (Firebase). Masuk dengan koneksi internet lalu coba lagi.', { type: 'warn' });
    try { if (window.Bgm && Bgm.el) Bgm.el.pause(); } catch (e) {}
    Sheet.open({
      id: 'tok', title: 'Dimzz Play', full: true, cls: 'tk-panel', bodyCls: 'tk-bodywrap',
      body: `<div class="tk" id="tk"><div class="tk-aur"></div>
        <div class="tk-top"><div class="tk-tr"><button class="tk-lvb" data-t="lv" aria-label="LIVE"><span>LIVE</span></button>
          <div class="tk-tabs"><b data-t="fo">Mengikuti</b><b data-t="fy" class="on">Saran</b><span class="tk-ind"></span></div><span class="tk-sp"></span></div>
          <button class="tk-sb" id="tk-sb"><i class="fa-solid fa-magnifying-glass"></i><span>Cari video atau akun</span></button></div>
        <div class="tk-feed" id="tk-feed"></div><div class="tk-livebox hidden" id="tk-lvbox"></div>
        
        <nav class="tk-nav"><button data-n="home" class="on"><i class="fa-solid fa-house"></i><span>Beranda</span></button><button data-n="live"><i class="fa-solid fa-tower-broadcast"></i><span>LIVE</span></button><button class="tk-plus" id="tk-plus" aria-label="Buat"><b><i class="fa-solid fa-plus"></i></b></button><button data-n="inbox"><i class="fa-regular fa-message"></i><span>Kotak Masuk</span><em class="tk-bd hidden"></em></button><button data-n="me"><i class="fa-regular fa-user"></i><span>Saya</span></button></nav>
        <div class="tk-pgbox hidden" id="tk-pg"></div><div class="tk-ov hidden" id="tk-ov"></div></div>`,
      onOpen: el => { this.root = el.querySelector('#tk'); this.bind(); this.load(); },
      onClose: () => { this.stopAll(); }
    });
  },
  bind() {
    const r = this.root, q = s => r.querySelector(s);
    const go = () => { const t = prompt('Cari video atau akun:', this.q || ''); if (t === null) return; this.q = t.trim().toLowerCase(); this.setTab(this.q ? 'q' : 'fy'); };
    q('#tk-sb').onclick = go;
    r.querySelectorAll('.tk-tabs b,.tk-lvb').forEach(b => b.onclick = () => this.setTab(b.dataset.t));
    r.querySelectorAll('.tk-nav [data-n]').forEach(b => b.onclick = () => {
      const n = b.dataset.n; if (n === 'shop' || n === 'inbox') return UI.toast((n === 'shop' ? 'Toko' : 'Kotak Masuk') + ' segera hadir', 'info');
      if (n === 'home' && this.tab === 'fy') return Sheet.close('tok');
      r.querySelectorAll('.tk-nav [data-n]').forEach(x => x.classList.toggle('on', x === b)); this.setTab(n === 'me' ? 'me' : 'fy');
    });
    q('#tk-plus').onclick = () => this.menu();
    this.setTab('fy', true);
  },
  setTab(t, quiet) {
    this.tab = t; const r = this.root, tabs = [...r.querySelectorAll('.tk-tabs b')], i = tabs.findIndex(b => b.dataset.t === t);
    tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t)); r.querySelector('.tk-lvb').classList.toggle('on', t === 'lv');
    const ind = r.querySelector('.tk-ind'), b = tabs[i]; ind.style.opacity = b ? 1 : 0; if (b) { ind.style.width = b.offsetWidth * .6 + 'px'; ind.style.transform = `translateX(${b.offsetLeft + b.offsetWidth * .2}px)`; }
    const lv = t === 'lv'; r.querySelector('#tk-feed').classList.toggle('hidden', lv); r.querySelector('#tk-lvbox').classList.toggle('hidden', !lv);
    if (lv) { this.pauseAll(); this.loadLive(); } else if (!quiet) this.renderFeed();
  },
  /* ---------- feed ---------- */
  async load() {
    const f = this.root.querySelector('#tk-feed'); f.innerHTML = '<div class="tk-empty"><div class="tk-spin"></div><p>Menyiapkan video…</p></div>';
    try {
      const [v, fo, vf] = await Promise.all([this.db('tok/videos', { orderBy: 'ts', limitToLast: 40 }), this.db('tok/fol/' + FB.st.uid), this.db('tok/verif')]);
      this.vids = Object.entries(v || {}).map(([id, x]) => Object.assign({ id }, x)).sort((a, b) => b.ts - a.ts);
      this.fol = fo || {}; this.verif = vf || {};
    } catch (e) { this.vids = []; UI.toast('Gagal memuat video', 'err'); }
    if (this.tab === 'lv') this.loadLive(); else this.renderFeed();
  },
  renderFeed() {
    const f = this.root.querySelector('#tk-feed'); if (this.io) this.io.disconnect();
    const T = this.tab, list = T === 'fo' ? this.vids.filter(v => this.fol[v.uid]) : T === 'me' ? this.vids.filter(v => v.uid === FB.st.uid) : T === 'q' ? this.vids.filter(v => (String(v.u) + ' ' + String(v.cap || '')).toLowerCase().includes(this.q)) : this.vids;
    if (!list.length) { f.innerHTML = `<div class="tk-empty"><i class="fa-solid fa-clapperboard"></i><h3>${T === 'fo' ? 'Belum ada yang kamu ikuti' : T === 'me' ? 'Kamu belum punya video' : T === 'q' ? 'Tidak ada hasil' : 'Belum ada video'}</h3><p>Jadilah yang pertama membagikan sesuatu.</p><button class="tk-cta" id="tk-up0"><i class="fa-solid fa-plus"></i> Unggah video</button></div>`; const b = f.querySelector('#tk-up0'); if (b) b.onclick = () => this.upload(); return; }
    f.innerHTML = list.map(v => `<section class="tk-item" data-id="${esc(v.id)}" data-uid="${esc(v.uid)}"><video loop playsinline webkit-playsinline preload="none" data-src="${esc(v.url)}"></video><div class="tk-shade"></div><div class="tk-heart"></div>
      <div class="tk-rail"><div class="tk-av"><span class="tk-ring">${esc(String(v.u || '?').charAt(0).toUpperCase())}</span>${v.uid === FB.st.uid ? '' : `<button class="tk-fol${this.fol[v.uid] ? ' on' : ''}" data-a="fol"><i class="fa-solid ${this.fol[v.uid] ? 'fa-check' : 'fa-plus'}"></i></button>`}</div>
        <button class="tk-act" data-a="like"><i class="fa-solid fa-heart"></i><span class="n">–</span></button>
        <button class="tk-act" data-a="cm"><i class="fa-solid fa-comment-dots"></i><span class="n">Komentar</span></button>
        <button class="tk-act${(LS.get('tk_bm', {}) || {})[v.id] ? ' on bm' : ''}" data-a="bm"><i class="fa-solid fa-bookmark"></i><span class="n">Simpan</span></button>
        <button class="tk-act" data-a="sh"><i class="fa-solid fa-share"></i><span class="n">Bagikan</span></button>
        <div class="tk-disc"><i class="fa-solid fa-music"></i></div></div>
      <div class="tk-info"><div class="tk-nm"><b>@${esc(v.u)}</b><span class="tk-vfs"></span></div><p>${esc(v.cap || '')}</p></div>
      <div class="tk-prog"><i></i></div></section>`).join('');
    f.querySelectorAll('.tk-item').forEach(it => this.wire(it));
    this.io = new IntersectionObserver(es => es.forEach(e => {
      const it = e.target, v = it.querySelector('video');
      if (e.isIntersecting && !v.src) { v.src = v.dataset.src; }
      if (e.intersectionRatio > .7) { f.querySelectorAll('video').forEach(o => { if (o !== v) o.pause(); }); v.muted = false; v.play().catch(() => { v.muted = true; v.play().catch(() => {}); }); this.hydrate(it); }
      else v.pause();
    }), { root: f, threshold: [0, .7] });
    f.querySelectorAll('.tk-item').forEach(it => this.io.observe(it));
  },
  async hydrate(it) {
    if (it.dataset.h) return; it.dataset.h = 1; const id = it.dataset.id, uid = it.dataset.uid, v = this.vids.find(x => x.id === id);
    try { const k = await this.db('tok/likes/' + id, { shallow: true }); const keys = Object.keys(k || {}); it.querySelector('[data-a=like] .n').textContent = keys.length; if (keys.includes(FB.st.uid)) it.querySelector('[data-a=like]').classList.add('on'); } catch (e) {}
    if (v && await this.isVf(uid, userKey(v.u))) it.querySelector('.tk-vfs').innerHTML = VF_SVG;
  },
  wire(it) {
    const v = it.querySelector('video'), id = it.dataset.id, bar = it.querySelector('.tk-prog i'); let last = 0;
    v.addEventListener('loadedmetadata', () => { if (v.videoWidth > v.videoHeight) v.style.objectFit = 'contain'; });
    v.addEventListener('timeupdate', () => { if (v.duration) bar.style.width = (v.currentTime / v.duration * 100) + '%'; });
    it.addEventListener('click', e => {
      if (e.target.closest('.tk-rail,.tk-info')) return;
      const n = Date.now(); if (n - last < 280) { this.like(it, true); last = 0; this.burst(it, e); return; } last = n;
      setTimeout(() => { if (last && Date.now() - last >= 280) { v.paused ? v.play() : v.pause(); it.classList.toggle('paused', v.paused); last = 0; } }, 300);
    });
    it.querySelector('.tk-rail').addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'like') this.like(it); else if (a === 'cm') this.comments(id); else if (a === 'fol') this.follow(it.dataset.uid, b); else if (a === 'sh') this.share(id); else if (a === 'bm') { const m = LS.get('tk_bm', {}) || {}; if (m[id]) delete m[id]; else m[id] = 1; LS.set('tk_bm', m); b.classList.toggle('on', !!m[id]); b.classList.add('bm'); }
    });
  },
  burst(it, e) {
    const r = it.getBoundingClientRect(), h = document.createElement('i'); h.className = 'fa-solid fa-heart tk-pop'; h.style.left = (e.clientX - r.left) + 'px'; h.style.top = (e.clientY - r.top) + 'px'; h.style.setProperty('--rz', (Math.random() * 40 - 20) + 'deg'); it.appendChild(h); setTimeout(() => h.remove(), 900);
    try { navigator.vibrate && navigator.vibrate(12); } catch (x) {}
  },
  async like(it, onlyOn) {
    const id = it.dataset.id, b = it.querySelector('[data-a=like]'), n = b.querySelector('.n'), was = b.classList.contains('on'); if (onlyOn && was) return;
    b.classList.toggle('on', !was); n.textContent = Math.max(0, (parseInt(n.textContent) || 0) + (was ? -1 : 1));
    try { await this.db('tok/likes/' + id + '/' + FB.st.uid, null, was ? 'DELETE' : 'PUT', was ? undefined : true); } catch (e) { b.classList.toggle('on', was); UI.toast('Gagal menyimpan suka', 'err'); }
  },
  async follow(uid, b) {
    const on = !this.fol[uid]; this.fol[uid] = on ? true : undefined; if (!on) delete this.fol[uid];
    this.root.querySelectorAll(`.tk-item[data-uid="${uid}"] .tk-fol`).forEach(x => { x.classList.toggle('on', on); x.innerHTML = `<i class="fa-solid ${on ? 'fa-check' : 'fa-plus'}"></i>`; });
    try { await this.db('tok/fol/' + FB.st.uid + '/' + uid, null, on ? 'PUT' : 'DELETE', on ? true : undefined); } catch (e) { UI.toast('Gagal mengikuti', 'err'); }
  },
  share(id) { const v = this.vids.find(x => x.id === id); const t = `Lihat video @${v ? v.u : ''} di Dimzz Play`; if (navigator.share) navigator.share({ title: 'Dimzz Play', text: t, url: v ? v.url : location.href }).catch(() => {}); else { try { navigator.clipboard.writeText(v ? v.url : location.href); UI.toast('Tautan disalin', 'ok'); } catch (e) {} } },
  async comments(id) {
    const ov = this.root.querySelector('#tk-ov'); ov.classList.remove('hidden');
    ov.innerHTML = `<div class="tk-sheet"><div class="tk-grab"></div><div class="tk-sh-h"><b>Komentar</b><button class="tk-ib sm" data-x><i class="fa-solid fa-xmark"></i></button></div><div class="tk-cm" id="tk-cm"><div class="tk-spin"></div></div><div class="tk-in"><input id="tk-ci" maxlength="200" placeholder="Tambahkan komentar…" /><button id="tk-cs"><i class="fa-solid fa-paper-plane"></i></button></div></div>`;
    const close = () => { ov.classList.add('hidden'); ov.innerHTML = ''; }; ov.onclick = e => { if (e.target === ov || e.target.closest('[data-x]')) close(); };
    const box = ov.querySelector('#tk-cm'), draw = async () => {
      let c = {}; try { c = await this.db('tok/cm/' + id) || {}; } catch (e) {}
      const l = Object.values(c).sort((a, b) => a.ts - b.ts); box.innerHTML = l.length ? l.map(x => `<div class="tk-c"><span class="tk-ring sm">${esc(String(x.u).charAt(0).toUpperCase())}</span><div><b>${esc(x.u)}</b><p>${esc(x.t)}</p></div></div>`).join('') : '<p class="tk-mt">Belum ada komentar. Mulai percakapan!</p>';
    }; await draw();
    const send = async () => { const i = ov.querySelector('#tk-ci'), t = i.value.trim(); if (!t) return; i.value = ''; try { await this.db('tok/cm/' + id, null, 'POST', { u: App.user.username, uid: FB.st.uid, t, ts: Date.now() }); const vv = this.vids.find(x => x.id === id); if (vv && vv.uid !== FB.st.uid) this.db('tok/act/' + vv.uid, null, 'POST', { type: 'cm', u: App.user.username, uid: FB.st.uid, t: t.slice(0, 60), ts: Date.now() }).catch(() => {}); await draw(); } catch (e) { UI.toast('Gagal mengirim', 'err'); } };
    ov.querySelector('#tk-cs').onclick = send; ov.querySelector('#tk-ci').onkeydown = e => { if (e.key === 'Enter') send(); };
  },
  menu() {
    const ov = this.root.querySelector('#tk-ov'); ov.classList.remove('hidden');
    ov.innerHTML = `<div class="tk-sheet sm"><div class="tk-grab"></div><button class="tk-mi" data-m="up"><i class="fa-solid fa-film"></i><div><b>Unggah video</b><small>Bagikan video ke Untuk Kamu</small></div></button><button class="tk-mi live" data-m="lv"><i class="fa-solid fa-tower-broadcast"></i><div><b>Mulai LIVE</b><small>Siaran langsung dari kameramu</small></div></button></div>`;
    ov.onclick = e => { const b = e.target.closest('[data-m]'); if (b || e.target === ov) { ov.classList.add('hidden'); ov.innerHTML = ''; if (b) b.dataset.m === 'up' ? this.upload() : this.goLive(); } };
  },
  upload() {
    const ov = this.root.querySelector('#tk-ov'); ov.classList.remove('hidden');
    ov.innerHTML = `<div class="tk-sheet"><div class="tk-grab"></div><div class="tk-sh-h"><b>Unggah video</b><button class="tk-ib sm" data-x><i class="fa-solid fa-xmark"></i></button></div><div class="tk-form"><label class="tk-file"><i class="fa-solid fa-cloud-arrow-up"></i><span id="tk-fn">Pilih video (maks 60 MB)</span><input type="file" id="tk-f" accept="video/*" hidden/></label><div class="tk-or">atau tempel tautan video (.mp4)</div><input id="tk-u" placeholder="https://…/video.mp4" /><textarea id="tk-c" maxlength="150" rows="2" placeholder="Tulis keterangan…"></textarea><button class="tk-cta" id="tk-go"><i class="fa-solid fa-paper-plane"></i> Posting</button><div class="tk-pg hidden" id="tk-pg"><i></i></div></div></div>`;
    ov.onclick = e => { if (e.target === ov || e.target.closest('[data-x]')) { ov.classList.add('hidden'); ov.innerHTML = ''; } };
    const f = ov.querySelector('#tk-f'); f.onchange = () => { ov.querySelector('#tk-fn').textContent = f.files[0] ? f.files[0].name : 'Pilih video (maks 60 MB)'; };
    ov.querySelector('#tk-go').onclick = async () => {
      const file = f.files[0], link = ov.querySelector('#tk-u').value.trim(), cap = ov.querySelector('#tk-c').value.trim(), pg = ov.querySelector('#tk-pg'), bar = pg.querySelector('i'), go = ov.querySelector('#tk-go');
      if (!file && !/^https:\/\//.test(link)) return UI.toast('Pilih video atau tempel tautan https', 'warn');
      if (file && file.size > 60 * 1048576) return UI.toast('Ukuran video maksimal 60 MB', 'warn');
      go.disabled = true; pg.classList.remove('hidden');
      try {
        let url = link;
        if (file) url = await this.storeFile(file, p => bar.style.width = p + '%');
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await this.db('tok/videos/' + id, null, 'PUT', { u: App.user.username, uid: FB.st.uid, url, cap, ts: Date.now() });
        ov.classList.add('hidden'); ov.innerHTML = ''; UI.toast('Video diposting!', 'ok'); this.setTab('fy', true); this.load();
      } catch (e) { go.disabled = false; pg.classList.add('hidden'); UI.alert('Gagal mengunggah', (e && e.userMessage) || 'Periksa Firebase Storage Rules (harus mengizinkan tulis untuk pengguna login) atau pakai tautan video.', { type: 'warn' }); }
    };
  },
  storeFile(file, prog) {
    return new Promise(async (ok, no) => {
      const b = FB.cfg().storageBucket, name = `tok/${FB.st.uid}/${Date.now()}_${file.name.replace(/[^\w.]/g, '_')}`, tok = await FB.token();
      const x = new XMLHttpRequest(); x.open('POST', `https://firebasestorage.googleapis.com/v0/b/${b}/o?name=${encodeURIComponent(name)}`);
      x.setRequestHeader('Authorization', 'Firebase ' + tok); x.setRequestHeader('Content-Type', file.type || 'video/mp4');
      x.upload.onprogress = e => e.lengthComputable && prog(Math.round(e.loaded / e.total * 100));
      x.onload = () => { try { const j = JSON.parse(x.responseText); if (x.status !== 200) return no(new Error(j.error && j.error.message)); ok(`https://firebasestorage.googleapis.com/v0/b/${b}/o/${encodeURIComponent(j.name)}?alt=media&token=${j.downloadTokens}`); } catch (e) { no(e); } };
      x.onerror = () => no(new Error('jaringan')); x.send(file);
    });
  },
  pauseAll() { this.root && this.root.querySelectorAll('video').forEach(v => v.pause()); },
  /* ---------- LIVE ---------- */
  ICE() { return (window.WA && WA.ICE) || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }; },
  waitIce(pc) { return new Promise(r => { if (pc.iceGatheringState === 'complete') return r(); const t = setTimeout(r, 4500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } }); }); },
  async loadLive() {
    const b = this.root.querySelector('#tk-lvbox'); b.innerHTML = '<div class="tk-empty"><div class="tk-spin"></div></div>'; let l = {};
    try { l = await this.db('tok/live') || {}; } catch (e) {}
    const now = Date.now(), arr = Object.values(l).filter(x => x && now - x.ts < 45000);
    b.innerHTML = `<div class="tk-lvh"><h2>Sedang <span>LIVE</span></h2><button class="tk-cta sm" id="tk-gl"><i class="fa-solid fa-video"></i> Mulai LIVE</button></div>` + (arr.length ? `<div class="tk-lvg">${arr.map(x => `<button class="tk-lc" data-h="${esc(x.uid)}"><div class="tk-lcb"><span class="tk-pill"><i></i>LIVE</span><span class="tk-vw"><i class="fa-solid fa-eye"></i> ${x.vw || 0}</span></div><div class="tk-lct"><b>${esc(x.title || 'Siaran langsung')}</b><small>@${esc(x.u)}</small></div></button>`).join('')}</div>` : '<div class="tk-empty"><i class="fa-solid fa-tower-broadcast"></i><h3>Belum ada yang LIVE</h3><p>Mulai siaran pertamamu sekarang.</p></div>');
    b.querySelector('#tk-gl').onclick = () => this.goLive(); b.querySelectorAll('.tk-lc').forEach(c => c.onclick = () => this.watch(l[c.dataset.h]));
    arr.forEach(x => this.isVf(x.uid, userKey(x.u)).then(v => { if (v) { const s = b.querySelector(`.tk-lc[data-h="${x.uid}"] small`); if (s) s.insertAdjacentHTML('beforeend', VF_SVG); } }));
  },
  livePanel(html) { const ov = this.root.querySelector('#tk-ov'); ov.classList.remove('hidden'); ov.classList.add('full'); ov.innerHTML = html; return ov; },
  async goLive() {
    if (!navigator.mediaDevices || !window.RTCPeerConnection) return UI.alert('Tidak didukung', 'Browser belum mendukung siaran langsung (butuh HTTPS + Chrome/Safari terbaru).', { type: 'warn' });
    const title = prompt('Judul LIVE kamu:', 'Ngobrol santai') ; if (title === null) return;
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true }); } catch (e) { return UI.alert('Izin ditolak', 'Izinkan kamera & mikrofon untuk mulai LIVE.', { type: 'warn' }); }
    const me = this.me(), L = this.live = { stream, pcs: {}, seen: {}, last: 0, timers: [] };
    const ov = this.livePanel(`<div class="tk-lv"><video id="tk-hv" muted autoplay playsinline></video><div class="tk-shade"></div><div class="tk-lvt"><span class="tk-pill"><i></i>LIVE</span><span class="tk-vw"><i class="fa-solid fa-eye"></i> <b id="tk-hn">0</b></span><button class="tk-end" id="tk-end">Akhiri</button></div><div class="tk-chat" id="tk-lchat"></div><div class="tk-in"><input id="tk-li" maxlength="120" placeholder="Sapa penontonmu…"/><button id="tk-ls"><i class="fa-solid fa-paper-plane"></i></button></div></div>`);
    ov.querySelector('#tk-hv').srcObject = stream;
    const put = () => this.db('tok/live/' + me.uid, null, 'PUT', { u: me.u, uid: me.uid, title: title || 'Siaran langsung', ts: Date.now(), vw: Object.keys(L.pcs).length }).catch(() => {});
    await put(); L.timers.push(setInterval(put, 15000));
    L.timers.push(setInterval(async () => {
      let lv = {}; try { lv = await this.db('tok/lv/' + me.uid) || {}; } catch (e) { return; }
      for (const [vid, d] of Object.entries(lv)) {
        if (!d || !d.offer || L.seen[vid] === d.ts || Object.keys(L.pcs).length >= 8) continue; L.seen[vid] = d.ts;
        try {
          if (L.pcs[vid]) { try { L.pcs[vid].close(); } catch (x) {} }
          const pc = L.pcs[vid] = new RTCPeerConnection(this.ICE()); stream.getTracks().forEach(t => pc.addTrack(t, stream));
          pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) { delete L.pcs[vid]; const n = ov.querySelector('#tk-hn'); if (n) n.textContent = Object.keys(L.pcs).length; } };
          await pc.setRemoteDescription(JSON.parse(d.offer)); await pc.setLocalDescription(await pc.createAnswer()); await this.waitIce(pc);
          await this.db('tok/lv/' + me.uid + '/' + vid + '/answer', null, 'PUT', JSON.stringify(pc.localDescription));
          const n = ov.querySelector('#tk-hn'); if (n) n.textContent = Object.keys(L.pcs).length;
        } catch (e) { delete L.pcs[vid]; }
      }
    }, 1500));
    L.timers.push(setInterval(() => this.pollChat(me.uid, ov.querySelector('#tk-lchat'), L), 2000));
    const send = () => this.sendChat(me.uid, ov.querySelector('#tk-li')); ov.querySelector('#tk-ls').onclick = send; ov.querySelector('#tk-li').onkeydown = e => { if (e.key === 'Enter') send(); };
    ov.querySelector('#tk-end').onclick = () => this.endLive();
  },
  async endLive() {
    const L = this.live; if (!L) return; const uid = FB.st.uid; this.live = null;
    L.timers.forEach(clearInterval); Object.values(L.pcs).forEach(p => { try { p.close(); } catch (e) {} }); L.stream.getTracks().forEach(t => t.stop());
    ['live', 'lv', 'lc'].forEach(n => this.db('tok/' + n + '/' + uid, null, 'DELETE').catch(() => {}));
    const ov = this.root && this.root.querySelector('#tk-ov'); if (ov) { ov.classList.add('hidden'); ov.classList.remove('full'); ov.innerHTML = ''; }
    UI.toast('LIVE selesai', 'ok'); if (this.tab === 'lv') this.loadLive();
  },
  async pollChat(host, box, S) {
    if (!box) return; try {
      const c = await this.db('tok/lc/' + host, { orderBy: 'ts', limitToLast: 30 }) || {}, l = Object.values(c).sort((a, b) => a.ts - b.ts);
      box.innerHTML = l.map(x => `<div class="tk-lm"><b>${esc(x.u)}</b> ${esc(x.t)}</div>`).join(''); box.scrollTop = box.scrollHeight;
    } catch (e) {}
  },
  async sendChat(host, inp) { const t = inp.value.trim(); if (!t) return; inp.value = ''; try { await this.db('tok/lc/' + host, null, 'POST', { u: App.user.username, uid: FB.st.uid, t, ts: Date.now() }); } catch (e) { UI.toast('Gagal mengirim', 'err'); } },
  async watch(h) {
    if (!h) return; const me = this.me(), V = this.view = { pc: null, timers: [] }, ov = this.livePanel(`<div class="tk-lv"><video id="tk-rv" autoplay playsinline></video><div class="tk-shade"></div><div class="tk-lvt"><span class="tk-pill"><i></i>LIVE</span><b class="tk-hn2">@${esc(h.u)}</b><button class="tk-end" id="tk-end">Keluar</button></div><div class="tk-wait" id="tk-wt"><div class="tk-spin"></div><p>Menyambungkan ke siaran…</p></div><div class="tk-chat" id="tk-lchat"></div><div class="tk-in"><input id="tk-li" maxlength="120" placeholder="Ketik komentar…"/><button id="tk-ls"><i class="fa-solid fa-paper-plane"></i></button></div></div>`);
    const out = () => this.leave(h.uid); ov.querySelector('#tk-end').onclick = out;
    try {
      const pc = V.pc = new RTCPeerConnection(this.ICE()); pc.addTransceiver('video', { direction: 'recvonly' }); pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.ontrack = e => { const v = ov.querySelector('#tk-rv'); if (v) { v.srcObject = e.streams[0]; v.play().catch(() => {}); } const w = ov.querySelector('#tk-wt'); if (w) w.remove(); };
      await pc.setLocalDescription(await pc.createOffer()); await this.waitIce(pc);
      await this.db('tok/lv/' + h.uid + '/' + me.uid, null, 'PUT', { offer: JSON.stringify(pc.localDescription), ts: Date.now(), u: me.u });
      let tries = 0; V.timers.push(setInterval(async () => {
        if (++tries > 30 || pc.signalingState === 'stable') return; try { const a = await this.db('tok/lv/' + h.uid + '/' + me.uid + '/answer'); if (a) await pc.setRemoteDescription(JSON.parse(a)); } catch (e) {}
        if (tries > 30) { const w = ov.querySelector('#tk-wt'); if (w) w.innerHTML = '<p>Host tidak merespons. Coba lagi nanti.</p>'; }
      }, 1000));
    } catch (e) { UI.toast('Gagal tersambung ke LIVE', 'err'); }
    V.timers.push(setInterval(() => this.pollChat(h.uid, ov.querySelector('#tk-lchat')), 2000));
    const send = () => this.sendChat(h.uid, ov.querySelector('#tk-li')); ov.querySelector('#tk-ls').onclick = send; ov.querySelector('#tk-li').onkeydown = e => { if (e.key === 'Enter') send(); };
  },
  leave(host) {
    const V = this.view; this.view = null; if (V) { V.timers.forEach(clearInterval); try { V.pc.close(); } catch (e) {} this.db('tok/lv/' + host + '/' + FB.st.uid, null, 'DELETE').catch(() => {}); }
    const ov = this.root && this.root.querySelector('#tk-ov'); if (ov) { ov.classList.add('hidden'); ov.classList.remove('full'); ov.innerHTML = ''; }
  },
  stopAll() { if (this.live) this.endLive(); if (this.view) this.leave(''); if (this.io) this.io.disconnect(); this.root = null; try { Bgm.resumeIfWanted(); } catch (e) {} },
  /* ---------- centang biru di profil sendiri (otomatis untuk Developer) ---------- */
  decorate() {
    const n = document.getElementById('u-name'); if (!n || !App.user || !n.textContent || n.textContent === '…') return false;
    if (App.isDev() && !n.parentNode.querySelector('.tk-vf')) n.insertAdjacentHTML('afterend', VF_SVG);
    return true;
  }
};
Features.reg({ id: 'tok', name: 'Dimzz Play', cat: 'media', icon: 'fa-clapperboard', grad: 'linear-gradient(135deg,#7c3aed,#ec4899)', open: () => Tok.open() });
(function () { const o = Rank.badge; Rank.badge = function (role, sm) { const h = o.call(this, role, sm); return String(role).toLowerCase() === 'developer' ? h + VF_SVG : h; }; })();
(function () { let t = 0; const iv = setInterval(() => { if (Tok.decorate() || ++t > 80) clearInterval(iv); }, 1500); })();

/* ---------- Kotak Masuk (chat antar-akun), Saya (profil), notifikasi ---------- */
Object.assign(Tok, {
  fmt(ts) { const d = new Date(ts), n = new Date(); return d.toDateString() === n.toDateString() ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  av(n, c) { return `<span class="tkp-av ${c || ''}">${esc(String(n || '?').charAt(0).toUpperCase())}</span>`; },
  async follow(uid) {
    const on = !this.fol[uid], nm = (this.vids.find(v => v.uid === uid) || {}).u || 'user';
    if (on) this.fol[uid] = nm; else delete this.fol[uid];
    this.root.querySelectorAll(`.tk-item[data-uid="${uid}"] .tk-fol`).forEach(x => { x.classList.toggle('on', on); x.innerHTML = `<i class="fa-solid ${on ? 'fa-check' : 'fa-plus'}"></i>`; });
    try {
      await this.db('tok/fol/' + FB.st.uid + '/' + uid, null, on ? 'PUT' : 'DELETE', on ? nm : undefined);
      await this.db('tok/fans/' + uid + '/' + FB.st.uid, null, on ? 'PUT' : 'DELETE', on ? App.user.username : undefined);
      if (on) this.db('tok/act/' + uid, null, 'POST', { type: 'follow', u: App.user.username, uid: FB.st.uid, ts: Date.now() }).catch(() => {});
    } catch (e) { UI.toast('Gagal mengikuti', 'err'); }
  },
  async showPage(n) {
    const r = this.root, box = r.querySelector('#tk-pg'), pg = n === 'inbox' || n === 'me'; clearInterval(this.pt); this.pt = null;
    r.classList.toggle('pg', pg); box.classList.toggle('hidden', !pg);
    r.querySelectorAll('.tk-nav [data-n]').forEach(x => x.classList.toggle('on', x.dataset.n === n));
    if (pg) { this.pauseAll(); n === 'inbox' ? this.inbox(box) : this.profile(box); }
  },
  async inbox(box) {
    const me = FB.st.uid; box.innerHTML = '<div class="tkp-top"><button id="tkp-new" aria-label="Chat baru"><i class="fa-regular fa-circle-plus"></i></button><b>Kotak Masuk</b><span></span></div><div class="tkp-sc"><div class="tk-spin dk"></div></div>';
    let ib = {}, ac = {}, fans = {}; try { [ib, ac, fans] = await Promise.all([this.db('tok/inbox/' + me), this.db('tok/act/' + me, { orderBy: 'ts', limitToLast: 1 }), this.db('tok/fans/' + me, { shallow: true })]); } catch (e) {}
    ib = ib || {}; ac = ac || {}; fans = fans || {};
    const chats = Object.entries(ib).map(([uid, x]) => Object.assign({ uid }, x)).sort((a, b) => b.ts - a.ts), la = Object.values(ac)[0], nf = Object.keys(fans).length;
    const stories = Object.entries(this.fol || {}).slice(0, 12);
    box.querySelector('.tkp-sc').innerHTML = `<div class="tkp-st"><button data-new><span class="tkp-av big add">${'<i class="fa-solid fa-plus"></i>'}</span><small>Buat</small></button>${stories.map(([u, n]) => `<button data-c="${esc(u)}" data-n="${esc(typeof n === 'string' ? n : 'user')}">${this.av(typeof n === 'string' ? n : 'user', 'big ring')}<small>${esc(typeof n === 'string' ? n : 'user')}</small></button>`).join('')}</div>
      <button class="tkp-r" data-act="a"><span class="tkp-ic" style="background:#fe2c55"><i class="fa-solid fa-bell"></i></span><div><b>Aktivitas</b><p>${la ? esc(la.u) + (la.type === 'cm' ? ' mengomentari: ' + esc(la.t || '') : ' mulai mengikuti Anda.') : 'Belum ada aktivitas.'}</p></div></button>
      <button class="tkp-r" data-act="f"><span class="tkp-ic" style="background:#20a4f3"><i class="fa-solid fa-user-group"></i></span><div><b>Pengikut baru</b><p>${nf} orang mengikutimu.</p></div><i class="fa-solid fa-chevron-right mut"></i></button>
      ${chats.map(c => `<button class="tkp-r" data-c="${esc(c.uid)}" data-n="${esc(c.u)}">${this.av(c.u)}<div><b>${esc(c.u)}</b><p>${esc(c.last || '')} · ${this.fmt(c.ts)}</p></div>${c.unread ? `<em class="tkp-bg">${c.unread}</em>` : ''}</button>`).join('') || '<p class="tkp-mt">Belum ada percakapan. Ketuk + untuk mulai chat.</p>'}`;
    const nw = async () => { const t = prompt('Chat dengan username:'); if (!t) return; let uid = null; try { uid = await this.db('keys/' + userKey(t.trim())); } catch (e) {} if (!uid) return UI.toast('Username tidak ditemukan', 'warn'); if (uid === me) return UI.toast('Itu akunmu sendiri', 'warn'); this.chat(uid, t.trim()); };
    box.querySelector('#tkp-new').onclick = nw;
    box.onclick = e => { const b = e.target.closest('[data-new],[data-c],[data-act]'); if (!b) return; if (b.dataset.new !== undefined) nw(); else if (b.dataset.c) this.chat(b.dataset.c, b.dataset.n); else this.acts(box, b.dataset.act); };
    this.unread();
  },
  async acts(box, k) {
    const me = FB.st.uid; box.innerHTML = `<div class="tkp-top"><button data-b><i class="fa-solid fa-chevron-left"></i></button><b>${k === 'f' ? 'Pengikut baru' : 'Aktivitas'}</b><span></span></div><div class="tkp-sc"><div class="tk-spin dk"></div></div>`;
    let a = {}; try { a = await this.db('tok/act/' + me, { orderBy: 'ts', limitToLast: 40 }) || {}; } catch (e) {}
    const l = Object.values(a).filter(x => k !== 'f' || x.type === 'follow').sort((x, y) => y.ts - x.ts);
    box.querySelector('.tkp-sc').innerHTML = l.map(x => `<div class="tkp-r">${this.av(x.u)}<div><b>${esc(x.u)}</b><p>${x.type === 'cm' ? 'mengomentari: ' + esc(x.t || '') : 'mulai mengikuti Anda.'} · ${this.fmt(x.ts)}</p></div></div>`).join('') || '<p class="tkp-mt">Belum ada.</p>';
    box.onclick = e => { if (e.target.closest('[data-b]')) this.inbox(box); };
  },
  async chat(peer, name) {
    const box = this.root.querySelector('#tk-pg'), me = FB.st.uid, cid = [me, peer].sort().join('_'); clearInterval(this.pt);
    box.innerHTML = `<div class="tkp-top"><button data-b><i class="fa-solid fa-chevron-left"></i></button><b>${esc(name)}<span id="tkp-vf"></span></b><span></span></div><div class="tkp-ms" id="tkp-ms"></div><div class="tkp-in"><input id="tkp-i" maxlength="500" placeholder="Kirim pesan…"/><button id="tkp-s"><i class="fa-solid fa-paper-plane"></i></button></div>`;
    this.isVf(peer, userKey(name)).then(v => { const e = box.querySelector('#tkp-vf'); if (v && e) e.innerHTML = VF_SVG; });
    this.db('tok/inbox/' + me + '/' + peer + '/unread', null, 'PUT', 0).catch(() => {});
    const ms = box.querySelector('#tkp-ms'); let last = '';
    const draw = async () => { try { const m = await this.db('tok/dm/' + cid, { orderBy: 'ts', limitToLast: 60 }) || {}, l = Object.values(m).sort((a, b) => a.ts - b.ts), h = l.map(x => `<div class="tkp-m ${x.uid === me ? 'me' : ''}">${esc(x.t)}<small>${this.fmt(x.ts)}</small></div>`).join('') || '<p class="tkp-mt">Mulai percakapan dengan ' + esc(name) + '</p>'; if (h !== last) { last = h; ms.innerHTML = h; ms.scrollTop = ms.scrollHeight; } } catch (e) {} };
    await draw(); this.pt = setInterval(draw, 2000);
    const inp = box.querySelector('#tkp-i'), send = async () => {
      const t = inp.value.trim(); if (!t) return; inp.value = ''; const ts = Date.now();
      try {
        await this.db('tok/dm/' + cid, null, 'POST', { uid: me, u: App.user.username, t, ts });
        let n = 0; try { n = Number(await this.db('tok/inbox/' + peer + '/' + me + '/unread')) || 0; } catch (e) {}
        await this.db('tok/inbox/' + me + '/' + peer, null, 'PUT', { u: name, last: t.slice(0, 60), ts, unread: 0 });
        await this.db('tok/inbox/' + peer + '/' + me, null, 'PUT', { u: App.user.username, last: t.slice(0, 60), ts, unread: n + 1 });
        draw();
      } catch (e) { UI.toast('Pesan gagal terkirim', 'err'); }
    };
    box.querySelector('#tkp-s').onclick = send; inp.onkeydown = e => { if (e.key === 'Enter') send(); };
    box.onclick = e => { if (e.target.closest('[data-b]')) { clearInterval(this.pt); this.inbox(box); } };
  },
  async unread() {
    if (!this.root) return; try { const ib = await this.db('tok/inbox/' + FB.st.uid) || {}, n = Object.values(ib).reduce((a, x) => a + (Number(x.unread) || 0), 0), b = this.root.querySelector('.tk-bd'); if (b) { b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hidden', !n); } } catch (e) {}
  },
  async profile(box, tabSel) {
    const me = FB.st.uid, u = App.user.username, tb = tabSel || 'g';
    const mine = this.vids.filter(v => v.uid === me), bm = LS.get('tk_bm', {}) || {}, saved = this.vids.filter(v => bm[v.id]), list = tb === 'g' ? mine : saved;
    box.innerHTML = `<div class="tkp-top"><button id="tkp-up"><i class="fa-solid fa-user-plus"></i></button><span></span><button id="tkp-lo" title="Keluar dari Dimzz Play"><i class="fa-solid fa-xmark"></i></button></div><div class="tkp-sc"><div class="tkp-pf"><div class="tkp-av xl ring"><span>${esc(u.charAt(0).toUpperCase())}</span><button class="tkp-ad" id="tkp-ad"><i class="fa-solid fa-plus"></i></button></div>
      <div class="tkp-nm"><b>${esc(u)}</b><span id="tkp-vf"></span><button class="tkp-ed" id="tkp-ed">Edit</button></div><small class="mut">@${esc(userKey(u))}</small>
      <div class="tkp-sts"><div><b id="tkp-a">…</b><small>Mengikuti</small></div><div><b id="tkp-b">…</b><small>Pengikut</small></div><div><b id="tkp-c">…</b><small>Suka</small></div></div>
      <button class="tkp-bio" id="tkp-bio">+ Tambahkan bio</button></div>
      <div class="tkp-tabs"><button data-g="g" class="${tb === 'g' ? 'on' : ''}"><i class="fa-solid fa-table-cells"></i></button><button data-g="s" class="${tb === 's' ? 'on' : ''}"><i class="fa-regular fa-bookmark"></i></button></div>
      ${list.length ? `<div class="tkp-gr">${list.map(v => `<button data-v="${esc(v.id)}"><video muted preload="metadata" playsinline src="${esc(v.url)}#t=0.1"></video></button>`).join('')}</div>` : `<div class="tkp-em"><i class="fa-solid fa-film"></i><p>${tb === 'g' ? 'Unggah momenmu untuk mengosongkan penyimpanan' : 'Belum ada video tersimpan'}</p>${tb === 'g' ? '<button class="tkp-cta" id="tkp-try">Coba sekarang</button>' : ''}</div>`}</div>`;
    this.isVf(me, userKey(u)).then(v => { const e = box.querySelector('#tkp-vf'); if (v && e) e.innerHTML = VF_SVG; });
    const q = s => box.querySelector(s);
    box.onclick = e => {
      const g = e.target.closest('[data-g]'), v = e.target.closest('[data-v]');
      if (g) this.profile(box, g.dataset.g); else if (v) { this.showPage('home'); this.setTab('me', true); this.tab = tb === 'g' ? 'me' : 'fy'; this.renderFeed(); setTimeout(() => { const it = this.root && this.root.querySelector(`.tk-item[data-id="${v.dataset.v}"]`); if (it) it.scrollIntoView(); }, 60); }
    };
    q('#tkp-lo').onclick = () => Sheet.close('tok'); q('#tkp-up').onclick = () => { this.showPage('home'); this.upload(); };
    const t = q('#tkp-try'); if (t) t.onclick = () => { this.showPage('home'); this.upload(); };
    q('#tkp-ad').onclick = () => { this.showPage('home'); this.upload(); };
    const bioSet = async () => { const cur = (q('#tkp-bio').dataset.b || ''), t = prompt('Bio kamu:', cur); if (t === null) return; try { await this.db('tok/prof/' + me, null, 'PUT', { bio: t.trim().slice(0, 80) }); this.profile(box, tb); } catch (e) { UI.toast('Gagal menyimpan bio', 'err'); } };
    q('#tkp-ed').onclick = bioSet; q('#tkp-bio').onclick = bioSet;
    try {
      const [fo, fa, pf] = await Promise.all([this.db('tok/fol/' + me, { shallow: true }), this.db('tok/fans/' + me, { shallow: true }), this.db('tok/prof/' + me)]);
      q('#tkp-a').textContent = Object.keys(fo || {}).length; q('#tkp-b').textContent = Object.keys(fa || {}).length;
      if (pf && pf.bio) { const b = q('#tkp-bio'); b.textContent = pf.bio; b.dataset.b = pf.bio; b.classList.add('has'); }
      let tot = 0; await Promise.all(mine.map(v => this.db('tok/likes/' + v.id, { shallow: true }).then(k => { tot += Object.keys(k || {}).length; }).catch(() => {}))); q('#tkp-c').textContent = tot;
    } catch (e) {}
  }
});
(function () {
  const ob = Tok.bind, os = Tok.stopAll;
  Tok.bind = function () {
    ob.call(this); const r = this.root;
    r.querySelectorAll('.tk-nav [data-n]').forEach(b => b.onclick = () => {
      const n = b.dataset.n;
      if (n === 'inbox' || n === 'me') return this.showPage(n);
      if (n === 'live') { if (r.classList.contains('pg')) this.showPage('home'); return this.setTab('lv'); }
      if (r.classList.contains('pg')) { this.showPage('home'); this.setTab(this.tab === 'lv' ? 'lv' : 'fy', false); return; }
      if (this.tab === 'fy') return Sheet.close('tok'); this.setTab('fy');
    });
    this.ut = setInterval(() => this.unread(), 12000); this.unread();
  };
  Tok.stopAll = function () { clearInterval(this.pt); clearInterval(this.ut); os.call(this); };
})();
