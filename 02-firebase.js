/* ==== 02-firebase.js — akun & database (Firebase REST) + cadangan lokal. Tanpa fitur ban/perangkat. ==== */
function sha256Hex(msg) {
  const rrot = (v, a) => (v >>> a) | (v << (32 - a));
  const bytes = new TextEncoder().encode(msg);
  const bitLen = bytes.length * 8;
  const withPad = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  withPad.set(bytes); withPad[bytes.length] = 0x80;
  const dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 8, Math.floor(bitLen / 4294967296)); dv.setUint32(withPad.length - 4, bitLen >>> 0);
  const K = [], H = [];
  const isPrime = n => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  for (let c = 2, n = 0; n < 64; c++) if (isPrime(c)) {
    if (n < 8) H[n] = (Math.pow(c, 1 / 2) * 4294967296) | 0;
    K[n++] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
  }
  const w = new Array(64);
  for (let i = 0; i < withPad.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
    for (let t = 16; t < 64; t++) {
      const s0 = rrot(w[t - 15], 7) ^ rrot(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rrot(w[t - 2], 17) ^ rrot(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[t] + w[t]) | 0;
      const S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22), maj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

const userKey = n => String(n || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
const NAME_RE = /^(?=.{3,20}$)[A-Za-z0-9]+(_[A-Za-z0-9]+)*$/;
const NAME_HELP = 'Username 3–20 karakter: huruf, angka, atau garis bawah (_) di tengah.';
const getSession = () => LS.get('session', {}) || {};

const FB = {
  st: { dbUrl: '', idToken: '', refresh: '', exp: 0, uid: '' },
  mode: 'local',
  cfg() { return CONFIG.FIREBASE || {}; },
  devKey() { return String(this.cfg().devUsername || 'dimzz').toLowerCase(); },
  email: key => `${key}@dimzz-users.example.com`,
  pw: (key, password) => sha256Hex(`dimzz|${key}|${password}`),
  clear() { this.st = { dbUrl: this.st.dbUrl, idToken: '', refresh: '', exp: 0, uid: '' }; },
  async resolveDb() {
    const c = this.cfg(), cands = [], saved = localStorage.getItem('dimzz_fb_dburl');
    if (c.databaseURL) cands.push(c.databaseURL); if (saved) cands.push(saved);
    const id = c.projectId + '-default-rtdb';
    cands.push(`https://${id}.firebaseio.com`, `https://${id}.asia-southeast1.firebasedatabase.app`, `https://${id}.europe-west1.firebasedatabase.app`);
    for (const u of [...new Set(cands.map(x => String(x).replace(/\/+$/, '')))]) {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 6000);
      try { const r = await fetch(u + '/.json?shallow=true', { signal: ctrl.signal }); if ([200, 401, 403].includes(r.status)) { localStorage.setItem('dimzz_fb_dburl', u); return u; } } catch (e) {} finally { clearTimeout(t); }
    }
    return '';
  },
  async init() { const u = await this.resolveDb(); if (u) { this.st.dbUrl = u; this.mode = 'firebase'; } return this.mode; },
  async identity(op, body) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${op}?key=${encodeURIComponent(this.cfg().apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const m = String((j.error && j.error.message) || 'HTTP ' + r.status); const e = new Error(m); e.code = m.split(' ')[0]; e.status = r.status; throw e; }
    return j;
  },
  setAuth(j) { this.st.idToken = j.idToken; this.st.refresh = j.refreshToken; this.st.exp = Date.now() + (Number(j.expiresIn) || 3600) * 1000; this.st.uid = j.localId; },
  persistRefresh() { const s = getSession(); if (s.username) { s.refresh = this.st.refresh; LS.set('session', s); } },
  async refreshToken() {
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(this.cfg().apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: this.st.refresh }).toString() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(String((j.error && j.error.message) || 'HTTP ' + r.status)); e.status = r.status; throw e; }
    this.st.idToken = j.id_token; this.st.refresh = j.refresh_token || this.st.refresh; this.st.exp = Date.now() + (Number(j.expires_in) || 3600) * 1000; this.st.uid = j.user_id || this.st.uid;
    this.persistRefresh();
  },
  async token(force) { if (!this.st.idToken) throw Object.assign(new Error('belum login'), { status: 401 }); if (force || Date.now() > this.st.exp - 60000) await this.refreshToken(); return this.st.idToken; },
  async request(path, q, method = 'GET', body, timeout = 12000) {
    for (let a = 0; a < 2; a++) {
      const tok = await this.token(a === 1);
      const qs = Object.entries(q || {}).map(([k, v]) => `${k}=${encodeURIComponent(JSON.stringify(v))}`);
      const url = `${this.st.dbUrl}/${path ? path + '.json' : '.json'}?auth=${encodeURIComponent(tok)}${qs.length ? '&' + qs.join('&') : ''}`;
      try { return await fetchJSON(url, body !== undefined ? { method, body: JSON.stringify(body) } : { method }, timeout); }
      catch (e) { if (e.status === 401 && a === 0) continue; if (e.status === 401) e.permission = true; throw e; }
    }
  },
  explain(e) {
    const map = { OPERATION_NOT_ALLOWED: 'Login Email/Password belum diaktifkan di Firebase Console → Authentication → Sign-in method.', CONFIGURATION_NOT_FOUND: 'Firebase Authentication belum diaktifkan.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.', API_KEY_INVALID: 'API key Firebase tidak valid.', USER_DISABLED: 'Akun ini dinonaktifkan.' };
    return Object.assign(new Error(e.message), { userMessage: map[e.code] || `Gagal (${e.code || 'jaringan'}). Periksa koneksi lalu coba lagi.` });
  },
  // mode: 'login' | 'register'
  async login(username, password, mode) {
    const key = userKey(username), email = this.email(key), pw = this.pw(key, password);
    let auth, created = false;
    if (mode === 'register') {
      try { auth = await this.identity('signUp', { email, password: pw, returnSecureToken: true }); created = true; }
      catch (e) { if (e.code === 'EMAIL_EXISTS') throw Object.assign(new Error('taken'), { userMessage: 'Username ini sudah dipakai. Coba username lain atau masuk.' }); throw this.explain(e); }
    } else {
      try { auth = await this.identity('signInWithPassword', { email, password: pw, returnSecureToken: true }); }
      catch (e) { if (['INVALID_PASSWORD', 'EMAIL_NOT_FOUND', 'INVALID_LOGIN_CREDENTIALS'].includes(e.code)) throw Object.assign(new Error('wrong'), { userMessage: 'Username atau kata sandi salah. Belum punya akun? Pilih tab Daftar.' }); throw this.explain(e); }
    }
    this.setAuth(auth);
    let prof = await this.request('users/' + this.st.uid).catch(e => { if (e.permission) throw Object.assign(new Error('rules'), { userMessage: 'Aturan database menolak akses. Publikasikan Rules Firebase (lihat PANDUAN.md).' }); throw e; });
    if (!prof) {
      prof = { u: username, k: key, role: key === this.devKey() ? 'Developer' : 'Gratis', created: Date.now() };
      try { await this.request('users/' + this.st.uid, null, 'PUT', prof); } catch (e) { throw Object.assign(new Error('profil'), { userMessage: 'Aturan database menolak pembuatan profil. Publikasikan Rules Firebase.' }); }
    }
    try { if ((await this.request('keys/' + key)) == null) await this.request('keys/' + key, null, 'PUT', this.st.uid); } catch (e) {}
    return { user: { username: prof.u, role: prof.role, created: prof.created }, created, session: { username: prof.u, role: prof.role, uid: this.st.uid, refresh: this.st.refresh } };
  },
  async restore(sess) {
    if (!sess.refresh) return null;
    this.st.refresh = sess.refresh; await this.refreshToken();
    const prof = await this.request('users/' + this.st.uid, null, 'GET', undefined, 10000);
    return prof ? { username: prof.u, role: prof.role, created: prof.created } : null;
  },
  async listUsers() {
    const all = (await this.request('users')) || {};
    return Object.entries(all).map(([uid, p]) => ({ uid, username: p.u, role: p.role, created: p.created || 0 })).sort((a, b) => (b.created || 0) - (a.created || 0));
  },
  async changePassword(newPw) {
    const key = userKey(App.user.username);
    try { this.setAuth(await this.identity('update', { idToken: await this.token(), password: this.pw(key, newPw), returnSecureToken: true })); this.persistRefresh(); } catch (e) { throw this.explain(e); }
  }
};

