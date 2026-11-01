/* ============================================================
   KONFIGURASI — semua OPSIONAL kecuali Firebase (sudah terisi).
   API_BASE : kosong = server yang sama dengan web ini (Vercel).
              Saat dijadikan APK (file lokal), isi dengan alamat Vercel-mu, contoh 'https://alltools-six.vercel.app'
   ============================================================ */
const CONFIG = {
  VERSION: '4.4.0',
  API_BASE: '',
  ADMIN_WA: '6281563426001',
  ASSETS: {
    LOGIN_VIDEO: 'https://files.catbox.moe/hnfdro.mp4',
    INTRO_VIDEO: 'https://files.catbox.moe/bm9jqf.mp4',
    BGM: 'https://files.catbox.moe/r4yjpe.mp3',
    ADZAN: ['https://cdn.aladhan.com/audio/adhans/a1.mp3', 'https://www.islamcan.com/audio/adhan/azan1.mp3', 'https://files.catbox.moe/mh6pyz.mpeg'],
    DEFAULT_WALLPAPER_VIDEO: 'https://files.catbox.moe/m5x2pf.mp4'
  },
  FIREBASE: {
    apiKey: 'AIzaSyDOyh8RYoRH3cnrM0TxgG2SNu6_oZPylmc',
    authDomain: 'dimzzproject-40f14.firebaseapp.com',
    projectId: 'dimzzproject-40f14',
    storageBucket: 'dimzzproject-40f14.firebasestorage.app',
    messagingSenderId: '1044798503810',
    appId: '1:1044798503810:web:d27296afef813bd6b4ad9b',
    databaseURL: 'https://dimzzproject-40f14-default-rtdb.firebaseio.com',
    devUsername: 'dimzz'   // identitas username Developer yang sudah diberi role tepercaya; pendaftaran tidak memberi role otomatis
  }
};
