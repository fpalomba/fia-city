// Pixel art originale disegnata via codice: tile, personaggi, edifici e badge.
export const TS = 16; // dimensione di un tile in pixel

export const T = { GRASS: 0, PATH: 1, TREE: 2, WATER: 3, FLOWER: 4, HEDGE: 5, FENCE: 6, PLAZA: 7, TALL: 8, SAND: 9 };
export const SOLID = new Set([T.TREE, T.WATER, T.HEDGE, T.FENCE]);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v + amt * 255))));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
export { shade };

// ---------------- Tile ----------------

export function drawTile(ctx, type, tx, ty) {
  const x = tx * TS, y = ty * TS;
  const r = rng(tx * 7349 + ty * 9151 + type * 31);
  const p = (px, py, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + px, y + py, w, h); };
  const grass = () => {
    p(0, 0, 16, 16, '#7ec850');
    for (let i = 0; i < 6; i++) p(Math.floor(r() * 15), Math.floor(r() * 14), 1, 2, r() < 0.5 ? '#6cb442' : '#94d860');
  };
  switch (type) {
    case T.GRASS: grass(); break;
    case T.TALL:
      grass();
      for (let i = 0; i < 4; i++) {
        const bx = 1 + i * 4, by = 6 + (i % 2) * 3;
        p(bx, by, 1, 5, '#3f8f2f'); p(bx + 1, by + 1, 1, 4, '#4fa83a'); p(bx + 2, by + 2, 1, 3, '#3f8f2f');
      }
      break;
    case T.PATH:
      p(0, 0, 16, 16, '#e6d3a3');
      for (let i = 0; i < 5; i++) p(Math.floor(r() * 15), Math.floor(r() * 15), 2, 1, '#d2bb88');
      break;
    case T.SAND:
      p(0, 0, 16, 16, '#d9bf86');
      for (let i = 0; i < 6; i++) p(Math.floor(r() * 15), Math.floor(r() * 15), 1, 1, '#c4a66a');
      break;
    case T.PLAZA:
      p(0, 0, 16, 16, '#d8d1c0');
      p(0, 0, 16, 1, '#bdb4a0'); p(0, 0, 1, 16, '#bdb4a0'); p(8, 8, 8, 1, '#c9c1ae'); p(8, 8, 1, 8, '#c9c1ae');
      break;
    case T.WATER:
      p(0, 0, 16, 16, '#4fa3e0');
      p(2 + Math.floor(r() * 4), 4, 5, 1, '#8fd0ff'); p(8 + Math.floor(r() * 3), 11, 5, 1, '#8fd0ff');
      break;
    case T.FLOWER: {
      grass();
      const cols = ['#ff6b6b', '#ffd43b', '#ffffff', '#f783ac'];
      for (let i = 0; i < 3; i++) {
        const fx = 2 + Math.floor(r() * 11), fy = 2 + Math.floor(r() * 11), c = cols[Math.floor(r() * cols.length)];
        p(fx, fy - 1, 1, 1, c); p(fx - 1, fy, 3, 1, c); p(fx, fy + 1, 1, 1, c); p(fx, fy, 1, 1, '#f59f00');
      }
      break;
    }
    case T.TREE:
      grass();
      p(7, 11, 3, 4, '#6d4c41');
      p(3, 2, 10, 9, '#2f7d32'); p(2, 4, 12, 5, '#2f7d32'); p(4, 1, 8, 1, '#2f7d32');
      p(4, 3, 4, 3, '#43a047'); p(5, 2, 3, 1, '#4caf50');
      p(3, 10, 10, 1, '#1b5e20');
      break;
    case T.HEDGE:
      p(0, 0, 16, 16, '#3d8b3d');
      p(0, 12, 16, 4, '#2e6b2e');
      for (let i = 0; i < 4; i++) p(1 + i * 4, 2 + (i % 2) * 3, 2, 2, '#57a957');
      break;
    case T.FENCE:
      grass();
      p(0, 6, 16, 2, '#a0703c'); p(0, 10, 16, 2, '#a0703c');
      p(2, 3, 3, 11, '#c08a52'); p(11, 3, 3, 11, '#c08a52'); p(2, 3, 3, 1, '#e0b07a'); p(11, 3, 3, 1, '#e0b07a');
      break;
  }
}

// ---------------- Personaggi ----------------

