/* ==== 15-roles.js — v3.17
   Role = PAJANGAN (lencana + bingkai warna, terutama di chat global). Gratis, hanya Developer yang bisa memberikan.
   Semua fitur, bot, dan tools SAMA untuk semua role. Urutan: Premium < Reseller < Owner < Co Admin < Admin < Super Admin < God < Immortal. ==== */
const Roles = {
  /* [nama, warna1, warna2, ikon, harga/bulan (Rp), jeda chat (ms), keuntungan khusus] */
  TIERS: [
    ['Premium', '#4ade80', '#16a34a', 'fa-star', 15000, 1200, 'Bot Penulis + tool Generator Sandi'],
    ['Reseller', '#22d3ee', '#0891b2', 'fa-store', 35000, 1000, 'Bot Dagang + tool Kalkulator Margin'],
    ['Owner', '#fb923c', '#ea580c', 'fa-briefcase', 60000, 900, 'Bot Strategi + tool Pembuat Link WhatsApp'],
    ['Co Admin', '#60a5fa', '#2563eb', 'fa-user-gear', 90000, 800, 'Bot Moderator'],
    ['Admin', '#818cf8', '#4f46e5', 'fa-user-shield', 130000, 700, 'Bot Coder + tool Statistik Chat'],
    ['Super Admin', '#c084fc', '#9333ea', 'fa-shield-halved', 180000, 600, 'Bot Analis'],
    ['God', '#f472b6', '#db2777', 'fa-bolt', 250000, 500, 'Bot Guru (penjelasan langkah demi langkah)'],
    ['Immortal', '#f87171', '#dc2626', 'fa-infinity', 400000, 400, 'Bot Mahatahu (jawaban terlengkap) + semua tool']
  ].map(([n, c, c2, i, p, cd, perk], idx) => ({ n, c, c2, i, p, cd, perk, lv: idx + 1, g: `linear-gradient(135deg,${c},${c2})` })),
  tier(role) { const r = String(role || '').toLowerCase(); return this.TIERS.find(t => t.n.toLowerCase() === r) || null; },
  level(role) { if (String(role).toLowerCase() === 'developer') return 99; const t = this.tier(role); return t ? t.lv : 0; },
  need(min) { return this.TIERS[min - 1]; },
  wa(text) { return `https://wa.me/${CONFIG.ADMIN_WA}?text=${encodeURIComponent(text)}`; },
  fmt: n => 'Rp' + Number(n).toLocaleString('id-ID'),
  /* semua role punya akses yang sama — role hanya tampilan */
  gate() { return true; },
  reg(id, name, min, icon, open) { const t = this.need(min); Features.reg({ id, name, cat: 'alat', icon, grad: t.g, open }); }
};

/* ---------- bingkai/lencana mengikuti role ---------- */
Rank.info = function (role) {
  if (String(role).toLowerCase() === 'developer') return { k: 'dev', label: 'Developer', icon: 'fa-crown' };
  const t = Roles.tier(role); return t ? { k: 'user', label: t.n, icon: t.i, t } : { k: 'user', label: String(role || 'Member'), icon: 'fa-gem' };
};
Rank.color = role => { const i = Rank.info(role); return i.k === 'dev' ? '#fbbf24' : i.t ? i.t.c : '#22d3ee'; };
Rank.badge = function (role, sm) { const i = this.info(role); return `<span class="rk-tag rk-${i.k}${sm ? ' sm' : ''}"${i.t ? ` style="background:${i.t.g};color:#fff"` : ''}><i class="fa-solid ${i.icon}"></i>${esc(sm && i.k === 'dev' ? 'DEV' : i.label)}</span>`; };
Rank.frame = function (el, role) { if (!el) return; el.classList.remove('rk-dev', 'rk-user'); el.classList.add('rk-' + this.info(role).k); el.style.setProperty('--rc', this.color(role)); };

