/* ==== 01-core.js — utilitas, UI (toast/dialog/sheet), pengatur suara, klien API ==== */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => /^(https?:|data:image\/|blob:)/i.test(u || '') ? u : '#';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const fmtDur = s => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const fmtSize = b => !b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
const fmtNum = n => (n === null || n === undefined || n === '' || isNaN(Number(n))) ? '-' : Number(n).toLocaleString('id-ID');
const timeAgo = t => { const s = Math.max(0, ((Date.now() - (t || 0)) / 1000) | 0); if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' mnt lalu'; if (s < 86400) return Math.floor(s / 3600) + ' jam lalu'; return Math.floor(s / 86400) + ' hari lalu'; };
const loadingHtml = t => `<div class="empty"><i class="fa-solid fa-circle-notch spin"></i>${esc(t || 'Memuat…')}</div>`;
const emptyHtml = (ic, t) => `<div class="empty"><i class="fa-solid ${ic || 'fa-inbox'}"></i>${t}</div>`;
const errHtml = t => `<div class="empty" style="color:#b91c1c"><i class="fa-solid fa-triangle-exclamation"></i>${esc(t)}</div>`;

const LS = {
  get(k, d) { try { const v = localStorage.getItem('dz_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dz_' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('dz_' + k); } catch (e) {} }
};

/* ---------- log galat (dilihat Developer) ---------- */
const ErrLog = { list: [], push(m, src) { this.list.unshift({ t: Date.now(), m: String(m).slice(0, 300), src: src || '' }); if (this.list.length > 60) this.list.pop(); } };
window.addEventListener('error', e => ErrLog.push(e.message, (e.filename || '').split('/').pop() + ':' + e.lineno));
window.addEventListener('unhandledrejection', e => ErrLog.push((e.reason && e.reason.message) || e.reason, 'promise'));

/* ---------- jaringan ---------- */
async function fetchJSON(url, opts = {}, timeout = 12000) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    let j = null; try { j = await res.json(); } catch (e) {}
    if (!res.ok) { const e = new Error((j && (j.error || j.message)) || 'HTTP ' + res.status); e.status = res.status; e.body = j; throw e; }
    return j;
  } catch (e) { if (e.name === 'AbortError') { const x = new Error('Waktu habis, server lambat'); x.timeout = true; throw x; } throw e; }
  finally { clearTimeout(timer); }
}
const API = {
  base: () => String(CONFIG.API_BASE || '').replace(/\/+$/, ''),
  url(fn, params) { const qs = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, v); }); return `${this.base()}/api/${fn}${qs.toString() ? '?' + qs : ''}`; },
  abs(u) { return /^https?:/i.test(u) ? u : this.base() + u; },
  async get(fn, params, timeout = 30000) { const j = await fetchJSON(this.url(fn, params), {}, timeout); if (j && j.ok === false) { const e = new Error(j.error || 'Gagal'); e.detail = j.detail; throw e; } return j; },
  async post(fn, body, timeout = 45000) { const j = await fetchJSON(this.url(fn), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, timeout); if (j && j.ok === false) { const e = new Error(j.error || 'Gagal'); e.detail = j.detail; throw e; } return j; }
};

