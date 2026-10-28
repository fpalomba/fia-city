// FIA City: avvio, login, creazione del personaggio, città 3D, movimento e interazioni.
import { api } from './api.js';
import { say, ask, toast, screen, el, isBusy } from './ui.js';
import { sfx, music, toggleMute, isMuted } from './audio.js';
import { LOOKS, badgeCanvas } from './sprites.js';
import { buildMap } from './map.js';
import { openBuilding } from './building.js';
import { enterBoss, setBossContent } from './boss.js';
import { createScene } from './scene3d.js';
import { OBSERVATORIES, openObservatory } from './observatory.js';
import { runSetup } from './setup.js';
import { createCompanion, petIcon } from './companion.js';
import { setTextContext, lookFromAvatar, gx } from './profile.js';

const canvas = document.querySelector('#game');
const $ = (s) => document.querySelector(s);

let world = null;
let progress = null;
let map = null;
let scene3d = null;
let companion = null;
const player = { x: 0, y: 0, dir: 'down', moving: false, from: null, to: null, t: 0, stepCount: 0 };
const pet = { x: 0, y: 0, dir: 'down', moving: false, from: null, to: null, t: 0 };
let lastSave = 0, dirty = false;
let lastInput = performance.now();
const hinted = new Set();

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
const KEYS = {
  ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right'
};
const held = new Set();
const st = () => progress.state;
const markDirty = () => { dirty = true; };

// ---------------- Login ----------------

async function boot() {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) $('#touch').classList.add('on');
  try { await document.fonts.ready; } catch { /* ignora */ }
  try {
    scene3d = createScene(canvas);
  } catch {
    document.body.append(el('div', { id: 'webgl-error' }, el('div', { class: 'panel' },
      el('h2', {}, 'Serve un browser con WebGL'),
      el('p', {}, 'FIA City è in 3D e richiede WebGL. Prova con una versione recente di Chrome, Firefox, Edge o Safari, e controlla che l\'accelerazione hardware sia attiva.'))));
    return;
  }
  window.addEventListener('resize', () => scene3d.resize());
  if (api.hasToken()) {
    try { await enterGame(); return; } catch { api.clearToken(); }
  }
  showLogin();
}

function showLogin() {
  $('#login').classList.remove('hidden');
  $('#hud').classList.add('hidden');
  const form = $('#login-form');
  const input = $('#username');
  input.focus();
  form.onsubmit = async (e) => {
    e.preventDefault();
    sfx.unlock();
    $('#login-error').textContent = '';
    try {
      await api.login(input.value);
      await enterGame();
    } catch (err) {
      $('#login-error').textContent = err.message;
    }
  };
}

function applyProfile() {
  const p = st().profile;
  setTextContext({ form: p.form, name: progress.username, pet: p.pet.name });
  Object.assign(LOOKS.player, lookFromAvatar(p.avatar));
  scene3d.setPlayer(p.avatar);
  scene3d.setPet(p.pet);
  $('#hud-pet').textContent = petIcon(p.pet);
  $('#hud-pet').title = `Parla con ${p.pet.name} (C)`;
  $('#touch .c').textContent = petIcon(p.pet);
}

async function enterGame() {
  [world, progress] = await Promise.all([api.world(), api.me()]);
  progress.state = progress.state || {};
  setBossContent(world.boss);
  map = buildMap(world);
  $('#login').classList.add('hidden');
  if (!st().profile) {
    const p = await runSetup(null, { first: true });
    st().profile = p;
    await saveState(true);
  }
  scene3d.load(map);
  companion = createCompanion({ getWorld: () => world, getProgress: () => progress, markDirty });
  applyProfile();
  const spot = st().pos && !map.solid[st().pos.y * map.W + st().pos.x] ? st().pos : map.spawn;
  player.x = spot.x; player.y = spot.y; player.dir = st().dir || map.spawn.dir;
  placePetBehind();
  syncWorld();
  $('#hud').classList.remove('hidden');
  updateHud();
  $('#hud-area').textContent = map.areaAt(player.x, player.y);
  music.play('city');
  if (!st().introSeen) {
    await say(world.city.welcome, { name: world.city.guide });
    const name = companion.nameOf();
    await say([`${companion.hello()} Sono ${name}, il tuo compagno di studio!`,
      'Ti seguirò ovunque. Quando vuoi ripassare, premi C (o il pulsante con la mia faccina) e ti faccio qualche domanda.',
      'Per strada troverai tanti ex-studenti del corso: quelli con il fumetto hanno qualcosa da raccontarti. Parla con tutti!'], { name });
    st().introSeen = true;
    saveState(true);
  }
}

