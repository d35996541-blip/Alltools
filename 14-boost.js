/* ==== 14-boost.js — v3.16
   • Bingkai (border) + lencana untuk SETIAP pengguna yang login; bingkai emas animasi khusus Developer
   • Fitur khusus pengguna: Catatan, Timer Fokus, Kartu Profil
   • Fitur khusus Developer: tab "Chat" di Panel Dev (pin pesan, siaran, moderasi)
   ==== */
const Rank = {
  info(role) { return String(role).toLowerCase() === 'developer' ? { k: 'dev', label: 'Developer', icon: 'fa-crown' } : { k: 'user', label: String(role || 'Member'), icon: 'fa-gem' }; },
  badge(role, sm) { const i = this.info(role); return `<span class="rk-tag rk-${i.k}${sm ? ' sm' : ''}"><i class="fa-solid ${i.icon}"></i>${esc(sm && i.k === 'dev' ? 'DEV' : i.label)}</span>`; },
  frame(el, role) { if (!el) return; el.classList.remove('rk-dev', 'rk-user'); el.classList.add('rk-' + this.info(role).k); },
  apply() {
    const u = App.user; if (!u) return;
    this.frame($('u-avatar'), u.role);
    const r = $('u-role'); if (r) r.outerHTML = this.badge(u.role).replace('class="rk-tag', 'id="u-role" class="rk-tag');
  }
};
(() => {
  const e0 = App.enter;
  App.enter = async function (f) { const r = await e0.call(this, f); try { Rank.apply(); } catch (x) {} return r; };
  const m0 = App.openMenu;
  App.openMenu = function () {
    m0.call(this);
    setTimeout(() => { const s = document.getElementById('sheet-menu'); if (!s || !App.user) return; Rank.frame(s.querySelector('.avatar'), App.user.role); const t = s.querySelector('.tag'); if (t) t.outerHTML = Rank.badge(App.user.role); }, 40);
  };
})();

/* ---------- Catatan pribadi (tersimpan di perangkat, per akun) ---------- */
const Notes = {
  key: () => 'notes_' + userKey(App.user.username),
  get() { return LS.get(this.key(), []) || []; },
  put(a) { LS.set(this.key(), a.slice(0, 100)); },
  open() {
    Sheet.open({ id: 'notes', title: 'Catatan', icon: 'fa-note-sticky', grad: 'linear-gradient(135deg,#f59e0b,#ea580c)',
      body: `<div class="card" style="padding:12px;display:flex;flex-direction:column;gap:8px"><textarea id="nt-in" class="inp" rows="3" maxlength="2000" placeholder="Tulis catatan baru…" style="font-size:16px;resize:vertical"></textarea><button class="btn btn-pri" id="nt-add"><i class="fa-solid fa-plus"></i> Simpan catatan</button></div><input id="nt-q" type="text" class="inp" placeholder="Cari catatan…" style="font-size:16px"/><div id="nt-l" style="display:flex;flex-direction:column;gap:8px"></div>`,
      onOpen: el => {
        const draw = () => { const q = el.querySelector('#nt-q').value.trim().toLowerCase(), a = this.get().filter(n => !q || n.t.toLowerCase().includes(q));
          el.querySelector('#nt-l').innerHTML = a.length ? a.map(n => `<div class="card" style="padding:12px"><div class="selectable" style="font-size:13.5px;font-weight:500;line-height:1.5;white-space:pre-wrap;word-break:break-word">${esc(n.t)}</div><div class="row" style="justify-content:space-between;margin-top:8px"><small class="muted" style="font-weight:700">${new Date(n.ts).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small><span class="row"><button class="btn btn-sm" data-c="${n.ts}"><i class="fa-regular fa-copy"></i></button><button class="btn btn-sm btn-danger" data-d="${n.ts}"><i class="fa-solid fa-trash"></i></button></span></div></div>`).join('') : emptyHtml('fa-note-sticky', 'Belum ada catatan.');
          el.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { this.put(this.get().filter(n => String(n.ts) !== b.dataset.d)); draw(); });
          el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const n = this.get().find(n => String(n.ts) === b.dataset.c); if (n && navigator.clipboard) navigator.clipboard.writeText(n.t).then(() => UI.toast('Disalin', 'ok')).catch(() => {}); }); };
        el.querySelector('#nt-add').onclick = () => { const i = el.querySelector('#nt-in'), t = i.value.trim(); if (!t) return UI.toast('Tulis sesuatu dulu', 'warn'); const a = this.get(); a.unshift({ t, ts: Date.now() }); this.put(a); i.value = ''; draw(); UI.toast('Catatan disimpan', 'ok'); };
        el.querySelector('#nt-q').oninput = draw; draw();
      } });
  }
};
Features.reg({ id: 'notes', name: 'Catatan', cat: 'alat', icon: 'fa-note-sticky', grad: 'linear-gradient(135deg,#f59e0b,#ea580c)', open: () => Notes.open() });

