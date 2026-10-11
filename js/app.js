/* Mi Departamento — oficina pixel-art (vanilla JS, sin dependencias)
 * Todo el arte se dibuja con rectángulos en <canvas>: sin imágenes externas. */
(() => {
  'use strict';

  /* ------------------------------------------------------------------ i18n */
  const I18N = {
    es: {
      docTitle: 'Mi Departamento · Yoandy Ramírez',
      title: 'Mi Departamento',
      subtitle: 'Mis agentes de IA, trabajando',
      owner: 'Responsable: Yoandy Ramírez',
      shift: 'Turno de noche · Huelva',
      officeH: 'La oficina',
      hint: 'Pulsa en un agente para ver su ficha.',
      activity: 'Actividad',
      pause: 'Pausar', play: 'Reanudar',
      pauseAria: 'Pausar la actividad', playAria: 'Reanudar la actividad',
      demo: 'Demo: la actividad es simulada',
      demoBadge: 'DEMO',
      team: 'El equipo',
      teamHint: 'Todos los agentes y su función, en texto.',
      made: 'Una oficina de Yoandy Ramírez, dibujada píxel a píxel.',
      repo: 'Código en GitHub',
      you: 'Tú', youAria: 'Tú (Yoandy Ramírez)',
      langGroup: 'Idioma',
      close: 'Cerrar',
      status: 'Estado',
      whatDoes: 'Qué hace',
      lastMsg: 'Último mensaje',
      openCard: 'Abrir ficha de',
      openCardShort: 'Pulsa para abrir su ficha',
      talkingTo: 'Hablando con {x}',
      writingToYou: 'Escribiéndote',
      reading: 'Leyendo mensaje',
      agents: 'agentes', rooms: 'salas',
      agentOne: 'agente', agentMany: 'agentes',
      newRound: '· nueva ronda ·',
      skip: 'Saltar a la actividad',
      cafe: 'Café',
      cafeAria: 'Café: zona de descanso, sin agentes',
      loadError: 'No se pudieron cargar los datos de la oficina.',
      to: 'para'
    },
    en: {
      docTitle: 'My Department · Yoandy Ramírez',
      title: 'My Department',
      subtitle: 'My AI agents, at work',
      owner: 'Run by: Yoandy Ramírez',
      shift: 'Night shift · Huelva',
      officeH: 'The office',
      hint: 'Tap an agent to see their card.',
      activity: 'Activity',
      pause: 'Pause', play: 'Resume',
      pauseAria: 'Pause the activity', playAria: 'Resume the activity',
      demo: 'Demo: activity is simulated',
      demoBadge: 'DEMO',
      team: 'The team',
      teamHint: 'Every agent and what they do, as text.',
      made: 'An office by Yoandy Ramírez, drawn pixel by pixel.',
      repo: 'Code on GitHub',
      you: 'You', youAria: 'You (Yoandy Ramírez)',
      langGroup: 'Language',
      close: 'Close',
      status: 'Status',
      whatDoes: 'What they do',
      lastMsg: 'Latest message',
      openCard: 'Open card for',
      openCardShort: 'Press to open their card',
      talkingTo: 'Talking to {x}',
      writingToYou: 'Writing to you',
      reading: 'Reading message',
      agents: 'agents', rooms: 'rooms',
      agentOne: 'agent', agentMany: 'agents',
      newRound: '· new round ·',
      skip: 'Skip to activity',
      cafe: 'Café',
      cafeAria: 'Café: break room, no agents',
      loadError: 'Could not load the office data.',
      to: 'to'
    }
  };

  const LS_KEY = 'mi-departamento.lang';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reduceMQ.matches;

  let lang = (() => {
    try { const v = localStorage.getItem(LS_KEY); if (v === 'es' || v === 'en') return v; } catch (e) { /* privado */ }
    return 'es';
  })();
  const t = (k) => (I18N[lang] && I18N[lang][k]) ?? I18N.es[k] ?? k;
  const L = (o) => (o && typeof o === 'object' && !Array.isArray(o)) ? (o[lang] ?? o.es ?? '') : (o ?? '');
  const fmt = (s, x) => s.replace('{x}', x);

  /* ---------------------------------------------------------------- state */
  const SLOT = 56, H = 76, DESK_Y = 58, CHAR_Y = 43;
  const state = {
    office: null, feed: null,
    agents: new Map(), rooms: [],
    frame: 0, tickId: 0, playing: true,
    log: [], lastBy: new Map(), cardId: null
  };
  const ROOM_ACCENT = {
    direccion: '#14b8a6', estrategia: '#d99a2b', finanzas: '#3f9a66', ventas: '#d0573f',
    marketing: '#c2477a', ciber: '#4a7ab8', laboratorio: '#3ddc84', herramientas: '#c96a22', cafe: '#a07850'
  };
  const ROOM_WALL = {
    direccion: '#2d2944', estrategia: '#292c42', finanzas: '#2b2a3b', ventas: '#30293b',
    marketing: '#33283f', ciber: '#232b3d', laboratorio: '#1c2130', herramientas: '#2c2a33', cafe: '#322a32'
  };

  /* -------------------------------------------------------------- helpers */
  function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1, 7), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
    r = f(r); g = f(g); b = f(b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
  }
  function hashStr(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function alpha(c, a, fn) { c.save(); c.globalAlpha = a; fn(); c.restore(); }

  /* ------------------------------------------------------------ sprites */
  function drawPerson(c, Lk, ox, oy, blink) {
    const skin = Lk.skin || '#e0b088', hair = Lk.hairColor || '#2b2b2b', shirt = Lk.shirt || '#0F766E';
    const skinD = shade(skin, -0.2), shirtD = shade(shirt, -0.25), hairL = shade(hair, 0.22);
    const ink = '#1b1420';
    const style = Lk.hair || 'short';
    // long hair behind the shoulders
    if (style === 'long') { px(c, ox + 1, oy + 4, 10, 9, hair); px(c, ox, oy + 7, 12, 5, hair); }
    // body
    px(c, ox + 2, oy + 10, 8, 1, shirt); px(c, ox + 1, oy + 11, 10, 8, shirt);
    px(c, ox + 1, oy + 11, 1, 8, shirtD); px(c, ox + 10, oy + 11, 1, 8, shirtD);
    px(c, ox + 5, oy + 10, 2, 1, skinD);
    if (style === 'hood') { px(c, ox + 4, oy + 11, 1, 3, '#d8d2c4'); px(c, ox + 7, oy + 11, 1, 3, '#d8d2c4'); }
    // neck + head
    px(c, ox + 5, oy + 9, 2, 1, skinD);
    px(c, ox + 2, oy + 3, 8, 6, skin);
    px(c, ox + 3, oy + 9, 6, 0, skin);
    if (style !== 'long' && style !== 'hood') { px(c, ox + 1, oy + 5, 1, 2, skinD); px(c, ox + 10, oy + 5, 1, 2, skinD); }
    // glasses lenses first
    if (Lk.glasses) { px(c, ox + 3, oy + 5, 3, 2, '#cfeee9'); px(c, ox + 6, oy + 5, 3, 2, '#cfeee9'); }
    // eyes
    if (blink) { px(c, ox + 4, oy + 6, 1, 1, ink); px(c, ox + 7, oy + 6, 1, 1, ink); }
    else { px(c, ox + 4, oy + 5, 1, 2, ink); px(c, ox + 7, oy + 5, 1, 2, ink); }
    if (Lk.glasses) { px(c, ox + 3, oy + 4, 6, 1, ink); px(c, ox + 2, oy + 5, 1, 1, ink); px(c, ox + 9, oy + 5, 1, 1, ink); }
    // blush + mouth
    alpha(c, 0.35, () => { px(c, ox + 3, oy + 7, 1, 1, '#e0607e'); px(c, ox + 8, oy + 7, 1, 1, '#e0607e'); });
    px(c, ox + 5, oy + 8, 2, 1, skinD);
    // hair styles
    if (style === 'short' || style === 'long' || style === 'bun') {
      px(c, ox + 2, oy + 1, 8, 1, hair); px(c, ox + 1, oy + 2, 10, 2, hair);
      px(c, ox + 1, oy + 4, 1, 1, hair); px(c, ox + 10, oy + 4, 1, 1, hair);
      px(c, ox + 2, oy + 3, 3, 1, hair); px(c, ox + 8, oy + 3, 2, 1, hair);
      px(c, ox + 3, oy + 1, 3, 1, hairL);
      if (style === 'bun') { px(c, ox + 4, oy - 1, 4, 2, hair); px(c, ox + 5, oy - 2, 2, 1, hair); px(c, ox + 5, oy - 1, 1, 1, hairL); }
      if (style === 'long') { px(c, ox + 1, oy + 4, 1, 6, hair); px(c, ox + 10, oy + 4, 1, 6, hair); }
    } else if (style === 'cap') {
      const cap = Lk.capColor || '#7a4bc2';
      px(c, ox + 1, oy + 4, 1, 2, hair); px(c, ox + 10, oy + 4, 1, 2, hair);
      px(c, ox + 2, oy + 0, 8, 1, cap); px(c, ox + 1, oy + 1, 10, 2, cap);
      px(c, ox + 1, oy + 3, 11, 1, shade(cap, -0.3)); px(c, ox + 5, oy + 1, 2, 1, shade(cap, 0.4));
    } else if (style === 'hood') {
      const hd = hair, hdD = shade(hair, -0.35);
      px(c, ox + 2, oy + 0, 8, 1, hd); px(c, ox + 1, oy + 1, 10, 2, hd);
      px(c, ox + 0, oy + 3, 2, 8, hd); px(c, ox + 10, oy + 3, 2, 8, hd);
      px(c, ox + 2, oy + 3, 8, 1, hdD);
      px(c, ox + 3, oy + 1, 3, 1, shade(hd, 0.2));
    }
    if (Lk.headset) {
      const hs = '#26222e';
      px(c, ox + 2, oy + 0, 8, 1, hs); px(c, ox + 1, oy + 1, 1, 3, hs); px(c, ox + 10, oy + 1, 1, 3, hs);
      px(c, ox + 0, oy + 4, 2, 3, hs); px(c, ox + 10, oy + 4, 2, 3, hs);
      px(c, ox + 1, oy + 7, 1, 1, hs); px(c, ox + 2, oy + 8, 2, 1, hs); px(c, ox + 4, oy + 8, 1, 1, '#e5484d');
    }
  }

  function drawRobot(c, Lk, ox, oy, blink, f) {
    const metal = Lk.metal || '#b9c2cc', metalD = shade(metal, -0.3), metalL = shade(metal, 0.3);
    const visor = Lk.visor || '#2dd4bf', shirt = Lk.shirt || '#0F766E', shirtD = shade(shirt, -0.25);
    // body
    px(c, ox + 2, oy + 10, 8, 1, shirt); px(c, ox + 1, oy + 11, 10, 8, shirt);
    px(c, ox + 1, oy + 11, 1, 8, shirtD); px(c, ox + 10, oy + 11, 1, 8, shirtD);
    px(c, ox + 5, oy + 12, 2, 1, f ? visor : shade(visor, -0.4));
    // antenna
    px(c, ox + 6, oy + 0, 1, 2, metalD); px(c, ox + 6, oy - 1, 1, 1, f ? '#ffffff' : visor);
    // head
    px(c, ox + 5, oy + 9, 2, 1, metalD);
    px(c, ox + 1, oy + 2, 10, 7, metal); px(c, ox + 1, oy + 2, 10, 1, metalL); px(c, ox + 1, oy + 8, 10, 1, metalD);
    px(c, ox + 0, oy + 4, 1, 3, metalD); px(c, ox + 11, oy + 4, 1, 3, metalD);
    // visor
    px(c, ox + 2, oy + 4, 8, 3, '#0b1a1c');
    if (blink) { px(c, ox + 3, oy + 5, 2, 1, shade(visor, -0.45)); px(c, ox + 7, oy + 5, 2, 1, shade(visor, -0.45)); }
    else { px(c, ox + 3, oy + 5, 2, 1, visor); px(c, ox + 7, oy + 5, 2, 1, visor); }
    px(c, ox + 4, oy + 7, 4, 1, metalD);
  }

  function drawCharacter(c, look, ox, oy, blink, f) {
    if (look.kind === 'robot') drawRobot(c, look, ox, oy, blink, f);
    else drawPerson(c, look, ox, oy, blink);
  }

  function drawEnvelope(c) {
    px(c, 0, 0, 11, 8, '#3a2f4a');
    px(c, 1, 1, 9, 6, '#fff3d6');
    px(c, 1, 1, 1, 1, '#d9c9a3'); px(c, 9, 1, 1, 1, '#d9c9a3');
    px(c, 2, 2, 1, 1, '#d9c9a3'); px(c, 8, 2, 1, 1, '#d9c9a3');
    px(c, 3, 3, 1, 1, '#d9c9a3'); px(c, 7, 3, 1, 1, '#d9c9a3');
    px(c, 4, 4, 3, 1, '#d9c9a3');
    px(c, 5, 4, 1, 2, '#0F766E');
  }

  /* ------------------------------------------------------------- décor */
  function drawWindow(c, x, y, w, h, f, o = {}) {
    px(c, x - 1, y - 1, w + 2, h + 2, '#120f1a');
    px(c, x, y, w, h, '#4a3d5c');
    const gx = x + 2, gy = y + 2, gw = w - 4, gh = h - 4;
    const waterY = gy + Math.round(gh * 0.68);
    px(c, gx, gy, gw, gh, '#141a33');
    px(c, gx, gy + Math.round(gh * 0.3), gw, Math.round(gh * 0.2), '#19213f');
    px(c, gx, gy + Math.round(gh * 0.5), gw, waterY - gy - Math.round(gh * 0.5), '#212c52');
    const r = rng(o.seed || 7);
    const stars = Math.max(4, Math.round(gw * gh / 45));
    for (let i = 0; i < stars; i++) {
      const sx = gx + Math.floor(r() * gw), sy = gy + Math.floor(r() * (waterY - gy - 4));
      const tw = (i + f) % 3 === 0;
      px(c, sx, sy, 1, 1, tw ? '#ffffff' : '#7f8fc2');
    }
    if (o.moon) {
      const mx = gx + gw - 8, my = gy + 2;
      px(c, mx + 1, my, 3, 5, '#f3e9c6'); px(c, mx, my + 1, 5, 3, '#f3e9c6');
      px(c, mx + 2, my, 2, 3, '#141a33'); px(c, mx + 3, my + 1, 2, 2, '#141a33');
    }
    // far shore (la ría) with port lights
    px(c, gx, waterY - 2, gw, 2, '#0b0f1e');
    px(c, gx + Math.round(gw * 0.55), waterY - 4, Math.round(gw * 0.3), 2, '#0b0f1e');
    // water
    px(c, gx, waterY, gw, gy + gh - waterY, '#0e1530');
    for (let lx = gx + 1; lx < gx + gw - 1; lx += 3) {
      const on = ((lx * 7 + (o.seed || 0)) % 5) !== 0 || f;
      px(c, lx, waterY - 3, 1, 1, on ? ((lx % 2) ? '#ffcf7a' : '#f4a259') : '#5a4630');
      if ((lx % 2) && on) alpha(c, 0.55, () => { px(c, lx, waterY + 1 + ((lx + f) % 2), 1, 1, '#f4a259'); px(c, lx - (f ? 1 : 0), waterY + 3, 2, 1, '#c27a3a'); });
    }
    px(c, gx + 2, gy + gh - 2 - (f ? 1 : 0), Math.max(2, Math.round(gw * 0.3)), 1, '#1d2a52');
    if (o.palm) {
      const bx = gx + 3, by = waterY;
      const k = '#07090f';
      px(c, bx + 2, by - 9, 1, 9, k); px(c, bx + 3, by - 13, 1, 4, k);
      px(c, bx, by - 14, 7, 1, k); px(c, bx - 1, by - 13, 2, 1, k); px(c, bx + 6, by - 13, 2, 1, k);
      px(c, bx + 1, by - 15, 2, 1, k); px(c, bx + 4, by - 15, 2, 1, k); px(c, bx - 1, by - 12, 1, 1, k); px(c, bx + 7, by - 12, 1, 1, k);
    }
    px(c, x + Math.floor(w / 2), y + 2, 1, h - 4, '#4a3d5c');
    px(c, x - 2, y + h, w + 4, 2, '#5a4a6e'); px(c, x - 2, y + h + 2, w + 4, 1, '#120f1a');
  }
  function frame(c, x, y, w, h, bg) { px(c, x - 1, y - 1, w + 2, h + 2, '#120f1a'); px(c, x, y, w, h, bg); }
  function plant(c, x, base) {
    px(c, x + 3, base - 15, 2, 9, '#2f7a52');
    px(c, x, base - 12, 3, 2, '#3f9a66'); px(c, x + 5, base - 13, 3, 2, '#3f9a66');
    px(c, x + 1, base - 10, 2, 3, '#2f7a52'); px(c, x + 5, base - 10, 2, 3, '#2f7a52');
    px(c, x + 2, base - 17, 2, 3, '#4fb37a'); px(c, x + 6, base - 15, 1, 2, '#4fb37a');
    px(c, x, base - 7, 8, 2, '#b45f35'); px(c, x + 1, base - 5, 6, 5, '#9a4f2c');
  }
  function floorLamp(c, x, base, f) {
    alpha(c, f ? 0.13 : 0.11, () => { px(c, x - 6, base - 30, 19, 30, '#f4b860'); });
    px(c, x + 3, base - 27, 1, 27, '#2b2536'); px(c, x, base - 2, 7, 2, '#2b2536');
    px(c, x, base - 32, 7, 5, '#e9b55f'); px(c, x + 1, base - 33, 5, 1, '#e9b55f'); px(c, x, base - 28, 7, 1, '#ffe2a8');
  }
  function wallClock(c, x, y) {
    px(c, x + 1, y, 5, 7, '#efe6d2'); px(c, x, y + 1, 7, 5, '#efe6d2');
    px(c, x + 3, y + 1, 1, 3, '#1b1420'); px(c, x + 3, y + 3, 2, 1, '#1b1420');
  }
  function whiteboard(c, x, y, w, h) {
    px(c, x - 1, y - 1, w + 2, h + 2, '#6e6880'); px(c, x, y, w, h, '#e6e3ec');
    px(c, x + 3, y + 3, 5, 5, '#f6d365'); px(c, x + 10, y + 3, 5, 5, '#7fd1c7'); px(c, x + 3, y + 11, 5, 5, '#f49ac1');
    px(c, x + 17, y + 4, w - 21, 1, '#4a6fa5'); px(c, x + 17, y + 7, w - 25, 1, '#4a6fa5');
    px(c, x + 17, y + 11, 5, 4, '#4a6fa5'); px(c, x + 18, y + 12, 3, 2, '#e6e3ec');
    px(c, x + 22, y + 13, 4, 1, '#c0504d'); px(c, x + 26, y + 11, 5, 4, '#c0504d'); px(c, x + 27, y + 12, 3, 2, '#e6e3ec');
    px(c, x + 2, y + h + 1, w - 4, 1, '#6e6880');
  }
  function chartPoster(c, x, y, w, h, type) {
    frame(c, x, y, w, h, '#efe6d2');
    px(c, x + 3, y + h - 4, w - 6, 1, '#3a2f4a'); px(c, x + 3, y + 3, 1, h - 6, '#3a2f4a');
    if (type === 'bars') {
      const hs = [4, 7, 6, 10, 12];
      hs.forEach((bh, i) => px(c, x + 6 + i * 4, y + h - 4 - bh, 3, bh, i === 4 ? '#0F766E' : '#3f9a66'));
    } else {
      let py = y + h - 7;
      for (let lx = x + 5; lx < x + w - 3; lx++) {
        if ((lx - x) % 3 === 0) py -= 1;
        if ((lx - x) % 9 === 4) py += 2;
        px(c, lx, Math.max(y + 3, py), 1, 1, '#d0573f');
      }
      px(c, x + w - 6, y + 3, 3, 3, '#d0573f');
    }
  }
  function safe(c, x, y) {
    px(c, x, y, 16, 16, '#3f4552'); px(c, x + 1, y + 1, 14, 14, '#5f6878'); px(c, x + 1, y + 1, 14, 1, '#7a8495');
    px(c, x + 9, y + 6, 4, 4, '#c9ced6'); px(c, x + 10, y + 7, 2, 2, '#3f4552');
    px(c, x + 3, y + 6, 1, 4, '#c9ced6'); px(c, x + 1, y + 16, 3, 1, '#2a2e37'); px(c, x + 12, y + 16, 3, 1, '#2a2e37');
  }
  function waterCooler(c, x, base) {
    px(c, x, base - 14, 8, 14, '#d9d6e0'); px(c, x, base - 14, 8, 1, '#f1eff5');
    px(c, x + 1, base - 22, 6, 8, '#7fb8e6'); px(c, x + 2, base - 23, 4, 1, '#5d9bd0'); px(c, x + 2, base - 21, 1, 5, '#b9dcf5');
    px(c, x + 3, base - 10, 2, 1, '#c0504d'); px(c, x + 1, base - 1, 6, 1, '#9b97a8');
  }
  function neonSign(c, x, y, w, h, f) {
    alpha(c, f ? 0.28 : 0.18, () => px(c, x - 2, y - 2, w + 4, h + 4, '#ff5fa2'));
    frame(c, x, y, w, h, '#1a1424');
    const col = f ? '#ff8cc0' : '#ff5fa2';
    px(c, x + 2, y + 2, w - 4, 1, col); px(c, x + 2, y + h - 3, w - 4, 1, col);
    px(c, x + 2, y + 2, 1, h - 4, col); px(c, x + w - 3, y + 2, 1, h - 4, col);
    const tx = x + Math.floor(w / 2) - 2, ty = y + Math.floor(h / 2) - 3;
    for (let k = 0; k < 7; k++) px(c, tx, ty + k, k < 4 ? k + 1 : 7 - k, 1, '#ffd27a');
  }
  function poster(c, x, y, w, h, kind, f) {
    if (kind === 'camera') {
      frame(c, x, y, w, h, '#2f5fa0');
      px(c, x + 3, y + 6, w - 6, h - 10, '#1b1420'); px(c, x + 5, y + 4, 4, 2, '#1b1420');
      px(c, x + Math.floor(w / 2) - 2, y + 8, 5, 5, '#cfeee9'); px(c, x + Math.floor(w / 2) - 1, y + 9, 3, 3, '#2f5fa0');
      px(c, x + w - 6, y + 7, 2, 1, f ? '#e5484d' : '#7a2a2d');
    } else if (kind === 'film') {
      frame(c, x, y, w, h, '#efe6d2');
      px(c, x + 3, y + 3, w - 6, h - 6, '#1b1420');
      for (let k = y + 4; k < y + h - 4; k += 3) { px(c, x + 4, k, 1, 1, '#efe6d2'); px(c, x + w - 5, k, 1, 1, '#efe6d2'); }
      px(c, x + 6, y + 5, w - 12, 4, '#c2477a'); px(c, x + 6, y + 11, w - 12, 4, '#d99a2b');
    } else if (kind === 'shield') {
      frame(c, x, y, w, h, '#1d2840');
      const cx = x + Math.floor(w / 2);
      px(c, cx - 6, y + 4, 12, 7, '#4a7ab8'); px(c, cx - 5, y + 11, 10, 3, '#4a7ab8'); px(c, cx - 3, y + 14, 6, 2, '#4a7ab8'); px(c, cx - 1, y + 16, 2, 1, '#4a7ab8');
      px(c, cx - 1, y + 6, 2, 8, '#cfeee9'); px(c, cx - 3, y + 8, 6, 2, '#cfeee9');
    } else if (kind === 'cert') {
      frame(c, x, y, w, h, '#efe6d2');
      px(c, x + 2, y + 2, w - 4, 1, '#b08a5a'); px(c, x + 3, y + 5, w - 6, 1, '#9b97a8'); px(c, x + 3, y + 7, w - 8, 1, '#9b97a8');
      px(c, x + w - 6, y + h - 6, 4, 4, '#c0504d'); px(c, x + w - 5, y + h - 2, 1, 2, '#c0504d');
    } else if (kind === 'lock') {
      frame(c, x, y, w, h, '#1d2840');
      const cx = x + Math.floor(w / 2);
      px(c, cx - 3, y + 3, 6, 1, '#c9ced6'); px(c, cx - 3, y + 3, 1, 4, '#c9ced6'); px(c, cx + 2, y + 3, 1, 4, '#c9ced6');
      px(c, cx - 4, y + 7, 8, 6, '#f4c430'); px(c, cx - 1, y + 9, 2, 2, '#1b1420');
    } else if (kind === 'org') {
      frame(c, x, y, w, h, '#efe6d2');
      const cx = x + Math.floor(w / 2);
      px(c, cx - 3, y + 3, 6, 4, '#0F766E'); px(c, cx, y + 7, 1, 3, '#3a2f4a');
      px(c, x + 4, y + 10, w - 8, 1, '#3a2f4a');
      [x + 3, cx - 2, x + w - 8].forEach((bx, i) => { px(c, bx + 2, y + 10, 1, 3, '#3a2f4a'); px(c, bx, y + 13, 5, 4, ['#d99a2b', '#c2477a', '#4a7ab8'][i]); });
    } else if (kind === 'gear') {
      frame(c, x, y, w, h, '#2c2a33');
      gear(c, x + Math.floor(w / 2), y + Math.floor(h / 2), f, '#c96a22', '#2c2a33');
    }
  }
  function gear(c, cx, cy, f, col, bg) {
    px(c, cx - 4, cy - 4, 9, 9, col);
    px(c, cx - 4, cy - 4, 1, 1, bg); px(c, cx + 4, cy - 4, 1, 1, bg); px(c, cx - 4, cy + 4, 1, 1, bg); px(c, cx + 4, cy + 4, 1, 1, bg);
    if (f) { px(c, cx - 1, cy - 6, 3, 2, col); px(c, cx - 1, cy + 5, 3, 2, col); px(c, cx - 6, cy - 1, 2, 3, col); px(c, cx + 5, cy - 1, 2, 3, col); }
    else { px(c, cx - 6, cy - 6, 3, 3, col); px(c, cx + 4, cy - 6, 3, 3, col); px(c, cx - 6, cy + 4, 3, 3, col); px(c, cx + 4, cy + 4, 3, 3, col); }
    px(c, cx - 1, cy - 1, 3, 3, bg);
  }
  function rack(c, x, y, w, h, f, seed) {
    px(c, x, y, w, h, '#15181f'); px(c, x, y, w, 1, '#2c3140'); px(c, x, y, 1, h, '#2c3140');
    const r = rng(seed);
    for (let uy = y + 2; uy < y + h - 3; uy += 4) {
      px(c, x + 1, uy, w - 2, 3, '#232835');
      const a = r(), b = r();
      px(c, x + 2, uy + 1, 1, 1, (a > 0.5) !== !!f ? '#3ddc84' : '#155c35');
      px(c, x + 4, uy + 1, 1, 1, (b > 0.7 && f) ? '#f4b860' : '#5a4630');
      px(c, x + w - 4, uy + 1, 2, 1, '#0b0d12');
    }
  }
  function terminal(c, x, y, w, h, f) {
    frame(c, x, y, w, h, '#22262e');
    px(c, x + 2, y + 2, w - 4, h - 4, '#07120b');
    const r = rng(42);
    let ly = y + 4;
    for (; ly < y + h - 5; ly += 2) {
      const lw = 4 + Math.floor(r() * (w - 12));
      px(c, x + 4, ly, 2, 1, '#1f7a46'); px(c, x + 7, ly, lw, 1, '#3ddc84');
    }
    if (f) px(c, x + 4, ly, 3, 1, '#a7f3c9');
    alpha(c, 0.08, () => px(c, x - 4, y + h, w + 8, 8, '#3ddc84'));
  }
  function pegboard(c, x, y, w, h) {
    px(c, x, y, w, h, '#a8834f'); px(c, x, y, w, 1, '#c09a63');
    for (let hy = y + 2; hy < y + h; hy += 3) for (let hx = x + 2; hx < x + w; hx += 3) px(c, hx, hy, 1, 1, '#7d6038');
    px(c, x + 4, y + 6, 2, 14, '#9aa3ad'); px(c, x + 3, y + 4, 4, 2, '#9aa3ad'); px(c, x + 4, y + 4, 2, 1, '#a8834f');
    px(c, x + 12, y + 7, 2, 14, '#8a5a3a'); px(c, x + 10, y + 5, 6, 3, '#5f6878');
    px(c, x + 20, y + 4, 3, 6, '#c0504d'); px(c, x + 21, y + 10, 1, 8, '#9aa3ad');
    px(c, x + 26, y + 6, 4, 4, '#5f6878'); px(c, x + 27, y + 7, 2, 2, '#a8834f');
  }
  function toolbox(c, x, y) {
    px(c, x + 4, y, 6, 1, '#3a2f4a'); px(c, x + 4, y, 1, 2, '#3a2f4a'); px(c, x + 9, y, 1, 2, '#3a2f4a');
    px(c, x, y + 2, 14, 7, '#c0392b'); px(c, x, y + 2, 14, 1, '#e0574a'); px(c, x + 6, y + 4, 2, 2, '#d8b07a');
  }
  function ringLight(c, x, base, f) {
    alpha(c, f ? 0.16 : 0.12, () => px(c, x - 3, base - 42, 17, 17, '#fff4d6'));
    px(c, x + 5, base - 27, 1, 27, '#2b2536'); px(c, x + 2, base - 2, 7, 2, '#2b2536');
    const rx = x, ry = base - 39, col = '#fff4d6';
    px(c, rx + 3, ry, 5, 1, col); px(c, rx + 3, ry + 10, 5, 1, col);
    px(c, rx, ry + 3, 1, 5, col); px(c, rx + 10, ry + 3, 1, 5, col);
    px(c, rx + 1, ry + 1, 2, 2, col); px(c, rx + 8, ry + 1, 2, 2, col); px(c, rx + 1, ry + 8, 2, 2, col); px(c, rx + 8, ry + 8, 2, 2, col);
  }
  function bookshelf(c, x, y, w, h) {
    px(c, x, y, w, h, '#5e3820'); px(c, x + 1, y + 1, w - 2, h - 2, '#3a2416');
    const cols = ['#c0504d', '#4a7ab8', '#d99a2b', '#3f9a66', '#c2477a', '#efe6d2'];
    for (let sy = y + 1; sy < y + h - 1; sy += 7) {
      px(c, x + 1, sy + 6, w - 2, 1, '#5e3820');
      for (let bx = x + 2, i = sy; bx < x + w - 3; bx += 3, i++) px(c, bx, sy + 1 + (i % 2), 2, 5 - (i % 2), cols[i % cols.length]);
    }
  }

  function drawDecor(c, id, W, f) {
    switch (id) {
      case 'direccion':
        drawWindow(c, 6, 5, 34, 27, f, { moon: true, palm: true, seed: 3 });
        poster(c, 76, 7, 26, 20, 'org', f);
        wallClock(c, 53, 6);
        plant(c, 6, 74); plant(c, 98, 74);
        break;
      case 'estrategia':
        whiteboard(c, 6, 6, 34, 22);
        drawWindow(c, 74, 5, 32, 27, f, { seed: 11 });
        plant(c, 8, 74); floorLamp(c, 99, 74, f);
        break;
      case 'finanzas':
        chartPoster(c, 8, 7, 28, 20, 'bars');
        drawWindow(c, 74, 5, 32, 27, f, { moon: true, seed: 19 });
        safe(c, 86, 56); plant(c, 6, 74);
        break;
      case 'ventas':
        chartPoster(c, 6, 7, 32, 20, 'line');
        drawWindow(c, 74, 5, 32, 27, f, { palm: true, seed: 23 });
        waterCooler(c, 96, 74); plant(c, 7, 74);
        break;
      case 'marketing': {
        const wide = W >= 224;
        drawWindow(c, 6, 5, 30, 27, f, { seed: 31 });
        neonSign(c, wide ? 64 : 45, 8, 22, 16, f);
        poster(c, wide ? 100 : 76, 8, 18, 18, 'camera', f);
        poster(c, wide ? 140 : 104, 7, 18, 20, 'film', f);
        if (wide) bookshelf(c, 168, 8, 18, 22);
        drawWindow(c, W - 36, 5, 30, 27, f, { moon: true, palm: true, seed: 37 });
        ringLight(c, wide ? 69 : 51, 74, f); plant(c, wide ? 146 : 108, 74);
        break;
      }
      case 'ciber':
        drawWindow(c, 6, 5, 28, 25, f, { seed: 41 });
        poster(c, 46, 5, 20, 20, 'shield', f);
        poster(c, 76, 8, 14, 12, 'cert', f);
        poster(c, 94, 7, 13, 15, 'lock', f);
        rack(c, 50, 46, 12, 26, f, 5);
        break;
      case 'laboratorio':
        terminal(c, 6, 5, 36, 26, f);
        poster(c, 49, 6, 14, 12, 'lock', f);
        rack(c, 78, 12, 14, 60, f, 9); rack(c, 95, 18, 13, 54, !f, 13);
        for (let sx = 0; sx < W; sx += 4) px(c, sx, 40, 2, 2, '#f4c430');
        px(c, 70, 72, 10, 1, '#0b0d12'); px(c, 72, 73, 6, 1, '#3ddc84');
        break;
      case 'herramientas':
        drawWindow(c, 6, 5, 26, 25, f, { moon: true, seed: 53 });
        pegboard(c, 40, 4, 32, 26);
        poster(c, 82, 6, 22, 22, 'gear', f);
        toolbox(c, 49, 63);
        break;
      case 'cafe':
        drawWindow(c, 12, 5, 36, 25, f, { moon: true, palm: true, seed: 61 });
        bookshelf(c, 58, 8, 22, 22);
        px(c, 4, 50, 56, 22, '#7a4a2c'); px(c, 4, 48, 56, 2, '#b97b4c'); px(c, 4, 50, 56, 1, '#5e3820');
        px(c, 10, 34, 12, 14, '#2b2b33'); px(c, 11, 35, 10, 3, '#3a3a44'); px(c, 12, 36, 2, 1, f ? '#e5484d' : '#7a2a2d');
        px(c, 14, 44, 4, 4, '#e8e2d0');
        alpha(c, 0.6, () => { px(c, 15, 41 - f, 1, 2, '#ffffff'); px(c, 16, 39 + f, 1, 2, '#ffffff'); });
        px(c, 30, 45, 4, 3, '#0F766E'); px(c, 38, 45, 4, 3, '#d0573f');
        px(c, 84, 14, 20, 58, '#0F766E'); px(c, 84, 14, 20, 1, '#14b8a6');
        px(c, 86, 17, 13, 36, '#0b2626');
        for (let ry = 19; ry < 51; ry += 6) for (let rx = 87; rx < 98; rx += 3) px(c, rx, ry, 2, 3, ['#f4c430', '#c0504d', '#3f9a66', '#f49ac1'][(rx + ry) % 4]);
        px(c, 100, 18, 2, 10, '#c9ced6'); px(c, 86, 58, 13, 6, '#062020');
        plant(c, 64, 74);
        break;
    }
  }

  /* --------------------------------------------------------------- rooms */
  function drawRoom(r) {
    const c = r.ctx; if (!c) return;
    const W = r.W, f = state.frame % 2;
    c.setTransform(r.scale, 0, 0, r.scale, 0, 0);
    c.imageSmoothingEnabled = false;
    const wall = ROOM_WALL[r.id] || '#2b2440';
    px(c, 0, 0, W, 40, wall);
    px(c, 0, 27, W, 13, shade(wall, -0.18)); px(c, 0, 27, W, 1, shade(wall, 0.12));
    px(c, 0, 40, W, 2, '#17131f');
    for (let y = 42, row = 0; y < H; y += 6, row++) {
      px(c, 0, y, W, 6, row % 2 ? '#5d3f2c' : '#664633');
      px(c, 0, y + 5, W, 1, '#4a3123');
      for (let sx = (row * 11) % 18; sx < W; sx += 18) px(c, sx, y, 1, 5, '#4a3123');
    }
    drawDecor(c, r.id, W, f);
    r.slots.forEach((s) => alpha(c, 0.09, () => { px(c, s.cx - 20, 44, 40, 32, '#f4b860'); px(c, s.cx - 13, 46, 26, 28, '#f4b860'); }));
    r.slots.forEach((s) => drawStation(c, s, state.frame));
  }

  function drawStation(c, s, frameN) {
    const ag = state.agents.get(s.id); if (!ag) return;
    const look = ag.a.look || {};
    const f = frameN % 2;
    const typing = isTyping(ag);
    const blink = !reduced && ((frameN + ag.seed) % 11 === 0);
    const bob = (!typing && !reduced && f) ? -1 : 0;
    const cx = s.cx, ox = cx - 6, oy = CHAR_Y + bob;
    // chair
    px(c, cx - 8, 49, 16, 9, '#3b3350'); px(c, cx - 8, 49, 16, 1, '#4c4266');
    drawCharacter(c, look, ox, oy, blink, f);
    // screen glow on the face
    alpha(c, 0.13, () => px(c, cx - 5, oy + 3, 10, 7, '#2dd4bf'));
    // desk
    px(c, cx - 16, DESK_Y, 32, 1, '#c08551'); px(c, cx - 16, DESK_Y + 1, 32, 2, '#a0683f');
    px(c, cx - 16, DESK_Y + 3, 32, 9, '#7a4a2c'); px(c, cx - 16, DESK_Y + 3, 32, 1, '#5e3820');
    px(c, cx + 5, DESK_Y + 5, 8, 4, '#6b4027'); px(c, cx + 8, DESK_Y + 6, 2, 1, '#d8b07a');
    px(c, cx - 15, DESK_Y + 12, 2, 4, '#5e3820'); px(c, cx + 13, DESK_Y + 12, 2, 4, '#5e3820');
    // laptop (back side)
    px(c, cx - 5, DESK_Y - 5, 10, 5, '#c9c4d4'); px(c, cx - 5, DESK_Y - 5, 10, 1, '#e4e0ec');
    px(c, cx - 1, DESK_Y - 3, 2, 2, (typing && f) ? '#5eead4' : '#0F766E');
    px(c, cx - 6, DESK_Y, 12, 1, '#8d879b');
    // mug + steam
    px(c, cx + 9, DESK_Y - 3, 3, 3, '#e8e2d0'); px(c, cx + 12, DESK_Y - 2, 1, 1, '#e8e2d0');
    if (!reduced) alpha(c, 0.5, () => px(c, cx + 10, DESK_Y - 5 - f, 1, 1, '#ffffff'));
    // papers
    px(c, cx - 14, DESK_Y - 1, 6, 1, '#efe6d2'); px(c, cx - 13, DESK_Y - 2, 5, 1, '#d9d2c0');
    // hands
    const hand = look.kind === 'robot' ? (look.metal || '#b9c2cc') : (look.skin || '#e0b088');
    const lh = typing && !reduced ? (f ? -1 : 0) : 0, rh = typing && !reduced ? (f ? 0 : -1) : 0;
    px(c, cx - 7, DESK_Y - 1 + lh, 2, 2, hand); px(c, cx + 5, DESK_Y - 1 + rh, 2, 2, hand);
  }

  function isTyping(ag) { return ag.override ? !!ag.override.typing || ag.a.anim === 'type' : ag.a.anim === 'type'; }

  const wideMQ = window.matchMedia('(min-width: 640px)');
  function roomWidth(n) { return n >= 3 ? (wideMQ.matches ? SLOT * 4 : SLOT * 3) : SLOT * 2; }
  function layoutSlots(r) {
    const n = r.slots.length;
    const W = roomWidth(n);
    if (W === r.W && r.laidOut) return;
    r.W = W; r.laidOut = true;
    r.canvas.style.aspectRatio = `${W} / ${H}`;
    r.slots.forEach((slot, i) => {
      const cx = Math.round(W * (i + 0.5) / n);
      slot.cx = cx;
      const ag = state.agents.get(slot.id);
      ag.hit.style.left = ((cx - 17) / W * 100) + '%';
      ag.hit.style.top = (40 / H * 100) + '%';
      ag.hit.style.width = (34 / W * 100) + '%';
      ag.hit.style.height = (36 / H * 100) + '%';
      ag.bubble.style.left = (cx / W * 100) + '%';
      ag.bubble.style.bottom = (100 - (41 / H * 100)) + '%';
    });
  }
  function sizeRoom(r) {
    layoutSlots(r);
    const cssW = r.canvas.clientWidth || r.W * 3;
    const dpr = window.devicePixelRatio || 1;
    const s = Math.max(1, Math.round((cssW * dpr) / r.W));
    if (s !== r.scale || r.canvas.width !== r.W * s) {
      r.scale = s; r.canvas.width = r.W * s; r.canvas.height = H * s;
    }
    drawRoom(r);
  }

  function drawAll() { state.rooms.forEach(drawRoom); }

  /* ------------------------------------------------------------- build UI */
  function buildRooms() {
    const floor = $('#floor');
    floor.textContent = '';
    state.rooms = [];
    const roomsData = state.office.rooms.slice();
    roomsData.forEach((room) => floor.appendChild(buildRoom(room, false)));
    floor.appendChild(buildRoom({ id: 'cafe', name: null, agents: [] }, true));
    const ro = 'ResizeObserver' in window ? new ResizeObserver((entries) => entries.forEach((e) => { const r = state.rooms.find((x) => x.canvas === e.target); if (r) sizeRoom(r); })) : null;
    state.rooms.forEach((r) => { if (ro) ro.observe(r.canvas); sizeRoom(r); });
    if (!ro) window.addEventListener('resize', () => state.rooms.forEach(sizeRoom));
    const relayout = () => state.rooms.forEach(sizeRoom);
    wideMQ.addEventListener ? wideMQ.addEventListener('change', relayout) : wideMQ.addListener(relayout);
  }

  function buildRoom(room, extra) {
    const n = room.agents.length;
    const W = roomWidth(n);
    const el = document.createElement(extra ? 'div' : 'article');
    el.className = 'room' + (extra ? ' room--extra' : '');
    el.dataset.room = room.id;
    if (n >= 3) el.dataset.span = '2';
    el.style.setProperty('--room-accent', ROOM_ACCENT[room.id] || '#14b8a6');
    const head = document.createElement('div'); head.className = 'room-head';
    const h = document.createElement('h3'); h.className = 'room-name'; h.id = 'room-' + room.id;
    const count = document.createElement('span'); count.className = 'room-count';
    head.append(h, count);
    const stage = document.createElement('div'); stage.className = 'room-stage';
    const canvas = document.createElement('canvas'); canvas.className = 'room-canvas';
    canvas.width = W * 3; canvas.height = H * 3;
    canvas.style.aspectRatio = `${W} / ${H}`;
    stage.appendChild(canvas);
    el.append(head, stage);
    if (extra) {
      el.setAttribute('role', 'img');
      canvas.setAttribute('aria-hidden', 'true');
    } else {
      el.setAttribute('aria-labelledby', h.id);
      canvas.setAttribute('aria-hidden', 'true');
    }
    const r = { id: room.id, room, W: 0, el, canvas, ctx: canvas.getContext('2d'), scale: 3, slots: [], h, count, extra };
    if (n) {
      const labels = document.createElement('div'); labels.className = 'labels';
      labels.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
      room.agents.forEach((a, i) => {
        const cx = Math.round(W * (i + 0.5) / n);
        const slot = { id: a.id, cx };
        r.slots.push(slot);
        const hit = document.createElement('button');
        hit.type = 'button'; hit.className = 'agent-hit'; hit.dataset.agent = a.id;
        hit.addEventListener('click', () => openCard(a.id, hit));
        const bubble = document.createElement('div');
        bubble.className = 'bubble'; bubble.setAttribute('aria-hidden', 'true');
        if (n > 1 && i === 0) { bubble.style.setProperty('--bx', '-22%'); bubble.style.setProperty('--tail', '22%'); }
        if (n > 1 && i === n - 1) { bubble.style.setProperty('--bx', '-78%'); bubble.style.setProperty('--tail', '78%'); }
        stage.append(hit, bubble);
        const label = document.createElement('div'); label.className = 'label';
        const nm = document.createElement('span'); nm.className = 'label-name'; nm.textContent = a.short || a.name; nm.title = a.name;
        const chip = document.createElement('span'); chip.className = 'chip';
        label.append(nm, chip);
        labels.appendChild(label);
        state.agents.set(a.id, { a, room, hit, chip, bubble, override: null, timer: 0, bTimer: 0, seed: hashStr(a.id) % 11 });
      });
      el.appendChild(labels);
    }
    state.rooms.push(r);
    return el;
  }

  function buildTeam() {
    const wrap = $('#team'); wrap.textContent = '';
    state.office.rooms.forEach((room) => {
      const box = document.createElement('section'); box.className = 'team-room';
      const h = document.createElement('h3'); h.textContent = L(room.name);
      const ul = document.createElement('ul');
      room.agents.forEach((a) => {
        const li = document.createElement('li');
        const b = document.createElement('button'); b.type = 'button'; b.className = 'agent-link';
        b.textContent = a.name; b.setAttribute('aria-label', `${t('openCard')} ${a.name}`);
        b.addEventListener('click', () => openCard(a.id, b));
        const role = document.createElement('span'); role.className = 'agent-role'; role.textContent = L(a.role);
        li.append(b, role); ul.appendChild(li);
      });
      box.append(h, ul); wrap.appendChild(box);
    });
  }

  /* ---------------------------------------------------------- statuses */
  function statusText(ag) {
    if (ag.override) return typeof ag.override.text === 'function' ? ag.override.text() : ag.override.text;
    return L(ag.a.status);
  }
  function renderAgent(ag) {
    ag.chip.textContent = statusText(ag);
    ag.chip.className = 'chip' + (ag.override && ag.override.kind ? ' ' + ag.override.kind : '');
    ag.hit.setAttribute('aria-label', `${ag.a.name}, ${L(ag.a.role)}. ${t('status')}: ${statusText(ag)}. ${t('openCardShort')}`);
  }
  function setStatus(id, text, kind, ms, typing) {
    const ag = state.agents.get(id); if (!ag) return;
    ag.override = { text, kind, typing };
    renderAgent(ag);
    clearTimeout(ag.timer);
    ag.timer = setTimeout(() => { ag.override = null; renderAgent(ag); if (state.cardId === id) fillCard(); }, ms);
    if (state.cardId === id) fillCard();
  }
  function nameOf(id) {
    if (id === 'tu') return L(state.office.you && state.office.you.name) || t('you');
    const ag = state.agents.get(id); return ag ? ag.a.name : id;
  }
  function colorOf(id) {
    if (id === 'tu') return '#f4b860';
    const ag = state.agents.get(id); return (ag && ag.a.look && ag.a.look.shirt) || '#0F766E';
  }
  function anchorOf(id) { return id === 'tu' ? $('#you') : (state.agents.get(id) || {}).hit; }

  /* ------------------------------------------------------------ effects */
  let envelopeURL = '';
  function envelopeSrc() {
    if (envelopeURL) return envelopeURL;
    const cv = document.createElement('canvas'); cv.width = 11; cv.height = 8;
    drawEnvelope(cv.getContext('2d'));
    envelopeURL = cv.toDataURL('image/png');
    return envelopeURL;
  }
  function flyEnvelope(fromEl, toEl, done) {
    if (!fromEl || !toEl || reduced || !Element.prototype.animate) { done(); return; }
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const x0 = a.left + a.width / 2 - 16, y0 = a.top + a.height * 0.2 - 12;
    const x1 = b.left + b.width / 2 - 16, y1 = b.top + b.height * 0.3 - 12;
    const img = document.createElement('img');
    img.className = 'envelope'; img.alt = ''; img.src = envelopeSrc();
    img.style.imageRendering = 'pixelated';
    $('#fx').appendChild(img);
    const anim = img.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 0, easing: 'ease-out' },
      { transform: `translate(${x0}px, ${y0 - 10}px) scale(1)`, opacity: 1, offset: 0.18, easing: 'cubic-bezier(.16, 1, .3, 1)' },
      { transform: `translate(${x1}px, ${y1}px) scale(1)`, opacity: 1 }
    ], { duration: 740, fill: 'forwards' });
    anim.onfinish = () => {
      const out = img.animate([{ opacity: 1, transform: `translate(${x1}px, ${y1}px) scale(1)` }, { opacity: 0, transform: `translate(${x1}px, ${y1 + 6}px) scale(.7)` }], { duration: 180, fill: 'forwards' });
      out.onfinish = () => img.remove();
      done();
    };
  }
  function ping(el) {
    if (!el || reduced) return;
    el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping');
    setTimeout(() => el.classList.remove('ping'), 950);
  }
  function showBubble(id, text) {
    const ag = state.agents.get(id); if (!ag) return;
    ag.bubble.textContent = text;
    ag.bubble.classList.add('show');
    clearTimeout(ag.bTimer);
    ag.bTimer = setTimeout(() => ag.bubble.classList.remove('show'), 3300);
  }

  /* ---------------------------------------------------------------- feed */
  const logEl = () => $('#log');
  function timeStr(d) {
    try { return new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(d); }
    catch (e) { return d.toTimeString().slice(0, 5); }
  }
  function renderLogItem(item, isNew) {
    const li = document.createElement('li');
    if (item.sep) { li.className = 'log-sep'; li.textContent = t('newRound'); return li; }
    const m = item.m;
    li.className = 'msg' + (isNew && !reduced ? ' new' : '') + (m.from === 'tu' || m.to === 'tu' ? ' msg--you' : '');
    li.style.setProperty('--c', colorOf(m.from));
    const head = document.createElement('div'); head.className = 'msg-head';
    const from = document.createElement('span'); from.textContent = nameOf(m.from);
    const arrow = document.createElement('span'); arrow.className = 'arrow'; arrow.textContent = '→';
    arrow.setAttribute('aria-label', t('to'));
    const to = document.createElement('span'); to.textContent = nameOf(m.to);
    const tm = document.createElement('time'); tm.dateTime = item.at.toISOString(); tm.textContent = timeStr(item.at);
    head.append(from, arrow, to, tm);
    const p = document.createElement('p'); p.className = 'msg-text'; p.textContent = L(m.text);
    li.append(head, p);
    return li;
  }
  function pushLog(item) {
    state.log.unshift(item);
    if (state.log.length > 40) state.log.length = 40;
    const el = logEl();
    el.prepend(renderLogItem(item, true));
    while (el.children.length > 40) el.lastElementChild.remove();
  }
  function rerenderLog() {
    const el = logEl();
    el.setAttribute('aria-live', 'off');
    el.textContent = '';
    state.log.forEach((it) => el.appendChild(renderLogItem(it, false)));
    requestAnimationFrame(() => el.setAttribute('aria-live', 'polite'));
  }
  let tickerMsg = null, tickerTimer = 0;
  function renderTicker() {
    const tk = $('#ticker'); if (!tickerMsg) return;
    $('#ticker-who').textContent = `${nameOf(tickerMsg.from)} → ${nameOf(tickerMsg.to)}`;
    $('#ticker-text').textContent = L(tickerMsg.text);
    tk.classList.add('show');
  }
  function playMsg(m) {
    pushLog({ m, at: new Date() });
    state.lastBy.set(m.from, m);
    tickerMsg = m; renderTicker();
    clearTimeout(tickerTimer);
    if (m.from === 'tu') ping($('#you'));
    else {
      const txt = m.status ? () => L(m.status) : (m.to === 'tu' ? () => t('writingToYou') : () => fmt(t('talkingTo'), nameOf(m.to)));
      setStatus(m.from, txt, 'busy', 6500, !!m.typing);
      showBubble(m.from, L(m.text));
    }
    if (state.cardId === m.from) fillCard();
    const go = () => flyEnvelope(anchorOf(m.from), anchorOf(m.to), () => {
      ping(anchorOf(m.to));
      if (m.to !== 'tu') setStatus(m.to, () => t('reading'), 'reading', 3200, false);
    });
    if (reduced) go(); else setTimeout(go, 380);
  }
  function sleepPlaying(ms) {
    return new Promise((res) => {
      let left = ms;
      const step = () => {
        if (left <= 0) { res(); return; }
        setTimeout(() => { if (state.playing && !document.hidden) left -= 100; step(); }, 100);
      };
      step();
    });
  }
  async function feedLoop() {
    const msgs = (state.feed && state.feed.messages) || [];
    if (!msgs.length) return;
    const def = state.feed.defaultDelayMs || 3800;
    await sleepPlaying(1200);
    for (;;) {
      for (const m of msgs) {
        if (!state.agents.has(m.from) && m.from !== 'tu') continue;
        playMsg(m);
        await sleepPlaying(m.delayMs || def);
      }
      await sleepPlaying(state.feed.loopPauseMs || 6000);
      pushLog({ sep: true });
    }
  }

  /* ---------------------------------------------------------------- card */
  const dlg = () => $('#card');
  function openCard(id, opener) {
    const d = dlg(); state.cardId = id; state.cardOpener = opener || null;
    fillCard();
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); }
    else d.setAttribute('open', '');
    $('#card-close').focus();
  }
  function closeCard() {
    const d = dlg();
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }
  function fillCard() {
    const ag = state.agents.get(state.cardId); if (!ag) return;
    $('#card-room').textContent = L(ag.room.name);
    $('#card-name').textContent = ag.a.name;
    $('#card-role').textContent = L(ag.a.role);
    const st = $('#card-status');
    st.textContent = statusText(ag);
    st.className = 'chip' + (ag.override && ag.override.kind ? ' ' + ag.override.kind : '');
    const ul = $('#card-does'); ul.textContent = '';
    (L(ag.a.does) || []).forEach((d) => { const li = document.createElement('li'); li.textContent = d; ul.appendChild(li); });
    const last = state.lastBy.get(state.cardId);
    $('#card-last').hidden = !last;
    if (last) $('#card-last-text').textContent = `→ ${nameOf(last.to)}: ${L(last.text)}`;
    const cv = $('#card-sprite'); const s = 6;
    cv.width = 16 * s; cv.height = 18 * s;
    const c = cv.getContext('2d'); c.setTransform(s, 0, 0, s, 0, 0); c.imageSmoothingEnabled = false;
    px(c, 0, 0, 16, 18, '#18141f');
    alpha(c, 0.18, () => px(c, 0, 0, 16, 18, ROOM_ACCENT[ag.room.id] || '#14b8a6'));
    drawCharacter(c, ag.a.look || {}, 2, 2, false, 1);
  }

  /* -------------------------------------------------------- small art */
  function drawBrand() {
    const cv = $('.brand-logo'); const s = 4; cv.width = 16 * s; cv.height = 16 * s;
    const c = cv.getContext('2d'); c.setTransform(s, 0, 0, s, 0, 0);
    px(c, 3, 3, 10, 11, '#0F766E'); px(c, 3, 3, 10, 1, '#14b8a6');
    [[4, 4, '#ffd27a'], [7, 4, '#2dd4bf'], [10, 4, '#ffd27a'], [4, 7, '#2dd4bf'], [7, 7, '#ffd27a'], [10, 7, '#134e4a'], [4, 10, '#ffd27a'], [10, 10, '#2dd4bf']]
      .forEach(([x, y, col]) => px(c, x, y, 2, 2, col));
    px(c, 7, 11, 2, 3, '#14111d'); px(c, 1, 14, 14, 1, '#3a3350');
  }
  function drawYou() {
    const cv = $('.you-avatar'); const s = 4; cv.width = 12 * s; cv.height = 12 * s;
    const c = cv.getContext('2d'); c.setTransform(s, 0, 0, s, 0, 0);
    const skin = '#d9a477', hair = '#2a1f1a';
    px(c, 1, 10, 10, 2, '#0F766E');
    px(c, 5, 9, 2, 1, shade(skin, -0.2));
    px(c, 2, 3, 8, 6, skin);
    px(c, 2, 1, 8, 1, hair); px(c, 1, 2, 10, 2, hair); px(c, 1, 4, 1, 2, hair); px(c, 10, 4, 1, 2, hair);
    px(c, 2, 7, 1, 2, hair); px(c, 9, 7, 1, 2, hair); px(c, 3, 8, 6, 1, hair);
    px(c, 4, 5, 1, 1, '#1b1420'); px(c, 7, 5, 1, 1, '#1b1420');
  }

  /* --------------------------------------------------------- language */
  function applyLang() {
    document.documentElement.lang = lang;
    document.title = t('docTitle');
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $$('.seg-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    renderPlayPause();
    if (!state.office) return;
    state.rooms.forEach((r) => {
      if (r.extra) { r.h.textContent = t('cafe'); r.count.textContent = ''; r.el.setAttribute('aria-label', t('cafeAria')); return; }
      r.h.textContent = L(r.room.name); r.h.title = L(r.room.name);
      const n = r.room.agents.length;
      r.count.textContent = `${n} ${n === 1 ? t('agentOne') : t('agentMany')}`;
    });
    state.agents.forEach(renderAgent);
    const total = state.office.rooms.reduce((s, r) => s + r.agents.length, 0);
    $('#headcount').textContent = `${total} ${t('agents')} · ${state.office.rooms.length} ${t('rooms')}`;
    buildTeam();
    rerenderLog();
    renderTicker();
    updateClock();
    if (dlg().open) fillCard();
  }
  function setLang(next) {
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(LS_KEY, lang); } catch (e) { /* ignore */ }
    applyLang();
  }
  function renderPlayPause() {
    const b = $('#playpause'); if (!b) return;
    const paused = !state.playing;
    b.setAttribute('aria-pressed', String(paused));
    b.setAttribute('aria-label', paused ? t('playAria') : t('pauseAria'));
    $('.pill-txt', b).textContent = paused ? t('play') : t('pause');
    $('#actividad').classList.toggle('paused', paused);
  }
  function updateClock() {
    const el = $('#clock'); if (!el) return;
    const now = new Date();
    el.dateTime = now.toISOString();
    el.textContent = timeStr(now);
  }

  /* -------------------------------------------------------------- tick */
  function startTick() {
    clearInterval(state.tickId);
    if (reduced) { state.frame = 0; drawAll(); return; }
    state.tickId = setInterval(() => { if (document.hidden) return; state.frame++; drawAll(); }, 420);
  }

  /* -------------------------------------------------------------- init */
  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(path + ' ' + res.status);
    return res.json();
  }
  async function init() {
    drawBrand(); drawYou();
    $$('.seg-btn').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
    $('#playpause').addEventListener('click', () => { state.playing = !state.playing; renderPlayPause(); });
    $('#card-close').addEventListener('click', closeCard);
    dlg().addEventListener('click', (e) => { if (e.target === dlg()) closeCard(); });
    dlg().addEventListener('close', () => {
      state.cardId = null;
      if (state.cardOpener && document.contains(state.cardOpener)) state.cardOpener.focus();
    });
    $('#you').addEventListener('click', () => { const a = $('#actividad'); a.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); });
    reduceMQ.addEventListener ? reduceMQ.addEventListener('change', (e) => { reduced = e.matches; startTick(); })
      : reduceMQ.addListener((e) => { reduced = e.matches; startTick(); });
    applyLang();
    updateClock(); setInterval(updateClock, 20000);
    try {
      const [office, feed] = await Promise.all([loadJSON('data/office.json'), loadJSON('data/feed.json')]);
      state.office = office; state.feed = feed;
    } catch (err) {
      const p = document.createElement('p'); p.className = 'hint'; p.textContent = t('loadError');
      $('#floor').appendChild(p);
      console.error(err);
      return;
    }
    buildRooms();
    applyLang();
    startTick();
    feedLoop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
