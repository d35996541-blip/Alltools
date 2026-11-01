/* ---------- Mesin catur: aturan lengkap (rokade, en passant, promosi, skakmat, remis) + bot ---------- */
const CE = (() => {
  const OFF = { n: [-33, -31, -18, -14, 14, 18, 31, 33], b: [-17, -15, 15, 17], r: [-16, -1, 1, 16], k: [-17, -16, -15, -1, 1, 15, 16, 17] };
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const col = p => p === p.toUpperCase() ? 'w' : 'b';
  const sqn = s => 'abcdefgh'[s & 15] + (8 - (s >> 4));
  const sqi = n => (8 - +n[1]) * 16 + 'abcdefgh'.indexOf(n[0]);
  function fromFen(fen) {
    const [pl, t, ca, ep, hm, fn] = fen.split(' '), b = new Array(128).fill(''), k = { w: -1, b: -1 }; let r = 0, f = 0;
    for (const c of pl) { if (c === '/') { r++; f = 0; } else if (/\d/.test(c)) f += +c; else { b[r * 16 + f] = c; if (c === 'K') k.w = r * 16 + f; if (c === 'k') k.b = r * 16 + f; f++; } }
    return { b, t, ca: ca === '-' ? '' : ca, ep: ep === '-' ? -1 : sqi(ep), hm: +hm || 0, fn: +fn || 1, k };
  }
  const start = () => fromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  function attacked(b, sq, by) {
    const P = by === 'w' ? 'P' : 'p', pd = by === 'w' ? [15, 17] : [-15, -17];
    for (const d of pd) { const s = sq + d; if (!(s & 0x88) && b[s] === P) return true; }
    const N = by === 'w' ? 'N' : 'n', K = by === 'w' ? 'K' : 'k';
    for (const d of OFF.n) { const s = sq + d; if (!(s & 0x88) && b[s] === N) return true; }
    for (const d of OFF.k) { const s = sq + d; if (!(s & 0x88) && b[s] === K) return true; }
    const B = by === 'w' ? 'B' : 'b', R = by === 'w' ? 'R' : 'r', Q = by === 'w' ? 'Q' : 'q';
    for (const d of OFF.b) { let s = sq + d; while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === B || p === Q) return true; break; } s += d; } }
    for (const d of OFF.r) { let s = sq + d; while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === R || p === Q) return true; break; } s += d; } }
    return false;
  }
  const inCheck = (s, c = s.t) => attacked(s.b, s.k[c], c === 'w' ? 'b' : 'w');
  function pseudo(s, caps) {
    const out = [], b = s.b, us = s.t, them = us === 'w' ? 'b' : 'w';
    for (let sq = 0; sq < 120; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq]; if (!p || col(p) !== us) continue; const ty = p.toLowerCase();
      if (ty === 'p') {
        const dir = us === 'w' ? -16 : 16, sr = us === 'w' ? 6 : 1, pr = us === 'w' ? 0 : 7, one = sq + dir;
        const add = (t, extra) => { if ((t >> 4) === pr) for (const q of 'qrbn') out.push({ f: sq, t, p: q, ...extra }); else out.push({ f: sq, t, ...extra }); };
        if (!caps && !(one & 0x88) && !b[one]) { add(one); if ((sq >> 4) === sr && !b[one + dir]) out.push({ f: sq, t: one + dir, dp: 1 }); }
        for (const d of [dir - 1, dir + 1]) { const t = sq + d; if (t & 0x88) continue; if (b[t] && col(b[t]) === them) add(t, { c: 1 }); else if (t === s.ep) out.push({ f: sq, t, ep: 1, c: 1 }); }
      } else if (ty === 'n' || ty === 'k') {
        for (const d of OFF[ty]) { const t = sq + d; if (t & 0x88) continue; if (!b[t]) { if (!caps) out.push({ f: sq, t }); } else if (col(b[t]) === them) out.push({ f: sq, t, c: 1 }); }
        if (ty === 'k' && !caps) {
          const home = us === 'w' ? 116 : 4, K = us === 'w' ? 'K' : 'k', Q = us === 'w' ? 'Q' : 'q';
          if (sq === home && !attacked(b, sq, them)) {
            if (s.ca.includes(K) && !b[sq + 1] && !b[sq + 2] && !attacked(b, sq + 1, them) && !attacked(b, sq + 2, them)) out.push({ f: sq, t: sq + 2, cs: 'K' });
            if (s.ca.includes(Q) && !b[sq - 1] && !b[sq - 2] && !b[sq - 3] && !attacked(b, sq - 1, them) && !attacked(b, sq - 2, them)) out.push({ f: sq, t: sq - 2, cs: 'Q' });
          }
        }
      } else {
        for (const d of (ty === 'b' ? OFF.b : ty === 'r' ? OFF.r : OFF.k)) { let t = sq + d; while (!(t & 0x88)) { if (!b[t]) { if (!caps) out.push({ f: sq, t }); } else { if (col(b[t]) === them) out.push({ f: sq, t, c: 1 }); break; } t += d; } }
      }
    }
    return out;
  }
  function apply(s, m) {
    const b = s.b.slice(), us = s.t, p = b[m.f], k = { w: s.k.w, b: s.k.b }; let ca = s.ca, ep = -1, hm = s.hm + 1;
    const captured = m.ep ? b[m.t + (us === 'w' ? 16 : -16)] : b[m.t];
    if (m.ep) b[m.t + (us === 'w' ? 16 : -16)] = '';
    b[m.t] = m.p ? (us === 'w' ? m.p.toUpperCase() : m.p) : p; b[m.f] = '';
    if (p.toLowerCase() === 'p' || captured) hm = 0;
    if (m.dp) ep = (m.f + m.t) / 2;
    if (p === 'K') { k.w = m.t; ca = ca.replace(/[KQ]/g, ''); } else if (p === 'k') { k.b = m.t; ca = ca.replace(/[kq]/g, ''); }
    if (m.cs) { const home = m.f; if (m.cs === 'K') { b[home + 1] = b[home + 3]; b[home + 3] = ''; } else { b[home - 1] = b[home - 4]; b[home - 4] = ''; } }
    for (const [sq, ch] of [[112, 'Q'], [119, 'K'], [0, 'q'], [7, 'k']]) if (m.f === sq || m.t === sq) ca = ca.replace(ch, '');
    return { b, t: us === 'w' ? 'b' : 'w', ca, ep, hm, fn: s.fn + (us === 'b' ? 1 : 0), k };
  }
  function legal(s, caps) { const us = s.t; return pseudo(s, caps).filter(m => !inCheck(apply(s, m), us)); }
  const uci = m => sqn(m.f) + sqn(m.t) + (m.p || '');
  const parse = (s, u) => legal(s).find(m => uci(m) === u) || null;
  const key = s => s.b.join('') + s.t + s.ca + (s.ep > -1 ? s.ep : '');
  function insufficient(s) {
    const ps = []; for (let i = 0; i < 120; i++) { if (i & 0x88) { i += 7; continue; } const p = s.b[i]; if (p && p.toLowerCase() !== 'k') ps.push(p.toLowerCase()); }
    return !ps.length || (ps.length === 1 && (ps[0] === 'n' || ps[0] === 'b'));
  }
  /* kembalikan {over, r:'w'|'b'|'d', why} atau null */
  function status(s, hist) {
    const mv = legal(s);
    if (!mv.length) return inCheck(s) ? { r: s.t === 'w' ? 'b' : 'w', why: 'mate' } : { r: 'd', why: 'stalemate' };
    if (insufficient(s)) return { r: 'd', why: 'material' };
    if (s.hm >= 100) return { r: 'd', why: 'fifty' };
    if (hist) { const k = key(s); let n = 0; for (const h of hist) if (h === k) n++; if (n >= 3) return { r: 'd', why: 'repeat' }; }
    return null;
  }
  function san(s, m, lg) {
    const p = s.b[m.f], ty = p.toLowerCase(); let core;
    if (m.cs) core = m.cs === 'K' ? 'O-O' : 'O-O-O';
    else if (ty === 'p') core = (m.c ? 'abcdefgh'[m.f & 15] + 'x' : '') + sqn(m.t) + (m.p ? '=' + m.p.toUpperCase() : '');
    else {
      const o = (lg || legal(s)).filter(x => x.f !== m.f && x.t === m.t && s.b[x.f] === p); let d = '';
      if (o.length) { const sf = o.some(x => (x.f & 15) === (m.f & 15)), sr = o.some(x => (x.f >> 4) === (m.f >> 4)); d = !sf ? 'abcdefgh'[m.f & 15] : !sr ? String(8 - (m.f >> 4)) : sqn(m.f); }
      core = ty.toUpperCase() + d + (m.c ? 'x' : '') + sqn(m.t);
    }
    const n = apply(s, m); if (inCheck(n)) core += legal(n).length ? '+' : '#'; return core;
  }
  /* ----- bot ----- */
  const PST = (ty, sq) => { const f = sq & 15, r = sq >> 4, cf = 3.5 - Math.abs(f - 3.5), cr = 3.5 - Math.abs(r - 3.5); return ty === 'n' || ty === 'b' ? (cf + cr) * 6 : ty === 'q' ? (cf + cr) * 2 : ty === 'p' ? (cf + cr) * 3 : 0; };
  function evalS(s) {
    let v = 0; for (let i = 0; i < 120; i++) { if (i & 0x88) { i += 7; continue; } const p = s.b[i]; if (!p) continue; const ty = p.toLowerCase(), w = col(p) === 'w'; let x = VAL[ty] + PST(ty, i); if (ty === 'p') x += ((w ? 6 - (i >> 4) : (i >> 4) - 1) * 6); v += w ? x : -x; }
    return s.t === 'w' ? v : -v;
  }
  function nega(s, d, a, b, ply) {
    const mv = legal(s); if (!mv.length) return inCheck(s) ? -99000 + ply : 0; if (d === 0) return evalS(s);
    mv.sort((x, y) => ((y.c ? VAL[(s.b[y.t] || 'p').toLowerCase()] : 0) + (y.p ? 800 : 0)) - ((x.c ? VAL[(s.b[x.t] || 'p').toLowerCase()] : 0) + (x.p ? 800 : 0)));
    let best = -Infinity; for (const m of mv) { const v = -nega(apply(s, m), d - 1, -b, -a, ply + 1); if (v > best) best = v; if (v > a) a = v; if (a >= b) break; } return best;
  }
  function bot(s, level) {
    const mv = legal(s); if (!mv.length) return null; if (level <= 0) return mv[Math.floor(Math.random() * mv.length)];
    let best = null, bv = -Infinity; const d = level >= 2 ? 3 : 2;
    mv.sort(() => Math.random() - .5);
    for (const m of mv) { let v = -nega(apply(s, m), d - 1, -Infinity, Infinity, 1); if (level === 1) v += Math.random() * 60; if (v > bv) { bv = v; best = m; } }
    return best;
  }
  return { fromFen, start, legal, apply, uci, parse, status, san, key, inCheck, sqn, sqi, bot, col, VAL };
})();

