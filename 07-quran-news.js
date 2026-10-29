/* ==== 07-quran-news.js — Al-Quran (layar penuh) & Berita real-time ==== */
const Quran = {
  list: [], cur: null, audio: null, playingNo: 0, fs: LS.get('quran_fs', 30), tr: LS.get('quran_tr', true),
  open() {
    Sheet.open({ id: 'quran', title: 'Al-Quran', icon: 'fa-book-quran', grad: 'linear-gradient(135deg,#0d9488,#115e59)', full: true, cls: 'quran-view', onClose: () => this.stopAudio(),
      body: `<input id="qr-q" class="inp" type="text" placeholder="Cari surah (nama / nomor)…"/><div id="qr-last"></div><div id="qr-list">${loadingHtml('Memuat daftar surah…')}</div>` });
    $('qr-q').oninput = () => this.renderList();
    this.load();
  },
  async load() {
    try { if (!this.list.length) { const j = await fetchJSON('https://equran.id/api/v2/surat', {}, 12000); this.list = j.data || []; } this.renderList(); this.renderLast(); }
    catch (e) { $('qr-list').innerHTML = errHtml('Gagal memuat Al-Quran. Periksa internet.') + '<div style="text-align:center"><button class="btn" id="qr-r">Coba lagi</button></div>'; $('qr-r').onclick = () => this.load(); }
  },
  renderLast() { const l = LS.get('quran_last'); if (!l || !$('qr-last')) return; $('qr-last').innerHTML = `<button class="card" style="width:100%;padding:12px 14px;text-align:left;display:flex;justify-content:space-between;align-items:center;border:0" id="qr-cont"><span><small class="muted" style="font-weight:800">LANJUTKAN MEMBACA</small><br><b>${esc(l.name)}</b> · ayat ${l.ayat}</span><i class="fa-solid fa-arrow-right"></i></button>`; $('qr-cont').onclick = () => this.read(l.no, l.ayat); },
  renderList() {
    const k = ($('qr-q') ? $('qr-q').value : '').toLowerCase().trim();
    const l = this.list.filter(s => !k || s.namaLatin.toLowerCase().includes(k) || String(s.nomor) === k || (s.arti || '').toLowerCase().includes(k));
    $('qr-list').innerHTML = l.map(s => `<button class="item" data-n="${s.nomor}" style="width:100%;text-align:left;margin-bottom:8px"><div style="width:38px;height:38px;border-radius:12px;background:#ccfbf1;color:#115e59;display:grid;place-items:center;font-weight:800;font-size:12px;flex:none">${s.nomor}</div><div style="flex:1;min-width:0"><div class="t" style="-webkit-line-clamp:1">${esc(s.namaLatin)} <span class="muted" style="font-weight:600">· ${esc(s.arti)}</span></div><div class="s">${s.jumlahAyat} ayat · ${esc(s.tempatTurun)}</div></div><div style="font-family:Amiri,serif;font-size:22px;font-weight:700;color:#115e59">${esc(s.nama)}</div></button>`).join('') || emptyHtml('fa-magnifying-glass', 'Surah tidak ditemukan');
    $('qr-list').querySelectorAll('[data-n]').forEach(b => b.onclick = () => this.read(+b.dataset.n));
  },
  async read(no, scrollTo) {
    const body = Sheet.$('quran'); body.innerHTML = loadingHtml('Memuat surah…'); this.stopAudio();
    try {
      const j = await fetchJSON('https://equran.id/api/v2/surat/' + no, {}, 15000), d = j.data; this.cur = d;
      body.style.padding = '0'; body.style.gap = '0';
      body.innerHTML = `<div style="padding:14px;text-align:center;background:linear-gradient(135deg,#0d9488,#115e59);color:#fff"><div style="font-family:Amiri,serif;font-size:34px;font-weight:700">${esc(d.nama)}</div><b>${esc(d.namaLatin)}</b> · ${esc(d.arti)}<div style="font-size:11px;opacity:.85;font-weight:600">${esc(d.tempatTurun)} · ${d.jumlahAyat} ayat</div></div>
        ${no !== 1 && no !== 9 ? '<div class="bismillah">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</div>' : ''}
        <div id="ayat-wrap" style="--arfs:${this.fs}px">${d.ayat.map(a => `<div class="ayat" id="ay-${a.nomorAyat}"><div class="row" style="justify-content:space-between;margin-bottom:6px"><span class="no">${a.nomorAyat}</span><span class="row"><button class="btn btn-sm btn-ghost" data-pa="${a.nomorAyat}"><i class="fa-solid fa-play"></i></button><button class="btn btn-sm btn-ghost" data-bm="${a.nomorAyat}"><i class="fa-regular fa-bookmark"></i></button></span></div><div class="ar">${esc(a.teksArab)}</div><div class="tr" style="${this.tr ? '' : 'display:none'}"><div style="font-size:12px;color:#92400e;font-style:italic;margin-top:6px">${esc(a.teksLatin)}</div><div style="font-size:13.5px;font-weight:600;margin-top:4px;line-height:1.6">${esc(a.teksIndonesia)}</div></div></div>`).join('')}</div>
        <div style="padding:14px;display:flex;gap:8px">${d.suratSebelumnya ? `<button class="btn" style="flex:1" id="qr-prev"><i class="fa-solid fa-chevron-left"></i> ${esc(d.suratSebelumnya.namaLatin)}</button>` : ''}${d.suratSelanjutnya ? `<button class="btn btn-pri" style="flex:1" id="qr-next">${esc(d.suratSelanjutnya.namaLatin)} <i class="fa-solid fa-chevron-right"></i></button>` : ''}</div>`;
      const bar = document.createElement('div'); bar.className = 'q-toolbar'; bar.innerHTML = `<button class="btn btn-icon" id="qr-back"><i class="fa-solid fa-list"></i></button><button class="btn btn-icon" id="qr-sm"><i class="fa-solid fa-minus"></i></button><button class="btn btn-icon" id="qr-bg"><i class="fa-solid fa-plus"></i></button><button class="btn btn-icon ${this.tr ? 'btn-dark' : ''}" id="qr-tr" title="Terjemahan"><i class="fa-solid fa-language"></i></button><button class="btn btn-pri" style="flex:1" id="qr-full"><i class="fa-solid fa-play"></i> Dengarkan surah</button>`;
      Sheet.$('quran').parentElement.appendChild(bar);
      $('qr-back').onclick = () => { bar.remove(); body.style.padding = ''; body.style.gap = ''; this.stopAudio(); body.innerHTML = `<input id="qr-q" class="inp" type="text" placeholder="Cari surah (nama / nomor)…"/><div id="qr-last"></div><div id="qr-list"></div>`; $('qr-q').oninput = () => this.renderList(); this.renderList(); this.renderLast(); };
      const sz = dlt => { this.fs = Math.max(20, Math.min(56, this.fs + dlt)); LS.set('quran_fs', this.fs); $('ayat-wrap').style.setProperty('--arfs', this.fs + 'px'); };
      $('qr-sm').onclick = () => sz(-3); $('qr-bg').onclick = () => sz(3);
      $('qr-tr').onclick = e => { this.tr = !this.tr; LS.set('quran_tr', this.tr); e.currentTarget.classList.toggle('btn-dark', this.tr); body.querySelectorAll('.tr').forEach(t => t.style.display = this.tr ? '' : 'none'); };
      $('qr-full').onclick = () => this.playFrom(1);
      body.querySelectorAll('[data-pa]').forEach(b => b.onclick = () => this.playFrom(+b.dataset.pa, true));
      body.querySelectorAll('[data-bm]').forEach(b => b.onclick = () => { LS.set('quran_last', { no, name: d.namaLatin, ayat: +b.dataset.bm }); UI.toast('Penanda disimpan: ' + d.namaLatin + ' ayat ' + b.dataset.bm, 'ok'); });
      const go = n => { bar.remove(); this.read(n); }; if ($('qr-prev')) $('qr-prev').onclick = () => go(no - 1); if ($('qr-next')) $('qr-next').onclick = () => go(no + 1);
      body.scrollTop = 0; if (scrollTo) setTimeout(() => { const e = $('ay-' + scrollTo); e && e.scrollIntoView({ block: 'center' }); }, 120);
      LS.set('quran_last', { no, name: d.namaLatin, ayat: LS.get('quran_last', {}).no === no ? LS.get('quran_last').ayat : 1 });
    } catch (e) { body.innerHTML = errHtml('Gagal memuat surah.') + '<div style="text-align:center"><button class="btn" id="qr-r2">Coba lagi</button></div>'; $('qr-r2').onclick = () => this.read(no); }
  },
  audioUrl(a) { return a.audio && (a.audio['05'] || Object.values(a.audio)[0]); },
  playFrom(n, single) {
    const d = this.cur; if (!d) return; this.stopAudio(); Sound.play('quran'); Sound.reg('quran', () => this.stopAudio(true));
    const a = d.ayat.find(x => x.nomorAyat === n); if (!a) return; const url = this.audioUrl(a); if (!url) return UI.toast('Audio tidak tersedia', 'warn');
    this.audio = new Audio(url); this.playingNo = n; document.querySelectorAll('.ayat.playing').forEach(e => e.classList.remove('playing')); const el = $('ay-' + n); if (el) { el.classList.add('playing'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    this.audio.onended = () => { if (!single && n < d.jumlahAyat) this.playFrom(n + 1); else this.stopAudio(); };
    this.audio.onerror = () => { UI.toast('Audio gagal diputar', 'err'); this.stopAudio(); };
    this.audio.play().catch(() => UI.toast('Ketuk lagi untuk memutar', 'warn')); const b = $('qr-full'); if (b) b.innerHTML = '<i class="fa-solid fa-stop"></i> Hentikan', b.onclick = () => this.stopAudio();
  },
  stopAudio(quiet) { if (this.audio) { try { this.audio.pause(); } catch (e) {} this.audio = null; } document.querySelectorAll('.ayat.playing').forEach(e => e.classList.remove('playing')); const b = $('qr-full'); if (b) { b.innerHTML = '<i class="fa-solid fa-play"></i> Dengarkan surah'; b.onclick = () => this.playFrom(1); } if (!quiet) Sound.release('quran'); }
};
Features.reg({ id: 'quran', name: 'Al-Quran', cat: 'islami', icon: 'fa-book-quran', grad: 'linear-gradient(135deg,#0d9488,#115e59)', open: () => Quran.open() });

/* ---------- Berita real-time ---------- */
const NEWS_CATS = [['terbaru', 'Terbaru'], ['nasional', 'Nasional'], ['dunia', 'Dunia'], ['ekonomi', 'Ekonomi'], ['olahraga', 'Olahraga'], ['teknologi', 'Teknologi'], ['hiburan', 'Hiburan'], ['kesehatan', 'Kesehatan']];
const News = {
  cat: 'terbaru', q: '', timer: null, last: 0, items: [],
  open() {
    Sheet.open({ id: 'news', title: 'Berita Terbaru', icon: 'fa-newspaper', grad: 'linear-gradient(135deg,#7c3aed,#5b21b6)', onClose: () => clearInterval(this.timer),
      head: '<span class="chip" id="nw-live" style="background:#fee2e2;color:#b91c1c;border-color:#fecaca"><span class="dot-bad" style="width:7px;height:7px"></span> LIVE</span>',
      body: `${searchBar('nw-q', 'Cari berita…')}<div class="h-scroll" id="nw-cats">${NEWS_CATS.map(([k, l]) => `<button class="chip ${k === this.cat ? 'on' : ''}" data-c="${k}">${l}</button>`).join('')}</div><div class="muted" id="nw-info" style="font-size:11px;font-weight:700"></div><div id="nw-out">${loadingHtml('Memuat berita…')}</div>` });
    $('nw-cats').querySelectorAll('button').forEach(b => b.onclick = () => { this.cat = b.dataset.c; this.q = ''; $('nw-q').value = ''; $('nw-cats').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); this.load(true); });
    bindSearch('nw-q', () => { this.q = $('nw-q').value.trim(); $('nw-cats').querySelectorAll('button').forEach(x => x.classList.remove('on')); this.load(true); });
    this.load(true); clearInterval(this.timer); this.timer = setInterval(() => { if (!document.hidden && Sheet.isOpen('news')) this.load(false); }, 60000);
  },
  async load(show) {
    const out = $('nw-out'); if (!out) return; if (show) out.innerHTML = loadingHtml('Mengambil berita terbaru…');
    try {
      const j = await API.get('news', { cat: this.cat, q: this.q }, 25000); const fresh = new Set(this.items.map(i => i.link)); this.items = j.items; this.last = j.updated;
      $('nw-info').innerHTML = `Diperbarui ${new Date(j.updated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${j.sources} sumber · otomatis tiap 1 menit`; $('nw-live').firstElementChild.className = 'dot-ok'; $('nw-live').style.color = '#15803d'; $('nw-live').style.background = '#dcfce7';
      out.innerHTML = this.items.map((n, i) => `<button class="item" data-i="${i}" style="width:100%;text-align:left;margin-bottom:8px;align-items:flex-start">${n.img ? `<img class="th" style="width:84px;height:68px" src="${esc(n.img)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" alt=""/>` : ''}<div style="min-width:0;flex:1"><div class="t" style="-webkit-line-clamp:3">${!show && !fresh.has(n.link) && fresh.size ? '<span class="tag" style="background:#ef4444;margin-right:4px">BARU</span>' : ''}${esc(n.title)}</div><div class="s" style="margin-top:4px"><b>${esc(n.source)}</b> · ${n.ts ? timeAgo(n.ts) : ''}</div></div></button>`).join('');
      out.querySelectorAll('[data-i]').forEach(b => b.onclick = () => this.read(this.items[+b.dataset.i]));
    } catch (e) { $('nw-live').firstElementChild.className = 'dot-bad'; if (show || !this.items.length) { out.innerHTML = errHtml(e.message || 'Gagal memuat berita') + '<div style="text-align:center"><button class="btn" id="nw-r"><i class="fa-solid fa-rotate"></i> Coba lagi</button></div>'; $('nw-r').onclick = () => this.load(true); } }
  },
  async read(n) {
    Sheet.open({ id: 'reader', title: n.source || 'Artikel', icon: 'fa-book-open', grad: 'linear-gradient(135deg,#475569,#1e293b)', body: loadingHtml('Membuka artikel…') });
    const b = Sheet.$('reader');
    try { const a = await API.get('article', { url: n.link }, 25000); b.innerHTML = `${a.image ? `<img src="${esc(a.image)}" referrerpolicy="no-referrer" onerror="this.remove()" style="width:100%;border-radius:16px" alt=""/>` : ''}<h2 style="font-size:19px;font-weight:800;line-height:1.3;margin:0">${esc(a.title || n.title)}</h2><div class="muted" style="font-size:11px;font-weight:700">${esc(n.source)}</div><div class="selectable" style="display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:1.75;font-weight:500">${a.paragraphs.map(p => `<p style="margin:0">${esc(p)}</p>`).join('')}</div><a class="btn" target="_blank" rel="noopener" href="${esc(safeUrl(n.link))}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka sumber asli</a>`; }
    catch (e) { b.innerHTML = `<h2 style="font-size:18px;font-weight:800;margin:0">${esc(n.title)}</h2><div class="muted" style="font-size:12px;font-weight:600">${esc(n.source)} · ${n.ts ? timeAgo(n.ts) : ''}</div>${n.summary ? `<p style="font-size:14px;line-height:1.7">${esc(n.summary)}</p>` : ''}<div class="card" style="padding:12px;font-size:12px;font-weight:600">Isi lengkap artikel ini tidak bisa ditampilkan di dalam aplikasi (situs sumber membatasinya).</div><a class="btn btn-pri" target="_blank" rel="noopener" href="${esc(safeUrl(n.link))}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Baca di situs sumber</a>`; }
  }
};
Features.reg({ id: 'news', name: 'Berita', cat: 'info', icon: 'fa-newspaper', grad: 'linear-gradient(135deg,#7c3aed,#5b21b6)', open: () => News.open() });
