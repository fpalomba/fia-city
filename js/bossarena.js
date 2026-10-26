// Aula Magna 3D dello scontro finale, pensata come una discussione alla pari: il Prof. Palomba
// cammina per la stanza (alla maniera dei peripatetici), si avvicina allo studente quando gli parla
// e insieme ragionano sulle domande, attorno a un tavolino. Nessuna pedana e nessuna cattedra.
import * as THREE from '../vendor/three.module.min.js';
import { makeCharacter, animateCharacter, makePet, animatePet, box, mat } from './models.js';

// Aspetto del Prof, ricavato dalla foto: capelli corti scuri, barba folta, maglione nero.
export const PROF_AVATAR = {
  skin: '#e6b48f', hair: 'corti', hairColor: '#2a211c', beard: '#2a211c',
  top: '#1e1e24', bottom: 'pantaloni', bottomColor: '#30323d', acc: 'nessuno'
};

const TABLE = { x: 0.35, y: -0.75 }, R = 1.1;
const put = (g, m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

function makeRoom() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), mat('#b98a5c'));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // listelli del parquet
  for (let i = -7; i <= 7; i++) g.add(box(0.02, 0.005, 10, '#a77a4f', i, 0.003, 0));
  // parete di fondo con finestre
  g.add(box(16, 4, 0.2, '#efe6d2', 0, 2, -3.2));
  g.add(box(16, 0.3, 0.24, '#c9b48f', 0, 0.15, -3.1));
  for (const x of [-4.2, 0, 4.2]) {
    g.add(box(2.0, 1.7, 0.05, '#bfe3ff', x, 2.15, -3.08, { emissive: 0x3a6a8a }));
    g.add(box(2.16, 0.1, 0.12, '#8a6a46', x, 1.27, -3.04));
    g.add(box(2.16, 0.1, 0.12, '#8a6a46', x, 3.03, -3.04));
    g.add(box(0.08, 1.7, 0.1, '#8a6a46', x, 2.15, -3.04));
  }
  // librerie ai lati, con libri colorati
  const books = ['#c0504d', '#2e86ab', '#f2c14e', '#5c946e', '#8e6cc1', '#e4572e'];
  for (const sx of [-6.6, 6.6]) {
    g.add(box(1.6, 2.6, 0.5, '#7a5232', sx, 1.3, -2.8));
    for (let r = 0; r < 4; r++) {
      g.add(box(1.5, 0.05, 0.46, '#5b3a22', sx, 0.3 + r * 0.6, -2.75));
      for (let b = 0; b < 7; b++) g.add(box(0.16, 0.42, 0.32, books[(b + r * 2) % books.length], sx - 0.6 + b * 0.2, 0.54 + r * 0.6, -2.72));
    }
  }
  // piante
  for (const x of [-2.2, 2.2]) {
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 10), mat('#c46a3a')), x, 0.2, -2.7);
    put(g, new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat('#4f8f4a')), x, 0.75, -2.7);
  }
  return g;
}

// Tavolino tondo con appunti e due tazze: il centro della discussione.
function makeTable() {
  const g = new THREE.Group();
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 24), mat('#8a5a35')), 0, 0.62, 0);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), mat('#5b3a22')), 0, 0.31, 0);
  put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.03, 16), mat('#5b3a22')), 0, 0.015, 0);
  g.add(box(0.3, 0.01, 0.22, '#f8f4e3', -0.12, 0.65, 0.05));
  g.add(box(0.26, 0.01, 0.2, '#ffffff', -0.05, 0.656, -0.08));
  for (const [x, z, c] of [[0.3, 0.12, '#e4572e'], [0.22, -0.22, '#2e86ab']]) {
    put(g, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 10), mat(c)), x, 0.7, z);
  }
  return g;
}

// Simboli sopra la testa dello studente: lampadina (ha capito) o punto di domanda (ci ragioniamo).
function symbolTexture(char, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill();
  g.lineWidth = 8; g.strokeStyle = '#1d1f2b'; g.stroke();
  g.fillStyle = color; g.font = 'bold 76px "Press Start 2P", monospace';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(char, 66, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBulb() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true }));
  g.add(glass);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), new THREE.MeshBasicMaterial({ color: '#868e96', transparent: true }));
  base.position.y = -0.15;
  g.add(base);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.24, 20), new THREE.MeshBasicMaterial({ color: '#fff3bf', transparent: true, side: THREE.DoubleSide }));
  g.add(halo);
  g.userData.parts = [glass, base, halo];
  return g;
}

