/* ==== 04-adzan.js — jadwal sholat otomatis (GPS), alarm adzan, pengaturan ==== */
const PRAYERS = [['subuh', 'Subuh', 'Fajr'], ['dzuhur', 'Dzuhur', 'Dhuhr'], ['ashar', 'Ashar', 'Asr'], ['maghrib', 'Maghrib', 'Maghrib'], ['isya', 'Isya', 'Isha']];
const CITIES = { 'Jakarta': [-6.2088, 106.8456], 'Bandung': [-6.9175, 107.6191], 'Surabaya': [-7.2575, 112.7521], 'Semarang': [-6.9667, 110.4167], 'Yogyakarta': [-7.7956, 110.3695], 'Medan': [3.5952, 98.6722], 'Palembang': [-2.9761, 104.7754], 'Makassar': [-5.1477, 119.4327], 'Denpasar': [-8.65, 115.2167], 'Sukabumi': [-6.9277, 106.93], 'Balikpapan': [-1.2379, 116.8529], 'Pontianak': [-0.0263, 109.3425], 'Banda Aceh': [5.5483, 95.3238], 'Jayapura': [-2.5337, 140.7181] };
const METHODS = [[20, 'Kemenag RI (Indonesia)'], [3, 'Muslim World League'], [2, 'ISNA'], [4, 'Umm al-Qura (Makkah)'], [5, 'Egyptian General Authority'], [11, 'MUIS (Singapura)'], [17, 'JAKIM (Malaysia)']];

