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