export const LOOKS = {
  player: { skin: '#f1c27d', hair: '#3b2a1a', cap: '#e4572e', shirt: '#2e86ab', pants: '#2b2f45' },
  ada: { skin: '#f3cfb3', hair: '#7b3f9e', long: true, shirt: '#f2c14e', pants: '#5c3d7a' },
  prof: { skin: '#e2ae8c', hair: '#24180f', beard: '#3a2a1f', shirt: '#1f2a44', collar: '#c9d6ea', pants: '#2b2f45', watch: '#e03131' },
  librarian: { skin: '#f1c9a5', hair: '#9a9a9a', bun: true, glasses: true, shirt: '#c0504d', pants: '#5a2f2e' },
  curator: { skin: '#d9a77c', hair: '#5b4636', shirt: '#8064a2', pants: '#3f2f55', glasses: true },
  scientist: { skin: '#f6d2b6', hair: '#d9822b', long: true, shirt: '#ffffff', pants: '#4f81bd' },
  actor: { skin: '#e8b48f', hair: '#1c1c1c', tophat: '#1c1c1c', shirt: '#9b2335', pants: '#1c1c1c' },
  philosopher: { skin: '#e9c09c', hair: '#dcdcdc', beard: '#dcdcdc', shirt: '#f1ede1', pants: '#d99a2b' },
  engineer: { skin: '#c68e63', hair: '#2b1d14', helmet: '#ffd43b', shirt: '#f08c00', pants: '#3b5b75' },
  agent: { skin: '#f0c8a0', hair: '#111111', shades: true, shirt: '#222831', pants: '#111111' },
  mechanic: { skin: '#b9825a', hair: '#3b2a1a', cap: '#3b5bdb', shirt: '#3b5bdb', pants: '#3b5bdb' },
  guard: { skin: '#e8b48f', hair: '#2b1d14', cap: '#1f2a44', shirt: '#1f2a44', pants: '#1f2a44' },
  worker: { skin: '#d6a07a', hair: '#2b1d14', helmet: '#ffd43b', shirt: '#f76707', pants: '#495057' },
  student1: { skin: '#f1c27d', hair: '#a0522d', shirt: '#2f9e44', pants: '#364fc7' },
  student2: { skin: '#8d5524', hair: '#111111', long: true, shirt: '#e64980', pants: '#343a40' }
};

// dir: 'down' | 'up' | 'left' | 'right'; frame: 0 fermo, 1/2 passo
export function drawChar(ctx, x, y, look, dir, frame = 0) {
  const L = look;
  const OUT = '#1d1f2b';
  const flip = dir === 'right';
  const p = (px, py, w, h, c) => {
    ctx.fillStyle = c;
    const rx = flip ? 16 - px - w : px;
    ctx.fillRect(x + rx, y + py, w, h);
  };
  const bob = frame ? 1 : 0;
  const top = 0 + bob;
  // ombra
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.fillRect(x + 3, y + 14, 10, 2);
  // gambe
  const legY = 12 + bob;
  const lUp = frame === 1, rUp = frame === 2;
  p(4, legY, 4, lUp ? 2 : 3, OUT); p(8, legY, 4, rUp ? 2 : 3, OUT);
  p(5, legY, 2, lUp ? 1 : 2, L.pants); p(9, legY, 2, rUp ? 1 : 2, L.pants);
  // corpo
  p(3, top + 8, 10, 5, OUT);
  p(4, top + 8, 8, 4, L.shirt);
  if (L.collar && dir === 'down') { p(6, top + 8, 4, 1, L.collar); }
  // braccia
  const swing = frame === 1 ? -1 : frame === 2 ? 1 : 0;
  if (dir === 'left' || dir === 'right') {
    p(7 + swing, top + 9, 2, 3, shade(L.shirt, -0.12)); p(7 + swing, top + 11, 2, 1, L.skin);
  } else {
    p(2, top + 9 + (swing > 0 ? 1 : 0), 2, 3, OUT); p(12, top + 9 + (swing < 0 ? 1 : 0), 2, 3, OUT);
    p(2, top + 9 + (swing > 0 ? 1 : 0), 1, 2, L.shirt); p(13, top + 9 + (swing < 0 ? 1 : 0), 1, 2, L.shirt);
    p(2, top + 11 + (swing > 0 ? 1 : 0), 1, 1, L.skin); p(13, top + 11 + (swing < 0 ? 1 : 0), 1, 1, L.skin);
    if (L.watch && dir === 'down') p(13, top + 10 + (swing < 0 ? 1 : 0), 1, 1, L.watch);
  }
  // testa
  p(3, top, 10, 9, OUT);
  p(4, top + 1, 8, 7, L.skin);
  // capelli
  const hair = L.hair;
  if (dir === 'up') {
    p(4, top + 1, 8, 6, hair);
    if (L.long) p(4, top + 7, 8, 2, hair);
  } else {
    p(4, top + 1, 8, 2, hair);
    if (dir === 'down') { p(4, top + 3, 1, 2, hair); p(11, top + 3, 1, 2, hair); }
    else { p(8, top + 1, 4, 5, hair); }
    if (L.long) { p(dir === 'down' ? 3 : 9, top + 3, dir === 'down' ? 1 : 3, 6, hair); if (dir === 'down') p(12, top + 3, 1, 6, hair); }
  }
  if (L.bun) p(6, top - 1, 4, 2, hair);
  // copricapi
  if (L.cap) { p(3, top, 10, 2, L.cap); if (dir === 'down') p(4, top + 2, 8, 1, shade(L.cap, -0.2)); else if (dir !== 'up') p(1, top + 2, 4, 1, shade(L.cap, -0.2)); }
  if (L.helmet) { p(3, top - 1, 10, 3, L.helmet); p(3, top + 1, 10, 1, shade(L.helmet, -0.25)); }
  if (L.tophat) { p(5, top - 3, 6, 4, L.tophat); p(3, top, 10, 1, L.tophat); p(5, top - 1, 6, 1, '#9b2335'); }
  // viso
  if (dir === 'down') {
    p(5, top + 4, 2, 2, OUT); p(9, top + 4, 2, 2, OUT);
    p(5, top + 4, 1, 1, '#ffffff'); p(9, top + 4, 1, 1, '#ffffff');
    if (L.glasses) { p(4, top + 4, 8, 1, '#5c5f73'); }
    if (L.shades) { p(4, top + 4, 8, 2, '#111111'); }
    if (L.beard) { p(4, top + 6, 8, 2, L.beard); p(6, top + 6, 4, 1, shade(L.skin, -0.25)); }
  } else if (dir !== 'up') {
    p(5, top + 4, 1, 2, OUT);
    if (L.glasses || L.shades) p(4, top + 4, 3, 1, L.shades ? '#111' : '#5c5f73');
    if (L.beard) p(4, top + 6, 5, 2, L.beard);
  }
}

