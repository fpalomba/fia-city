// Modelli 3D low-poly costruiti in codice: personaggi, compagni di studio, edifici e arredo urbano.
// Tutta la grafica è originale (primitive di Three.js), nessun asset esterno.
import * as THREE from '../vendor/three.module.min.js';

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!opts.unique && mats.has(key)) return mats.get(key);
  const m = opts.basic
    ? new THREE.MeshBasicMaterial({ color, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide })
    : new THREE.MeshLambertMaterial({ color, flatShading: true, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, emissive: opts.emissive || 0x000000 });
  if (!opts.unique) mats.set(key, m);
  return m;
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return '#' + c.getHexString();
}

const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}

export function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(boxGeo(w, h, d), typeof color === 'object' ? color : mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function mesh(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, typeof color === 'object' ? color : mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------------- Personaggi ----------------

// Converte un "look" dei vecchi sprite (NPC storici) in un avatar 3D.
export function avatarFromLook(L) {
  return {
    skin: L.skin, hairColor: L.hair, top: L.shirt, bottomColor: L.pants, bottom: 'pantaloni',
    hair: L.bun ? 'chignon' : L.long ? 'lunghi' : 'corti',
    acc: L.glasses ? 'occhiali' : 'nessuno',
    cap: L.cap, helmet: L.helmet, tophat: L.tophat, shades: L.shades, beard: L.beard, collar: L.collar
  };
}

// Restituisce un Group alto ~1 unità (un tile), rivolto verso +z, con le parti animabili in userData.
export function makeCharacter(a) {
  const g = new THREE.Group();
  const skin = a.skin || '#f1c27d';
  const hairC = a.hairColor || '#3b2a1a';
  const top = a.top || '#2e86ab';
  const bottomC = a.bottomColor || '#2b2f45';
  const shoe = '#2b2f45';

  // gambe (pivot all'anca)
  const legs = [];
  for (const sx of [-0.085, 0.085]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.34, 0);
    const legColor = a.bottom === 'pantaloni' ? bottomC : skin;
    const leg = box(0.13, 0.3, 0.14, legColor, 0, -0.15, 0);
    pivot.add(leg);
    if (a.bottom === 'pantaloncini') pivot.add(box(0.14, 0.13, 0.15, bottomC, 0, -0.06, 0));
    pivot.add(box(0.14, 0.06, 0.18, shoe, 0, -0.31, 0.02));
    g.add(pivot);
    legs.push(pivot);
  }
  // busto
  const body = new THREE.Group();
  g.add(body);
  body.add(box(0.36, 0.32, 0.22, top, 0, 0.5, 0));
  if (a.bottom === 'gonna') {
    const skirt = mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.2, 8), bottomC, 0, 0.32, 0);
    body.add(skirt);
  } else {
    body.add(box(0.36, 0.06, 0.22, shade(a.bottom === 'pantaloni' ? bottomC : top, -0.12), 0, 0.36, 0));
  }
  if (a.collar) body.add(box(0.2, 0.05, 0.03, a.collar, 0, 0.64, 0.11));
  // braccia (pivot alla spalla)
  const arms = [];
  for (const sx of [-0.23, 0.23]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.63, 0);
    pivot.add(box(0.1, 0.2, 0.12, shade(top, -0.06), 0, -0.08, 0));
    pivot.add(box(0.09, 0.11, 0.1, skin, 0, -0.23, 0));
    body.add(pivot);
    arms.push(pivot);
  }
  // testa
  const head = new THREE.Group();
  head.position.set(0, 0.86, 0);
  body.add(head);
  head.add(box(0.42, 0.38, 0.38, skin, 0, 0, 0));
  const eye = '#1d1f2b';
  head.add(box(0.06, 0.08, 0.02, eye, -0.09, -0.01, 0.195));
  head.add(box(0.06, 0.08, 0.02, eye, 0.09, -0.01, 0.195));
  head.add(box(0.02, 0.02, 0.01, '#ffffff', -0.08, 0.01, 0.207));
  head.add(box(0.02, 0.02, 0.01, '#ffffff', 0.1, 0.01, 0.207));
  head.add(box(0.07, 0.025, 0.01, shade(skin, -0.25), 0, -0.11, 0.195));
  head.add(box(0.06, 0.03, 0.01, '#f4a5a5', -0.15, -0.07, 0.193));
  head.add(box(0.06, 0.03, 0.01, '#f4a5a5', 0.15, -0.07, 0.193));
  addHair(head, a.hair || 'corti', hairC);
  if (a.beard) head.add(box(0.36, 0.12, 0.06, a.beard, 0, -0.15, 0.18));
  if (a.acc === 'occhiali' || a.shades) {
    const c = a.shades ? '#111111' : '#495057';
    head.add(box(0.13, 0.1, 0.02, a.shades ? '#111111' : mat('#a5d8ff', { transparent: true, opacity: 0.45 }), -0.09, -0.01, 0.215));
    head.add(box(0.13, 0.1, 0.02, a.shades ? '#111111' : mat('#a5d8ff', { transparent: true, opacity: 0.45 }), 0.09, -0.01, 0.215));
    head.add(box(0.4, 0.02, 0.02, c, 0, 0.035, 0.215));
  }
  const capC = a.cap || (a.acc === 'berretto' ? shade(top, -0.1) : null);
  if (capC) {
    head.add(box(0.44, 0.1, 0.4, capC, 0, 0.2, 0));
    head.add(box(0.36, 0.03, 0.16, shade(capC, -0.15), 0, 0.16, 0.26));
  }
  if (a.helmet) {
    const h = mesh(new THREE.SphereGeometry(0.25, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), a.helmet, 0, 0.13, 0);
    head.add(h);
    head.add(box(0.5, 0.03, 0.46, shade(a.helmet, -0.2), 0, 0.13, 0.02));
  }
  if (a.tophat) {
    head.add(box(0.5, 0.03, 0.48, a.tophat, 0, 0.2, 0));
    head.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 8), a.tophat, 0, 0.34, 0));
    head.add(mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.05, 8), '#9b2335', 0, 0.24, 0));
  }
  if (a.acc === 'cuffie') {
    head.add(box(0.46, 0.04, 0.06, '#343a40', 0, 0.21, 0));
    head.add(box(0.06, 0.14, 0.12, '#e03131', -0.23, 0.0, 0));
    head.add(box(0.06, 0.14, 0.12, '#e03131', 0.23, 0.0, 0));
  }
  if (a.acc === 'fiocco') {
    head.add(box(0.1, 0.08, 0.04, '#f06595', 0.12, 0.2, 0.12));
    head.add(box(0.1, 0.08, 0.04, '#f06595', 0.24, 0.2, 0.12));
    head.add(box(0.05, 0.05, 0.05, '#c2255c', 0.18, 0.2, 0.12));
  }
  // ombra morbida
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), mat('#000000', { basic: true, transparent: true, opacity: 0.22 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  g.add(shadow);
  g.userData = { legs, arms, body, head };
  return g;
}

function addHair(head, style, c) {
  const dark = shade(c, -0.08);
  switch (style) {
    case 'rasati':
      head.add(box(0.43, 0.05, 0.39, c, 0, 0.19, 0));
      head.add(box(0.43, 0.2, 0.04, c, 0, 0.06, -0.18));
      break;
    case 'lunghi':
      head.add(box(0.45, 0.12, 0.41, c, 0, 0.18, 0));
      head.add(box(0.45, 0.55, 0.1, dark, 0, -0.08, -0.17));
      head.add(box(0.07, 0.42, 0.3, c, -0.22, -0.04, -0.03));
      head.add(box(0.07, 0.42, 0.3, c, 0.22, -0.04, -0.03));
      head.add(box(0.36, 0.07, 0.04, c, 0, 0.12, 0.19));
      break;
    case 'coda':
      head.add(box(0.45, 0.12, 0.41, c, 0, 0.18, 0));
      head.add(box(0.45, 0.25, 0.06, c, 0, 0.05, -0.18));
      head.add(box(0.12, 0.12, 0.12, dark, 0, 0.1, -0.25));
      head.add(box(0.1, 0.32, 0.1, c, 0, -0.08, -0.3));
      head.add(box(0.36, 0.07, 0.04, c, 0, 0.12, 0.19));
      break;
    case 'chignon':
      head.add(box(0.45, 0.12, 0.41, c, 0, 0.18, 0));
      head.add(box(0.45, 0.25, 0.06, c, 0, 0.05, -0.18));
      head.add(mesh(new THREE.IcosahedronGeometry(0.13, 0), dark, 0, 0.3, -0.08));
      head.add(box(0.36, 0.06, 0.04, c, 0, 0.13, 0.19));
      break;
    case 'ricci': {
      const geo = new THREE.IcosahedronGeometry(0.1, 0);
      const spots = [[-0.16, 0.18, 0.1], [0, 0.22, 0.12], [0.16, 0.18, 0.1], [-0.18, 0.2, -0.08], [0.18, 0.2, -0.08], [0, 0.24, -0.06],
        [-0.2, 0.04, -0.14], [0.2, 0.04, -0.14], [0, 0.08, -0.2], [-0.1, 0.24, 0], [0.1, 0.24, 0]];
      for (const [x, y, z] of spots) head.add(mesh(geo, (x + z) > 0 ? c : dark, x, y, z));
      break;
    }
    default: // corti
      head.add(box(0.45, 0.12, 0.41, c, 0, 0.18, 0));
      head.add(box(0.45, 0.24, 0.06, dark, 0, 0.06, -0.18));
      head.add(box(0.06, 0.14, 0.3, c, -0.22, 0.08, -0.04));
      head.add(box(0.06, 0.14, 0.3, c, 0.22, 0.08, -0.04));
      head.add(box(0.3, 0.06, 0.04, c, -0.04, 0.12, 0.19));
  }
}

// Animazione di camminata: phase in [0,1) per passo, moving = in movimento.
export function animateCharacter(ch, phase, moving, t) {
  const { legs, arms, body } = ch.userData;
  const s = moving ? Math.sin(phase * Math.PI * 2) : 0;
  legs[0].rotation.x = s * 0.6; legs[1].rotation.x = -s * 0.6;
  arms[0].rotation.x = -s * 0.7; arms[1].rotation.x = s * 0.7;
  body.position.y = moving ? Math.abs(Math.sin(phase * Math.PI * 2)) * 0.04 : Math.sin(t / 600) * 0.008;
}

// ---------------- Compagni di studio ----------------

export function makePet(species, color) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const c = color || '#4dabf7';
  const light = shade(c, 0.18), dark = shade(c, -0.18);
  const parts = {};
  if (species === 'gufo') {
    const bodyM = mesh(new THREE.SphereGeometry(0.22, 8, 6), c, 0, 0.26, 0);
    bodyM.scale.set(1, 1.15, 0.95);
    inner.add(bodyM);
    const belly = mesh(new THREE.SphereGeometry(0.16, 8, 6), '#f8f0e3', 0, 0.22, 0.09);
    belly.scale.set(1, 1.1, 0.6);
    inner.add(belly);
    for (const sx of [-0.08, 0.08]) {
      inner.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), '#ffffff', sx, 0.38, 0.17));
      inner.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), '#1d1f2b', sx, 0.38, 0.23));
      const ear = mesh(new THREE.ConeGeometry(0.05, 0.12, 4), dark, sx * 1.6, 0.53, 0);
      ear.rotation.z = -sx * 3;
      inner.add(ear);
    }
    const beak = mesh(new THREE.ConeGeometry(0.035, 0.08, 4), '#f59f00', 0, 0.31, 0.22);
    beak.rotation.x = Math.PI / 2 + 0.4;
    inner.add(beak);
    parts.wings = [-1, 1].map((sx) => {
      const w = mesh(new THREE.SphereGeometry(0.12, 6, 4), dark, sx * 0.2, 0.25, -0.02);
      w.scale.set(0.35, 1, 0.8);
      inner.add(w);
      return w;
    });
    for (const sx of [-0.07, 0.07]) inner.add(box(0.05, 0.04, 0.08, '#f59f00', sx, 0.02, 0.04));
    parts.hover = 0;
  } else if (species === 'drago') {
    const bodyM = mesh(new THREE.SphereGeometry(0.2, 8, 6), c, 0, 0.22, 0);
    bodyM.scale.set(1, 0.95, 1.15);
    inner.add(bodyM);
    const belly = mesh(new THREE.SphereGeometry(0.14, 8, 6), '#fff3bf', 0, 0.19, 0.1);
    belly.scale.set(1, 1, 0.6);
    inner.add(belly);
    const head = new THREE.Group();
    head.position.set(0, 0.45, 0.07);
    inner.add(head);
    head.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), c, 0, 0, 0));
    const snout = mesh(new THREE.SphereGeometry(0.09, 8, 5), light, 0, -0.04, 0.13);
    snout.scale.set(1.1, 0.8, 1);
    head.add(snout);
    for (const sx of [-0.07, 0.07]) {
      head.add(mesh(new THREE.SphereGeometry(0.04, 6, 4), '#ffffff', sx, 0.04, 0.13));
      head.add(mesh(new THREE.SphereGeometry(0.022, 6, 4), '#1d1f2b', sx, 0.04, 0.165));
      const horn = mesh(new THREE.ConeGeometry(0.03, 0.1, 4), '#fff3bf', sx, 0.16, -0.03);
      horn.rotation.x = -0.4;
      head.add(horn);
    }
    parts.wings = [-1, 1].map((sx) => {
      const w = mesh(new THREE.ConeGeometry(0.1, 0.22, 3), dark, sx * 0.2, 0.33, -0.08);
      w.rotation.z = sx * 1.1;
      inner.add(w);
      return w;
    });
    const tail = mesh(new THREE.ConeGeometry(0.07, 0.3, 5), c, 0, 0.12, -0.27);
    tail.rotation.x = -1.2;
    inner.add(tail);
    for (const sx of [-0.09, 0.09]) inner.add(box(0.08, 0.08, 0.1, dark, sx, 0.04, 0.03));
    parts.hover = 0;
  } else {
    // robot fluttuante
    const bodyM = mesh(new THREE.IcosahedronGeometry(0.2, 1), c, 0, 0.42, 0);
    bodyM.scale.set(1.1, 0.95, 1);
    inner.add(bodyM);
    inner.add(box(0.26, 0.15, 0.04, '#1d1f2b', 0, 0.44, 0.18));
    for (const sx of [-0.06, 0.06]) inner.add(box(0.045, 0.06, 0.02, mat('#63e6be', { basic: true }), sx, 0.45, 0.205));
    inner.add(box(0.02, 0.12, 0.02, '#868e96', 0, 0.66, 0));
    parts.bulb = mesh(new THREE.SphereGeometry(0.04, 8, 6), mat('#ffd43b', { basic: true }), 0, 0.74, 0);
    inner.add(parts.bulb);
    parts.wings = [-1, 1].map((sx) => {
      const w = box(0.06, 0.12, 0.12, dark, sx * 0.24, 0.4, 0);
      inner.add(w);
      return w;
    });
    inner.add(mesh(new THREE.ConeGeometry(0.08, 0.1, 6), light, 0, 0.21, 0));
    parts.hover = 1;
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), mat('#000000', { basic: true, transparent: true, opacity: 0.2 }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  g.add(shadow);
  g.userData = { inner, parts, species };
  return g;
}

