/* ==== 06-media.js — YouTube (cari, putar, unduh video/MP3) & Sholawatan (khusus audio) ==== */
const Yt = {
  items: [],
  open() {
    Sheet.open({ id: 'youtube', title: 'YouTube', icon: 'fa-brands fa-youtube'.replace('fa-brands ', ''), grad: 'linear-gradient(135deg,#ef4444,#b91c1c)', onClose: () => this.stopPlayer(), body: `${searchBar('yt-q', 'Cari video atau tempel link YouTube…')}<div id="yt-player" class="hidden"></div><div id="yt-out">${emptyHtml('fa-play', 'Cari video, atau tempel link YouTube untuk memutar & mengunduh (MP4 / MP3).')}</div>` });
    { const gi = $('sheet-youtube').querySelector('.gi i'); if (gi) gi.className = 'fa-brands fa-youtube'; }
    bindSearch('yt-q', () => this.search($('yt-q').value.trim()));
  },
  vid(u) { const m = String(u).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|music\.youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/); return m ? m[1] : (/^[\w-]{11}$/.test(u) ? u : null); },
  async search(q) {
    if (!q) return; const out = $('yt-out'), id = this.vid(q);
    if (id) { this.items = [{ id, title: 'Video YouTube', author: q.replace(/^https?:\/\//, '').slice(0, 30), duration: '', thumb: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` }]; fetchJSON('https://www.youtube.com/oembed?url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id) + '&format=json', {}, 6000).then(m => { this.items[0].title = m.title; this.items[0].author = m.author_name; this.render(); }).catch(() => {}); return this.render(); }
    out.innerHTML = loadingHtml('Mencari video…');
    try { this.items = (await API.get('yt', { a: 'search', q }, 30000)).items; this.render(); }
    catch (e) { try { ErrLog.push('YouTube cari: ' + (e.message || e), 'youtube'); } catch (x) {} out.innerHTML = errHtml('Pencarian YouTube sedang bermasalah. Coba lagi sebentar, atau cari langsung di YouTube.') + `<div class="row" style="justify-content:center"><button class="btn" id="yt-retry"><i class="fa-solid fa-rotate"></i> Coba lagi</button><a class="btn" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(q)}">Cari di YouTube</a></div>`; $('yt-retry').onclick = () => this.search(q); }
  },
  render() {
    const out = $('yt-out'); if (!this.items.length) return void (out.innerHTML = emptyHtml('fa-face-sad-tear', 'Video tidak ditemukan.'));
    out.innerHTML = this.items.map((v, i) => `<div class="card" style="margin-bottom:10px;overflow:hidden"><div style="position:relative;cursor:pointer" data-p="${i}"><img src="${esc(v.thumb)}" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block" loading="lazy" alt=""/>${v.duration ? `<span class="tag" style="position:absolute;right:8px;bottom:8px;background:rgba(0,0,0,.8)">${esc(v.duration)}</span>` : ''}<div style="position:absolute;inset:0;display:grid;place-items:center"><div style="width:54px;height:54px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;display:grid;place-items:center;font-size:20px"><i class="fa-solid fa-play"></i></div></div></div>
      <div style="padding:10px 12px"><div style="font-weight:800;font-size:13px;line-height:1.3">${esc(v.title)}</div><div class="muted" style="font-size:11px;font-weight:600;margin:3px 0 10px">${esc(v.author)}${v.views ? ' · ' + esc(v.views) : ''}${v.published ? ' · ' + esc(v.published) : ''}</div><div class="row"><button class="btn btn-sm btn-dark" data-p="${i}"><i class="fa-solid fa-play"></i> Putar</button><button class="btn btn-sm btn-pri" data-d="${i}"><i class="fa-solid fa-download"></i> Unduh MP4 / MP3</button><button class="btn btn-sm" data-a="${i}"><i class="fa-solid fa-headphones"></i></button></div></div></div>`).join('');
    out.querySelectorAll('[data-p]').forEach(b => b.onclick = () => this.play(this.items[+b.dataset.p]));
    out.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { const v = this.items[+b.dataset.d]; this.openDl(v.id, v.title); });
    out.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const v = this.items[+b.dataset.a]; Music.playList([{ id: v.id, title: v.title, artist: v.author, duration: v.duration, thumb: v.thumb }], 0); UI.toast('Diputar sebagai audio', 'ok'); });
  },
  play(v) {
    Sound.play('yt'); Sound.reg('yt', () => this.stopPlayer());
    const p = $('yt-player'); p.classList.remove('hidden');
    const origin = /^https?:/.test(location.protocol) ? '&origin=' + encodeURIComponent(location.origin) : '';
    p.innerHTML = `<div class="card" style="overflow:hidden;background:#000"><div style="position:relative;padding-bottom:56.25%"><iframe id="yt-frame2" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen src="https://www.youtube.com/embed/${v.id}?autoplay=1&playsinline=1&rel=0${origin}"></iframe></div><div class="row" style="padding:8px;gap:6px"><button class="btn btn-sm" id="yt-close"><i class="fa-solid fa-xmark"></i> Tutup</button><a class="btn btn-sm" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${v.id}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka di YouTube</a></div></div>`;
    $('yt-close').onclick = () => this.stopPlayer(); $('yt-player').scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  stopPlayer() { const p = $('yt-player'); if (p) { p.innerHTML = ''; p.classList.add('hidden'); } Sound.release('yt'); },
  async openDl(id, title) {
    const el = Sheet.open({ id: 'ytdl', title: 'Unduh dari YouTube', icon: 'fa-download', grad: 'linear-gradient(135deg,#ef4444,#b91c1c)', body: loadingHtml('Menyiapkan tautan unduhan… (bisa ±20 detik)') });
    try {
      const d = await API.get('yt', { a: 'dl', id }, 55000), body = Sheet.$('ytdl'), name = safeName(d.title || title || id);
      body.innerHTML = `<div class="item"><img class="th" style="width:84px;height:56px" src="${esc(d.thumb)}" alt=""/><div style="min-width:0"><div class="t">${esc(d.title || title)}</div><div class="s">${esc(d.author || '')}${d.duration ? ' · ' + fmtDur(d.duration) : ''}</div></div></div>
        <div class="sec-title" style="margin:6px 2px 0">Video (MP4)</div><div id="dl-v" class="row" style="flex-wrap:wrap"></div><div class="sec-title" style="margin:6px 2px 0">Audio</div><div id="dl-a" class="row" style="flex-wrap:wrap"></div>
        <div class="muted" style="font-size:11px;font-weight:600">Semua tautan sudah diperiksa server dan berisi berkas asli. Unduhan berjalan lewat browser/aplikasi, jadi bisa kamu pantau di notifikasi.</div>`;
      const v = d.formats.filter(f => f.kind === 'video'), a = d.formats.filter(f => f.kind === 'audio');
      $('dl-v').innerHTML = v.length ? mediaBtns(v) : '<span class="muted" style="font-size:12px">Tidak tersedia untuk video ini.</span>'; $('dl-a').innerHTML = a.length ? mediaBtns(a) : '<span class="muted" style="font-size:12px">Tidak tersedia.</span>';
      const bind = (box, files) => box.querySelectorAll('button[data-i]').forEach(b => b.onclick = () => { const f = files[+b.dataset.i]; saveFile(f.url, name + (f.kind === 'video' ? ' [' + f.label + ']' : '') + '.' + f.ext, b); });
      bind($('dl-v'), v); bind($('dl-a'), a);
    } catch (e) { Sheet.$('ytdl').innerHTML = errHtml(e.message || 'Gagal menyiapkan unduhan') + `<div class="row" style="justify-content:center"><button class="btn" id="dl-retry"><i class="fa-solid fa-rotate"></i> Coba lagi</button><a class="btn" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${id}">Buka di YouTube</a></div>`; $('dl-retry').onclick = () => { Sheet.close('ytdl'); this.openDl(id, title); }; }
  }
};
Features.reg({ id: 'youtube', name: 'YouTube', cat: 'media', icon: 'fa-play', grad: 'linear-gradient(135deg,#ef4444,#b91c1c)', open: () => Yt.open() });

/* ---------- Sholawatan: hanya audio, memakai pemutar musik (tanpa video YouTube) ---------- */
const SHOLAWAT_SETS = ['Sholawat Nariyah', 'Sholawat Badar', 'Ya Asyiqol Musthofa', 'Deen Assalam', 'Ya Maulana', 'Allahul Kafi', 'Ya Hanana', 'Habbitah', 'Sholawat Habib Syech', 'Sholawat Gus Azmi', 'Hadroh Maulid', 'Sholawat Ai Khodijah', 'Sholawat Sabyan', 'Qasidah'];
const Sholawat = {
  open() {
    Sheet.open({ id: 'sholawat', title: 'Sholawatan', icon: 'fa-hands-praying', grad: 'linear-gradient(135deg,#10b981,#047857)', body: `${searchBar('sh-q', 'Cari sholawat, qasidah, atau pelantun…')}<div class="h-scroll">${SHOLAWAT_SETS.map(s => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div><div class="muted" style="font-size:11px;font-weight:600"><i class="fa-solid fa-headphones"></i> Hanya audio — tidak membuka video. Lagu terus berjalan di pemutar mini.</div><div id="sh-out">${loadingHtml('Memuat pilihan sholawat…')}</div>` });
    bindSearch('sh-q', () => this.search($('sh-q').value.trim()));
    $('sheet-sholawat').querySelectorAll('[data-s]').forEach(c => c.onclick = () => { $('sh-q').value = c.dataset.s; this.search(c.dataset.s); });
    this.search('Sholawat Nariyah');
  },
  async search(q) {
    if (!q) return; const out = $('sh-out'); out.innerHTML = loadingHtml('Mencari…'); const query = /sholawat|shalawat|qasidah|hadroh|maulid|nasheed/i.test(q) ? q : 'sholawat ' + q;
    let items = [];
    try { items = (await API.get('yt', { a: 'music', q: query }, 30000)).items.filter(t => t.seconds === 0 || t.seconds < 3600); } catch (e) { ErrLog.push(e.message, 'sholawat'); }
    if (!items.length) { try { items = await this.archive(query); } catch (e) {} }
    if (!items.length) return void (out.innerHTML = errHtml('Sholawat tidak bisa dimuat sekarang. Coba lagi sebentar.'));
    Music.init(); out.innerHTML = '<div id="sh-list"></div>'; Music.renderList($('sh-list'), items);
  },
  // cadangan non-YouTube: arsip audio publik archive.org
  async archive(q) {
    const j = await fetchJSON(`https://archive.org/advancedsearch.php?q=${encodeURIComponent('(' + q + ') AND mediatype:audio')}&fl[]=identifier&fl[]=title&fl[]=creator&rows=8&output=json`, {}, 10000);
    const docs = (j.response && j.response.docs) || []; const out = [];
    for (const d of docs.slice(0, 5)) { try { const m = await fetchJSON('https://archive.org/metadata/' + d.identifier, {}, 8000); (m.files || []).filter(f => /\.mp3$/i.test(f.name)).slice(0, 4).forEach(f => out.push({ id: d.identifier + '/' + f.name, title: f.title || f.name.replace(/\.mp3$/i, ''), artist: [].concat(d.creator || m.metadata && m.metadata.creator || 'Arsip').join(', '), duration: '', seconds: Math.round(+f.length || 0), kind: 'Lagu', thumb: 'https://archive.org/services/img/' + d.identifier, url: `https://archive.org/download/${d.identifier}/${encodeURIComponent(f.name)}` })); } catch (e) {} }
    return out;
  }
};
Features.reg({ id: 'sholawat', name: 'Sholawatan', cat: 'islami', icon: 'fa-hands-praying', grad: 'linear-gradient(135deg,#10b981,#047857)', open: () => Sholawat.open() });