function placePetBehind() {
  const [dx, dy] = DIRS[OPP[player.dir]];
  const bx = player.x + dx, by = player.y + dy;
  const ok = !blocked(bx, by) && !objectAt(bx, by);
  pet.x = ok ? bx : player.x; pet.y = ok ? by : player.y;
  pet.moving = false; pet.dir = player.dir;
}

function hasBadge(id) { return !!(progress.buildings[id] || {}).badge; }

function syncWorld() {
  scene3d.setGateStates(gateState);
  scene3d.setBadges(hasBadge);
  // Il fumetto resta finché un ex-studente ha ancora conversazioni da raccontare.
  const talked = new Set(st().talked || []), heard = st().heard || {};
  const npcs = new Map(((world.people && world.people.npcs) || []).map((n) => [n.id, n]));
  scene3d.setTalked((id) => {
    if (!talked.has(id)) return false;
    const n = npcs.get(id), mask = heard[id] || 1;
    return !n || n.talks.every((t, i) => !talkAvailable(t) || ((mask >> i) & 1));
  });
}

async function refreshProgress() {
  const before = new Set(Object.entries(progress.buildings).filter(([, b]) => b.badge).map(([id]) => id));
  const state = progress.state;
  progress = await api.me();
  progress.state = state; // lo stato locale è più recente di quello salvato
  updateHud();
  syncWorld();
  const fresh = Object.entries(progress.buildings).filter(([id, b]) => b.badge && !before.has(id));
  if (fresh.length) {
    const b = allBuildings().find((x) => x.id === fresh[0][0]);
    petSay(`Evviva! Badge «${b.name}» conquistato! 🎉`, 4500);
  }
}

// ---------------- HUD e zaino ----------------

function allBuildings() {
  return world.levels.filter((l) => l.implemented).flatMap((l) => l.buildings);
}

function updateHud() {
  const total = allBuildings().length;
  const got = Object.values(progress.buildings).filter((b) => b.badge).length;
  $('#hud-user').textContent = progress.username;
  $('#hud-badges').textContent = `${got}/${total}`;
  $('#hud-audio').textContent = isMuted() ? '🔇' : '🔊';
}

$('#hud-audio').addEventListener('click', () => { toggleMute(); updateHud(); });
$('#hud-menu').addEventListener('click', () => openBackpack());
$('#hud-pet').addEventListener('click', () => { if (!isBusy() && companion) { hidePetBubble(); companion.talk(); } });

const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