/* ---------- toast & dialog (pengganti alert/prompt bawaan browser) ---------- */
const UI = {
  toast(msg, type = 'info', ms = 3200) {
    const ic = { ok: 'fa-circle-check', err: 'fa-circle-xmark', warn: 'fa-triangle-exclamation', info: 'fa-circle-info' }[type] || 'fa-circle-info';
    const el = document.createElement('div'); el.className = 'toast ' + type;
    el.innerHTML = `<i class="fa-solid ${ic}"></i><div>${esc(msg)}</div>`;
    $('toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, ms);
  },
  _dlg(html) {
    return new Promise(res => {
      const old = $('dialog'); if (old) old.remove();
      const d = document.createElement('div'); d.id = 'dialog'; d.innerHTML = `<div class="dlg">${html}</div>`;
      document.body.appendChild(d);
      d._done = v => { d.remove(); res(v); };
      d.addEventListener('click', e => { if (e.target === d) d._done(d._cancelVal); });
    });
  },
  alert(title, msg, o = {}) {
    const t = o.type || 'info', c = { ok: ['#dcfce7', '#16a34a', 'fa-check'], err: ['#fee2e2', '#dc2626', 'fa-xmark'], warn: ['#fef3c7', '#d97706', 'fa-exclamation'], info: ['#e0e7ff', '#4f46e5', 'fa-info'] }[t];
    const p = this._dlg(`<div class="di" style="background:${c[0]};color:${c[1]}"><i class="fa-solid ${c[2]}"></i></div><h4>${esc(title)}</h4><p>${esc(msg || '')}</p><button class="btn btn-pri" style="width:100%" id="dlg-ok">${esc(o.ok || 'Mengerti')}</button>`);
    const d = $('dialog'); d._cancelVal = true; $('dlg-ok').onclick = () => d._done(true); return p;
  },
  confirm(title, msg, o = {}) {
    const p = this._dlg(`<div class="di" style="background:${o.danger ? '#fee2e2' : '#e0e7ff'};color:${o.danger ? '#dc2626' : '#4f46e5'}"><i class="fa-solid ${o.icon || 'fa-question'}"></i></div><h4>${esc(title)}</h4><p>${esc(msg || '')}</p><div class="row"><button class="btn" style="flex:1" id="dlg-no">${esc(o.cancel || 'Batal')}</button><button class="btn ${o.danger ? 'btn-danger' : 'btn-pri'}" style="flex:1" id="dlg-ok">${esc(o.ok || 'Ya')}</button></div>`);
    const d = $('dialog'); d._cancelVal = false; $('dlg-no').onclick = () => d._done(false); $('dlg-ok').onclick = () => d._done(true); return p;
  },
  prompt(title, msg, o = {}) {
    const p = this._dlg(`<h4>${esc(title)}</h4><p>${esc(msg || '')}</p><input id="dlg-in" class="inp" type="${o.type || 'text'}" placeholder="${esc(o.placeholder || '')}" value="${esc(o.value || '')}" style="margin-bottom:14px"/><div class="row"><button class="btn" style="flex:1" id="dlg-no">Batal</button><button class="btn btn-pri" style="flex:1" id="dlg-ok">${esc(o.ok || 'Simpan')}</button></div>`);
    const d = $('dialog'); d._cancelVal = null; const i = $('dlg-in'); setTimeout(() => i.focus(), 60);
    $('dlg-no').onclick = () => d._done(null); $('dlg-ok').onclick = () => d._done(i.value);
    i.addEventListener('keydown', e => { if (e.key === 'Enter') d._done(i.value); }); return p;
  }
};

/* ---------- sheet (halaman fitur) dengan dukungan tombol Back ---------- */
const Sheet = {
  stack: [],
  open(o) {
    const exist = this.stack.find(s => s.id === o.id); if (exist) { exist.el.remove(); this.stack = this.stack.filter(s => s !== exist); }
    const el = document.createElement('div'); el.className = 'sheet' + (o.full ? ' full' : ''); el.id = 'sheet-' + o.id;
    el.innerHTML = `<div class="panel ${o.cls || ''}"><div class="sheet-head">${(typeof Ico !== 'undefined' && Ico.has(o.id)) ? `<div class="gi gi2" style="--c:${Ico.hex(o.grad)}">${Ico.svg(o.id, 20)}</div>` : `<div class="gi" style="background:${o.grad || 'var(--ink)'}"><i class="fa-solid ${o.icon || 'fa-star'}"></i></div>`}<h3>${esc(o.title)}</h3>${o.head || ''}<button class="btn btn-icon btn-ghost" data-close aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button></div><div class="sheet-body ${o.bodyCls || 'custom-scrollbar'}" id="sb-${o.id}">${o.body || ''}</div>${o.foot || ''}</div>`;
    el.addEventListener('mousedown', e => { if (e.target === el) this.close(o.id); });
    el.querySelector('[data-close]').onclick = () => this.close(o.id);
    document.body.appendChild(el);
    const item = { id: o.id, el, onClose: o.onClose };
    this.stack.push(item);
    history.pushState({ sheet: o.id }, '');
    if (o.onOpen) setTimeout(() => { try { o.onOpen(el); } catch (e) { ErrLog.push(e.message, o.id); console.error(e); } }, 0);
    return el;
  },
  close(id, fromPop) {
    const it = id ? this.stack.find(s => s.id === id) : this.stack[this.stack.length - 1];
    if (!it) return;
    this.stack = this.stack.filter(s => s !== it);
    try { it.onClose && it.onClose(); } catch (e) {}
    it.el.remove();
    if (!fromPop && history.state && history.state.sheet) { this.skip = (this.skip || 0) + 1; history.back(); }
  },
  $(id) { return $('sb-' + id); },
  isOpen(id) { return this.stack.some(s => s.id === id); }
};
window.addEventListener('popstate', () => { if (Sheet.skip > 0) { Sheet.skip--; return; } if (Sheet.stack.length) Sheet.close(null, true); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && Sheet.stack.length && !$('dialog')) Sheet.close(); });