/* ---------- Catur online: data, ulang-mainkan, hakim ---------- */
const GL = { K: '\u265A', Q: '\u265B', R: '\u265C', B: '\u265D', N: '\u265E', P: '\u265F' };
const CH_TC = [['300_0', '5 menit'], ['180_2', '3 + 2'], ['600_0', '10 menit']];
const tcOf = k => { const [b, i] = String(k || '300_0').split('_').map(Number); return { base: (b || 300) * 1000, inc: (i || 0) * 1000 }; };
const tcName = k => (CH_TC.find(x => x[0] === k) || [0, '5 menit'])[1];
const arrOf = o => !o ? [] : Array.isArray(o) ? o : Object.keys(o).sort((a, b) => a - b).map(k => o[k]);
/* Semua pihak menghitung hasil dari data yang sama (langkah + waktu server), jadi hasilnya tidak bisa dipalsukan satu pihak */
function chReplay(g, nowMs, withSan) {
  const meta = g.meta, tc = tcOf(meta.tc), mw = arrOf(g.mw), mb = arrOf(g.mb), rdy = g.rdy || {}, wr = meta.w.uid, br = meta.b.uid;
  const st0 = rdy[wr] && rdy[br] ? Math.max(rdy[wr], rdy[br]) : null;
  let s = CE.start(); const hist = [CE.key(s)], ts = [], mv = [], used = { w: 0, b: 0 }, cnt = { w: 0, b: 0 }; let over = null;
  for (let k = 0; ; k++) {
    const side = k % 2 ? 'b' : 'w', e = (side === 'w' ? mw : mb)[k >> 1]; if (!e || !e.m) break;
    const lg = CE.legal(s), m = lg.find(x => CE.uci(x) === e.m); if (!m) break;
    if (st0 != null) { used[side] += Math.max(0, e.t - (k ? ts[k - 1] : st0)); if (tc.base + tc.inc * cnt[side] - used[side] <= 0) { over = { r: side === 'w' ? 'b' : 'w', why: 'time' }; break; } }
    cnt[side]++; mv.push({ f: m.f, t: m.t, u: e.m, san: withSan ? CE.san(s, m, lg) : '' }); ts.push(e.t); s = CE.apply(s, m); hist.push(CE.key(s));
    const stt = CE.status(s, hist); if (stt) { over = stt; break; }
  }
  const turn = s.t, last = ts.length ? ts[ts.length - 1] : st0;
  const left = side => tc.base + tc.inc * cnt[side] - used[side] - (!over && st0 != null && nowMs && side === turn ? nowMs - last : 0);
  if (!over && st0 != null && nowMs && left(turn) <= 0) over = { r: turn === 'w' ? 'b' : 'w', why: 'time' };
  const r = g.res;
  if (!over && r && r.by) {
    const bc = r.by === wr ? 'w' : r.by === br ? 'b' : null;
    if (bc && r.why === 'resign' && r.r === (bc === 'w' ? 'b' : 'w')) over = { r: r.r, why: 'resign' };
    else if (bc && r.why === 'agree' && r.r === 'd' && g.dr && g.dr.by && g.dr.by !== bc) over = { r: 'd', why: 'agree' };
    else if (bc && r.why === 'abandon' && r.r === bc && !mv.length) over = { r: r.r, why: 'abandon' };
  }
  return { s, hist, ts, mv, st0, left, over, tc, turn };
}
const CH_WHY = { mate: 'Skakmat', stalemate: 'Pat (seri)', material: 'Bidak tidak cukup untuk skakmat', fifty: 'Aturan 50 langkah', repeat: 'Posisi berulang tiga kali', time: 'Waktu habis', resign: 'Menyerah', agree: 'Seri disepakati', abandon: 'Lawan tidak hadir' };
const mmss = ms => { ms = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(ms / 60) + ':' + String(ms % 60).padStart(2, '0'); };
const pow2 = n => { let p = 2; while (p < n) p *= 2; return p; };