/* role berubah (dari Developer) → ikut diperbarui otomatis tanpa login ulang */
setInterval(async () => {
  if (!App.user || FB.mode !== 'firebase' || !FB.st.uid || document.hidden) return;
  try { const p = await FB.request('users/' + FB.st.uid, null, 'GET', undefined, 8000); if (p && p.role && p.role !== App.user.role) { App.user.role = p.role; Rank.apply(); UI.toast('Role kamu sekarang: ' + p.role, 'ok', 6000); } } catch (e) {}
}, 60000);

/* ---------- Bot (terbuka untuk semua) ---------- */
const Bots = {
  LIST: [
    ['Si Penulis', 'Kamu "Si Penulis": bantu menulis caption, bio, copywriting, dan postingan yang menarik. Jawab singkat, kreatif, bahasa Indonesia santai.'],
    ['Si Dagang', 'Kamu "Si Dagang": bantu reseller membuat deskripsi produk, menentukan harga, dan membalas pembeli dengan ramah. Berikan contoh kalimat siap pakai.'],
    ['Si Strategi', 'Kamu "Si Strategi": bantu pemilik usaha menyusun rencana konten, promosi, dan target mingguan. Berikan langkah yang jelas dan terukur.'],
    ['Si Moderator', 'Kamu "Si Moderator": bantu admin grup/komunitas menyusun aturan, menegur dengan sopan, dan membalas komplain secara tenang dan adil.'],
    ['Si Coder', 'Kamu "Si Coder": bantu menulis, memperbaiki, dan menjelaskan kode (HTML, CSS, JavaScript, Python). Berikan kode lengkap dalam blok yang rapi dan jelaskan singkat.'],
    ['Si Analis', 'Kamu "Si Analis": bantu menganalisis angka, tabel, dan data sederhana. Tunjukkan perhitungannya dan tarik kesimpulan yang jelas.'],
    ['Si Guru', 'Kamu "Si Guru": jelaskan apa pun langkah demi langkah dengan contoh dan analogi, mulai dari dasar sampai paham. Tutup dengan ringkasan dan satu soal latihan.'],
    ['Si Mahatahu', 'Kamu "Si Mahatahu": asisten paling lengkap. Berikan jawaban mendalam, terstruktur, dengan sudut pandang berbeda, risiko, dan rekomendasi akhir. Sesuaikan gaya dengan kebutuhan pengguna.']
  ].map(([n, p], i) => ({ n, p, lv: i + 1, t: Roles.TIERS[i] })),
  hist: {},
  open() {
    Sheet.open({ id: 'bots', title: 'Bot AI', icon: 'fa-robot', grad: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
      body: `<div class="muted" style="font-size:12px;font-weight:600">Semua bot gratis dan bisa dipakai siapa saja.</div>${this.LIST.map((b, i) => `<button class="item" data-b="${i}" style="text-align:left;width:100%"><span class="avatar" style="width:42px;height:42px;background:${b.t.g}"><i class="fa-solid ${b.t.i}"></i></span><span style="flex:1;min-width:0"><b style="font-size:13.5px">${b.n}</b><br><small class="muted" style="font-weight:600">Gratis untuk semua</small></span><i class="fa-solid fa-chevron-right"></i></button>`).join('')}`,
      onOpen: el => el.querySelectorAll('[data-b]').forEach(b => b.onclick = () => { const bot = this.LIST[+b.dataset.b]; if (Roles.gate(bot.lv, bot.n)) this.chat(+b.dataset.b); }) });
  },
  chat(i) {
    const bot = this.LIST[i], id = 'bot' + i, h = this.hist[id] = this.hist[id] || [];
    const draw = () => { const c = document.getElementById('bt-c'); if (!c) return; c.innerHTML = h.length ? h.map(m => `<div class="selectable" style="align-self:${m.role === 'user' ? 'flex-end' : 'flex-start'};max-width:88%;padding:.6rem .85rem;border-radius:16px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;${m.role === 'user' ? `background:${bot.t.g};color:#fff` : 'background:#fff;border:1px solid var(--line)'}">${esc(m.content)}</div>`).join('') : emptyHtml('fa-robot', `Halo, saya ${esc(bot.n)}. Tanyakan apa saja sesuai keahlian saya.`); const b = Sheet.$(id); if (b) b.scrollTop = b.scrollHeight; };
    Sheet.open({ id, title: bot.n, icon: bot.t.i, grad: bot.t.g, full: true,
      body: '<div id="bt-c" style="display:flex;flex-direction:column;gap:8px;flex:1"></div>',
      foot: `<div class="ch-bar" style="background:#fff;border-top:1px solid var(--line)"><textarea id="bt-in" class="inp" rows="1" maxlength="1500" placeholder="Tulis pertanyaan…" style="font-size:16px;resize:none;max-height:120px;border-radius:22px!important"></textarea><button class="ch-b ch-go" id="bt-go" aria-label="Kirim"><i class="fa-solid fa-paper-plane"></i></button></div>`,
      onOpen: () => {
        draw(); const inp = document.getElementById('bt-in'), go = document.getElementById('bt-go'), touch = matchMedia('(pointer:coarse)').matches; let busy = false;
        inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 120) + 'px'; });
        const send = async () => {
          const t = inp.value.trim(); if (!t || busy) return; busy = true; inp.value = ''; inp.style.height = 'auto'; h.push({ role: 'user', content: t }); h.push({ role: 'assistant', content: 'Berpikir…' }); draw();
          const msgs = h.slice(0, -1).map(m => ({ role: m.role, content: m.content })); msgs[0] = { role: 'user', content: bot.p + '\n\nPesan pengguna: ' + msgs[0].content };
          try { const j = await API.post('ai', { messages: msgs.slice(-12) }, 60000); h[h.length - 1] = { role: 'assistant', content: j.text || 'Tidak ada jawaban.' }; }
          catch (e) { h[h.length - 1] = { role: 'assistant', content: 'Maaf, layanan AI sedang sibuk. Coba lagi sebentar.' }; }
          busy = false; draw(); inp.focus();
        };
        go.onclick = send; inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !touch) { e.preventDefault(); send(); } });
      } });
  }
};
Features.reg({ id: 'bots', name: 'Bot AI', cat: 'info', icon: 'fa-robot', grad: 'linear-gradient(135deg,#8b5cf6,#ec4899)', open: () => Bots.open() });