const Adzan = {
  s: null, times: null, date: '', fired: {}, ringing: false, silent: null,
  load() { this.s = LS.get('adzan', { lat: null, lng: null, city: '', method: 20, on: true, vib: true }); },
  save() { LS.set('adzan', this.s); },

  async init() {
    this.load(); this.renderGrid();
    if (this.s.lat === null) await this.askLocation(true); else this.refresh();
    this.armKeepAlive(); this.updateAlarmUi();
    try { if ('Notification' in window && Notification.permission === 'default' && this.s.on) setTimeout(() => Notification.requestPermission().catch(() => {}), 4000); } catch (e) {}
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { this.tick(); if (this.date !== this.today()) this.refresh(); } });
  },
  today() { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; },

  /* ----- lokasi otomatis ----- */
  async askLocation(first) {
    if (first && !LS.get('loc_explained')) {
      LS.set('loc_explained', 1);
      const ok = await UI.confirm('Izinkan akses lokasi?', 'Lokasi dipakai agar jadwal adzan sesuai wilayahmu secara otomatis — tanpa perlu atur kota manual. Lokasi hanya disimpan di perangkat ini.', { ok: 'Izinkan', cancel: 'Nanti saja', icon: 'fa-location-dot' });
      if (!ok) { await this.byIp(true); return; }
    }
    return this.detect();
  },
  detect() {
    return new Promise(res => {
      if (!navigator.geolocation) { this.byIp().then(res); return; }
      navigator.geolocation.getCurrentPosition(async p => { this.s.lat = +p.coords.latitude.toFixed(4); this.s.lng = +p.coords.longitude.toFixed(4); this.s.auto = true; this.s.city = await this.reverse(this.s.lat, this.s.lng); this.save(); UI.toast('Lokasi terdeteksi: ' + (this.s.city || 'OK'), 'ok'); await this.refresh(); res(true); },
        async err => { UI.toast(err.code === 1 ? 'Izin lokasi ditolak — memakai perkiraan dari jaringan' : 'GPS tidak tersedia — memakai perkiraan dari jaringan', 'warn'); await this.byIp(); res(false); },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
    });
  },
  async byIp(silent) {
    try { const j = await fetchJSON('https://get.geojs.io/v1/ip/geo.json', {}, 7000); this.s.lat = +(+j.latitude).toFixed(3); this.s.lng = +(+j.longitude).toFixed(3); this.s.city = j.city || j.region || 'Perkiraan'; this.s.auto = false; }
    catch (e) { this.s.lat = CITIES.Jakarta[0]; this.s.lng = CITIES.Jakarta[1]; this.s.city = 'Jakarta'; }
    this.save(); if (!silent) UI.toast('Lokasi perkiraan: ' + this.s.city, 'info'); await this.refresh();
  },
  async reverse(lat, lng) {
    try { const j = await fetchJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=id`, {}, 7000); return j.city || j.locality || j.principalSubdivision || ''; } catch (e) {}
    try { const j = await fetchJSON(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=id`, {}, 7000); const a = j.address || {}; return a.city || a.county || a.town || a.state || ''; } catch (e) { return ''; }
  },

  /* ----- jadwal ----- */
  async refresh() {
    if (this.s.lat === null) return;
    const d = this.today(), ck = LS.get('adzan_cache', null);
    if (ck && ck.d === d && ck.lat === this.s.lat && ck.lng === this.s.lng && ck.m === this.s.method) this.times = ck.t;
    else {
      try {
        const j = await fetchJSON(`https://api.aladhan.com/v1/timings/${d}?latitude=${this.s.lat}&longitude=${this.s.lng}&method=${this.s.method}`, {}, 12000);
        const t = j.data.timings, h = x => String(x).slice(0, 5);
        this.times = {}; PRAYERS.forEach(([k, , a]) => this.times[k] = h(t[a]));
        LS.set('adzan_cache', { d, lat: this.s.lat, lng: this.s.lng, m: this.s.method, t: this.times });
      } catch (e) { if (ck) this.times = ck.t; else { $('next-line').textContent = 'Jadwal sholat belum bisa dimuat. Periksa internet.'; return; } }
    }
    this.date = d; this.renderGrid(); this.tick(); this.scheduleNative();
    $('loc-name').textContent = this.s.city || 'Lokasi';
  },
  renderGrid() {
    $('loc-name').textContent = (this.s && this.s.city) || 'Atur lokasi';
    $('pray-grid').innerHTML = PRAYERS.map(([k, n]) => `<div class="pray" id="pr-${k}"><small>${n}</small><b>${(this.times && this.times[k]) || '--:--'}</b></div>`).join('');
  },
  nextPrayer() {
    if (!this.times) return null; const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
    for (const [k, n] of PRAYERS) { const [h, m] = this.times[k].split(':').map(Number); if (h * 60 + m > nm) return { k, n, mins: h * 60 + m - nm - 1, secs: 59 - now.getSeconds() }; }
    const [h, m] = this.times.subuh.split(':').map(Number); return { k: 'subuh', n: 'Subuh', mins: 1440 - nm + h * 60 + m - 1, secs: 59 - now.getSeconds(), tomorrow: true };
  },
  tick() {
    if (!this.times) return;
    const nx = this.nextPrayer(); if (nx) {
      const h = Math.floor(nx.mins / 60), m = nx.mins % 60;
      $('next-line').innerHTML = `Menuju <b>${nx.n}</b> ${nx.tomorrow ? '(besok) ' : ''}— <b>${h ? h + ' jam ' : ''}${m} mnt ${String(nx.secs).padStart(2, '0')} dtk</b>`;
      PRAYERS.forEach(([k]) => { const e = $('pr-' + k); if (e) e.classList.toggle('next', k === nx.k); });
    }
    if (this.date && this.date !== this.today()) this.refresh();
    if (!this.s.on) return;
    const now = new Date(), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    PRAYERS.forEach(([k, n]) => { const key = this.today() + k; if (this.times[k] === hm && !this.fired[key]) { this.fired[key] = 1; this.ring(n); } });
  },

  /* ----- alarm ----- */
  updateAlarmUi() { const on = this.s.on; $('alarm-label').textContent = on ? 'Alarm adzan aktif' : 'Alarm adzan mati'; $('alarm-btn').firstElementChild.className = 'fa-solid ' + (on ? 'fa-bell' : 'fa-bell-slash'); $('alarm-btn').style.background = on ? 'linear-gradient(135deg,#34d399,#10b981)' : 'rgba(255,255,255,.14)'; $('alarm-btn').style.color = on ? '#022c22' : '#fff'; },
  async toggle() {
    this.s.on = !this.s.on; this.save(); this.updateAlarmUi();
    if (this.s.on) { this.armKeepAlive(true); try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) {} this.scheduleNative(); UI.toast('Alarm adzan aktif — akan berbunyi otomatis saat waktunya', 'ok'); }
    else { this.stopKeepAlive(); UI.toast('Alarm adzan dimatikan', 'info'); }
  },
  sources() { return CONFIG.ASSETS.ADZAN; },
  playSound() {
    const a = $('a-adzan'), srcs = this.sources(); let i = 0;
    Sound.play('adzan'); Sound.reg('adzan', () => { try { a.pause(); } catch (e) {} });
    const next = () => { if (i >= srcs.length) { try { speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance('Waktunya sholat'), { lang: 'id-ID' })); } catch (e) {} return; } a.src = srcs[i++]; a.play().catch(next); };
    a.onerror = next; a.onended = () => { this.stopRing(); }; next();
  },
  ring(name, test) {
    if (this.ringing) return; this.ringing = true;
    this.playSound();
    try { if (this.s.vib && navigator.vibrate) navigator.vibrate([600, 300, 600, 300, 900]); } catch (e) {}
    try { if (Notification.permission === 'granted') new Notification('Waktunya sholat ' + name, { body: 'Adzan sedang berkumandang.', tag: 'adzan', requireInteraction: true }); } catch (e) {}
    const o = document.createElement('div'); o.id = 'ring'; o.style.cssText = 'position:fixed;inset:0;z-index:9900;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#065f46,#022c22 70%);color:#fff;text-align:center;padding:24px;animation:fadein .3s both';
    o.innerHTML = `<div><div style="width:110px;height:110px;margin:0 auto 20px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center;font-size:48px;animation:spin 2.4s ease-in-out infinite alternate"><i class="fa-solid fa-mosque"></i></div><div style="font-size:13px;font-weight:700;opacity:.8">${test ? 'UJI COBA ALARM' : 'WAKTUNYA ADZAN'}</div><h1 style="font-size:40px;font-weight:800;margin:6px 0">${esc(name)}</h1><div style="opacity:.8;font-weight:600;margin-bottom:26px">${esc(this.s.city || '')} · ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div><button class="btn btn-acc" id="ring-stop" style="padding:1rem 2.4rem;font-size:15px"><i class="fa-solid fa-bell-slash"></i> Hentikan adzan</button></div>`;
    document.body.appendChild(o); $('ring-stop').onclick = () => this.stopRing();
  },
  stopRing() { const a = $('a-adzan'); try { a.pause(); a.currentTime = 0; } catch (e) {} const o = $('ring'); if (o) o.remove(); if (navigator.vibrate) navigator.vibrate(0); this.ringing = false; Sound.release('adzan'); },

  /* Audio senyap agar browser tidak "membekukan" halaman saat layar mati (di APK diganti notifikasi terjadwal) */
  armKeepAlive(now) {
    if (!this.s.on) return;
    const go = () => { if (!this.silent) { const sr = 8000, n = sr * 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }; w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true); for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, i % 2 ? 1 : -1, true); this.silent = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))); this.silent.loop = true; this.silent.volume = 0.01; } this.silent.play().catch(() => {}); };
    if (now) go(); else document.addEventListener('pointerdown', go, { once: true, capture: true });
  },
  stopKeepAlive() { if (this.silent) this.silent.pause(); },

  /* Jadwal alarm native (APK Capacitor): notifikasi terjadwal berbunyi walau aplikasi ditutup */
  async scheduleNative() {
    const LN = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications; if (!LN || !this.s.on || this.s.lat === null) return;
    try {
      const p = await LN.requestPermissions(); if (p.display !== 'granted') return;
      try { await LN.createChannel({ id: 'adzan', name: 'Adzan', description: 'Alarm waktu sholat', importance: 5, sound: 'adzan', vibration: true, visibility: 1 }); } catch (e) {}
      const pend = await LN.getPending(); if (pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications });
      const now = new Date(), list = []; let id = 1;
      for (let d = 0; d < 7; d++) {
        const dt = new Date(now.getTime() + d * 864e5), ds = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
        let t; if (d === 0) t = this.times; else { try { const j = await fetchJSON(`https://api.aladhan.com/v1/timings/${ds}?latitude=${this.s.lat}&longitude=${this.s.lng}&method=${this.s.method}`, {}, 10000); t = {}; PRAYERS.forEach(([k, , a]) => t[k] = String(j.data.timings[a]).slice(0, 5)); } catch (e) { continue; } }
        PRAYERS.forEach(([k, n]) => { const [h, m] = t[k].split(':').map(Number), at = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), h, m, 0); if (at > now) list.push({ id: id++, title: 'Waktunya sholat ' + n, body: (this.s.city || '') + ' · ' + t[k], schedule: { at, allowWhileIdle: true }, channelId: 'adzan', sound: 'adzan' }); });
      }
      if (list.length) await LN.schedule({ notifications: list });
    } catch (e) { ErrLog.push(e.message, 'native-alarm'); }
  },

  /* ----- halaman pengaturan ----- */
  open() {
    this.load(); const s = this.s;
    Sheet.open({ id: 'adzan', title: 'Adzan & Lokasi', icon: 'fa-mosque', grad: 'linear-gradient(135deg,#059669,#047857)', body: `
      <div class="card" style="padding:14px"><div class="row" style="justify-content:space-between"><div><div class="muted" style="font-size:11px;font-weight:800">LOKASI SAAT INI</div><b id="ad-city" style="font-size:17px">${esc(s.city || 'Belum diatur')}</b><div class="muted" style="font-size:11px;font-weight:600" id="ad-coord">${s.lat !== null ? s.lat + ', ' + s.lng : ''} ${s.auto ? '· GPS' : s.lat !== null ? '· perkiraan/manual' : ''}</div></div><button class="btn btn-pri" id="ad-detect"><i class="fa-solid fa-location-crosshairs"></i> Deteksi otomatis</button></div></div>
      <div class="card" style="padding:14px"><div style="font-weight:800;font-size:12px;margin-bottom:8px">Atau cari kota</div>${searchBar('ad-q', 'Ketik nama kota…')}<div id="ad-res" style="margin-top:8px" class="h-scroll">${Object.keys(CITIES).map(c => `<button class="chip" data-city="${c}">${c}</button>`).join('')}</div></div>
      <div class="card" style="padding:14px"><div style="font-weight:800;font-size:12px;margin-bottom:8px">Metode perhitungan</div><select id="ad-m" class="inp">${METHODS.map(([k, n]) => `<option value="${k}" ${k === s.method ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="card" style="padding:6px 14px"><div class="kv" style="align-items:center"><span><b>Alarm adzan otomatis</b><br><small class="muted">Berbunyi sendiri saat waktu sholat tiba</small></span><button class="switch ${s.on ? 'on' : ''}" id="ad-on"></button></div><div class="kv" style="align-items:center"><span><b>Getar</b></span><button class="switch ${s.vib ? 'on' : ''}" id="ad-vib"></button></div></div>
      <button class="btn" id="ad-test"><i class="fa-solid fa-volume-high"></i> Uji coba alarm</button>
      <div class="card" style="padding:12px;font-size:11.5px;font-weight:600;line-height:1.6" id="ad-note">${window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() ? '<i class="fa-solid fa-circle-check" style="color:#16a34a"></i> Mode aplikasi: alarm dijadwalkan di sistem Android dan tetap berbunyi walau aplikasi ditutup.' : '<i class="fa-solid fa-circle-info" style="color:#4f46e5"></i> Di browser, alarm berbunyi selama tab/aplikasi ini masih terbuka (boleh layar terkunci, jangan ditutup). Setelah dijadikan APK, alarm berbunyi otomatis walau aplikasi ditutup.'}</div>`,
      onOpen: el => {
        const setCity = (name, lat, lng) => { this.s.city = name; this.s.lat = lat; this.s.lng = lng; this.s.auto = false; this.save(); $('ad-city').textContent = name; $('ad-coord').textContent = lat + ', ' + lng + ' · manual'; this.refresh(); UI.toast('Lokasi: ' + name, 'ok'); };
        $('ad-detect').onclick = async () => { await this.detect(); $('ad-city').textContent = this.s.city || ''; $('ad-coord').textContent = this.s.lat + ', ' + this.s.lng + (this.s.auto ? ' · GPS' : ''); };
        el.querySelectorAll('[data-city]').forEach(b => b.onclick = () => setCity(b.dataset.city, ...CITIES[b.dataset.city]));
        bindSearch('ad-q', async () => { const q = $('ad-q').value.trim(); if (!q) return; $('ad-res').innerHTML = loadingHtml('Mencari…'); try { const g = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=id`, {}, 9000); const r = g.results || []; $('ad-res').innerHTML = r.length ? r.map((p, i) => `<button class="chip" data-i="${i}">${esc(p.name)}, ${esc(p.admin1 || p.country || '')}</button>`).join('') : '<span class="muted" style="font-size:12px">Kota tidak ditemukan</span>'; $('ad-res').querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const p = r[+b.dataset.i]; setCity(p.name, +p.latitude.toFixed(4), +p.longitude.toFixed(4)); }); } catch (e) { $('ad-res').innerHTML = errHtml('Gagal mencari kota'); } });
        $('ad-m').onchange = e => { this.s.method = +e.target.value; this.save(); LS.del('adzan_cache'); this.refresh(); };
        $('ad-on').onclick = e => { this.toggle(); e.currentTarget.classList.toggle('on', this.s.on); };
        $('ad-vib').onclick = e => { this.s.vib = !this.s.vib; this.save(); e.currentTarget.classList.toggle('on', this.s.vib); };
        $('ad-test').onclick = () => { Sheet.close('adzan'); setTimeout(() => this.ring('Uji coba', true), 250); };
      } });
  }
};
Features.reg({ id: 'adzan', name: 'Adzan', cat: 'islami', icon: 'fa-mosque', grad: 'linear-gradient(135deg,#059669,#047857)', open: () => Adzan.open() });