// Ritratto di un personaggio su un canvas dedicato (per le schermate).
export function portrait(look, size = 96, dir = 'down') {
  const c = document.createElement('canvas');
  c.width = 20; c.height = 20;
  c.style.width = size + 'px'; c.style.height = size + 'px';
  const g = c.getContext('2d');
  drawChar(g, 2, 3, LOOKS[look] || LOOKS.student1, dir, 0);
  return c;
}

// ---------------- Edifici ----------------

export function drawBuilding(ctx, b) {
  const x = b.x * TS, y = b.y * TS, w = b.w * TS, h = b.h * TS;
  const p = (px, py, ww, hh, c) => { ctx.fillStyle = c; ctx.fillRect(x + px, y + py, ww, hh); };
  if (b.kind === 'construction') {
    p(2, 8, w - 4, h - 8, '#adb5bd');
    for (let i = 0; i < w; i += 8) p(i + 2, 8, 2, h - 8, '#868e96');
    for (let j = 12; j < h; j += 10) p(2, j, w - 4, 2, '#868e96');
    p(0, h - 6, w, 4, '#ffd43b');
    for (let i = 0; i < w; i += 8) p(i, h - 6, 4, 4, '#212529');
    return;
  }
  if (b.kind === 'boss') {
    const stone = '#d5d3e0', dark = '#9c98b3';
    p(0, 22, w, h - 22, stone);
    // timpano
    for (let i = 0; i < 22; i++) p(Math.max(0, w / 2 - i * (w / 44) - 8), i, Math.min(w, i * (w / 22) + 16), 1, i > 18 ? '#7a1f2b' : '#a8323e');
    p(0, 22, w, 3, dark);
    for (let cx = 8; cx < w - 8; cx += 22) { p(cx, 28, 6, h - 34, '#f1f0f7'); p(cx + 5, 28, 1, h - 34, dark); }
    p(w / 2 - 12, h - 24, 24, 24, '#5a3a22'); p(w / 2 - 1, h - 24, 2, 24, '#3e2716');
    p(w / 2 - 14, h - 26, 28, 2, dark);
    p(0, h - 4, w, 4, dark);
    ctx.fillStyle = '#f2c14e';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AULA MAGNA', x + w / 2, y + 38);
    ctx.textAlign = 'left';
    return;
  }
  const roof = b.color || '#c0504d';
  const roofH = 2 * TS;
  // tetto
  p(0, 2, w, roofH - 2, roof);
  for (let j = 5; j < roofH - 2; j += 4) p(0, j, w, 1, shade(roof, -0.12));
  p(0, 2, w, 2, shade(roof, 0.15));
  p(-0, roofH - 2, w, 3, shade(roof, -0.3));
  // muro
  p(1, roofH + 1, w - 2, h - roofH - 1, '#f3ead2');
  p(1, h - 3, w - 2, 3, '#cbbf9f');
  // finestre
  const winY = roofH + 4;
  const wins = b.w >= 5 ? [5, w - 14] : [3];
  for (const wx of wins) { p(wx, winY, 9, 8, '#2b2f45'); p(wx + 1, winY + 1, 7, 6, '#9ad1f5'); p(wx + 1, winY + 1, 3, 2, '#d7f0ff'); }
  // porta
  const dx = (b.door.x - b.x) * TS;
  p(dx + 3, h - 14, 10, 14, '#2b2f45'); p(dx + 4, h - 13, 8, 13, '#8a5a32'); p(dx + 10, h - 7, 1, 2, '#f2c14e');
  // insegna con glifo
  if (b.glyph) {
    p(w / 2 - 7, roofH - 9, 14, 10, '#2b2f45'); p(w / 2 - 6, roofH - 8, 12, 8, '#f8f4e3');
    ctx.fillStyle = '#2b2f45';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(b.glyph, x + w / 2, y + roofH);
    ctx.textAlign = 'left';
  }
}