/* ---------- Catur: controller, lobi, papan ---------- */
const Chess = {
  T: [], G: null, off: 0, root: null, tc: '300_0', rating: 1000, qk: null,
  on() { return FB.mode === 'firebase' && !!FB.st.idToken; },
  q(p, qq, m, b, t) { return FB.request(p, qq, m || 'GET', b, t); },
  /* Ambil data terbaru. Pakai indeks bila ada; kalau indeks belum terpasang, urutkan lewat $key (id memuat waktu) agar tidak gagal. */
  async recent(path, idx, n) {
    try { return await this.q(path, { orderBy: idx, limitToLast: n }); }
    catch (e) { if (e.status === 401 || e.status === 403) throw e; return this.q(path, { orderBy: '$key', limitToLast: n }); }
  },
  now() { return Date.now() + this.off; },
  uid() { return FB.st.uid; }, name() { return App.user.username; },
  timer(fn, ms) { const t = setInterval(fn, ms); this.T.push(t); return t; },
  stopT() { this.T.forEach(clearInterval); this.T = []; if (this.qk) { this.q(this.qk, null, 'DELETE').catch(() => {}); this.qk = null; } },
  err(e) { UI.toast(e && (e.permission || e.status === 401) ? 'Aturan Firebase belum diperbarui (lihat panduan)' : 'Koneksi bermasalah, coba lagi', 'warn'); },
  open() {
    Sheet.open({ id: 'catur', title: 'Catur', icon: 'fa-chess-knight', grad: 'linear-gradient(135deg,#e2512f,#9c2f17)', cls: 'ch-panel', bodyCls: 'ch-body', full: true, body: '<div id="ch-root"></div>',
      onClose: () => { this.stopT(); this.G = null; }, onOpen: () => { this.root = $('ch-root'); this.boot(); } });
  },
  async boot() {
    this.rulesErr = false;
    if (this.on()) { try { const t = await this.q('chess/off/' + this.uid(), null, 'PUT', { '.sv': 'timestamp' }); if (typeof t === 'number') this.off = t - Date.now(); } catch (e) { this.rulesErr = true; } }
    this.lobby();
  },
  modal(html, bind) {
    const r = this.root; r.querySelectorAll('.ch-ov').forEach(x => x.remove()); const el = document.createElement('div'); el.className = 'ch-ov'; el.innerHTML = `<div class="ch-card">${html}</div>`; r.appendChild(el);
    const close = () => el.remove(); bind && bind(el, close); return el;
  },
  chips(sel) { return `<div class="ch-chips" id="ch-tc">${CH_TC.map(([k, l]) => `<button data-k="${k}" class="${k === this.tc ? 'on' : ''}">${l}</button>`).join('')}</div>`; },
  bindChips(root) { root.querySelectorAll('#ch-tc button').forEach(b => b.onclick = () => { this.tc = b.dataset.k; root.querySelectorAll('#ch-tc button').forEach(x => x.classList.toggle('on', x === b)); }); },
  /* ===== lobi ===== */
  lobby() {
    this.stopT(); this.G = null; const r = this.root, me = this.name(), on = this.on();
    r.innerHTML = `<div class="ch-lob"><div class="ch-hero"><div class="ch-av">${esc(me.charAt(0).toUpperCase())}</div><div class="ch-hi"><b>${esc(me)}</b><small id="ch-rt">Memuat peringkat…</small></div><div class="ch-sc" id="ch-sc"></div></div>
      ${!on ? '<div class="ch-warn">Mode online butuh akun yang terhubung ke Firebase. Kamu tetap bisa berlatih melawan bot.</div>' : this.rulesErr ? '<div class="ch-warn">Fitur online belum aktif: tempel Rules Firebase terbaru (berkas firebase-rules.json), lalu buka ulang Catur.</div>' : ''}
      <div class="ch-rank" aria-hidden="true">${['♜','♞','♝','♛','♚','♝','♞','♜'].map(c => `<i>${c}</i>`).join('')}</div><div id="ch-resume"></div>
      <h4 class="ch-h">Main cepat</h4>${this.chips()}
      <button class="ch-cta" id="ch-find" ${on ? '' : 'disabled'}><i class="fa-solid fa-bolt"></i> Cari lawan</button>
      <div class="ch-grid"><button data-g="friend" ${on ? '' : 'disabled'}><i class="fa-solid fa-user-group"></i><b>Dengan teman</b><small>Kode kamar atau tantang username</small></button>
        <button data-g="tour" ${on ? '' : 'disabled'}><i class="fa-solid fa-trophy"></i><b>Turnamen</b><small>Sistem gugur, juara di akhir</small></button>
        <button data-g="bot"><i class="fa-solid fa-robot"></i><b>Lawan bot</b><small>Latihan, tanpa jaringan</small></button>
        <button data-g="rank" ${on ? '' : 'disabled'}><i class="fa-solid fa-ranking-star"></i><b>Peringkat</b><small>20 pemain teratas</small></button></div></div>`;
    this.bindChips(r); $('ch-find').onclick = () => this.find();
    r.querySelectorAll('[data-g]').forEach(b => b.onclick = () => ({ friend: () => this.friend(), tour: () => this.tours(), bot: () => this.botSetup(), rank: () => this.rank() })[b.dataset.g]());
    if (!on) { $('ch-rt').textContent = 'Mode latihan'; return; }
    this.q('chess/st/' + this.uid()).then(st => { st = st || {}; this.rating = st.r || 1000; const a = $('ch-rt'); if (a) { a.textContent = 'Peringkat ' + this.rating; $('ch-sc').innerHTML = `<span class="w">${st.w || 0}M</span><span class="d">${st.d || 0}S</span><span class="l">${st.l || 0}K</span>`; } }).catch(() => { const a = $('ch-rt'); if (a) a.textContent = 'Peringkat 1000'; });
    this.timer(() => this.lobbyTick(), 3000); this.lobbyTick();
  },
  async lobbyTick() {
    if (this.G || this.lb) return; this.lb = 1; const uid = this.uid();
    try {
      const a = await this.q('chess/act/' + uid), box = $('ch-resume');
      if (a && a.g) { const g = await this.q('chess/games/' + a.g); if (g && g.meta && !chReplay(g, this.now()).over) { if (box) { box.innerHTML = `<div class="ch-res"><div><b>Pertandingan sedang berjalan</b><small>${esc(g.meta.w.u)} vs ${esc(g.meta.b.u)}</small></div><button id="ch-go">Lanjutkan</button></div>`; $('ch-go').onclick = () => this.enter(a.g); } } else { this.q('chess/act/' + uid, null, 'DELETE').catch(() => {}); if (box) box.innerHTML = ''; } } else if (box) box.innerHTML = '';
      const c = await this.q('chess/ch/' + uid);
      if (c && c.f && !this.root.querySelector('.ch-ov')) { if (c.ts && this.now() - c.ts > 120000) this.q('chess/ch/' + uid, null, 'DELETE').catch(() => {}); else this.challenged(c); }
    } catch (e) {} this.lb = 0;
  },
  challenged(c) {
    this.modal(`<div class="ch-big"><i class="fa-solid fa-chess-knight"></i></div><h3>${esc(c.u)} menantangmu</h3><p>Waktu ${esc(tcName(c.tc))}. Terima tantangan ini?</p><div class="ch-row"><button class="ch-sec" id="n">Tolak</button><button class="ch-pri" id="y">Terima</button></div>`, (el, close) => {
      el.querySelector('#n').onclick = () => { this.q('chess/ch/' + this.uid(), null, 'DELETE').catch(() => {}); close(); };
      el.querySelector('#y').onclick = async () => { close(); try { const gid = await this.create({ uid: c.f, u: c.u }, c.tc); this.q('chess/ch/' + this.uid(), null, 'DELETE').catch(() => {}); this.enter(gid); } catch (e) { this.err(e); } };
    });
  },
  async create(opp, tc, gid) {
    const uid = this.uid(), me = { uid, u: this.name() }, iw = Math.random() < .5; gid = gid || 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await this.q(`chess/games/${gid}/meta`, null, 'PUT', { w: iw ? me : opp, b: iw ? opp : me, tc, ts: { '.sv': 'timestamp' } });
    await this.q('chess/act/' + uid, null, 'PUT', { g: gid }); await this.q('chess/act/' + opp.uid, null, 'PUT', { g: gid }); return gid;
  },
  /* ===== cari lawan publik ===== */
  find() {
    const uid = this.uid(), tc = this.tc, key = `chess/q/${tc}/${uid}`, r = this.root, t0 = Date.now(); this.stopT(); this.qk = key;
    r.innerHTML = `<div class="ch-wait"><div class="ch-spin"><i class="fa-solid fa-chess-knight"></i></div><h3>Mencari lawan…</h3><p>${esc(tcName(tc))} · peringkatmu ${this.rating}</p><small id="ch-el">0 detik</small><div id="ch-bt"></div><button class="ch-sec" id="ch-cx">Batal</button></div>`;
    $('ch-cx').onclick = () => this.lobby();
    const tick = async () => {
      if (this.G) return;
      try {
        const a = await this.q('chess/act/' + uid);
        if (a && a.g) { const g = await this.q('chess/games/' + a.g); if (g && g.meta && !chReplay(g, this.now()).over) { this.q(key, null, 'DELETE').catch(() => {}); this.qk = null; return this.enter(a.g); } }
        const me = await this.q(key, null, 'PUT', { u: this.name(), r: this.rating, ts: { '.sv': 'timestamp' } }), all = await this.q('chess/q/' + tc) || {};
        const c = Object.entries(all).filter(([u, v]) => u !== uid && v && me.ts - v.ts < 10000).sort((x, y) => Math.abs(x[1].r - this.rating) - Math.abs(y[1].r - this.rating))[0];
        if (c && uid < c[0] && !(await this.q('chess/act/' + c[0]))) { const gid = await this.create({ uid: c[0], u: c[1].u }, tc); this.q(key, null, 'DELETE').catch(() => {}); this.q(`chess/q/${tc}/${c[0]}`, null, 'DELETE').catch(() => {}); this.qk = null; return this.enter(gid); }
        const s = Math.round((Date.now() - t0) / 1000), el = $('ch-el'); if (el) el.textContent = s + ' detik';
        if (s >= 25 && $('ch-bt') && !$('ch-bt').innerHTML) { $('ch-bt').innerHTML = '<p>Belum ada lawan online.</p><button class="ch-pri" id="ch-bb">Main lawan bot</button>'; $('ch-bb').onclick = () => this.botSetup(); }
      } catch (e) { this.err(e); }
    };
    this.timer(tick, 2000); tick();
  },
  /* ===== dengan teman ===== */
  friend() {
    this.stopT(); const r = this.root;
    r.innerHTML = `<div class="ch-pg"><button class="ch-back" id="bk"><i class="fa-solid fa-arrow-left"></i> Lobi</button><h3>Main dengan teman</h3>${this.chips()}
      <div class="ch-box"><b>Buat kamar</b><p>Kamu dapat kode, kirim ke temanmu.</p><button class="ch-pri" id="mk">Buat kamar</button><div id="rm"></div></div>
      <div class="ch-box"><b>Masuk dengan kode</b><div class="ch-in"><input id="cd" maxlength="6" placeholder="KODE" autocapitalize="characters"/><button class="ch-pri" id="jn">Masuk</button></div></div>
      <div class="ch-box"><b>Tantang username</b><div class="ch-in"><input id="un" placeholder="username temanmu" autocapitalize="none"/><button class="ch-pri" id="cl">Tantang</button></div><small id="cs"></small></div></div>`;
    this.bindChips(r); $('bk').onclick = () => this.lobby();
    const uid = this.uid(), waitAct = (cancel) => { this.timer(async () => { try { const a = await this.q('chess/act/' + uid); if (a && a.g) { cancel(); this.enter(a.g); } } catch (e) {} }, 2000); };
    $('mk').onclick = async () => {
      const al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = ''; for (let i = 0; i < 5; i++) code += al[Math.floor(Math.random() * al.length)];
      try { await this.q('chess/rooms/' + code, null, 'PUT', { uid, u: this.name(), tc: this.tc, ts: { '.sv': 'timestamp' } }); } catch (e) { return this.err(e); }
      $('rm').innerHTML = `<div class="ch-code">${code}</div><small>Menunggu temanmu masuk…</small><button class="ch-sec" id="rc">Batalkan kamar</button>`; $('mk').classList.add('hidden');
      const cancel = () => this.q('chess/rooms/' + code, null, 'DELETE').catch(() => {}); $('rc').onclick = () => { cancel(); this.friend(); }; waitAct(cancel);
    };
    $('jn').onclick = async () => {
      const code = $('cd').value.trim().toUpperCase(); if (code.length < 4) return UI.toast('Masukkan kode kamar', 'info');
      try { const rm = await this.q('chess/rooms/' + code); if (!rm || !rm.uid) return UI.toast('Kode tidak ditemukan atau sudah dipakai', 'warn'); if (rm.uid === uid) return UI.toast('Itu kamarmu sendiri', 'info');
        const gid = await this.create({ uid: rm.uid, u: rm.u }, rm.tc || this.tc); this.q('chess/rooms/' + code, null, 'DELETE').catch(() => {}); this.enter(gid); } catch (e) { this.err(e); }
    };
    $('cl').onclick = async () => {
      const un = $('un').value.trim().replace(/^@+/, ''); if (!un) return; const cs = $('cs');
      try { const tid = await this.q('keys/' + userKey(un)); if (!tid) return UI.toast('Username tidak ditemukan', 'warn'); if (tid === uid) return UI.toast('Itu akunmu sendiri', 'info');
        await this.q('chess/ch/' + tid, null, 'PUT', { f: uid, u: this.name(), tc: this.tc, ts: { '.sv': 'timestamp' } }); cs.textContent = 'Tantangan terkirim ke @' + un + '. Menunggu jawaban…'; waitAct(() => this.q('chess/ch/' + tid, null, 'DELETE').catch(() => {})); } catch (e) { this.err(e); }
    };
  },
  /* ===== bot ===== */
  botSetup() {
    this.stopT(); let lv = 1, side = 'w'; const r = this.root;
    r.innerHTML = `<div class="ch-pg"><button class="ch-back" id="bk"><i class="fa-solid fa-arrow-left"></i> Lobi</button><h3>Lawan bot</h3><div class="ch-box"><b>Tingkat</b><div class="ch-chips" id="lv"><button data-v="0">Mudah</button><button data-v="1" class="on">Sedang</button><button data-v="2">Sulit</button></div></div>
      <div class="ch-box"><b>Warna bidakmu</b><div class="ch-chips" id="sd"><button data-v="w" class="on">Putih</button><button data-v="b">Hitam</button><button data-v="r">Acak</button></div></div><button class="ch-cta" id="go"><i class="fa-solid fa-play"></i> Mulai</button></div>`;
    $('bk').onclick = () => this.lobby();
    const pick = (id, f) => r.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { r.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); f(b.dataset.v); });
    pick('lv', v => lv = +v); pick('sd', v => side = v);
    $('go').onclick = () => this.startBot(lv, side === 'r' ? (Math.random() < .5 ? 'w' : 'b') : side);
  },
  startBot(lv, my) {
    const nm = ['Bot Mudah', 'Bot Sedang', 'Bot Sulit'][lv], me = { uid: 'me', u: this.name() }, bt = { uid: 'bot', u: nm };
    this.begin({ mode: 'bot', lv, my, id: null, g: { meta: { w: my === 'w' ? me : bt, b: my === 'w' ? bt : me, tc: '300_0' }, mw: [], mb: [] }, ret: () => this.botSetup(), again: () => this.startBot(lv, my) });
  },
  /* ===== masuk pertandingan online ===== */
  async enter(gid, ret) {
    this.stopT(); let g; try { g = await this.q('chess/games/' + gid); } catch (e) { return this.err(e); }
    if (!g || !g.meta) { UI.toast('Pertandingan tidak ditemukan', 'warn'); return this.lobby(); }
    const uid = this.uid(), my = g.meta.w.uid === uid ? 'w' : g.meta.b.uid === uid ? 'b' : null; g.mw = arrOf(g.mw); g.mb = arrOf(g.mb); g.rdy = g.rdy || {};
    if (my && !g.rdy[uid]) { try { g.rdy[uid] = (await this.q(`chess/games/${gid}/rdy/${uid}`, null, 'PUT', { '.sv': 'timestamp' })); } catch (e) {} }
    const rt = {}; await Promise.all(['w', 'b'].map(c => this.q('chess/st/' + g.meta[c].uid).then(s => { rt[c] = (s && s.r) || 1000; }).catch(() => { rt[c] = 1000; })));
    this.begin({ mode: 'online', id: gid, my, g, rt, tour: !!ret, ret: ret || (() => this.lobby()), again: () => (ret ? ret() : this.find()) });
  },
  begin(G) {
    this.stopT(); this.G = Object.assign({ sel: null, lg: [], flip: G.my === 'b', shown: false, forced: null, pend: null }, G); const r = this.root;
    r.innerHTML = `<div class="ch-g"><div class="ch-pl" id="pt"></div><div class="ch-bw"><div class="ch-board" id="bd"></div></div><div class="ch-pl" id="pb"></div><div class="ch-mv" id="mv"></div><div id="ban"></div><div class="ch-ctl" id="ct"></div></div>`;
    this.recalc(); this.paint();
    if (G.mode === 'online') { this.timer(() => this.poll(), 1200); }
    this.timer(() => this.tick(), 250); if (G.mode === 'bot') this.botTurn();
  },
  recalc() { const G = this.G; G.R = chReplay(G.g, G.mode === 'online' ? this.now() : 0, true); G.lg = CE.legal(G.R.s); const o = G.R.over || G.forced; G.over = o || null; },
  async poll() {
    const G = this.G; if (!G || G.mode !== 'online' || G.busy) return; G.busy = 1;
    try {
      const g = await this.q('chess/games/' + G.id); if (!g || !this.G || this.G !== G) { G.busy = 0; return; }
      g.mw = arrOf(g.mw); g.mb = arrOf(g.mb); g.rdy = g.rdy || {};
      if (G.pend) { const arr = G.pend.side === 'w' ? g.mw : g.mb; if (arr[G.pend.idx]) G.pend = null; else arr[G.pend.idx] = G.pend.e; }
      const was = G.R.mv.length; G.g = g; this.recalc(); if (G.R.mv.length !== was) { G.sel = null; try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} } this.paint();
    } catch (e) {} G.busy = 0;
  },
  tick() {
    const G = this.G; if (!G) return; if (G.mode === 'online') { this.recalc(); this.clocks(); if (G.over && !G.shown) this.paint(); } else this.clocks();
  },
  /* ===== langkah ===== */
  tap(i) {
    const G = this.G; if (!G || G.over || !G.my || G.R.s.t !== G.my || G.thinking) return;
    const p = G.R.s.b[i];
    if (G.sel != null) { const c = G.lg.filter(m => m.f === G.sel && m.t === i); if (c.length) return c.length > 1 ? this.promo(c) : this.play(c[0]); }
    G.sel = p && CE.col(p) === G.my ? i : null; this.paint();
  },
  promo(c) {
    const col = this.G.my; this.modal(`<h3>Promosi bidak</h3><div class="ch-pro">${['q', 'r', 'b', 'n'].map(x => `<button data-p="${x}" class="pc ${col}">${GL[x.toUpperCase()]}\uFE0E</button>`).join('')}</div>`, (el, close) => el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { close(); this.play(c.find(m => m.p === b.dataset.p)); }));
  },
  async play(m) {
    const G = this.G, side = G.R.s.t, k = G.R.mv.length, idx = k >> 1, e = { m: CE.uci(m), t: this.now() }; G.sel = null;
    (side === 'w' ? G.g.mw : G.g.mb)[idx] = e; this.recalc(); this.paint(); try { navigator.vibrate && navigator.vibrate(10); } catch (x) {}
    if (G.mode === 'bot') return this.botTurn();
    G.pend = { side, idx, e };
    try { const res = await this.q(`chess/games/${G.id}/${side === 'w' ? 'mw' : 'mb'}/${idx}`, null, 'PUT', { m: e.m, t: { '.sv': 'timestamp' } }); if (res && res.t) { e.t = res.t; this.recalc(); } }
    catch (x) { G.pend = null; (side === 'w' ? G.g.mw : G.g.mb).length = idx; this.recalc(); this.paint(); this.err(x); }
  },
  botTurn() {
    const G = this.G; if (!G || G.mode !== 'bot' || G.over || G.R.s.t === G.my) return; G.thinking = 1; this.paint();
    setTimeout(() => { if (this.G !== G) return; const m = CE.bot(G.R.s, G.lv); G.thinking = 0; if (!m) return this.paint(); const side = G.R.s.t; (side === 'w' ? G.g.mw : G.g.mb)[G.R.mv.length >> 1] = { m: CE.uci(m), t: Date.now() }; this.recalc(); this.paint(); }, 350 + Math.random() * 350);
  },
  act(a) {
    const G = this.G; if (!G) return;
    if (a === 'flip') { G.flip = !G.flip; return this.paint(); }
    if (a === 'out') { if (G.over || !G.my || confirm('Pertandingan masih berjalan dan jam tetap berjalan. Keluar dari layar ini?')) return this.leave(); return; }
    if (!G.my || G.over) return;
    if (a === 'resign') { if (!confirm('Menyerah dan mengakhiri pertandingan?')) return; if (G.mode === 'bot') { G.forced = { r: G.my === 'w' ? 'b' : 'w', why: 'resign' }; this.recalc(); return this.paint(); } this.q(`chess/games/${G.id}/res`, null, 'PUT', { r: G.my === 'w' ? 'b' : 'w', why: 'resign', by: this.uid() }).then(() => this.poll()).catch(e => this.err(e)); }
    if (a === 'draw') { if (G.mode === 'bot') return UI.toast('Bot tidak menerima tawaran seri', 'info'); this.q(`chess/games/${G.id}/dr`, null, 'PUT', { by: G.my, at: G.R.mv.length }).then(() => { UI.toast('Tawaran seri terkirim', 'ok'); this.poll(); }).catch(e => this.err(e)); }
    if (a === 'accept') this.q(`chess/games/${G.id}/res`, null, 'PUT', { r: 'd', why: 'agree', by: this.uid() }).then(() => this.poll()).catch(e => this.err(e));
    if (a === 'decline') this.q(`chess/games/${G.id}/dr`, null, 'DELETE').then(() => this.poll()).catch(() => {});
  },
  leave() { const G = this.G; this.stopT(); this.G = null; (G && G.ret ? G.ret : () => this.lobby())(); },
  /* ===== tampilan papan ===== */
  mat(b, c) { let v = 0; for (let i = 0; i < 120; i++) { if (i & 0x88) { i += 7; continue; } const p = b[i]; if (p && CE.col(p) === c) v += CE.VAL[p.toLowerCase()]; } return v; },
  caps(b, c) { const init = { P: 8, N: 2, B: 2, R: 2, Q: 1 }, have = {}; for (let i = 0; i < 120; i++) { if (i & 0x88) { i += 7; continue; } const p = b[i]; if (p && CE.col(p) === c) have[p.toUpperCase()] = (have[p.toUpperCase()] || 0) + 1; } let out = ''; for (const k of ['Q', 'R', 'B', 'N', 'P']) out += (GL[k] + '\uFE0E').repeat(Math.max(0, init[k] - (have[k] || 0))); return out; },
  bar(side) {
    const G = this.G, R = G.R, o = side === 'w' ? 'b' : 'w', p = G.g.meta[side], rt = G.rt ? G.rt[side] : '', d = this.mat(R.s.b, side) - this.mat(R.s.b, o);
    return `<div class="ch-av s">${esc(String(p.u).charAt(0).toUpperCase())}</div><div class="ch-pi"><b>${esc(p.u)}${rt ? `<em>${rt}</em>` : ''}</b><span class="ch-cap pc ${o}">${this.caps(R.s.b, o)}${d > 0 ? `<i>+${Math.round(d / 100)}</i>` : ''}</span></div>${G.mode === 'online' ? `<div class="ch-ck" id="ck-${side}"></div>` : ''}`;
  },
  paint() {
    const G = this.G, r = this.root; if (!G || !$('bd')) return; const R = G.R, s = R.s, top = G.flip ? 'w' : 'b', bot = G.flip ? 'b' : 'w', last = R.mv[R.mv.length - 1];
    const targets = new Set(G.sel != null ? G.lg.filter(m => m.f === G.sel).map(m => m.t) : []), kc = CE.inCheck(s) ? s.k[s.t] : -1; let h = '';
    for (let rr = 0; rr < 8; rr++) for (let ff = 0; ff < 8; ff++) {
      const f = G.flip ? 7 - ff : ff, rk = G.flip ? 7 - rr : rr, i = rk * 16 + f, p = s.b[i], dark = (rk + f) % 2 === 1;
      h += `<div class="sq ${dark ? 'd' : 'l'}${last && (last.f === i || last.t === i) ? ' lm' : ''}${G.sel === i ? ' sl' : ''}${kc === i ? ' ck' : ''}" data-i="${i}">${ff === 0 ? `<u class="rn">${8 - rk}</u>` : ''}${rr === 7 ? `<u class="fn">${'abcdefgh'[f]}</u>` : ''}${p ? `<b class="pc ${CE.col(p)}">${GL[p.toUpperCase()]}\uFE0E</b>` : ''}${targets.has(i) ? `<i class="${p ? 'rg' : 'dt'}"></i>` : ''}</div>`;
    }
    $('bd').innerHTML = h; $('bd').onclick = e => { const q = e.target.closest('.sq'); if (q) this.tap(+q.dataset.i); };
    $('pt').innerHTML = this.bar(top); $('pb').innerHTML = this.bar(bot);
    $('pt').className = 'ch-pl' + (!G.over && s.t === top ? ' act' : ''); $('pb').className = 'ch-pl' + (!G.over && s.t === bot ? ' act' : '');
    const mv = R.mv, rows = []; for (let k = 0; k < mv.length; k += 2) rows.push(`<span class="n">${k / 2 + 1}.</span><span>${esc(mv[k].san)}</span><span>${mv[k + 1] ? esc(mv[k + 1].san) : ''}</span>`);
    $('mv').innerHTML = rows.join('') || '<small>Langkah akan muncul di sini</small>'; $('mv').scrollLeft = 99999;
    const dr = G.g.dr, ban = $('ban'); let b = '';
    if (G.over) b = ''; else if (G.thinking) b = '<div class="ch-bn">Bot berpikir…</div>';
    else if (G.mode === 'online' && !R.st0) b = '<div class="ch-bn">Menunggu lawan masuk… jam belum berjalan</div>';
    else if (G.my && dr && dr.by !== G.my && dr.at === R.mv.length) b = '<div class="ch-bn dr">Lawan menawarkan seri <button data-a="accept">Terima</button><button data-a="decline">Tolak</button></div>';
    else if (G.my && dr && dr.by === G.my && dr.at === R.mv.length) b = '<div class="ch-bn">Tawaran seri terkirim</div>';
    else if (G.my) b = `<div class="ch-bn ${s.t === G.my ? 'me' : ''}">${s.t === G.my ? (CE.inCheck(s) ? 'Skak! Giliranmu' : 'Giliranmu') : 'Giliran lawan'}</div>`; else b = `<div class="ch-bn">Menonton · giliran ${s.t === 'w' ? 'putih' : 'hitam'}</div>`;
    ban.innerHTML = b; ban.querySelectorAll('[data-a]').forEach(x => x.onclick = () => this.act(x.dataset.a));
    $('ct').innerHTML = `<button data-a="out"><i class="fa-solid fa-chevron-left"></i>Keluar</button><button data-a="flip"><i class="fa-solid fa-rotate"></i>Balik</button>${G.my && !G.over ? `<button data-a="draw"><i class="fa-regular fa-handshake"></i>Seri</button><button data-a="resign" class="rd"><i class="fa-regular fa-flag"></i>Menyerah</button>` : ''}`;
    $('ct').querySelectorAll('[data-a]').forEach(x => x.onclick = () => this.act(x.dataset.a));
    this.clocks(); if (G.over && !G.shown) this.over();
  },
  clocks() {
    const G = this.G; if (!G || G.mode !== 'online' || !G.R) return; for (const c of ['w', 'b']) { const el = $('ck-' + c); if (!el) continue; const l = G.R.left(c); el.textContent = mmss(l); el.classList.toggle('low', l < 10000 && !G.over); el.classList.toggle('on', !G.over && G.R.st0 != null && G.R.s.t === c); }
  },
  async over() {
    const G = this.G, o = G.over; G.shown = true; const my = G.my, won = o.r === my, draw = o.r === 'd';
    if (G.mode === 'online') {
      if (my && !G.g.res) this.q(`chess/games/${G.id}/res`, null, 'PUT', { r: o.r, why: o.why, by: this.uid() }).catch(() => {});
      if (my) this.q('chess/act/' + this.uid(), null, 'DELETE').catch(() => {});
    }
    const title = !my ? (draw ? 'Seri' : (o.r === 'w' ? 'Putih' : 'Hitam') + ' menang') : draw ? 'Seri' : won ? 'Kamu menang!' : 'Kamu kalah';
    this.modal(`<div class="ch-big ${draw ? 'd' : won ? 'w' : 'l'}"><i class="fa-solid ${draw ? 'fa-handshake' : won ? 'fa-trophy' : 'fa-chess-king'}"></i></div><h3>${title}</h3><p>${esc(CH_WHY[o.why] || '')}</p><div class="ch-dl" id="dl"></div><div class="ch-row"><button class="ch-sec" id="lb">${G.ret && G.mode === 'online' && G.tour ? 'Kembali ke turnamen' : 'Ke lobi'}</button>${G.tour ? '' : '<button class="ch-pri" id="ag">Main lagi</button>'}</div>`, (el, close) => {
      el.querySelector('#lb').onclick = () => { close(); this.leave(); }; const ag = el.querySelector('#ag'); if (ag) ag.onclick = () => { close(); G.again(); };
    });
    if (G.mode === 'online' && my) this.record(G, o);
  },
  async record(G, o) {
    const uid = this.uid(), oc = G.my === 'w' ? 'b' : 'w';
    try {
      await this.q(`chess/games/${G.id}/ctr/${uid}`, null, 'PUT', true);
      const [mine, opp] = await Promise.all([this.q('chess/st/' + uid), this.q('chess/st/' + G.g.meta[oc].uid)]); const m = mine || { r: 1000, w: 0, l: 0, d: 0, n: 0 }, ro = (opp && opp.r) || 1000;
      const S = o.r === 'd' ? .5 : o.r === G.my ? 1 : 0, E = 1 / (1 + Math.pow(10, (ro - m.r) / 400)), dl = Math.round(24 * (S - E));
      const nw = { u: this.name(), r: Math.max(100, m.r + dl), w: (m.w || 0) + (S === 1 ? 1 : 0), l: (m.l || 0) + (S === 0 ? 1 : 0), d: (m.d || 0) + (S === .5 ? 1 : 0), n: (m.n || 0) + 1 };
      await this.q('chess/st/' + uid, null, 'PUT', nw); this.rating = nw.r; const el = $('dl'); if (el) el.innerHTML = `<b class="${dl >= 0 ? 'up' : 'dn'}">${dl >= 0 ? '+' : ''}${dl}</b> peringkat → ${nw.r}`;
    } catch (e) {}
  },
  /* ===== peringkat ===== */
  async rank() {
    this.stopT(); const r = this.root; r.innerHTML = '<div class="ch-pg"><button class="ch-back" id="bk"><i class="fa-solid fa-arrow-left"></i> Lobi</button><h3>Peringkat</h3><div id="lst" class="ch-lst"><div class="ch-load">Memuat…</div></div></div>'; $('bk').onclick = () => this.lobby();
    try {
      const o = await this.recent('chess/st', 'r', 20) || {}, l = Object.entries(o).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.r - a.r), me = this.uid();
      $('lst').innerHTML = l.length ? l.map((x, i) => `<div class="ch-row2${x.id === me ? ' me' : ''}"><span class="rk r${i + 1}">${i + 1}</span><div class="ch-av s">${esc(String(x.u || '?').charAt(0).toUpperCase())}</div><div class="ch-pi"><b>${esc(x.u || 'Pemain')}</b><small>${x.w || 0} menang · ${x.d || 0} seri · ${x.l || 0} kalah</small></div><b class="ch-pt">${x.r}</b></div>`).join('') : '<div class="ch-load">Belum ada pertandingan. Jadilah yang pertama!</div>';
    } catch (e) { $('lst').innerHTML = '<div class="ch-load">Gagal memuat peringkat.</div>'; }
  }
};