/* ---------- Timer Fokus (Pomodoro) — tetap jalan walau panel ditutup ---------- */
const Focus = {
  end: 0, total: 0, left: 0, tm: null,
  beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); [0, .25, .5].forEach(t => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = 880; o.connect(g); g.connect(c.destination); g.gain.setValueAtTime(.2, c.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + t + .2); o.start(c.currentTime + t); o.stop(c.currentTime + t + .22); }); } catch (e) {} try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} },
  start(min) { this.total = min * 60; this.end = Date.now() + this.total * 1000; this.left = 0; clearInterval(this.tm); this.tm = setInterval(() => this.tick(), 500); this.tick(); },
  pause() { if (!this.end) return; this.left = Math.max(0, Math.round((this.end - Date.now()) / 1000)); this.end = 0; clearInterval(this.tm); this.paint(); },
  resume() { if (!this.left) return; this.end = Date.now() + this.left * 1000; this.left = 0; clearInterval(this.tm); this.tm = setInterval(() => this.tick(), 500); this.tick(); },
  reset() { clearInterval(this.tm); this.end = 0; this.left = 0; this.total = 0; this.paint(); },
  rem() { return this.end ? Math.max(0, Math.round((this.end - Date.now()) / 1000)) : this.left; },
  tick() { if (this.end && this.rem() <= 0) { clearInterval(this.tm); this.end = 0; this.left = 0; const k = 'focus_' + new Date().toISOString().slice(0, 10); LS.set(k, (LS.get(k, 0) || 0) + 1); this.beep(); UI.toast('Sesi fokus selesai. Istirahat sebentar!', 'ok', 6000); } this.paint(); },
  paint() {
    const t = document.getElementById('fc-t'); if (!t) return; const r = this.rem(), run = !!this.end;
    t.textContent = String(Math.floor(r / 60)).padStart(2, '0') + ':' + String(r % 60).padStart(2, '0');
    const p = document.getElementById('fc-p'); if (p) p.style.width = (this.total ? (100 - r / this.total * 100) : 0) + '%';
    const b = document.getElementById('fc-go'); if (b) b.innerHTML = run ? '<i class="fa-solid fa-pause"></i> Jeda' : (this.left ? '<i class="fa-solid fa-play"></i> Lanjut' : '<i class="fa-solid fa-play"></i> Mulai');
    const d = document.getElementById('fc-n'); if (d) d.textContent = (LS.get('focus_' + new Date().toISOString().slice(0, 10), 0) || 0) + ' sesi selesai hari ini';
  },
  open() {
    Sheet.open({ id: 'focus', title: 'Timer Fokus', icon: 'fa-hourglass-half', grad: 'linear-gradient(135deg,#10b981,#0d9488)',
      body: `<div class="card" style="padding:22px 16px;text-align:center"><div id="fc-t" style="font-size:64px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums">25:00</div><div style="height:8px;border-radius:99px;background:rgba(15,23,42,.1);margin:12px 0;overflow:hidden"><div id="fc-p" style="height:100%;width:0;background:linear-gradient(90deg,#10b981,#0d9488);transition:width .5s"></div></div><small id="fc-n" class="muted" style="font-weight:700"></small></div><div class="row" style="gap:8px">${[15, 25, 45, 60].map(m => `<button class="btn" style="flex:1" data-m="${m}">${m} mnt</button>`).join('')}</div><div class="row" style="gap:8px"><button class="btn btn-pri" id="fc-go" style="flex:2"></button><button class="btn" id="fc-rs" style="flex:1"><i class="fa-solid fa-rotate-left"></i> Atur ulang</button></div>`,
      onOpen: el => {
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { this.start(+b.dataset.m); });
        el.querySelector('#fc-go').onclick = () => { if (this.end) this.pause(); else if (this.left) this.resume(); else this.start(25); };
        el.querySelector('#fc-rs').onclick = () => this.reset();
        if (!this.end && !this.left) { const t = el.querySelector('#fc-t'); t.textContent = '25:00'; } this.paint();
        if (!this.end && !this.left) el.querySelector('#fc-t').textContent = '25:00';
      } });
  }
};
Features.reg({ id: 'focus', name: 'Timer Fokus', cat: 'alat', icon: 'fa-hourglass-half', grad: 'linear-gradient(135deg,#10b981,#0d9488)', open: () => Focus.open() });