export function drawSign(ctx, tx, ty, color = '#c08a52') {
  const x = tx * TS, y = ty * TS;
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(x + 7, y + 8, 2, 7);
  ctx.fillStyle = '#2b2f45'; ctx.fillRect(x + 1, y + 2, 14, 8);
  ctx.fillStyle = color; ctx.fillRect(x + 2, y + 3, 12, 6);
  ctx.fillStyle = '#f8f4e3'; ctx.fillRect(x + 4, y + 5, 8, 1); ctx.fillRect(x + 4, y + 7, 6, 1);
}

export function drawGate(ctx, tx, ty, state) {
  const x = tx * TS, y = ty * TS;
  if (state === 'open') return;
  if (state === 'construction') {
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(x, y + 5, 16, 5);
    ctx.fillStyle = '#212529'; for (let i = 0; i < 16; i += 6) ctx.fillRect(x + i, y + 5, 3, 5);
    ctx.fillStyle = '#495057'; ctx.fillRect(x + 1, y + 10, 2, 5); ctx.fillRect(x + 13, y + 10, 2, 5);
    return;
  }
  // cancello chiuso
  ctx.fillStyle = '#495057'; ctx.fillRect(x, y + 3, 16, 2); ctx.fillRect(x, y + 12, 16, 2);
  ctx.fillStyle = '#343a40'; for (let i = 1; i < 16; i += 3) ctx.fillRect(x + i, y + 1, 2, 14);
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(x + 6, y + 7, 4, 3);
}

export function drawFlag(ctx, tx, ty, t) {
  const x = tx * TS, y = ty * TS;
  ctx.fillStyle = '#6d4c41'; ctx.fillRect(x + 7, y - 6, 1, 12);
  const wave = Math.round(Math.sin(t / 200) * 1);
  ctx.fillStyle = '#f2c14e'; ctx.fillRect(x + 8, y - 6 + wave, 6, 4);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 10, y - 5 + wave, 2, 2);
}

// ---------------- Badge ----------------

export function badgeCanvas(color, glyph, earned = true) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const g = c.getContext('2d');
  const col = earned ? color : '#adb5bd';
  const rows = [[5, 6], [3, 10], [2, 12], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [2, 12], [3, 10], [5, 6]];
  rows.forEach(([sx, w], i) => { g.fillStyle = '#1d1f2b'; g.fillRect(sx, i + 1, w, 1); });
  rows.forEach(([sx, w], i) => { if (i > 0 && i < rows.length - 1) { g.fillStyle = col; g.fillRect(sx + 1, i + 1, w - 2, 1); } });
  g.fillStyle = earned ? shade(color, 0.3) : '#ced4da';
  g.fillRect(4, 3, 3, 2);
  g.fillStyle = earned ? '#f2c14e' : '#868e96';
  g.fillRect(5, 5, 6, 6);
  g.fillStyle = '#1d1f2b';
  g.font = '6px "Press Start 2P", monospace';
  g.textAlign = 'center';
  g.fillText(glyph || '?', 8, 11);
  return c;
}