/* ---------- Tools khusus role ---------- */
Roles.reg('t-pass', 'Generator Sandi', 1, 'fa-key', () => {
  Sheet.open({ id: 't-pass', title: 'Generator Sandi', icon: 'fa-key', grad: Roles.TIERS[0].g,
    body: `<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px"><div id="pw-o" class="selectable" style="font:700 18px ui-monospace,monospace;word-break:break-all;padding:12px;border-radius:12px;background:#f1f5f9;min-height:50px"></div><label style="font-size:12px;font-weight:700">Panjang: <b id="pw-n">16</b></label><input id="pw-l" type="range" min="8" max="32" value="16"/><label style="font-size:12px;font-weight:700"><input id="pw-s" type="checkbox" checked/> Pakai simbol</label><div class="row"><button class="btn btn-pri" id="pw-g" style="flex:1"><i class="fa-solid fa-rotate"></i> Buat baru</button><button class="btn" id="pw-c"><i class="fa-regular fa-copy"></i></button></div></div>`,
    onOpen: el => { const g = () => { const n = +el.querySelector('#pw-l').value, set = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' + (el.querySelector('#pw-s').checked ? '!@#$%^&*?-_+=' : ''), a = new Uint32Array(n); crypto.getRandomValues(a); el.querySelector('#pw-o').textContent = Array.from(a, x => set[x % set.length]).join(''); el.querySelector('#pw-n').textContent = n; };
      el.querySelector('#pw-l').oninput = g; el.querySelector('#pw-s').onchange = g; el.querySelector('#pw-g').onclick = g; el.querySelector('#pw-c').onclick = () => copyText(el.querySelector('#pw-o').textContent); g(); } });
});
Roles.reg('t-margin', 'Kalkulator Margin', 2, 'fa-percent', () => {
  Sheet.open({ id: 't-margin', title: 'Kalkulator Margin', icon: 'fa-percent', grad: Roles.TIERS[1].g,
    body: `<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px"><input id="mg-m" type="number" inputmode="decimal" class="inp" placeholder="Harga modal (Rp)" style="font-size:16px"/><input id="mg-p" type="number" inputmode="decimal" class="inp" placeholder="Target untung (%)" value="20" style="font-size:16px"/><input id="mg-a" type="number" inputmode="decimal" class="inp" placeholder="Biaya admin/marketplace (%)" value="0" style="font-size:16px"/></div><div class="card" style="padding:6px 14px" id="mg-o"></div>`,
    onOpen: el => { const g = () => { const m = +el.querySelector('#mg-m').value || 0, p = +el.querySelector('#mg-p').value || 0, a = +el.querySelector('#mg-a').value || 0, jual = a < 100 ? Math.ceil(m * (1 + p / 100) / (1 - a / 100)) : 0, bersih = jual * (1 - a / 100); el.querySelector('#mg-o').innerHTML = `<div class="kv"><span>Harga jual</span><b>${Roles.fmt(jual)}</b></div><div class="kv"><span>Diterima setelah biaya</span><b>${Roles.fmt(Math.round(bersih))}</b></div><div class="kv"><span>Untung bersih</span><b>${Roles.fmt(Math.round(bersih - m))}</b></div>`; };
      el.querySelectorAll('input').forEach(i => i.oninput = g); g(); } });
});
Roles.reg('t-walink', 'Link WhatsApp', 3, 'fa-link', () => {
  Sheet.open({ id: 't-walink', title: 'Pembuat Link WhatsApp', icon: 'fa-link', grad: Roles.TIERS[2].g,
    body: `<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px"><input id="wl-n" type="tel" inputmode="tel" class="inp" placeholder="Nomor (08xx / 62xx)" style="font-size:16px"/><textarea id="wl-t" class="inp" rows="3" placeholder="Pesan otomatis (opsional)" style="font-size:16px"></textarea><div id="wl-o" class="selectable" style="font-size:12px;font-weight:700;word-break:break-all;padding:10px;border-radius:12px;background:#f1f5f9;min-height:40px"></div><div class="row"><button class="btn btn-pri" id="wl-c" style="flex:1"><i class="fa-regular fa-copy"></i> Salin link</button><a class="btn" id="wl-go" target="_blank" rel="noopener">Buka</a></div></div>`,
    onOpen: el => { const g = () => { let n = el.querySelector('#wl-n').value.replace(/\D/g, ''); if (n.startsWith('0')) n = '62' + n.slice(1); const t = el.querySelector('#wl-t').value.trim(), u = n ? `https://wa.me/${n}${t ? '?text=' + encodeURIComponent(t) : ''}` : ''; el.querySelector('#wl-o').textContent = u || 'Isi nomor dulu'; el.querySelector('#wl-go').href = u || '#'; el._u = u; };
      el.querySelectorAll('input,textarea').forEach(i => i.oninput = g); el.querySelector('#wl-c').onclick = () => el._u ? copyText(el._u) : UI.toast('Isi nomor dulu', 'warn'); g(); } });
});
Roles.reg('t-chatstat', 'Statistik Chat', 5, 'fa-chart-simple', () => {
  Sheet.open({ id: 't-chatstat', title: 'Statistik Chat', icon: 'fa-chart-simple', grad: Roles.TIERS[4].g, body: loadingHtml('Menghitung…'),
    onOpen: async el => {
      try { await Chat.poll(true); } catch (e) {}
      const b = el.querySelector('.sheet-body'), m = Chat.msgs, by = {}; m.forEach(x => { by[x.u] = (by[x.u] || 0) + 1; }); const top = Object.entries(by).sort((a, c) => c[1] - a[1]).slice(0, 10);
      b.innerHTML = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"><div class="stat"><b>${m.length}</b><small>Pesan</small></div><div class="stat"><b>${Object.keys(by).length}</b><small>Pengirim</small></div><div class="stat"><b>${m.filter(x => x.im || x.s).length}</b><small>Foto/stiker</small></div></div><div class="sec-title" style="color:var(--ink2)">Paling aktif</div><div class="card" style="padding:6px 14px">${top.length ? top.map(([u, n]) => `<div class="kv"><span style="color:var(--ink)">${esc(u)}</span><b>${n}</b></div>`).join('') : '<div class="muted" style="padding:10px;font-size:12px">Belum ada data.</div>'}</div>`;
    } });
});

/* ---------- Khusus Developer: tab "Role" untuk mengatur role pengguna ---------- */
Dev.t_role = async function (box) {
  let users = []; try { users = FB.mode === 'firebase' ? await FB.listUsers() : LocalAuth.users().map(u => ({ uid: u.k, username: u.u, role: u.role })); } catch (e) { return box.innerHTML = errHtml('Gagal memuat pengguna'); }
  const names = ['Gratis', ...Roles.TIERS.map(t => t.n)];
  const draw = q => { const l = users.filter(u => String(u.role).toLowerCase() !== 'developer' && (!q || String(u.username).toLowerCase().includes(q)));
    $('rl-l').innerHTML = l.map(u => `<div class="kv" style="align-items:center;gap:8px"><span style="color:var(--ink);min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis"><b>${esc(u.username)}</b><br>${Rank.badge(u.role, true)}</span><select data-u="${esc(u.uid)}" data-n="${esc(u.username)}" style="width:132px;font-size:14px;padding:.5rem;border-radius:12px;border:1px solid var(--line)">${names.map(n => `<option ${n.toLowerCase() === String(u.role).toLowerCase() ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`).join('') || '<div class="muted" style="padding:10px;font-size:12px">Tidak ada.</div>';
    $('rl-l').querySelectorAll('select').forEach(s => s.onchange = async () => { try { if (FB.mode === 'firebase') await FB.request('users/' + s.dataset.u, null, 'PATCH', { role: s.value }); else { const us = LocalAuth.users(), f = us.find(x => x.k === s.dataset.u); if (f) { f.role = s.value; LS.set('users', us); } } const f = users.find(x => x.uid === s.dataset.u); if (f) f.role = s.value; UI.toast(s.dataset.n + ' → ' + s.value, 'ok'); draw($('rl-q').value.trim().toLowerCase()); } catch (e) { UI.toast(e.permission ? 'Ditolak Firebase — tempel Rules terbaru (firebase-rules-tambahan.json) lalu Publish' : 'Gagal mengubah role', 'err', 6000); } }); };
  box.innerHTML = `<div class="muted" style="font-size:12px;font-weight:600">Atur role pengguna. Role hanya pajangan (lencana & bingkai di chat) dan gratis; fitur sama untuk semua. Perubahan masuk otomatis di perangkat mereka dalam ±1 menit. Role Developer tidak bisa diberikan.</div><input id="rl-q" type="text" class="inp" placeholder="Cari pengguna…" style="font-size:16px"/><div class="card" style="padding:6px 14px" id="rl-l"></div>`;
  $('rl-q').oninput = e => draw(e.target.value.trim().toLowerCase()); draw('');
};
(() => {
  const d1 = Dev.open;
  Dev.open = function () { d1.call(this); setTimeout(() => { const t = document.getElementById('dv-tabs'); if (!t || t.querySelector('[data-k="role"]')) return; const b = document.createElement('button'); b.className = 'chip'; b.dataset.k = 'role'; b.textContent = 'Role'; b.onclick = () => Dev.go('role'); t.appendChild(b); }, 70); };
})();