/* Konfigurasi global (pengumuman, pemeliharaan, saklar fitur) — Firebase kalau ada, kalau tidak lokal */
const Cfg = {
  async get(key) { if (FB.mode === 'firebase' && FB.st.idToken) { try { return await FB.request('config/' + key, null, 'GET', undefined, 8000); } catch (e) { return undefined; } } return LS.get('cfg_' + key, null); },
  async set(key, val) { if (FB.mode === 'firebase' && FB.st.idToken) { await FB.request('config/' + key, null, 'PUT', val === undefined ? null : val); return; } LS.set('cfg_' + key, val); }
};

/* Cadangan lokal bila Firebase tidak terjangkau (data hanya di perangkat ini) */
const LocalAuth = {
  users() { return LS.get('users', []); },
  login(username, password, mode) {
    const us = this.users(), key = userKey(username), h = sha256Hex(`local|${key}|${password}`), f = us.find(u => u.k === key);
    if (mode === 'register') { if (f) throw Object.assign(new Error('taken'), { userMessage: 'Username ini sudah dipakai.' }); const u = { u: username, k: key, h, role: key === FB.devKey() ? 'Developer' : 'Gratis', created: Date.now() }; us.push(u); LS.set('users', us); return { user: u, created: true, session: { username, role: u.role } }; }
    if (!f || f.h !== h) throw Object.assign(new Error('wrong'), { userMessage: 'Username atau kata sandi salah.' });
    return { user: f, created: false, session: { username: f.u, role: f.role } };
  }
};

/* Daftar akun yang diblokir Developer: bans/<username-huruf-kecil> = { reason, by, ts } */
const Ban = {
  on: () => FB.mode === 'firebase' && !!FB.st.idToken,
  async get(key) { if (this.on()) { try { return await FB.request('bans/' + key, null, 'GET', undefined, 8000); } catch (e) { return null; } } return (LS.get('bans', {}) || {})[key] || null; },
  async set(key, d) { if (this.on()) return FB.request('bans/' + key, null, 'PUT', d); const b = LS.get('bans', {}) || {}; b[key] = d; LS.set('bans', b); },
  async del(key) { if (this.on()) return FB.request('bans/' + key, null, 'DELETE'); const b = LS.get('bans', {}) || {}; delete b[key]; LS.set('bans', b); },
  async all() { if (this.on()) return (await FB.request('bans')) || {}; return LS.get('bans', {}) || {}; }
};