function openBackpack() {
  if (isBusy() && !screen.active) return;
  sfx.select();
  const sections = world.levels.map((l, i) => {
    const lp = progress.levels[i];
    if (!l.implemented) {
      return el('div', { style: 'margin-bottom:16px' }, el('h3', {}, `${i + 1}. ${l.name}`), el('div', { class: 'muted' }, `In costruzione · ${l.theme}`));
    }
    return el('div', { style: 'margin-bottom:16px' },
      el('h3', {}, `${i + 1}. ${l.name} ${lp.complete ? '✔' : lp.unlocked ? '' : '🔒'}`),
      el('div', { class: 'badge-grid' }, l.buildings.map((b) => {
        const bp = progress.buildings[b.id] || {};
        return el('div', { class: 'badge-cell' + (bp.badge ? '' : ' locked') },
          badgeCanvas(b.color, b.glyph, !!bp.badge),
          el('div', {}, b.name),
          el('div', { class: 'sc' }, bp.graded === null || bp.graded === undefined ? '—' : `${bp.graded}/100`),
          el('div', { class: 'muted', style: 'font-size:13px' }, `${bp.attempts || 0} tentativi`));
      })));
  });
  const final = progress.boss.final;
  const people = (world.people && world.people.npcs) || [];
  const met = (st().talked || []).filter((id) => people.some((n) => n.id === id)).length;
  const summary = el('div', { class: 'feedback', style: 'margin-bottom:16px' },
    el('div', {}, 'Media attuale dei quiz: ', el('b', {}, `${fmt(progress.quizAvg30)}/30`)),
    final
      ? el('div', {}, '🎓 Voto finale registrato: ', el('b', {}, `${fmt(final.grade)}/30`))
      : el('div', { class: 'muted' }, `Se sconfiggi il Prof. Palomba, il voto finale sarà (30 + media quiz) / 2 = ${fmt((30 + progress.quizAvg30) / 2)}/30 con la media attuale.`),
    el('div', { class: 'muted', style: 'margin-top:6px' }, `Badge con almeno il ${progress.rules.passThreshold}% · per il voto di ogni edificio ${progress.rules.scorePolicy === 'first' ? 'conta il primo tentativo completato' : 'vale la politica «' + progress.rules.scorePolicy + '»'}.`),
    el('div', { style: 'margin-top:6px' }, `🧑‍🎓 Ex-studenti conosciuti: ${met}/${people.length}`));
  const close = el('button', { class: 'btn primary', onclick: () => { screen.close(); } }, 'Chiudi');
  const logout = el('button', { class: 'btn', onclick: async () => { await saveState(true); await api.logout(); location.reload(); } }, 'Esci (cambia utente)');
  const edit = el('button', { class: 'btn', onclick: async () => {
    screen.close();
    const p = await runSetup(st().profile, { first: false });
    if (p) { st().profile = p; applyProfile(); placePetBehind(); saveState(true); toast('Personaggio aggiornato!'); }
  } }, '✏️ Modifica personaggio');
  const review = el('button', { class: 'btn', onclick: () => companion.reviewScreen() }, `${petIcon(st().profile.pet)} Ripasso con ${companion.nameOf()}`);
  screen.open(el('div', { class: 'panel' },
    el('div', { class: 'row' }, el('h1', {}, '🎒 Zaino'), el('div', { class: 'spacer' }), logout, close),
    el('p', {}, 'Giocatore: ', el('b', {}, progress.username)),
    el('div', { class: 'row', style: 'margin-bottom:12px' }, edit, review),
    summary, ...sections,
    el('div', { class: 'muted', style: 'font-size:14px' }, 'Comandi: frecce/WASD muovi · SPAZIO/INVIO interagisci · C compagno · ESC zaino · +/− zoom · M audio')));
  close.focus();
}

// ---------------- Interazioni ----------------

function levelUnlocked(i) { return progress.levels[i] && progress.levels[i].unlocked; }

function gateState(o) {
  if (o.gate === 'boss') return progress.boss.unlocked ? 'open' : 'locked';
  if (!o.implemented) return 'construction';
  return levelUnlocked(o.levelIndex) ? 'open' : 'locked';
}

function gateAt(x, y) {
  return map.objects.find((o) => o.type === 'gate' && o.tiles.some((t) => t.x === x && t.y === y));
}

function blocked(x, y) {
  if (x < 0 || y < 0 || x >= map.W || y >= map.H) return true;
  if (map.solid[y * map.W + x]) return true;
  const gte = gateAt(x, y);
  if (gte && gateState(gte) !== 'open') return true;
  return false;
}

