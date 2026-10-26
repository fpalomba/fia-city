// Generazione della mappa di FIA City a partire dai livelli definiti sul server.
import { T, SOLID } from './sprites.js';
import { OBSERVATORIES } from './observatory.js';

export const W = 56, H = 70;
const AVE = [26, 27, 28, 29];          // colonne del Viale degli Algoritmi
const BANDS = [39, 26, 13];            // y iniziale delle fasce: (L2,L3), (L4,L5), (L6,L7)
const L1_ROW1 = [3, 10, 17, 34, 41, 48];
const L1_ROW2 = [6, 13, 44];
// Posti liberi per gli ex-studenti (mai davanti a porte o cartelli).
const L1_SPOTS = [
  { x: 3, y: 62, dir: 'right' }, { x: 37, y: 58, dir: 'down' }, { x: 11, y: 66, dir: 'up' }, { x: 52, y: 58, dir: 'left' },
  { x: 16, y: 58, dir: 'down' }, { x: 42, y: 66, dir: 'up' }, { x: 20, y: 63, dir: 'right' }, { x: 47, y: 65, dir: 'left' }
];
// Lungo tutto il viale, mai davanti a un cancello o all'ingresso di un osservatorio.
const AVENUE_SPOTS = [
  { x: 26, y: 52, dir: 'right' }, { x: 29, y: 49, dir: 'left' }, { x: 26, y: 41, dir: 'right' }, { x: 29, y: 37, dir: 'left' },
  { x: 26, y: 30, dir: 'right' }, { x: 29, y: 25, dir: 'left' }, { x: 26, y: 21, dir: 'right' }, { x: 29, y: 15, dir: 'left' },
  { x: 26, y: 14, dir: 'right' }
];
// Piazzetta delle tesi: nel giardino ovest della Cittadella, sempre aperta (il cancello del boss è davanti all'Aula Magna).
const PIAZZA_SPOTS = [
  { x: 4, y: 8, dir: 'down' }, { x: 8, y: 8, dir: 'down' }, { x: 12, y: 8, dir: 'down' }, { x: 16, y: 8, dir: 'down' },
  { x: 4, y: 11, dir: 'up' }, { x: 8, y: 11, dir: 'up' }, { x: 12, y: 11, dir: 'up' }
];
const CITADEL_SPOTS = [{ x: 24, y: 10, dir: 'right' }, { x: 34, y: 10, dir: 'left' }];
// Osservatori (4x3) nella striscia del quartiere che dà sul viale: si entrano dal viale, quindi sono sempre aperti.
const OBS_ROWS = [6, 0, 9];