/* ---------- Catur: turnamen sistem gugur ---------- */
Object.assign(Chess, {
  async tours() {
    this.stopT(); const r = this.root;
    r.innerHTML = '<div class="ch-pg"><button class="ch-back" id="bk"><i class="fa-solid fa-arrow-left"></i> Lobi</button><div class="ch-hd"><h3>Turnamen</h3><button class="ch-pri sm" id="nw"><i class="fa-solid fa-plus"></i> Buat</button></div><div id="lst" class="ch-lst"><div class="ch-load">Memuat…</div></div></div>';
    $('bk').onclick = () => this.lobby(); $('nw').onclick = () => this.newTour();
    const load = async () => {
      try {
        const o = await this.recent('chess/tour', 'm/ts', 15) || {}, l = Object.entries(o).filter(([, v]) => v && v.m).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.m.ts - a.m.ts), el = $('lst'); if (!el) return;
        el.innerHTML = l.length ? l.map(t => { const n = Object.keys(t.p || {}).length, st = t.z ? 'Selesai · juara ' + esc(t.z.u) : t.b ? 'Berlangsung' : 'Pendaftaran';
          return `<button class="ch-tr" data-t="${esc(t.id)}"><i class="fa-solid fa-trophy"></i><div><b>${esc(t.m.n)}</b><small>${n}/${t.m.max} pemain · ${esc(tcName(t.m.tc))} · oleh ${esc(t.m.bu)}</small></div><span class="${t.z ? 'dn' : t.b ? 'lv' : 'op'}">${st}</span></button>`; }).join('') : '<div class="ch-load">Belum ada turnamen. Buat yang pertama!</div>';
        el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => this.tourView(b.dataset.t));
      } catch (e) { const el = $('lst'); if (!el) return; const denied = e && (e.status === 401 || e.status === 403 || e.permission); let why = denied ? 'Database menolak akses.' : 'Cek koneksi lalu coba lagi.';
        const probe = async (path) => { try { await this.q(path, { shallow: true }); return 'ok'; } catch (x) { return (x.status || '?') + ' ' + String(x.message || '').slice(0, 60); } };
        const rows = [['Akunmu', 'users/' + this.uid()], ['Peringkat', 'chess/st'], ['Lobi online', 'chess/rooms'], ['Turnamen', 'chess/tour']], res = [];
        for (const [n, pth] of rows) res.push([n, await probe(pth)]);
        el.innerHTML = `<div class="ch-load err"><b>Daftar turnamen tidak terbaca</b><p>${why}</p><div class="ch-dg">${res.map(([n, r]) => `<div><span>${esc(n)}</span><i class="${r === 'ok' ? 'ok' : 'no'}">${esc(r === 'ok' ? 'terbaca' : r)}</i></div>`).join('')}</div><small>Database ${esc(String((FB.st.dbUrl || '').replace('https://', '')))} · uid ${esc(String(this.uid() || '').slice(0, 8))}…</small></div>`; }
    };
    this.timer(load, 6000); load();
  },
  newTour() {
    let max = 8, tc = this.tc;
    this.modal(`<h3>Buat turnamen</h3><div class="ch-in col"><input id="nm" maxlength="24" placeholder="Nama turnamen"/></div><b class="ch-lb">Waktu</b>${this.chips()}<b class="ch-lb">Jumlah pemain maksimal</b><div class="ch-chips" id="mx"><button data-v="4">4</button><button data-v="8" class="on">8</button><button data-v="16">16</button></div><div class="ch-row"><button class="ch-sec" id="x">Batal</button><button class="ch-pri" id="ok">Buat</button></div>`, (el, close) => {
      this.bindChips(el); el.querySelectorAll('#mx button').forEach(b => b.onclick = () => { max = +b.dataset.v; el.querySelectorAll('#mx button').forEach(x => x.classList.toggle('on', x === b)); });
      el.querySelector('#x').onclick = close;
      el.querySelector('#ok').onclick = async () => {
        const n = el.querySelector('#nm').value.trim() || ('Turnamen ' + this.name()), uid = this.uid(), id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        try { await this.q(`chess/tour/${id}/m`, null, 'PUT', { n, by: uid, bu: this.name(), tc: this.tc, max, ts: { '.sv': 'timestamp' } }); await this.q(`chess/tour/${id}/p/${uid}`, null, 'PUT', { u: this.name(), ts: { '.sv': 'timestamp' } }); close(); this.tourView(id); } catch (e) { this.err(e); }
      };
    });
  },
  /* susun bracket dari daftar seed + hasil tiap pertandingan (dihitung dari data game, bukan dari klaim pemain) */
  async bracket(tid, t) {
    const sz = t.b.n, S = t.b.s || {}, seeds = []; for (let i = 0; i < sz; i++) seeds.push(S[i] || null);
    this.gc = this.gc || {}; const rounds = []; let cur = seeds, rn = 0;
    while (cur.length > 1) {
      const pairs = [], next = [];
      for (let i = 0; i < cur.length; i += 2) {
        const a = cur[i], b = cur[i + 1], p = { a, b, gid: `${tid}-${rn}-${i / 2}`, w: null, st: 'tbd' };
        if (rn === 0 && (!a || !b)) { p.w = a || b; p.st = 'bye'; }
        else if (a && b) {
          let g = this.gc[p.gid]; if (!g || !g.fin) { try { const x = await this.q('chess/games/' + p.gid); g = x && x.meta ? { g: x } : { g: null }; } catch (e) { g = { g: null }; } }
          if (g.g) { const R = chReplay(g.g, this.now()); if (R.over) { p.w = R.over.r === 'w' ? g.g.meta.w : g.g.meta.b; p.st = 'done'; p.why = R.over.why; p.draw = R.over.r === 'd'; g.fin = 1; } else p.st = 'live'; } else p.st = 'ready';
          this.gc[p.gid] = g;
        }
        pairs.push(p); next.push(p.w || null);
      }
      rounds.push(pairs); cur = next; rn++;
    }
    return { rounds, champ: cur[0] || null };
  },
  async tourView(tid) {
    this.stopT(); const r = this.root; this.gc = {};
    r.innerHTML = '<div class="ch-pg"><button class="ch-back" id="bk"><i class="fa-solid fa-arrow-left"></i> Turnamen</button><div id="tv"><div class="ch-load">Memuat…</div></div></div>'; $('bk').onclick = () => this.tours();
    const uid = this.uid(), tick = async () => {
      if (this.G) return; let t; try { t = await this.q('chess/tour/' + tid); } catch (e) { return; } const el = $('tv'); if (!el) return; if (!t || !t.m) { el.innerHTML = '<div class="ch-load">Turnamen tidak ditemukan.</div>'; return; }
      const m = t.m, ps = Object.entries(t.p || {}).map(([id, v]) => ({ uid: id, u: v.u })), mine = !!(t.p && t.p[uid]); let bk = null; if (t.b) bk = await this.bracket(tid, t);
      let h = `<div class="ch-th"><div class="ch-big w"><i class="fa-solid fa-trophy"></i></div><h3>${esc(m.n)}</h3><small>${esc(tcName(m.tc))} · maks ${m.max} pemain · oleh ${esc(m.bu)}</small></div>`;
      if (bk && bk.champ && bk.rounds[bk.rounds.length - 1][0].st === 'done') { h += `<div class="ch-champ"><i class="fa-solid fa-crown"></i><div><small>Juara</small><b>${esc(bk.champ.u)}</b></div></div>`; if (mine && !t.z) this.q(`chess/tour/${tid}/z`, null, 'PUT', { uid: bk.champ.uid, u: bk.champ.u }).catch(() => {}); }
      if (!t.b) {
        h += `<h4 class="ch-h">Pemain (${ps.length}/${m.max})</h4><div class="ch-pls">${ps.map(p => `<span><b class="ch-av s">${esc(String(p.u).charAt(0).toUpperCase())}</b>${esc(p.u)}</span>`).join('')}</div><div class="ch-row">`;
        if (!mine && ps.length < m.max) h += '<button class="ch-pri" id="jn">Ikut turnamen</button>'; if (mine && m.by !== uid) h += '<button class="ch-sec" id="lv">Keluar</button>';
        if (m.by === uid) h += `<button class="ch-pri" id="st" ${ps.length < 2 ? 'disabled' : ''}>Mulai turnamen</button>`; h += '</div>' + (m.by === uid && ps.length < 2 ? '<small class="ch-hint">Butuh minimal 2 pemain untuk memulai.</small>' : '<small class="ch-hint">Pendaftaran dibuka sampai penyelenggara menekan Mulai.</small>');
      } else {
        const names = ['Final', 'Semifinal', 'Perempat final', 'Babak 16 besar']; const nr = bk.rounds.length;
        h += '<div class="ch-bk">' + bk.rounds.map((pairs, ri) => `<div class="ch-rd"><h5>${nr - ri <= 4 ? names[nr - ri - 1] : 'Babak ' + (ri + 1)}</h5>${pairs.map((p, i) => {
          const row = (x, c) => `<div class="pl${p.w && x && p.w.uid === x.uid ? ' win' : ''}"><b class="cd ${c}"></b>${x ? esc(x.u) : '<i>' + (p.st === 'bye' ? 'bye' : 'menunggu') + '</i>'}</div>`, inM = (p.a && p.a.uid === uid) || (p.b && p.b.uid === uid);
          const lab = { tbd: 'Menunggu babak sebelumnya', bye: 'Lolos otomatis', ready: 'Siap dimainkan', live: 'Sedang berlangsung', done: (p.draw ? 'Seri → hitam menang · ' : '') + (CH_WHY[p.why] || 'Selesai') }[p.st];
          return `<div class="ch-mt ${p.st}">${row(p.a, 'w')}${row(p.b, 'b')}<small>${esc(lab)}</small>${(p.st === 'ready' || p.st === 'live') ? `<button class="ch-pri sm" data-g="${i}" data-r="${ri}">${inM ? 'Main sekarang' : 'Tonton'}</button>` : ''}</div>`; }).join('')}</div>`).join('') + '</div>';
      }
      el.innerHTML = h; this.tourT = t;
      const j = $('jn'); if (j) j.onclick = () => this.q(`chess/tour/${tid}/p/${uid}`, null, 'PUT', { u: this.name(), ts: { '.sv': 'timestamp' } }).then(tick).catch(e => this.err(e));
      const lv = $('lv'); if (lv) lv.onclick = () => this.q(`chess/tour/${tid}/p/${uid}`, null, 'DELETE').then(tick).catch(e => this.err(e));
      const st = $('st'); if (st) st.onclick = () => this.startTour(tid, ps, tick);
      el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const p = bk.rounds[+b.dataset.r][+b.dataset.g]; this.playMatch(tid, p, m.tc); });
    };
    this.timer(tick, 3000); tick();
  },
  async startTour(tid, ps, done) {
    const pl = ps.slice().sort(() => Math.random() - .5), size = pow2(pl.length), byes = size - pl.length, s = {}; let k = 0;
    for (let i = 0; i < size / 2; i++) { if (i < byes) { s[2 * i] = pl[k++]; } else { s[2 * i] = pl[k++]; s[2 * i + 1] = pl[k++]; } }
    try { await this.q(`chess/tour/${tid}/b`, null, 'PUT', { n: size, s }); UI.toast('Turnamen dimulai!', 'ok'); done(); } catch (e) { this.err(e); }
  },
  async playMatch(tid, p, tc) {
    try { await this.q(`chess/games/${p.gid}/meta`, null, 'PUT', { w: p.a, b: p.b, tc, tid, ts: { '.sv': 'timestamp' } }); } catch (e) { /* sudah dibuat pemain lain */ }
    this.enter(p.gid, () => this.tourView(tid));
  }
});

if (!CATS.some(c => c[0] === 'game')) CATS.push(['game', 'Game']);
Features.reg({ id: 'catur', name: 'Catur', cat: 'game', icon: 'fa-chess-knight', grad: 'linear-gradient(135deg,#e2512f,#9c2f17)', open: () => Chess.open() });
