/* v4.0 — "Langit Senja": menandai waktu hari agar langit hero & latar berubah warna. Tidak mengubah logika fitur. */
(function () {
  function sky() {
    var d = new Date(), h = d.getHours() + d.getMinutes() / 60, s;
    if (h >= 4 && h < 6) s = 'subuh';
    else if (h >= 6 && h < 10) s = 'pagi';
    else if (h >= 10 && h < 15) s = 'siang';
    else if (h >= 15 && h < 17.5) s = 'sore';
    else if (h >= 17.5 && h < 19) s = 'maghrib';
    else s = 'malam';
    if (document.documentElement.dataset.sky !== s) document.documentElement.dataset.sky = s;
    var m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', s === 'malam' ? '#0b0e26' : '#12163a');
  }
  sky();
  setInterval(sky, 60000);
})();

/* v4.1 — sentuhan hidup: efek tekan, riak warna fitur, ikon memantul, getar halus */
(function () {
  var SEL = '.tile,.feat-card,.dock button,.tabs .chip';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = null;
  function release() {
    if (!cur) return;
    var t = cur; cur = null;
    t.classList.remove('pressing');
    if (calm) return;
    t.classList.add('popped');
    setTimeout(function () { t.classList.remove('popped'); }, 520);
  }
  document.addEventListener('pointerdown', function (e) {
    var t = e.target.closest && e.target.closest(SEL);
    if (!t) return;
    release();
    cur = t;
    t.classList.add('pressing');
    if (!calm) {
      var r = t.getBoundingClientRect(), d = document.createElement('i');
      d.className = 'rip';
      d.style.left = (e.clientX - r.left) + 'px';
      d.style.top = (e.clientY - r.top) + 'px';
      t.appendChild(d);
      setTimeout(function () { d.remove(); }, 700);
      try { if (navigator.vibrate && e.pointerType !== 'mouse') navigator.vibrate(8); } catch (x) {}
    }
  }, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave', 'dragstart', 'scroll'].forEach(function (n) {
    document.addEventListener(n, release, { passive: true, capture: true });
  });
})();

/* v4.2 — "Sering dibuka" (otomatis dari fitur yang paling sering kamu buka) */
(function () {
  var KEY = 'dimzz_v4_opens';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.tile[data-f]');
    if (!t) return;
    var m = load(); m[t.dataset.f] = (m[t.dataset.f] || 0) + 1;
    try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (x) {}
  }, true);
  var busy = false;
  function render() {
    var box = document.getElementById('tiles');
    if (!box || busy || box.classList.contains('searching')) return;
    var grid = box.querySelector('.tile-grid');
    if (!grid || !box.querySelector('.sec-title') || box.querySelector('.fav-row')) return;
    var m = load();
    var top = Object.keys(m).filter(function (k) { return m[k] > 0; }).sort(function (a, b) { return m[b] - m[a]; });
    var picks = [];
    top.forEach(function (id) {
      if (picks.length >= 3) return;
      var el = grid.querySelector('.tile[data-f="' + id + '"]');
      if (el && !el.classList.contains('off')) picks.push(el);
    });
    if (!picks.length) return;
    busy = true;
    var row = document.createElement('div');
    row.className = 'fav-row';
    row.innerHTML = '<div class="sec-title"><i class="fa-solid fa-bolt"></i>Sering dibuka</div><div class="tile-grid fav"></div>';
    var g = row.querySelector('.tile-grid');
    picks.forEach(function (el) {
      var c = el.cloneNode(true);
      c.onclick = function () { try { Features.open(c.dataset.f); } catch (x) {} };
      g.appendChild(c);
    });
    box.insertBefore(row, box.firstChild);
    busy = false;
  }
  function start() {
    var box = document.getElementById('tiles');
    if (!box) return setTimeout(start, 500);
    new MutationObserver(render).observe(box, { childList: true });
    render();
  }
  start();
})();

/* v4.2 — cuaca singkat di samping nama (Open-Meteo, tanpa kunci API, memakai lokasi adzan) */
(function () {
  var KEY = 'dimzz_v4_wx';
  function icon(c) {
    if (c === 0) return '☀️'; if (c <= 2) return '⛅'; if (c === 3) return '☁️';
    if (c <= 48) return '🌫️'; if (c <= 57) return '🌦️'; if (c <= 67) return '🌧️';
    if (c <= 77) return '❄️'; if (c <= 82) return '🌧️'; if (c <= 86) return '❄️'; return '⛈️';
  }
  function show(w) {
    var row = document.getElementById('u-role');
    if (!row || !row.parentNode) return;
    var el = document.getElementById('u-wx');
    if (!el) { el = document.createElement('span'); el.id = 'u-wx'; el.className = 'wx'; row.parentNode.appendChild(el); }
    el.textContent = icon(w.c) + ' ' + Math.round(w.t) + '°';
    el.title = 'Cuaca saat ini';
  }
  function cached() { try { var w = JSON.parse(localStorage.getItem(KEY)); return w && Date.now() - w.at < 1800000 ? w : null; } catch (e) { return null; } }
  var tries = 0;
  function go() {
    var w = cached();
    if (w) return show(w);
    var s; try { s = LS.get('adzan', {}); } catch (e) { s = {}; }
    if (s && s.lat != null && s.lng != null) {
      fetch('https://api.open-meteo.com/v1/forecast?latitude=' + s.lat + '&longitude=' + s.lng + '&current=temperature_2m,weather_code')
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.current) return;
          var d = { t: j.current.temperature_2m, c: j.current.weather_code, at: Date.now() };
          try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (x) {}
          show(d);
        }).catch(function () {});
    } else if (++tries < 15) setTimeout(go, 3000);
  }
  setTimeout(go, 2500);
  setInterval(function () { tries = 0; go(); }, 1800000);
})();

/* v4.3 — bintang jatuh di latar dasbor */
(function () {
  function add() {
    var bg = document.querySelector('.cyberbg');
    if (!bg) return setTimeout(add, 600);
    if (bg.querySelector('.meteor')) return;
    [['12%', '0s'], ['46%', '3.2s'], ['78%', '5.6s']].forEach(function (p) {
      var m = document.createElement('i');
      m.className = 'meteor';
      m.style.setProperty('--x', p[0]);
      m.style.setProperty('--d', p[1]);
      bg.appendChild(m);
    });
  }
  add();
})();