export function animatePet(p, t, moving) {
  const { inner, parts } = p.userData;
  if (parts.hover) {
    inner.position.y = 0.06 + Math.sin(t / 380) * 0.05;
    if (parts.bulb) parts.bulb.material.color.setHSL(0.13, 1, 0.5 + Math.sin(t / 200) * 0.15);
  } else {
    inner.position.y = moving ? Math.abs(Math.sin(t / 90)) * 0.08 : Math.abs(Math.sin(t / 700)) * 0.02;
  }
  const flap = Math.sin(t / (moving ? 70 : 260)) * (moving ? 0.5 : 0.15);
  if (parts.wings) { parts.wings[0].rotation.y = flap; parts.wings[1].rotation.y = -flap; }
}

// ---------------- Testi su texture ----------------

export function textTexture(lines, { w = 512, h = 128, bg = '#f8f4e3', fg = '#1d1f2b', border = '#1d1f2b', font = '600 54px "Pixelify Sans", monospace', glyph = null, glyphBg = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = border; g.fillRect(0, 0, w, h);
  g.fillStyle = bg; g.fillRect(8, 8, w - 16, h - 16);
  let x0 = 0;
  if (glyph) {
    g.fillStyle = glyphBg || '#1d1f2b';
    g.fillRect(16, 16, h - 32, h - 32);
    g.fillStyle = '#ffffff';
    g.font = `${Math.round(h * 0.5)}px "Press Start 2P", monospace`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(glyph, h / 2, h / 2 + 4);
    x0 = h - 16;
  }
  g.fillStyle = fg;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  const avail = w - x0 - 32;
  const fit = () => { g.font = font.replace(/\d+px/, size + 'px'); return Math.max(...arr.map((l) => g.measureText(l).width)); };
  while (fit() > avail && size > 14) size -= 2;
  const lh = size * 1.1;
  arr.forEach((l, i) => g.fillText(l, x0 + 16 + avail / 2, h / 2 + (i - (arr.length - 1) / 2) * lh + 2));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Divide un nome lungo su due righe per le insegne.
function splitName(name) {
  if (name.length <= 18) return [name];
  const words = name.split(' ');
  let best = [name], bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const d = Math.abs(a.length - b.length);
    if (d < bestDiff) { bestDiff = d; best = [a, b]; }
  }
  return best;
}

// ---------------- Edifici ----------------

function roofGeo(width, depth, height) {
  const s = new THREE.Shape();
  s.moveTo(-depth / 2, 0); s.lineTo(depth / 2, 0); s.lineTo(0, height); s.lineTo(-depth / 2, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(Math.PI / 2);
  return geo;
}

// Edificio standard 5x4: il gruppo ha origine nell'angolo (o.x, o.y) del suo ingombro.
export function makeBuilding(o) {
  const g = new THREE.Group();
  g.position.set(o.x, 0, o.y);
  const W = o.w, D = o.h;
  const fz = D - 0.08; // facciata
  const cx = W / 2;
  if (o.kind === 'construction') return makeConstruction(g, W, D);
  const roofC = o.color || '#c0504d';
  const wall = '#f3ead7';
  g.add(box(W - 0.2, 0.2, D - 0.5, '#b7ab93', cx, 0.1, D / 2 - 0.15));
  g.add(box(W - 0.4, 2.0, D - 0.7, wall, cx, 1.1, D / 2 - 0.25));
  g.add(box(W - 0.36, 0.14, D - 0.66, shade(roofC, -0.2), cx, 2.13, D / 2 - 0.25));
  const roof = new THREE.Mesh(roofGeo(W, D - 0.1, 1.2), mat(roofC));
  roof.position.set(cx, 2.2, D / 2 - 0.25);
  roof.castShadow = true; roof.receiveShadow = true;
  g.add(roof);
  // porta
  const dx = o.door.x - o.x + 0.5;
  g.add(box(0.86, 1.25, 0.12, shade(roofC, -0.3), dx, 0.72, fz - 0.24));
  g.add(box(0.7, 1.12, 0.06, '#5c3d2e', dx, 0.66, fz - 0.17));
  g.add(box(0.07, 0.07, 0.04, '#ffd43b', dx + 0.22, 0.66, fz - 0.13));
  g.add(box(1.1, 0.06, 0.5, '#b7ab93', dx, 0.03, fz + 0.05));
  // finestre
  for (const wx of [0.85, W - 0.85]) {
    if (Math.abs(wx - dx) < 0.9) continue;
    g.add(box(0.7, 0.62, 0.06, '#5c5f73', wx, 1.25, fz - 0.26));
    g.add(box(0.6, 0.52, 0.05, mat('#a5d8ff', { emissive: 0x112233 }), wx, 1.25, fz - 0.23));
    g.add(box(0.6, 0.04, 0.06, '#5c5f73', wx, 1.25, fz - 0.21));
    g.add(box(0.8, 0.06, 0.16, shade(roofC, -0.1), wx, 0.92, fz - 0.2));
  }
  // insegna con il nome
  const tex = textTexture(splitName(o.name), { w: 640, h: 128, glyph: o.glyph, glyphBg: roofC });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.68), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(cx, 1.78, fz - 0.19);
  g.add(sign);
  // bandiera del badge (visibile solo con il badge)
  const flag = new THREE.Group();
  flag.position.set(W - 0.6, 2.2, 0.5);
  flag.add(box(0.05, 1.3, 0.05, '#adb5bd', 0, 0.65, 0));
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.38, 4, 1), mat(roofC, { basic: true, side: THREE.DoubleSide }));
  cloth.position.set(0.32, 1.1, 0);
  flag.add(cloth);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), mat('#ffd43b', { basic: true }));
  star.position.set(0, 1.38, 0);
  flag.add(star);
  flag.visible = false;
  g.add(flag);
  g.userData.flag = flag;
  g.userData.cloth = cloth;
  return g;
}

