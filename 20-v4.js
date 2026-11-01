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