/* ---------- Kartu Profil ---------- */
const Me = {
  open() {
    const u = App.user, usage = LS.get('usage', {}) || {}, top = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 5), total = Object.values(usage).reduce((a, b) => a + b, 0);
    const days = u.created ? Math.max(1, Math.round((Date.now() - u.created) / 864e5)) : 1, dev = App.isDev();
    Sheet.open({ id: 'me', title: 'Profil Saya', icon: 'fa-id-card', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
      body: `<div class="card me-card ${dev ? 'dev' : ''}"><div class="avatar rk-${dev ? 'dev' : 'user'}" style="width:76px;height:76px;font-size:30px;border-radius:24px;margin:0 auto 10px">${esc(u.username.charAt(0).toUpperCase())}</div><div style="font-size:19px;font-weight:800">${esc(u.username)}</div><div style="margin-top:6px">${Rank.badge(u.role)}</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"><div class="stat"><b>${days}</b><small>Hari bergabung</small></div><div class="stat"><b>${total}</b><small>Fitur dibuka</small></div><div class="stat"><b>${LS.get('focus_' + new Date().toISOString().slice(0, 10), 0) || 0}</b><small>Fokus hari ini</small></div></div>
      <div class="sec-title" style="color:var(--ink2)">Fitur favoritmu</div><div class="card" style="padding:6px 14px">${top.length ? top.map(([id, n]) => `<div class="kv"><span style="color:var(--ink)">${esc((Features.get(id) || { name: id }).name)}</span><b>${n}x</b></div>`).join('') : '<div class="muted" style="padding:10px;font-size:12px">Belum ada data.</div>'}</div>` });
  }
};
Features.reg({ id: 'me', name: 'Profil Saya', cat: 'alat', icon: 'fa-id-card', grad: 'linear-gradient(135deg,#6366f1,#8b5cf6)', open: () => Me.open() });