function makeConstruction(g, W, D) {
  const cx = W / 2;
  g.add(box(W - 0.4, 0.9, D - 0.8, '#adb5bd', cx, 0.45, D / 2 - 0.3));
  g.add(box(W - 0.6, 0.5, D - 1.0, '#ced4da', cx, 1.15, D / 2 - 0.3));
  for (const px of [0.3, W - 0.3]) for (const pz of [0.4, D - 0.4]) g.add(box(0.08, 2.2, 0.08, '#f08c00', px, 1.1, pz));
  for (const y of [1.0, 1.9]) {
    g.add(box(W - 0.5, 0.06, 0.08, '#f08c00', cx, y, D - 0.4));
    g.add(box(W - 0.5, 0.06, 0.08, '#f08c00', cx, y, 0.4));
  }
  // gru
  g.add(box(0.14, 3.4, 0.14, '#ffd43b', W - 0.9, 1.7, 0.8));
  g.add(box(2.6, 0.12, 0.12, '#ffd43b', W - 1.6, 3.35, 0.8));
  g.add(box(0.03, 0.9, 0.03, '#495057', W - 2.6, 2.9, 0.8));
  g.add(box(0.3, 0.2, 0.3, '#495057', W - 2.6, 2.4, 0.8));
  const tex = textTexture('CANTIERE', { w: 384, h: 96, bg: '#ffd43b' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(cx, 0.65, D - 0.36);
  g.add(sign);
  for (const px of [0.6, W - 0.6]) {
    const cone = mesh(new THREE.ConeGeometry(0.14, 0.36, 8), '#ff6b00', px, 0.18, D - 0.15);
    g.add(cone);
  }
  return g;
}

// Osservatorio 4x3: torre cilindrica con cupola e telescopio. La porta guarda il viale (doorDir left/right).
export function makeObservatory(o) {
  const g = new THREE.Group();
  g.position.set(o.x, 0, o.y);
  const col = o.color || '#7048e8';
  const inner = new THREE.Group();          // costruito con la porta verso +z, poi ruotato
  inner.position.set(o.w / 2, 0, o.h / 2);
  inner.rotation.y = o.doorDir === 'left' ? Math.PI / 2 : o.doorDir === 'right' ? -Math.PI / 2 : 0;
  g.add(inner);
  const R = 1.35;
  inner.add(box(3.0, 0.16, 3.8, '#b7ab93', 0, 0.08, 0));
  inner.add(mesh(new THREE.CylinderGeometry(R, R + 0.08, 1.7, 16), '#f3ead7', 0, 1.0, -0.2));
  inner.add(mesh(new THREE.CylinderGeometry(R + 0.05, R + 0.05, 0.18, 16), shade(col, -0.15), 0, 1.92, -0.2));
  inner.add(mesh(new THREE.SphereGeometry(R - 0.05, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#dee2e6', 0, 2.0, -0.2));
  const tube = mesh(new THREE.CylinderGeometry(0.13, 0.17, 1.6, 10), col, 0, 2.95, 0.35);
  tube.rotation.x = 0.95;
  inner.add(tube);
  inner.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.07, 10), mat('#ffe066', { emissive: 0x554400 }), 0, 2.95 + 0.8 * Math.cos(0.95), 0.35 + 0.8 * Math.sin(0.95)));
  const fz = -0.2 + R;
  inner.add(box(0.86, 1.25, 0.14, shade(col, -0.3), 0, 0.72, fz - 0.02));
  inner.add(box(0.68, 1.1, 0.06, '#3b2d5c', 0, 0.65, fz + 0.06));
  inner.add(box(1.0, 0.06, 0.55, '#b7ab93', 0, 0.03, fz + 0.4));
  for (const sx of [-0.85, 0.85]) inner.add(mesh(new THREE.OctahedronGeometry(0.11), mat('#ffd43b', { emissive: 0x332200 }), sx, 1.2, fz - 0.25));
  const tex = textTexture(splitName(o.name), { w: 640, h: 128, glyph: o.glyph, glyphBg: col });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 0.54), new THREE.MeshBasicMaterial({ map: tex }));
  sign.position.set(0, 1.62, fz + 0.12);
  inner.add(sign);
  return g;
}