export function buildMap(world) {
  const tiles = new Uint8Array(W * H).fill(T.GRASS);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = t; };
  const fill = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  const objects = [];
  const areas = [];

  // Bordi della città
  fill(0, 0, W - 1, 0, T.TREE); fill(0, H - 1, W - 1, H - 1, T.TREE);
  fill(0, 0, 0, H - 1, T.TREE); fill(W - 1, 0, W - 1, H - 1, T.TREE);

  // ---- Cittadella del Test Finale (boss) ----
  fill(1, 1, W - 2, 11, T.GRASS);
  fill(19, 9, 36, 11, T.PLAZA);
  for (let x = 2; x < 19; x += 3) set(x, 2 + (x % 2), T.TREE);
  for (let x = 38; x < W - 2; x += 3) set(x, 2 + (x % 2), T.TREE);
  fill(2, 6, 17, 7, T.FLOWER); fill(38, 6, 53, 7, T.FLOWER);
  fill(3, 8, 18, 11, T.PLAZA); // piazzetta delle tesi
  objects.push({ type: 'sign', x: 16, y: 11, kind: 'thesis' });
  objects.push({ type: 'boss', x: 22, y: 2, w: 12, h: 7, door: { x: 27, y: 8 }, doorW: 2, kind: 'boss', name: world.boss.building });
  objects.push({ type: 'npc', x: 31, y: 10, look: 'guard', dir: 'down', name: 'Usciere', lines: [
    'Questa è l\'Aula Magna del Test Finale. Qui il Prof. Palomba mette alla prova chi ha conquistato tutti i badge.',
    'Le sue domande riguardano TUTTI i quartieri, e il tempo per rispondere è poco. Buona fortuna!',
    'Intanto, se pensi già alla tesi, fai un salto nella piazzetta qui nel giardino a ovest: è sempre aperta, e gli ex-studenti ti raccontano come si lavora con il Prof.'
  ] });
  areas.push({ x0: 1, y0: 1, x1: W - 2, y1: 11, name: 'Cittadella del Test Finale' });
  fill(1, 12, W - 2, 12, T.HEDGE);
  // Il cancello del boss sta davanti all'Aula Magna: la Cittadella e la piazzetta delle tesi sono sempre aperte.
  objects.push({ type: 'gate', gate: 'boss', tiles: AVE.map((x) => ({ x, y: 9 })) });

  // ---- Quartieri 2-7 ----
  const others = world.levels.slice(1);
  others.forEach((level, i) => {
    const band = BANDS[Math.floor(i / 2)];
    const left = i % 2 === 0;
    const x0 = left ? 1 : 31, x1 = left ? 24 : 54;
    const hedgeX = left ? 25 : 30;
    const y0 = band, y1 = band + 11;
    fill(1, y1 + 1, W - 2, y1 + 1, T.HEDGE); // siepe sotto la fascia
    fill(hedgeX, y0, hedgeX, y1, T.HEDGE);
    fill(x0, y0, x1, y1, level.implemented ? T.GRASS : T.SAND);
    // sentieri interni
    fill(x0 + 1, y0 + 5, x1 - (left ? 0 : 1), y0 + 5, T.PATH);
    fill(left ? x0 + 1 : x0 + 4, y0 + 10, left ? x1 - 4 : x1 - 1, y0 + 10, T.PATH);
    const cx = left ? x1 - 5 : x1 - 2;
    fill(cx, y0 + 5, cx + 1, y0 + 10, T.PATH);
    const gateX = hedgeX, gateY = y0 + 5;
    set(gateX, gateY, T.PATH);
    objects.push({ type: 'gate', gate: level.id, levelIndex: i + 1, implemented: level.implemented, tiles: [{ x: gateX, y: gateY }] });
    objects.push({ type: 'sign', x: gateX, y: gateY - 1, kind: 'district', levelIndex: i + 1 });
    areas.push({ x0, y0, x1, y1, name: level.name, levelIndex: i + 1 });
    const slotsX = left ? [2, 8, 14] : [35, 41, 47];
    const slots = [...slotsX.map((x) => ({ x, y: y0 + 1 })), ...slotsX.map((x) => ({ x, y: y0 + 6 }))];
    if (level.implemented) {
      level.buildings.slice(0, slots.length).forEach((b, k) => addBuilding(objects, b, slots[k], i + 1));
    } else {
      addBuilding(objects, null, slots[1], i + 1, 'construction');
      addBuilding(objects, null, slots[4], i + 1, 'construction');
      objects.push({ type: 'npc', x: slots[2].x + 1, y: y0 + 5, look: 'worker', dir: 'down', name: 'Capocantiere', lines: [
        `Cantiere del ${level.name}! Qui sorgeranno gli edifici su: ${level.lessons.join(', ')}.`,
        'Il quartiere aprirà dopo le lezioni corrispondenti. Torna a trovarci!'
      ] });
      for (let k = 0; k < 6; k++) set(x0 + 2 + k * 3, y1 - 0, T.TALL);
    }
    // alberi decorativi
    set(left ? 20 : 33, y0 + 2, T.TREE);
    // osservatori del quartiere, con l'ingresso aperto nella siepe del viale
    OBSERVATORIES.filter((m) => m.levelId === level.id).forEach((m, k) => {
      const ox = left ? x1 - 3 : x0, oy = y0 + OBS_ROWS[k];
      const doorX = left ? ox + 3 : ox, doorY = oy + 1;
      fill(ox, oy, ox + 3, oy + 2, T.GRASS);
      set(hedgeX, doorY, T.PATH);
      objects.push({ type: 'building', kind: 'observatory', x: ox, y: oy, w: 4, h: 3, door: { x: doorX, y: doorY }, doorDir: left ? 'left' : 'right', name: m.name, color: m.color, glyph: m.glyph, obs: m });
    });
  });

  // ---- Viale degli Algoritmi ----
  fill(AVE[0], 9, AVE[3], 58, T.PATH);

  // ---- Quartiere delle Origini (livello 1) ----
  const l1 = world.levels[0];
  fill(1, 52, W - 2, H - 2, T.GRASS);
  fill(1, 57, W - 2, 58, T.PATH);
  fill(1, 64, W - 2, 65, T.PATH);
  fill(21, 59, 34, 66, T.PLAZA);
  fill(AVE[0], 51, AVE[3], 56, T.PATH);
  fill(49, 60, 53, 62, T.WATER);
  fill(19, 60, 20, 62, T.FLOWER); fill(35, 60, 36, 62, T.FLOWER);
  fill(2, 67, 18, 68, T.TALL); fill(37, 67, 53, 68, T.TALL);
  for (let x = 22; x <= 33; x += 11) set(x, 52, T.TREE);
  set(25, 52, T.FLOWER); set(30, 52, T.FLOWER);
  fill(23, 53, 24, 55, T.FLOWER); fill(31, 53, 32, 55, T.FLOWER);
  set(39, 61, T.TREE); set(41, 61, T.TREE); set(19, 66, T.TREE); set(36, 66, T.TREE);
  areas.push({ x0: 1, y0: 52, x1: W - 2, y1: H - 2, name: l1.name, levelIndex: 0 });
  const l1Slots = [...L1_ROW1.map((x) => ({ x, y: 53 })), ...L1_ROW2.map((x) => ({ x, y: 60 }))];
  l1.buildings.slice(0, l1Slots.length).forEach((b, k) => addBuilding(objects, b, l1Slots[k], 0));

  objects.push({ type: 'npc', x: 27, y: 60, look: 'ada', dir: 'down', name: world.city.guide, role: 'guide' });
  // Ex-studenti: occupano i posti liberi della loro zona, nell'ordine del file content/npcs.json.
  const free = { l1: L1_SPOTS.slice(), viale: AVENUE_SPOTS.slice(), cittadella: CITADEL_SPOTS.slice(), piazza: PIAZZA_SPOTS.slice() };
  for (const n of (world.people && world.people.npcs) || []) {
    const spot = (free[n.spot] || free.l1).shift();
    if (!spot) continue;
    objects.push({ type: 'npc', x: spot.x, y: spot.y, dir: spot.dir, name: n.name, role: 'exstudent', person: n, avatar: n.avatar });
  }
  objects.push({ type: 'sign', x: 30, y: 56, kind: 'avenue' });


  // Solidi: tile + oggetti
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < tiles.length; i++) solid[i] = SOLID.has(tiles[i]) ? 1 : 0;
  for (const o of objects) {
    if (o.type === 'building' || o.type === 'boss') {
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) solid[y * W + x] = 1;
    } else if (o.type === 'sign' || o.type === 'npc') {
      solid[o.y * W + o.x] = 1;
    }
  }

  return {
    W, H, tiles, solid, objects, areas,
    spawn: { x: 27, y: 62, dir: 'up' },
    areaAt(x, y) {
      const a = areas.find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
      return a ? a.name : 'Viale degli Algoritmi';
    }
  };
}

function addBuilding(objects, b, slot, levelIndex, kind = 'normal') {
  const o = {
    type: 'building', kind, x: slot.x, y: slot.y, w: 5, h: 4, levelIndex,
    door: { x: slot.x + 2, y: slot.y + 3 }
  };
  if (b) Object.assign(o, { id: b.id, name: b.name, color: b.color, glyph: b.glyph, data: b });
  objects.push(o);
  if (b) objects.push({ type: 'sign', x: slot.x + 5, y: slot.y + 3, kind: 'building', building: b, levelIndex });
}