/* ---------- pengatur suara: satu sumber aktif; musik latar mengalah ---------- */
const Sound = {
  pausers: {}, active: new Set(),
  reg(name, pause) { this.pausers[name] = pause; },
  play(name) {
    Object.entries(this.pausers).forEach(([n, p]) => { if (n !== name) { try { p(); } catch (e) {} this.active.delete(n); } });
    this.active.add(name);
  },
  release(name) { this.active.delete(name); setTimeout(() => { if (!this.active.size) Bgm.resumeIfWanted(); }, 400); }
};
// video/audio apa pun yang dinyalakan pengguna (kecuali milik sistem) menghentikan sumber lain
document.addEventListener('play', e => {
  const t = e.target; if (!t || !/^(VIDEO|AUDIO)$/.test(t.tagName) || t.muted) return;
  if (['a-bgm', 'a-music', 'a-adzan', 'auth-video', 'intro-video'].includes(t.id)) return;
  Sound.play('media'); t.addEventListener('ended', () => Sound.release('media'), { once: true }); t.addEventListener('pause', () => Sound.release('media'), { once: true });
}, true);

/* ---------- simpan berkas (web / APK) ---------- */
async function saveFile(url, filename, btn) {
  const old = btn && btn.innerHTML; const set = h => { if (btn) btn.innerHTML = h; };
  const done = () => { set('<i class="fa-solid fa-check"></i> Selesai'); setTimeout(() => { if (btn) { btn.innerHTML = old; btn.disabled = false; } }, 2500); };
  if (btn) btn.disabled = true; set('<i class="fa-solid fa-circle-notch spin"></i> Mengunduh…');
  const abs = API.abs(url);
  try {
    const Cap = window.Capacitor;
    if (Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.Plugins && Cap.Plugins.Filesystem) {
      const r = await fetch(abs); const blob = await r.blob();
      const b64 = await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1]); f.onerror = rej; f.readAsDataURL(blob); });
      await Cap.Plugins.Filesystem.writeFile({ path: 'Download/' + filename, data: b64, directory: 'EXTERNAL_STORAGE', recursive: true }).catch(() => Cap.Plugins.Filesystem.writeFile({ path: filename, data: b64, directory: 'DOCUMENTS', recursive: true }));
      UI.toast('Tersimpan: ' + filename, 'ok'); return done();
    }
    // jalur umum: server mengirim Content-Disposition: attachment -> browser mengunduh langsung dengan progres
    const a = document.createElement('a');
    const u = new URL(abs, location.href);
    if (u.searchParams.has('s')) u.searchParams.set('name', filename);
    a.href = u.toString(); a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    UI.toast('Unduhan dimulai — cek notifikasi / folder Unduhan', 'ok'); done();
  } catch (e) { window.open(abs, '_blank'); done(); }
}
const safeName = s => String(s || 'file').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'file';
async function copyText(t) { try { await navigator.clipboard.writeText(t); UI.toast('Disalin', 'ok'); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); UI.toast('Disalin', 'ok'); } catch (x) { UI.toast('Gagal menyalin', 'err'); } ta.remove(); } }

/* ---------- komponen kecil yang dipakai banyak fitur ---------- */
const searchBar = (id, ph, btnLabel = 'Cari') => `<div class="row"><input id="${id}" class="inp" type="text" placeholder="${esc(ph)}" enterkeyhint="search" autocomplete="off" /><button class="btn btn-pri" id="${id}-btn" style="flex:none">${btnLabel}</button></div>`;
const bindSearch = (id, fn) => { const i = $(id), b = $(id + '-btn'); if (!i) return; b.onclick = fn; i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fn(); } }); };
const kv = (k, v) => `<div class="kv"><span>${esc(k)}</span><span>${v}</span></div>`;
const seg = (id, items, cur) => `<div class="seg" id="${id}">${items.map(([k, l]) => `<button data-k="${k}" class="${k === cur ? 'on' : ''}">${l}</button>`).join('')}</div>`;
function bindSeg(id, fn) { const s = $(id); if (!s) return; s.querySelectorAll('button').forEach(b => b.onclick = () => { s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.k); }); }
function mediaBtns(files, baseName) {
  return files.map((f, i) => `<button class="btn ${f.kind === 'audio' ? 'btn-pri' : f.kind === 'image' ? '' : 'btn-dark'} btn-sm" data-i="${i}"><i class="fa-solid ${f.kind === 'audio' ? 'fa-music' : f.kind === 'image' ? 'fa-image' : 'fa-video'}"></i> ${esc(f.label)}${f.size ? ' · ' + fmtSize(f.size) : ''}</button>`).join('');
}
function bindMedia(root, files, baseName) { root.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => { const f = files[+b.dataset.i]; saveFile(f.url, safeName(baseName) + (f.label && !/^Video$|^MP3$/.test(f.label) ? ' [' + f.label + ']' : '') + '.' + f.ext, b); }); }