// Aula Magna del Test Finale (12x7) con colonnato e frontone.
export function makeBossHall(o, name) {
  const g = new THREE.Group();
  g.position.set(o.x, 0, o.y);
  const W = o.w, D = o.h, cx = W / 2;
  const marble = '#f1ede1', marbleD = '#d8d1c0';
  for (let i = 0; i < 3; i++) g.add(box(W - i * 0.4, 0.15, D - i * 0.35, i % 2 ? marble : marbleD, cx, 0.075 + i * 0.15, D / 2 - i * 0.12));
  g.add(box(W - 1.8, 3.4, D - 2.6, marble, cx, 2.15, D / 2 - 0.8));
  // colonnato
  const colGeo = new THREE.CylinderGeometry(0.2, 0.24, 3.2, 10);
  const nCol = 8;
  for (let i = 0; i < nCol; i++) {
    const x = 1.2 + i * ((W - 2.4) / (nCol - 1));
    if (Math.abs(x - cx) < 0.9) continue;
    g.add(mesh(colGeo, marble, x, 2.05, D - 1.0));
    g.add(box(0.55, 0.15, 0.55, marbleD, x, 3.72, D - 1.0));
  }
  g.add(box(W - 0.6, 0.35, 1.5, marbleD, cx, 3.95, D - 1.15));
  const ped = new THREE.Mesh(roofGeo(1.5, W - 0.6, 1.3), mat('#9b2335'));
  ped.rotation.y = Math.PI / 2;
  ped.position.set(cx, 4.12, D - 1.15);
  g.add(ped);
  const roof = new THREE.Mesh(roofGeo(W - 1.6, D - 2.4, 1.6), mat('#9b2335'));
  roof.position.set(cx, 3.85, D / 2 - 0.9);
  roof.castShadow = true;
  g.add(roof);
  // fregio con il nome
  const tex = textTexture(['AULA MAGNA', 'del Test Finale'], { w: 1024, h: 160, bg: '#f1ede1', border: '#c9a227', fg: '#9b2335' });
  const frieze = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 1.0), new THREE.MeshBasicMaterial({ map: tex }));
  frieze.position.set(cx, 3.95, D - 0.39);
  g.add(frieze);
  // portone a due ante (porta su due tile)
  const doorX = o.door.x - o.x + (o.doorW || 1) / 2;
  g.add(box(1.9, 2.3, 0.1, '#c9a227', doorX, 1.6, D - 1.38));
  g.add(box(0.8, 2.1, 0.06, '#5c2b1e', doorX - 0.42, 1.5, D - 1.32));
  g.add(box(0.8, 2.1, 0.06, '#5c2b1e', doorX + 0.42, 1.5, D - 1.32));
  // tappeto rosso
  g.add(box(1.8, 0.04, 2.4, '#c92a2a', doorX, 0.47, D - 0.2));
  // stendardi
  for (const bx of [1.3, W - 1.3]) {
    const t = textTexture(['TEST', 'FINALE'], { w: 128, h: 256, bg: '#9b2335', fg: '#ffd43b', border: '#c9a227', font: '600 40px "Press Start 2P", monospace' });
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    ban.position.set(bx, 2.4, D - 0.75);
    g.add(ban);
  }
  g.userData.name = name;
  return g;
}