/* ---------- Khusus Developer: tab "Chat" di Panel Dev ---------- */
Dev.t_chat = async function (box) {
  const pin = await Cfg.get('chatpin').catch(() => null);
  box.innerHTML = `<div class="muted" style="font-size:12px;font-weight:600">Pin tampil di atas Chat Global untuk semua pengguna. Siaran dikirim sebagai pesan Developer.</div>
    <div class="card" style="padding:12px;display:flex;flex-direction:column;gap:8px"><b style="font-size:13px"><i class="fa-solid fa-thumbtack"></i> Pesan tersemat</b><textarea id="dc-t" class="inp" rows="3" maxlength="300" style="font-size:16px" placeholder="Contoh: Aturan chat — sopan ya!">${esc((pin && pin.text) || '')}</textarea><div class="row"><button class="btn btn-pri" id="dc-set" style="flex:1"><i class="fa-solid fa-thumbtack"></i> Pasang pin</button><button class="btn btn-danger" id="dc-clr"><i class="fa-solid fa-xmark"></i> Lepas</button></div><button class="btn" id="dc-bc"><i class="fa-solid fa-bullhorn"></i> Kirim sebagai siaran ke chat</button></div>
    <div class="sec-title" style="color:var(--ink2)">Moderasi pesan terakhir</div><div class="card" style="padding:6px 14px" id="dc-l">${loadingHtml()}</div>`;
  const read = () => $('dc-t').value.trim().slice(0, 300);
  $('dc-set').onclick = async () => { const t = read(); if (!t) return UI.toast('Isi pesan dulu', 'warn'); try { await Cfg.set('chatpin', { text: t, by: App.user.username, ts: Date.now() }); UI.toast('Pin dipasang', 'ok'); } catch (e) { UI.toast(Dev.warnRules(e), 'err'); } };
  $('dc-clr').onclick = async () => { try { await Cfg.set('chatpin', null); $('dc-t').value = ''; UI.toast('Pin dilepas', 'ok'); } catch (e) { UI.toast(Dev.warnRules(e), 'err'); } };
  $('dc-bc').onclick = async () => { const t = read(); if (!t) return UI.toast('Isi pesan dulu', 'warn'); try { await Chat.post({ t: '📢 ' + t.slice(0, 296) }, 0); UI.toast('Siaran terkirim', 'ok'); } catch (e) { UI.toast('Gagal mengirim', 'err'); } };
  const drawMsgs = async () => {
    try { await Chat.poll(); } catch (e) {}
    const l = Chat.msgs.slice(-30).reverse(), bx = $('dc-l'); if (!bx) return;
    bx.innerHTML = l.length ? l.map(m => `<div class="kv" style="align-items:center;gap:8px"><span style="color:var(--ink);min-width:0;text-align:left"><b>${esc(m.u)}</b><br><small class="muted" style="font-weight:600;word-break:break-word">${esc(m.t || (m.s ? 'stiker ' + m.s : 'foto'))}</small></span><span class="row" style="flex:none"><button class="btn btn-sm" data-x="${esc(m.id)}" data-im="${esc(m.im || '')}" title="Hapus pesan"><i class="fa-solid fa-trash"></i></button>${String(m.r).toLowerCase() === 'developer' ? '' : `<button class="btn btn-sm btn-danger" data-b="${esc(m.k || '')}" data-n="${esc(m.u)}" title="Ban pengguna"><i class="fa-solid fa-ban"></i></button>`}</span></div>`).join('') : '<div class="muted" style="padding:10px;font-size:12px">Belum ada pesan.</div>';
    bx.querySelectorAll('[data-x]').forEach(b => b.onclick = async () => { try { await FB.request('chat/global/' + b.dataset.x, null, 'DELETE'); if (b.dataset.im) FB.request('chatimg/' + b.dataset.im, null, 'DELETE').catch(() => {}); drawMsgs(); } catch (e) { UI.toast('Gagal menghapus', 'err'); } });
    bx.querySelectorAll('[data-b]').forEach(b => b.onclick = async () => { if (!b.dataset.b) return; if (!await UI.confirm('Ban ' + b.dataset.n + '?', 'Akun ini akan diblokir dan tidak bisa memakai web.', { ok: 'Ban', danger: true, icon: 'fa-ban' })) return; try { await Ban.set(b.dataset.b, { reason: 'Melanggar aturan chat', by: App.user.username, ts: Date.now() }); UI.toast('Pengguna diblokir', 'ok'); } catch (e) { UI.toast('Gagal memblokir', 'err'); } });
  };
  drawMsgs();
};
(() => {
  const d0 = Dev.open;
  Dev.open = function () {
    d0.call(this);
    setTimeout(() => { const t = document.getElementById('dv-tabs'); if (!t || t.querySelector('[data-k="chat"]')) return; const b = document.createElement('button'); b.className = 'chip'; b.dataset.k = 'chat'; b.textContent = 'Chat'; b.onclick = () => Dev.go('chat'); t.appendChild(b); }, 40);
  };
})();