export function createBossArena(canvas, { avatar, pet } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#efe6d2');
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  const hemi = new THREE.HemisphereLight('#ffffff', '#8a6a46', 1.8);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 1.9);
  sun.position.set(2, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(sun);
  scene.add(makeRoom());
  const table = makeTable();
  table.position.set(TABLE.x, 0, TABLE.y);
  scene.add(table);

  // studente e compagno: in piedi accanto al tavolino, alla stessa altezza del Prof
  const hero = makeCharacter(avatar || {});
  hero.scale.setScalar(1.5);
  hero.position.set(-1.25, 0, 0.5);
  scene.add(hero);
  const buddy = pet ? makePet(pet.species, pet.color) : null;
  if (buddy) { buddy.scale.setScalar(1.3); buddy.position.set(-1.95, 0, 0.95); scene.add(buddy); }

  const prof = makeCharacter(PROF_AVATAR);
  prof.scale.setScalar(1.5);
  let ang = 0;
  prof.position.set(TABLE.x + Math.cos(ang) * R, 0, TABLE.y + Math.sin(ang) * R);
  scene.add(prof);

  const bulb = makeBulb();
  bulb.visible = false;
  scene.add(bulb);
  const question = new THREE.Sprite(new THREE.SpriteMaterial({ map: symbolTexture('?', '#2e86ab'), transparent: true }));
  question.scale.setScalar(0.42);
  question.visible = false;
  scene.add(question);

  // Il Prof gira attorno al tavolino (un angolo sul cerchio); quando parla si ferma di fianco allo studente.
  const TALK_ANG = Math.atan2(0.3 - TABLE.y, -0.45 - TABLE.x);
  const fx = { talk: 0, bulb: 0, question: 0, nod: 0, end: null, endT: 0, phase: 1 };
  let pause = 1.2, stepPhase = 0, targetAng = 0;
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  function layout() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const narrow = camera.aspect < 1.1;
    camera.fov = narrow ? 58 : 36;
    camera.position.set(0.2, narrow ? 2.6 : 2.2, narrow ? 7.4 : 6.3);
    camera.lookAt(0, 0.95, -0.3);
    camera.updateProjectionMatrix();
  }
  layout();
  const ro = new ResizeObserver(layout);
  ro.observe(canvas);

  const turnTo = (ch, x, z, k) => {
    const want = Math.atan2(x - ch.position.x, z - ch.position.z);
    let d = want - ch.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    ch.rotation.y += d * k;
  };

  let raf = 0, alive = true, last = performance.now();
  const loop = (t) => {
    if (!alive) return;
    const dt = Math.max(0, Math.min(0.1, (t - last) / 1000)); last = Math.max(last, t);
    const talking = fx.talk > 0 || fx.end;
    fx.talk = Math.max(0, fx.talk - dt);

    // --- il Prof cammina ---
    const speed = fx.phase === 2 ? 1.25 : 0.85;
    const goalAng = talking ? TALK_ANG : targetAng;
    const da = angDiff(goalAng, ang);
    let moving = false, dist = 0;
    if (fx.end && Math.abs(da) < 0.05) {
      // a fine discussione si avvicina allo studente, fuori dal cerchio
      const goal = new THREE.Vector2(-0.65, 0.45);
      const pos = new THREE.Vector2(prof.position.x, prof.position.z);
      dist = pos.distanceTo(goal);
      if (dist > 0.05) {
        const step = Math.min(dist, speed * dt), dir = goal.clone().sub(pos).normalize();
        prof.position.x += dir.x * step; prof.position.z += dir.y * step;
        turnTo(prof, goal.x, goal.y, Math.min(1, dt * 8));
        stepPhase = (stepPhase + step / 0.55) % 1;
        moving = true;
      } else turnTo(prof, hero.position.x, hero.position.z, Math.min(1, dt * 6));
    } else if (Math.abs(da) > 0.03) {
      dist = 1;
      const step = Math.sign(da) * Math.min(Math.abs(da), (speed / R) * dt);
      ang += step;
      const nx = TABLE.x + Math.cos(ang) * R, nz = TABLE.y + Math.sin(ang) * R;
      turnTo(prof, nx + (nx - prof.position.x) * 20, nz + (nz - prof.position.z) * 20, Math.min(1, dt * 10));
      prof.position.x = nx; prof.position.z = nz;
      stepPhase = (stepPhase + Math.abs(step) * R / 0.55) % 1;
      moving = true;
    } else if (talking) {
      turnTo(prof, hero.position.x, hero.position.z, Math.min(1, dt * 6));
    } else if ((pause -= dt) <= 0) {
      targetAng = ang + (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 1.6);
      pause = 1 + Math.random() * 2;
    } else {
      // in pausa: guarda lo studente, come chi sta pensando alla prossima domanda
      turnTo(prof, hero.position.x, hero.position.z, Math.min(1, dt * 3));
    }
    animateCharacter(prof, stepPhase, moving, t);
    const arms = prof.userData.arms, head = prof.userData.head;
    if (!moving && talking && !fx.end) {
      // gesti a mani aperte mentre spiega
      const g = Math.sin(t / 180);
      arms[0].rotation.x = -0.7 + g * 0.25; arms[0].rotation.z = -0.25;
      arms[1].rotation.x = -0.7 - g * 0.25; arms[1].rotation.z = 0.25;
    } else if (!moving) {
      arms[0].rotation.z = 0; arms[1].rotation.z = 0;
    }
    fx.nod = Math.max(0, fx.nod - dt);
    head.rotation.x = fx.nod > 0 ? Math.sin(fx.nod * 14) * 0.18 : 0;
    head.rotation.z = talking && !moving ? Math.sin(t / 260) * 0.04 : 0;

    // --- lo studente segue il Prof con lo sguardo ---
    animateCharacter(hero, 0, false, t);
    turnTo(hero, prof.position.x, prof.position.z, Math.min(1, dt * 4));
    if (buddy) { turnTo(buddy, prof.position.x, prof.position.z, Math.min(1, dt * 3)); animatePet(buddy, t, false); }
    const hHead = hero.userData.head;
    hHead.rotation.x = fx.bulb > 0 ? Math.sin(fx.bulb * 12) * 0.12 : 0;
    hHead.rotation.z = fx.question > 0 ? 0.18 * Math.min(1, fx.question) : 0;

    // simboli
    const top = new THREE.Vector3(hero.position.x, 2.05, hero.position.z);
    fx.bulb = Math.max(0, fx.bulb - dt * 0.6);
    bulb.visible = fx.bulb > 0;
    if (bulb.visible) {
      bulb.position.copy(top).add(new THREE.Vector3(0, (1 - fx.bulb) * 0.25, 0));
      bulb.lookAt(camera.position);
      bulb.userData.parts.forEach((m) => { m.material.opacity = Math.min(1, fx.bulb * 2.5); });
      bulb.userData.parts[2].scale.setScalar(1 + Math.sin(t / 90) * 0.12);
    }
    fx.question = Math.max(0, fx.question - dt * 0.6);
    question.visible = fx.question > 0;
    if (question.visible) {
      question.position.copy(top).add(new THREE.Vector3(0, Math.sin(t / 200) * 0.04, 0));
      question.material.opacity = Math.min(1, fx.question * 2.5);
    }

    // --- finale: stretta di mano, oppure una pacca sulla spalla ---
    if (fx.end && !moving && dist <= 0.05) {
      fx.endT += dt;
      const k = Math.min(1, fx.endT * 2);
      if (fx.end === 'win') {
        arms[0].rotation.x = -1.3 * k;
        hero.userData.arms[0].rotation.x = -1.3 * k;
        const shake = fx.endT > 0.5 && fx.endT < 2.2 ? Math.sin(fx.endT * 18) * 0.15 : 0;
        arms[0].rotation.x += shake; hero.userData.arms[0].rotation.x += shake;
        if (fx.endT > 0.4 && fx.endT < 0.5) fx.bulb = 1.6;
      } else {
        arms[1].rotation.x = -1.6 * k; arms[1].rotation.z = 0.35 * k;
        hHead.rotation.x = 0.25 * k;
      }
    }

    // seconda fase: luce del tardo pomeriggio
    const warm = fx.phase === 2 ? 1 : 0;
    sun.color.lerp(new THREE.Color(warm ? '#ffb070' : '#fff4e0'), Math.min(1, dt * 2));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    talk(sec = 2) { fx.talk = Math.max(fx.talk, sec); },
    quiet() { fx.talk = 0; },
    // posizione sullo schermo (pixel nel canvas) della testa del Prof, per il fumetto
    profHead() {
      const v = new THREE.Vector3();
      prof.userData.head.getWorldPosition(v);
      v.project(camera);
      return { x: (v.x + 1) / 2 * canvas.clientWidth, y: (1 - v.y) / 2 * canvas.clientHeight, w: canvas.clientWidth, h: canvas.clientHeight };
    },
    // risposta giusta: lo studente ha l'intuizione giusta, il Prof annuisce
    hitBoss() { fx.bulb = 1.6; fx.nod = 0.8; fx.question = 0; },
    // risposta sbagliata: un dubbio su cui ragionare insieme
    hitPlayer() { fx.question = 1.8; fx.bulb = 0; },
    setPhase(n) { fx.phase = n; },
    // fine: se vince lo studente si stringono la mano, altrimenti il Prof lo incoraggia
    faint(who) { fx.end = who === 'boss' ? 'win' : 'lose'; fx.endT = 0; },
    dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); }
  };
}