// ---------------- Arredo ----------------

export function makeSign(color = '#c08a52', label = null) {
  const g = new THREE.Group();
  g.add(box(0.08, 0.6, 0.08, '#8b5e34', 0, 0.3, 0));
  g.add(box(0.62, 0.4, 0.08, '#5c3d2e', 0, 0.68, 0));
  if (label) {
    const tex = textTexture(label, { w: 256, h: 160, bg: '#f8f4e3', fg: '#1d1f2b', border: color, font: '600 44px "Pixelify Sans", monospace' });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), new THREE.MeshBasicMaterial({ map: tex }));
    p.position.set(0, 0.68, 0.045);
    g.add(p);
  } else {
    g.add(box(0.54, 0.32, 0.09, color, 0, 0.68, 0));
  }
  return g;
}

// Cancelli: open | locked | construction
export function makeGate(tiles, kind) {
  const g = new THREE.Group();
  const xs = tiles.map((t) => t.x), y = tiles[0].y;
  const x0 = Math.min(...xs), x1 = Math.max(...xs) + 1;
  const len = x1 - x0;
  const cx = (x0 + x1) / 2, cz = y + 0.5;
  const stoneC = kind === 'boss' ? '#d8d1c0' : '#adb5bd';
  for (const px of [x0 - 0.15, x1 + 0.15]) {
    g.add(box(0.36, 1.5, 0.5, stoneC, px, 0.75, cz));
    g.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), kind === 'boss' ? '#c9a227' : '#868e96', px, 1.65, cz));
  }
  const locked = new THREE.Group();
  const bars = Math.max(3, Math.round(len * 4));
  for (let i = 0; i < bars; i++) locked.add(box(0.06, 1.25, 0.06, '#343a40', x0 + (i + 0.5) * (len / bars), 0.63, cz));
  locked.add(box(len, 0.08, 0.08, '#343a40', cx, 1.2, cz));
  locked.add(box(len, 0.08, 0.08, '#343a40', cx, 0.25, cz));
  locked.add(box(0.26, 0.22, 0.1, '#f59f00', cx, 0.75, cz + 0.06));
  locked.add(mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 10, Math.PI), '#adb5bd', cx, 0.86, cz + 0.06));
  g.add(locked);
  const works = new THREE.Group();
  for (let i = 0; i < 4; i++) works.add(box(len / 4, 0.16, 0.08, i % 2 ? '#f8f9fa' : '#e03131', x0 + (i + 0.5) * (len / 4), 0.65, cz));
  for (const px of [x0 + 0.15, x1 - 0.15]) works.add(box(0.06, 0.65, 0.06, '#495057', px, 0.33, cz));
  works.add(mesh(new THREE.ConeGeometry(0.12, 0.32, 8), '#ff6b00', cx, 0.16, cz + 0.3));
  g.add(works);
  g.userData.setState = (st) => { locked.visible = st === 'locked'; works.visible = st === 'construction'; };
  return g;
}

