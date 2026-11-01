/* v6 — "Waktu": warna beranda mengikuti waktu hari (fajar → malam), penggaris 24 jam, favorit & cuaca singkat. Tidak mengubah logika fitur. */
var Waktu = (function () {
  var NAMA = { fajar: 'Fajar', pagi: 'Pagi', siang: 'Siang', sore: 'Sore', senja: 'Senja', malam: 'Malam' };
  var HERO = { fajar: '#3C41A8', pagi: '#FFC53D', siang: '#27B4EC', sore: '#FF8F3F', senja: '#D9385F', malam: '#141A44' };
  var key = null;
  function mm(s) { var p = String(s || '').split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function times() {
    var t = window.Adzan && Adzan.times;
    if (t && t.subuh && t.dzuhur && t.ashar && t.maghrib && t.isya) return { sub: mm(t.subuh), dzu: mm(t.dzuhur), ash: mm(t.ashar), mag: mm(t.maghrib), isy: mm(t.isya) };
    return { sub: 270, dzu: 715, ash: 900, mag: 1085, isy: 1170 };
  }
  function part(m) {
    var t = times();
    if (m >= t.isy || m < t.sub) return 'malam';
    if (m < t.sub + 75) return 'fajar';
    if (m < t.dzu) return 'pagi';
    if (m < t.ash) return 'siang';
    if (m < t.mag) return 'sore';
    return 'senja';
  }
  function set(k) {
    if (k === key) return; key = k;
    document.documentElement.dataset.waktu = k;
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', HERO[k]);
  }
  function tick() {
    var n = new Date(), mins = n.getHours() * 60 + n.getMinutes();
    set(part(mins));
    var r = document.getElementById('ruler');
    if (r) r.style.setProperty('--p', ((mins + n.getSeconds() / 60) / 1440 * 100).toFixed(2));
    var ac = document.getElementById('auth-clock');
    if (ac) { ac.textContent = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); var ad = document.getElementById('auth-date'); if (ad) ad.textContent = n.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }); }
  }
  function marks() {
    var box = document.getElementById('rl-marks'); if (!box) return;
    var t = window.Adzan && Adzan.times;
    box.innerHTML = t ? ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'].map(function (k) { return t[k] ? '<i class="rl-m" style="--x:' + (mm(t[k]) / 1440 * 100).toFixed(2) + '"></i>' : ''; }).join('') : '';
    key = null; tick();
  }
  tick(); setInterval(tick, 15000);
  return { tick: tick, marks: marks, nama: NAMA, part: part };
})();

/* tekan: umpan balik sederhana (kelas .pressing), tanpa riak & getar */
(function () {
  var SEL = '.cell,.dock button,.tabs .chip';
  var cur = null;
  function release() { if (cur) { cur.classList.remove('pressing'); cur = null; } }
  document.addEventListener('pointerdown', function (e) {
    var t = e.target.closest && e.target.closest(SEL); if (!t) return;
    release(); cur = t; t.classList.add('pressing');
  }, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave', 'dragstart', 'scroll'].forEach(function (n) { document.addEventListener(n, release, { passive: true, capture: true }); });
})();

/* "Sering dibuka" — otomatis dari fitur yang paling sering dibuka */
(function () {
  var KEY = 'dimzz_v4_opens';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.cell[data-f]'); if (!t || t.closest('.fav')) return;
    var m = load(); m[t.dataset.f] = (m[t.dataset.f] || 0) + 1;
    try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (x) {}
  }, true);
  var busy = false;
  function render() {
    var box = document.getElementById('tiles');
    if (!box || busy || box.classList.contains('searching') || box.querySelector('.fav')) return;
    if (!box.querySelector('.grp')) return;
    var cat = document.querySelector('#cat-tabs .chip.on'); if (cat && cat.dataset.c !== 'semua') return;
    var m = load(), picks = [];
    Object.keys(m).filter(function (k) { return m[k] > 0; }).sort(function (a, b) { return m[b] - m[a]; }).forEach(function (id) {
      if (picks.length >= 4) return;
      var el = box.querySelector('.cell[data-f="' + id + '"]');
      if (el && !el.classList.contains('off')) picks.push(el);
    });
    if (!picks.length) return;
    busy = true;
    var sec = document.createElement('section'); sec.className = 'grp fav';
    sec.innerHTML = '<div class="grp-h"><h3>Sering dibuka</h3><span>' + picks.length + '</span></div><div class="cells"></div>';
    var g = sec.querySelector('.cells');
    picks.forEach(function (el) { var c = el.cloneNode(true); c.onclick = function () { try { Features.open(c.dataset.f); } catch (x) {} }; g.appendChild(c); });
    box.insertBefore(sec, box.firstChild);
    busy = false;
  }
  function start() {
    var box = document.getElementById('tiles'); if (!box) return setTimeout(start, 500);
    new MutationObserver(render).observe(box, { childList: true }); render();
  }
  start();
})();

/* cuaca singkat di samping nama (Open-Meteo, tanpa kunci API, memakai lokasi adzan) */
(function () {
  var KEY = 'dimzz_v4_wx';
  function icon(c) {
    if (c === 0) return '☀️'; if (c <= 2) return '⛅'; if (c === 3) return '☁️';
    if (c <= 48) return '🌫️'; if (c <= 57) return '🌦️'; if (c <= 67) return '🌧️';
    if (c <= 77) return '❄️'; if (c <= 82) return '🌧️'; if (c <= 86) return '❄️'; return '⛈️';
  }
  function show(w) {
    var row = document.getElementById('u-role'); if (!row || !row.parentNode) return;
    var el = document.getElementById('u-wx');
    if (!el) { el = document.createElement('span'); el.id = 'u-wx'; el.className = 'wx'; row.parentNode.appendChild(el); }
    el.textContent = icon(w.c) + ' ' + Math.round(w.t) + '°'; el.title = 'Cuaca saat ini';
  }
  function cached() { try { var w = JSON.parse(localStorage.getItem(KEY)); return w && Date.now() - w.at < 1800000 ? w : null; } catch (e) { return null; } }
  var tries = 0;
  function go() {
    var w = cached(); if (w) return show(w);
    var s; try { s = LS.get('adzan', {}); } catch (e) { s = {}; }
    if (s && s.lat != null && s.lng != null) {
      fetch('https://api.open-meteo.com/v1/forecast?latitude=' + s.lat + '&longitude=' + s.lng + '&current=temperature_2m,weather_code')
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j || !j.current) return; var d = { t: j.current.temperature_2m, c: j.current.weather_code, at: Date.now() }; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (x) {} show(d); }).catch(function () {});
    } else if (++tries < 15) setTimeout(go, 3000);
  }
  setTimeout(go, 2500); setInterval(function () { tries = 0; go(); }, 1800000);
})();