function objectAt(x, y) {
  for (const o of map.objects) {
    if ((o.type === 'npc' || o.type === 'sign') && o.x === x && o.y === y) return o;
    if ((o.type === 'building' || o.type === 'boss') && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return o;
  }
  return gateAt(x, y) || null;
}

const isDoor = (o, x, y) => y === o.door.y && x >= o.door.x && x < o.door.x + (o.doorW || 1);
// Direzione in cui si cammina per entrare: di norma verso l'alto; gli osservatori si aprono di lato, sul viale.
const doorDir = (o) => o.doorDir || 'up';

async function interact() {
  const [dx, dy] = DIRS[player.dir];
  const tx = player.x + dx, ty = player.y + dy;
  const o = objectAt(tx, ty);
  if (!o) {
    if (tx === pet.x && ty === pet.y && companion) { hidePetBubble(); return companion.talk(); }
    return;
  }
  sfx.select();
  if (o.type === 'npc') {
    scene3d.faceNpc(o, OPP[player.dir]);
    if (o.role === 'guide') await guideTalk();
    else if (o.role === 'exstudent') await personTalk(o);
    else await say(o.lines, { name: o.name });
    scene3d.faceNpc(o, null);
  } else if (o.type === 'sign') {
    await readSign(o);
  } else if (o.type === 'gate') {
    await gateTalk(o);
  } else if (o.type === 'building' || o.type === 'boss') {
    if (isDoor(o, tx, ty)) await enterDoor(o);
    else if (o.kind === 'construction') await say('Un edificio in costruzione. Lavori in corso!');
    else await say(o.type === 'boss' ? 'L\'imponente Aula Magna. L\'ingresso è al centro.' : `${o.name}: l'ingresso è dalla porta.`);
  }
}

const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

const GREET = ['Ciao {nome}! Che piacere rivederti.', 'Ehi, di nuovo tu!', 'Ciao! Come va lo studio?'];

async function filmAdvice(name) {
  const films = world.people.films;
  const types = [...new Set(films.map((f) => f.type))];
  for (;;) {
    const c = await ask(world.people.filmIntro, [...types, 'Niente, grazie'], { name });
    if (c >= types.length) break;
    const seen = st().films || (st().films = []);
    const pool = films.filter((f) => f.type === types[c]);
    let fresh = pool.filter((f) => !seen.includes(f.title));
    if (!fresh.length) { st().films = seen.filter((t) => !pool.some((f) => f.title === t)); fresh = pool; }
    const f = pickOne(fresh);
    st().films.push(f.title);
    markDirty();
    await say([`🎬 «${f.title}» (${f.year}). ${f.pitch}`, `Perché c'entra con il corso: ${f.link}`], { name });
    const more = await ask('Ti consiglio qualcos\'altro?', ['Sì, dai!', 'No, grazie: vado a studiare'], { name });
    if (more === 1) break;
  }
}

// Una conversazione: battute, eventuale domanda a scelta, eventuale chiusura, eventuali film.
// Una risposta può avere a sua volta una domanda (then), così la conversazione si ramifica.
async function runQuestion(q, name, depth = 0) {
  const c = await ask(q.question, q.choices.map((x) => x.label), { name });
  const ch = q.choices[c];
  if (ch.reply && ch.reply.length) await say(ch.reply, { name });
  if (ch.then && depth < 4) await runQuestion(ch.then, name, depth + 1);
}
async function runTalk(t, name, again) {
  if (!(t.films && again)) await say(t.lines, { name });
  if (t.question) {
    await runQuestion(t, name);
    if (t.outro) await say(t.outro, { name });
  }
  if (t.films) await filmAdvice(name);
}

// Alcune conversazioni compaiono solo più avanti: dopo un certo numero di badge, dopo aver visitato
// un osservatorio o dopo aver conosciuto un altro ex-studente.
function talkAvailable(t) {
  const r = t.requires;
  if (!r) return true;
  if (r.badges && Object.values(progress.buildings).filter((b) => b.badge).length < r.badges) return false;
  if (r.obs && !(r.obs === 'any' ? obsVisited().length : obsVisited().includes(r.obs))) return false;
  if (r.met && !(st().talked || []).includes(r.met)) return false;
  if (r.boss && !progress.boss.final) return false;
  return true;
}

async function personTalk(o) {
  const n = o.person;
  const name = `${n.name} · ${n.role}`;
  const talked = st().talked || (st().talked = []);
  const heard = st().heard || (st().heard = {});
  const first = !talked.includes(n.id);
  const mask = heard[n.id] || (first ? 0 : 1);
  const isHeard = (i) => (mask >> i) & 1;
  let idx = 0;
  if (!first) {
    // Al nuovo incontro si sceglie l'argomento; quelli già ascoltati restano disponibili, segnati con ↺.
    const avail = n.talks.map((t, i) => i).filter((i) => talkAvailable(n.talks[i]));
    const left = avail.filter((i) => !isHeard(i)).length;
    const hello = pickOne(n.greet && n.greet.length ? n.greet : GREET);
    const prompt = left ? `${hello} Di cosa parliamo?` : `${hello} Ormai ti ho raccontato tutto, ma possiamo riparlarne.`;
    // prima gli argomenti nuovi, poi quelli già sentiti
    const order = [...avail.filter((i) => !isHeard(i)), ...avail.filter((i) => isHeard(i))];
    const c = await ask(prompt, [...order.map((i) => (isHeard(i) ? '↺ ' : '') + n.talks[i].topic), 'Niente, ci vediamo!'], { name });
    if (c >= order.length) return;
    idx = order[c];
  }
  await runTalk(n.talks[idx], name, isHeard(idx));
  heard[n.id] = mask | (1 << idx);
  markDirty();
  if (!first) syncWorld();
  if (first) {
    talked.push(n.id);
    markDirty();
    syncWorld();
    const total = world.people.npcs.length;
    const met = talked.filter((id) => world.people.npcs.some((x) => x.id === id)).length;
    toast(`🧑‍🎓 Ex-studenti conosciuti: ${met}/${total}`);
  }
}

async function guideTalk() {
  const total = allBuildings().length;
  const got = Object.values(progress.buildings).filter((b) => b.badge).length;
  const c = await ask(`Ciao ${progress.username}! Hai ${got} badge su ${total}. Come posso aiutarti?`, ['Come funziona il gioco?', 'Dove vado adesso?', 'Come viene calcolato il voto?', 'Cosa sono gli osservatori?', 'Niente, grazie'], { name: world.city.guide });
  if (c === 0) await say(world.city.welcome.slice(1), { name: world.city.guide });
  else if (c === 1) {
    const next = world.levels.flatMap((l, i) => (l.implemented && levelUnlocked(i) ? l.buildings : [])).find((b) => !(progress.buildings[b.id] || {}).badge);
    if (next) await say(`Ti manca ancora il badge di «${next.name}» (${next.concept}). Il nome è scritto sull'insegna sopra la porta.`, { name: world.city.guide });
    else if (progress.boss.unlocked && !progress.boss.final) await say('Hai tutti i badge disponibili! Percorri il Viale degli Algoritmi verso nord: il Prof. Palomba ti aspetta nell\'Aula Magna.', { name: world.city.guide });
    else if (progress.boss.final) await say('Hai già sconfitto il Prof. Palomba. Puoi rigiocare gli edifici per ripassare quando vuoi!', { name: world.city.guide });
    else await say('Al momento non ci sono altri edifici aperti. Nuovi quartieri apriranno con le prossime lezioni!', { name: world.city.guide });
  } else if (c === 2) {
    await say([
      `Ogni edificio ti dà un punteggio da 0 a 100: per il voto ${progress.rules.scorePolicy === 'first' ? 'conta il primo tentativo completato' : 'vale la politica scelta dal docente'}.`,
      'La media dei punteggi di tutti gli edifici viene convertita in trentesimi.',
      `Se sconfiggi il Prof. Palomba, il voto finale è la media tra 30 e la tua media quiz. Ora saresti a ${fmt((30 + progress.quizAvg30) / 2)}/30.`
    ], { name: world.city.guide });
  } else if (c === 3) {
    await say([
      'Gli osservatori sono gli edifici con la cupola lungo il Viale degli Algoritmi, uno o più per quartiere, con l\'ingresso direttamente sul viale.',
      'Sono approfondimenti sugli argomenti più ostici, come il training delle reti neurali, l\'attention o la scelta di k nel clustering. Lì vedi in movimento cosa succede, e puoi cambiare i parametri.',
      'Sono sempre aperti, anche se il quartiere è ancora chiuso, e non danno punti né badge: entra quando un argomento ti sembra difficile.',
      `Finora ne hai visitati ${obsVisited().length} su ${OBSERVATORIES.length}.`
    ], { name: world.city.guide });
  }
}

async function readSign(o) {
  if (o.kind === 'avenue') return say('↑ VIALE DEGLI ALGORITMI · in fondo: Aula Magna del Test Finale. Ai lati, i quartieri del corso e i loro osservatori, sempre aperti.');
  if (o.kind === 'thesis') return say([
    'BACHECA TESI E TIROCINI · Gli ex-studenti con il tocco 🎓 qui in piazzetta raccontano gli argomenti del laboratorio del Prof.',
    'Non ci sono progetti già pronti: il lavoro si costruisce insieme, partendo dagli interessi di entrambi. Chi è interessato scrive al Prof.',
    'Le tesi passate, divise per tutor: github.com/SeSaLabUnisa/Tesi'
  ]);
  if (o.kind === 'observatory') return say([`${o.obs.name}: ${o.obs.topic}`, `📖 ${o.obs.lesson}. ${obsVisited().includes(o.obs.id) ? 'Già visitato ✔' : 'Non ancora visitato.'}`]);
  if (o.kind === 'district') {
    const l = world.levels[o.levelIndex];
    const obs = OBSERVATORIES.filter((m) => m.levelId === l.id);
    const obsLine = obs.length ? ` Osservatori, sempre aperti con ingresso dal viale: ${obs.map((m) => m.name.replace('Osservatorio ', '')).join(', ')}.` : '';
    if (!l.implemented) return say(`${l.name} (${l.theme}). Cantiere aperto: il quartiere sarà inaugurato con le lezioni su ${l.lessons.join(', ')}.${obsLine}`);
    return say(`${l.name} (${l.theme}). ${levelUnlocked(o.levelIndex) ? 'Quartiere aperto!' : 'Si apre con tutti i badge del quartiere precedente.'}${obsLine}`);
  }
  const b = o.building;
  const bp = progress.buildings[b.id] || {};
  return say([`${b.name}: ${b.concept}.`, `📖 ${b.slides}. ${bp.badge ? 'Badge ottenuto ✔' : 'Badge non ancora ottenuto.'}`]);
}

async function gateTalk(o) {
  const s = gateState(o);
  if (o.gate === 'boss') {
    if (s === 'locked') return say(world.boss.lockedLines);
    return;
  }
  const l = world.levels[o.levelIndex];
  if (s === 'construction') return say(`Lavori in corso: il ${l.name} non è ancora aperto.`);
  if (s === 'locked') {
    const prev = world.levels.slice(0, o.levelIndex).filter((x) => x.implemented).map((x) => x.name);
    return say(`Il cancello del ${l.name} è chiuso. Servono tutti i badge di: ${prev.join(', ')}.`);
  }
}

async function enterDoor(o) {
  hidePetBubble();
  if (o.type === 'boss') {
    saveState(true);
    await enterBoss(progress, world, refreshProgress);
    await refreshProgress();
    return;
  }
  if (o.kind === 'construction') return say('Il cantiere è chiuso al pubblico.');
  if (o.kind === 'observatory') return enterObservatory(o.obs);
  if (!levelUnlocked(o.levelIndex)) return say('Questo quartiere è ancora bloccato.');
  saveState(true);
  openBuilding({ ...o.data, levelIndex: o.levelIndex }, progress, refreshProgress);
}

// Gli osservatori sono sempre aperti e non danno punti: si tiene solo traccia di quelli visitati.
function obsVisited() { return st().obs || []; }
async function enterObservatory(meta) {
  saveState(true);
  await new Promise((resolve) => openObservatory(meta, { onClose: resolve }));
  const seen = st().obs || (st().obs = []);
  if (!seen.includes(meta.id)) {
    seen.push(meta.id);
    markDirty();
    syncWorld();
    toast(`🔭 Osservatori visitati: ${seen.length}/${OBSERVATORIES.length}`);
  }
}

// ---------------- Compagno: fumetto ----------------

let bubbleUntil = 0;
function petSay(text, ms = 4000) {
  const b = $('#pet-bubble');
  b.querySelector('.panel').textContent = gx(text);
  b.classList.remove('hidden');
  bubbleUntil = performance.now() + ms;
}
function hidePetBubble() { $('#pet-bubble').classList.add('hidden'); bubbleUntil = 0; }

function isNear(o) {
  const d = doorDir(o);
  if (d === 'left') return player.y === o.door.y && player.x - o.door.x >= 1 && player.x - o.door.x <= 2;
  if (d === 'right') return player.y === o.door.y && o.door.x - player.x >= 1 && o.door.x - player.x <= 2;
  return Math.abs(o.door.x + ((o.doorW || 1) - 1) / 2 - player.x) <= 1.5 && player.y - o.door.y >= 1 && player.y - o.door.y <= 2;
}

function petThoughts(now) {
  if (!companion || isBusy()) return;
  // vicino alla porta di un edificio senza badge: propone un ripasso
  const near = map.objects.find((o) => o.type === 'building' && o.id && isNear(o));
  if (near && !hasBadge(near.id) && !hinted.has(near.id) && levelUnlocked(near.levelIndex)) {
    hinted.add(near.id);
    petSay(`Qui si parla di: ${near.data.concept}. Vuoi ripassare prima di entrare? Premi C!`, 5000);
    lastInput = now;
    return;
  }
  if (now - lastInput > 45000) {
    lastInput = now;
    petSay(Math.random() < 0.6 ? companion.tip() : companion.idleLine(), 5500);
  }
}

// ---------------- Movimento ----------------

function tryMove(dir) {
  player.dir = dir;
  const [dx, dy] = DIRS[dir];
  const nx = player.x + dx, ny = player.y + dy;
  const o = objectAt(nx, ny);
  if (o && (o.type === 'building' || o.type === 'boss') && isDoor(o, nx, ny) && dir === doorDir(o)) {
    enterDoor(o);
    held.clear();
    return;
  }
  if (blocked(nx, ny)) {
    if (!player.bumped) { sfx.bump(); player.bumped = true; setTimeout(() => { player.bumped = false; }, 300); }
    return;
  }
  // il compagno prende il posto lasciato libero
  if (pet.x !== player.x || pet.y !== player.y) {
    const far = Math.abs(pet.x - player.x) + Math.abs(pet.y - player.y) > 2;
    if (far) { pet.x = player.x; pet.y = player.y; pet.moving = false; }
    else {
      pet.from = { x: pet.x, y: pet.y };
      pet.to = { x: player.x, y: player.y };
      pet.dir = pet.to.x > pet.x ? 'right' : pet.to.x < pet.x ? 'left' : pet.to.y > pet.y ? 'down' : 'up';
      pet.moving = true; pet.t = 0;
    }
  }
  player.moving = true;
  player.from = { x: player.x, y: player.y };
  player.to = { x: nx, y: ny };
  player.t = 0;
  player.stepCount++;
}

window.addEventListener('keydown', (e) => {
  if (!map || !$('#login').classList.contains('hidden')) return;
  sfx.unlock();
  lastInput = performance.now();
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'm' || e.key === 'M') { toggleMute(); updateHud(); return; }
  if (screen.active) {
    const h1 = screen.wrap.querySelector('h1');
    if (e.key === 'Escape' && h1 && /Zaino|Ripasso/.test(h1.textContent)) screen.close();
    return;
  }
  if (isBusy() || !companion) return;
  if (KEYS[e.key]) { held.add(KEYS[e.key]); e.preventDefault(); }
  else if ([' ', 'Enter', 'z', 'Z'].includes(e.key)) { e.preventDefault(); interact(); }
  else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); hidePetBubble(); companion.talk(); }
  else if (e.key === '+' || e.key === '=') scene3d.setZoom(scene3d.zoom - 0.1);
  else if (e.key === '-' || e.key === '_') scene3d.setZoom(scene3d.zoom + 0.1);
  else if (e.key === 'Escape' || e.key === 'x' || e.key === 'X') { e.preventDefault(); openBackpack(); }
});
window.addEventListener('keyup', (e) => { if (KEYS[e.key]) held.delete(KEYS[e.key]); });
window.addEventListener('blur', () => held.clear());
canvas.addEventListener('wheel', (e) => { if (scene3d) { e.preventDefault(); scene3d.setZoom(scene3d.zoom + Math.sign(e.deltaY) * 0.08); } }, { passive: false });