// Lampione decorativo.
export function makeLamp() {
  const g = new THREE.Group();
  g.add(box(0.08, 1.6, 0.08, '#343a40', 0, 0.8, 0));
  g.add(box(0.26, 0.06, 0.26, '#343a40', 0, 1.62, 0));
  g.add(box(0.18, 0.2, 0.18, mat('#fff3bf', { emissive: 0x665522 }), 0, 1.5, 0));
  return g;
}

// Fumetto sopra la testa degli ex-studenti (consiglio, filosofia, film).
const ICONS = { consiglio: ['!', '#f59f00'], filosofia: ['?', '#7048e8'], film: ['▶', '#e03131'], tesi: ['🎓', '#0ca678'] };
export function makeBubble(kind) {
  const [txt, col] = ICONS[kind] || ['…', '#495057'];
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#1d1f2b';
  g.beginPath(); g.arc(32, 28, 26, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(24, 48); g.lineTo(32, 62); g.lineTo(40, 48); g.fill();
  g.fillStyle = col;
  g.beginPath(); g.arc(32, 28, 21, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  if (txt === '▶') { g.beginPath(); g.moveTo(25, 17); g.lineTo(44, 28); g.lineTo(25, 39); g.fill(); }
  else if (txt === '🎓') { // tocco da laureato disegnato a mano: gli emoji non sono uguali su tutti i sistemi
    g.beginPath(); g.moveTo(32, 16); g.lineTo(48, 24); g.lineTo(32, 32); g.lineTo(16, 24); g.fill();
    g.fillRect(23, 27, 18, 9);
    g.fillRect(45, 24, 2, 10); g.fillRect(43.5, 33, 5, 4);
  }
  else { g.font = 'bold 30px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 32, 30); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(0.42, 0.42, 1);
  s.renderOrder = 10;
  return s;
}
