/* ==== 19-icons.js — set ikon fitur buatan sendiri (SVG garis + isian duotone), menggantikan ikon bawaan Font Awesome pada kartu fitur ==== */
const Ico = (() => {
  const F = 'fill="currentColor" fill-opacity=".22"';
  const P = {
    adzan: `<path d="M6 20v-6.2C6 10.7 8.7 9 12 9s6 1.7 6 4.8V20" ${F}/><path d="M12 9V6.7M13.4 4.6a1.5 1.5 0 1 1-1.9-1.5 1.2 1.2 0 0 0 1.9 1.5z"/><path d="M3.5 20v-8.5M20.5 20v-8.5M2.6 11.5h1.8M19.6 11.5h1.8M2 20h20M10 20v-2.6a2 2 0 0 1 4 0V20"/>`,
    music: `<path d="M4.5 14.5v-2.2a7.5 7.5 0 0 1 15 0v2.2"/><rect x="3.8" y="14" width="4.4" height="6.5" rx="2" ${F}/><rect x="15.8" y="14" width="4.4" height="6.5" rx="2" ${F}/>`,
    youtube: `<rect x="2.8" y="5.8" width="18.4" height="12.4" rx="4" ${F}/><path d="M10.2 9.4v5.2l4.6-2.6z" fill="currentColor"/>`,
    sholawat: `<path d="M15.8 4.2A8 8 0 1 0 19.8 17 6.6 6.6 0 0 1 15.8 4.2z" ${F}/><path d="M18.6 3.6v3M17.1 5.1h3M20.3 9.2v1.6M19.5 10h1.6"/>`,
    quran: `<path d="M12 6.8C10 5.2 7 4.9 3.8 5.4v12.2c3.2-.5 6.2-.2 8.2 1.4 2-1.6 5-1.9 8.2-1.4V5.4C17 4.9 14 5.2 12 6.8z" ${F}/><path d="M12 6.8V19"/><path d="M7.6 9.6l.6 1.2 1.3.2-.9.9.2 1.3-1.2-.6-1.2.6.2-1.3-.9-.9 1.3-.2z"/>`,
    news: `<rect x="4" y="4.5" width="16" height="15" rx="3" ${F}/><path d="M7.5 8.5h5v4h-5zM15 8.5h2M15 11.5h2M7.5 15.5h9.5"/>`,
    photos: `<rect x="3.5" y="4" width="17" height="16" rx="3.5" ${F}/><circle cx="9" cy="9.5" r="1.7"/><path d="M4 17l4.8-4.6 3.6 3.2 2.7-2.5L20 16.8"/>`,
    wallpaper: `<rect x="6" y="3" width="12" height="18" rx="3" ${F}/><circle cx="14.6" cy="8" r="1.4"/><path d="M6.4 16.6l3.6-3.8 2.5 2.4 2.1-1.8 3 3.1"/>`,
    camera: `<path d="M4 9a2 2 0 0 1 2-2h1.5l1.3-2h6.4l1.3 2H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" ${F}/><circle cx="12" cy="13" r="3.3"/><path d="M16.8 10h.01"/>`,
    ai: `<path d="M11 3.5c.7 4.5 2.8 6.6 7.3 7.3-4.5.7-6.6 2.8-7.3 7.3-.7-4.5-2.8-6.6-7.3-7.3C8.2 10.1 10.3 8 11 3.5z" ${F}/><path d="M18.5 3.3v3.4M16.8 5h3.4M18.2 16.8v3.4M16.5 18.5h3.4"/>`,
    translate: `<path d="M3.5 6.5h9M8 4.3v2.2M5.3 6.5c.6 3 2.7 5.4 6 6.8M11.2 6.5c-.7 3-3.2 5.6-6.9 7.1"/><path d="M12.8 20l3.7-9 3.7 9M14.1 17h4.8" ${F}/>`,
    lyrics: `<rect x="9" y="3.5" width="6" height="10.5" rx="3" ${F}/><path d="M6 11.5a6 6 0 0 0 12 0M12 17.5v3M9 20.5h6"/>`,
    weather: `<circle cx="8.5" cy="8.5" r="3" ${F}/><path d="M8.5 2.8v1.1M3 8.5h1.1M4.6 4.6l.8.8M12.4 4.6l-.8.8"/><path d="M8.5 19.5h8.8a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.4 1.1 3 3 0 0 0 .3 5.9z" ${F}/>`,
    calc: `<rect x="5" y="3" width="14" height="18" rx="3.2" ${F}/><rect x="8" y="6" width="8" height="3.6" rx="1"/><path d="M9 13.4h.01M12 13.4h.01M15 13.4h.01M9 17h.01M12 17h.01M15 17h.01" stroke-width="2.2"/>`,
    currency: `<circle cx="12" cy="12" r="3.2" ${F}/><path d="M5 8.5h11.5l-2.8-2.8M19 15.5H7.5l2.8 2.8"/>`,
    bmkg: `<path d="M2.5 12h4l2-5.5 3.4 11 2.6-8 1.4 2.5h5.7"/><path d="M4 20.5h16" ${F}/>`,
    links: `<path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1 1"/><path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1-1" ${F}/>`,
    downloader: `<rect x="4" y="14.5" width="16" height="5.5" rx="2.2" ${F}/><path d="M12 4v10M7.8 10.2L12 14.4l4.2-4.2"/>`,
    stalk: `<circle cx="9.5" cy="8.5" r="3.2" ${F}/><path d="M3.8 19c.6-3.2 2.8-4.8 5.7-4.8"/><circle cx="16.2" cy="15.6" r="3.3"/><path d="M18.6 18l2.5 2.5"/>`,
    osint: `<circle cx="10.5" cy="10.5" r="6.6" ${F}/><path d="M15.4 15.4l5 5M8 12.7v-2M10.5 12.7V8.4M13 12.7v-3.4"/>`,
    anime: `<rect x="3" y="7" width="18" height="12.5" rx="3.2" ${F}/><path d="M8.5 3.6L12 7l3.5-3.4M10.4 10.6v5l4.2-2.5z" />`,
    manga: `<rect x="5" y="3.5" width="14" height="17" rx="2.8" ${F}/><path d="M5 12h14M12 3.5V12M8.5 16.2h7"/>`,
    dev: `<path d="M12 3.2l7 2.6v5.4c0 4.4-3 7.8-7 9.6-4-1.8-7-5.2-7-9.6V5.8z" ${F}/><path d="M10 9.6l-1.8 2L10 13.6M14 9.6l1.8 2-1.8 2"/>`,
    chat: `<path d="M3.8 6.6A2.6 2.6 0 0 1 6.4 4h6.2a2.6 2.6 0 0 1 2.6 2.6v3.6a2.6 2.6 0 0 1-2.6 2.6H9L5.8 15.4v-2.7a2.6 2.6 0 0 1-2-2.5z" ${F}/><path d="M18 9.4a2.6 2.6 0 0 1 2.2 2.6v3.6a2.6 2.6 0 0 1-1.9 2.5v2.1L16 18.2h-4.5"/>`,
    notes: `<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5V14l-5.2 6H7.5A2.5 2.5 0 0 1 5 17.5z" ${F}/><path d="M19 14h-3.7A1.5 1.5 0 0 0 13.8 15.5V20M8.5 8h7M8.5 11.4h4.5"/>`,
    focus: `<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5 4 8.5s-4 4.5-4 8.5M16 3.5c0 4-4 5-4 8.5s4 4.5 4 8.5"/><path d="M9.6 18.4c.9-1.4 1.6-1.9 2.4-1.9s1.5.5 2.4 1.9z" fill="currentColor" stroke="none"/>`,
    me: `<rect x="3" y="5" width="18" height="14" rx="3.2" ${F}/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.2c.5-1.7 1.8-2.5 3.2-2.5s2.7.8 3.2 2.5M14.6 10h3.9M14.6 13.4h2.8"/>`,
    bots: `<rect x="5" y="8" width="14" height="11" rx="3.6" ${F}/><path d="M12 8V5.3M3 12.5v3M21 12.5v3M9.5 16.4h5"/><circle cx="12" cy="4.2" r="1.1"/><path d="M9.3 12.4h.01M14.7 12.4h.01" stroke-width="2.4"/>`,
    wa: `<path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8l-1.2 4.2 4.4-1.1A8.5 8.5 0 1 0 12 3.5z" ${F}/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" stroke-width="2.4"/>`,
    online: `<circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 5.4a9.4 9.4 0 0 0 0 13.2M18.6 5.4a9.4 9.4 0 0 1 0 13.2"/>`,
    't-pass': `<circle cx="8.5" cy="14.5" r="4.2" ${F}/><path d="M11.6 11.4L20 3M16.5 6.5l2.2 2.2M14.2 8.8l1.8 1.8"/>`,
    't-margin': `<rect x="3.5" y="3.5" width="17" height="17" rx="4.2" ${F}/><path d="M8.5 15.5l7-7"/><circle cx="8.7" cy="8.9" r="1.3"/><circle cx="15.3" cy="15.1" r="1.3"/>`,
    't-walink': `<path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8l-1.2 4.2 4.4-1.1A8.5 8.5 0 1 0 12 3.5z" ${F}/><path d="M9.2 9.3c.2 2.6 2.4 4.9 5.4 5.6l1-1.5-1.8-.9-.8.7c-.9-.4-1.7-1.2-2.1-2.1l.7-.8-.9-1.8z"/>`,
    't-chatstat': `<rect x="4" y="12" width="4" height="8" rx="1.3" ${F}/><rect x="10" y="7" width="4" height="13" rx="1.3" ${F}/><rect x="16" y="3.5" width="4" height="16.5" rx="1.3" ${F}/>`,
    /* ikon antarmuka */
    back: `<path d="M14.5 5.5L8 12l6.5 6.5"/>`,
    gavel: `<g transform="rotate(45 15 8)"><rect x="9.6" y="5.6" width="10.8" height="4.8" rx="1.7" ${F}/></g><path d="M12.6 10.4L4.8 18.2M11.5 20.6h9"/>`,
    megaphone: `<path d="M4 10.2v3.6h3l7 4V6.2l-7 4z" ${F}/><path d="M17.2 9.4a3.6 3.6 0 0 1 0 5.2M7 13.8l1 4.7h2.5l-.8-3.4"/>`,
    menu: `<path d="M5 7h14M5 12h14M5 17h14"/>`,
    img: `<rect x="3.5" y="4" width="17" height="16" rx="3.5"/><circle cx="9" cy="9.5" r="1.6"/><path d="M4 17l4.8-4.6 3.6 3.2 2.7-2.5L20 16.8"/>`,
    smile: `<circle cx="12" cy="12" r="8.6"/><path d="M8.4 14.2c.8 1.5 2 2.2 3.6 2.2s2.8-.7 3.6-2.2"/><path d="M9.3 9.8h.01M14.7 9.8h.01" stroke-width="2.4"/>`,
    send: `<path d="M20.6 3.4L3.9 10.1l6.2 3.1 3.1 6.2z" ${F}/><path d="M10.1 13.2l10.5-9.8"/>`,
    reply: `<path d="M9.5 6L4 11.5 9.5 17"/><path d="M4.6 11.5H14a6 6 0 0 1 6 6V19"/>`,
    x: `<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`
  };
  const hex = g => (String(g || '').match(/#[0-9a-fA-F]{6}/) || ['#6366f1'])[0];
  return {
    P, hex,
    has: id => Object.prototype.hasOwnProperty.call(P, id),
    svg(id, sz) { return `<svg class="ico" viewBox="0 0 24 24" width="${sz || 24}" height="${sz || 24}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[id] || ''}</svg>`; }
  };
})();