// comandi touch
document.querySelectorAll('#touch [data-dir]').forEach((b) => {
  const d = b.dataset.dir;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); sfx.unlock(); lastInput = performance.now(); if (!isBusy()) held.add(d); });
  b.addEventListener('pointerup', () => held.delete(d));
  b.addEventListener('pointerleave', () => held.delete(d));
});
document.querySelector('#touch .a').addEventListener('pointerdown', (e) => {
  e.preventDefault(); sfx.unlock();
  if (isBusy()) document.dispatchEvent(new Event('fiacity-a'));
  else interact();
});
document.querySelector('#touch .b').addEventListener('pointerdown', (e) => { e.preventDefault(); if (screen.active) screen.close(); else if (!isBusy()) openBackpack(); });
document.querySelector('#touch .c').addEventListener('pointerdown', (e) => { e.preventDefault(); if (!isBusy() && companion) { hidePetBubble(); companion.talk(); } });

// ---------------- Salvataggio ----------------

async function saveState(force = false) {
  if (!progress || (!dirty && !force)) return;
  const now = Date.now();
  if (!force && now - lastSave < api.saveEveryMs) return;
  lastSave = now;
  dirty = false;
  const state = { ...progress.state, pos: { x: player.x, y: player.y }, dir: player.dir };
  progress.state = state;
  try { await api.saveState(state, true); } catch { dirty = true; }
}
window.addEventListener('beforeunload', () => saveState(true));
setInterval(() => saveState(false), 3000);

// ---------------- Ciclo di gioco ----------------

const STEP_MS = 190;
let lastT = performance.now();
let fps = 60;

function update(dt, now) {
  if (player.moving) {
    player.t += dt / STEP_MS;
    if (player.t >= 1) {
      player.x = player.to.x; player.y = player.to.y;
      player.moving = false;
      player.t = 0;
      dirty = true;
      $('#hud-area').textContent = map.areaAt(player.x, player.y);
    }
  }
  if (pet.moving) {
    pet.t += dt / STEP_MS;
    if (pet.t >= 1) { pet.x = pet.to.x; pet.y = pet.to.y; pet.moving = false; }
  } else if (!player.moving && (pet.x !== player.x || pet.y !== player.y)) {
    pet.dir = player.x > pet.x ? 'right' : player.x < pet.x ? 'left' : player.y > pet.y ? 'down' : 'up';
  }
  if (!player.moving && !isBusy() && held.size) tryMove([...held][held.size - 1]);
  if (!player.moving) petThoughts(now);
}

function lerpPos(o) {
  if (!o.moving) return { x: o.x, y: o.y };
  return { x: o.from.x + (o.to.x - o.from.x) * o.t, y: o.from.y + (o.to.y - o.from.y) * o.t };
}

function updateOverlays(pp) {
  // suggerimento per entrare negli edifici
  const near = map.objects.find((o) => ((o.type === 'building' && (o.id || o.kind === 'observatory')) || o.type === 'boss') && isNear(o));
  const hint = $('#hint');
  if (near && !isBusy()) {
    hint.querySelector('.panel').textContent = `${{ up: '▲', left: '◀', right: '▶' }[doorDir(near)]} ${near.name}`;
    hint.classList.remove('hidden');
  } else hint.classList.add('hidden');
  // fumetto del compagno
  const b = $('#pet-bubble');
  if (bubbleUntil && (performance.now() > bubbleUntil || isBusy())) hidePetBubble();
  if (!b.classList.contains('hidden')) {
    // a lato del compagno, per non coprire il giocatore
    const p = scene3d.project(pp.x, pp.y, 0.7);
    const w = b.offsetWidth || 260;
    const right = p.x + 26 + w < window.innerWidth - 8;
    b.classList.toggle('left', !right);
    b.style.left = `${right ? p.x + 26 : Math.max(8, p.x - 26 - w)}px`;
    b.style.top = `${Math.max(60, p.y)}px`;
  }
}

function loop(t) {
  const dt = Math.min(120, t - lastT);
  lastT = t;
  if (map && scene3d && companion && progress && st().profile) {
    update(dt, t);
    fps = fps * 0.95 + (1000 / Math.max(1, dt)) * 0.05;
    const pp = lerpPos(player), qp = lerpPos(pet);
    const phase = ((player.stepCount % 2) + player.t) / 2;
    scene3d.frame({ t, dt, player: { ...pp, dir: player.dir, moving: player.moving, phase }, pet: { ...qp, dir: pet.dir, moving: pet.moving } });
    updateOverlays(qp);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Scorciatoie per i test automatici (?debug=1): non aggirano i controlli del server.
if (new URLSearchParams(location.search).has('debug')) {
  window.__fia = {
    openBuilding: (id) => { const o = map.objects.find((x) => x.id === id); return enterDoor(o); },
    boss: () => enterDoor(map.objects.find((x) => x.type === 'boss')),
    teleport: (x, y, dir = 'up') => { player.x = x; player.y = y; player.dir = dir; player.moving = false; placePetBehind(); $('#hud-area').textContent = map.areaAt(x, y); },
    talkTo: (id) => personTalk(map.objects.find((x) => x.person && x.person.id === id)),
    npcAt: (id) => { const o = map.objects.find((x) => x.person && x.person.id === id); return o && { x: o.x, y: o.y }; },
    companion: () => companion.talk(),
    petSay,
    zoom: (z) => scene3d.setZoom(z),
    state: () => progress.state,
    pos: () => ({ player: { x: player.x, y: player.y }, pet: { x: pet.x, y: pet.y } }),
    map: () => map,
    fps: () => Math.round(fps),
    refresh: refreshProgress
  };
}

boot();
