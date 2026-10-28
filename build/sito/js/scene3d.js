// Città in 3D: terreno pixel-art, alberi, siepi, edifici, personaggi e camera in stile RPG portatile.
import * as THREE from '../vendor/three.module.min.js';
import { T, TS, drawTile, LOOKS } from './sprites.js';
import {
  makeCharacter, animateCharacter, makePet, animatePet, makeBuilding, makeObservatory, makeBossHall, makeSign, makeGate,
  makeBubble, avatarFromLook, mat
} from './models.js';

const DIR_ANGLE = { down: 0, up: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 };
const CAM_OFFSET = new THREE.Vector3(0, 12.5, 11);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const sky = new THREE.Color('#9fd8ff');
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 24, 44);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 90);
  let zoom = 1;

  scene.add(new THREE.HemisphereLight('#e7f5ff', '#6b8f3a', 1.6));
  const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const state = {
    map: null, npcs: [], buildings: [], gates: [], player: null, pet: null, playerAngle: 0, petAngle: 0,
    camPos: new THREE.Vector3(), camTarget: new THREE.Vector3(), camInit: false
  };
  const root = new THREE.Group();
  scene.add(root);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---------- Terreno ----------
  function buildGround(map) {
    const c = document.createElement('canvas');
    c.width = map.W * TS; c.height = map.H * TS;
    const g = c.getContext('2d');
    for (let y = 0; y < map.H; y++) {
      for (let x = 0; x < map.W; x++) {
        let t = map.tiles[y * map.W + x];
        if (t === T.TREE || t === T.HEDGE || t === T.FENCE || t === T.TALL) {
          // sotto alberi e siepi si usa il terreno circostante (erba o sabbia)
          const near = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].map(([a, b]) => map.tiles[b * map.W + a]);
          t = near.includes(T.SAND) && !near.includes(T.GRASS) ? T.SAND : T.GRASS;
        }
        drawTile(g, t, x, y);
      }
    }
    // pavimento sotto gli edifici e davanti alle porte
    for (const o of map.objects) {
      if (o.type !== 'building' && o.type !== 'boss') continue;
      for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) drawTile(g, T.PLAZA, x, y);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(map.W, map.H), new THREE.MeshLambertMaterial({ map: tex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(map.W / 2, 0, map.H / 2);
    ground.receiveShadow = true;
    root.add(ground);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat('#5f9e3c'));
    outside.rotation.x = -Math.PI / 2;
    outside.position.set(map.W / 2, -0.02, map.H / 2);
    outside.receiveShadow = true;
    root.add(outside);
  }

  // ---------- Vegetazione (instanced) ----------
  function buildNature(map) {
    const trees = [], hedges = [], tall = [], fences = [];
    for (let y = 0; y < map.H; y++) for (let x = 0; x < map.W; x++) {
      const t = map.tiles[y * map.W + x];
      if (t === T.TREE) trees.push([x, y]);
      else if (t === T.HEDGE) hedges.push([x, y]);
      else if (t === T.TALL) tall.push([x, y]);
      else if (t === T.FENCE) fences.push([x, y]);
    }
    // alberi fuori dalla città, per non vedere il vuoto ai bordi
    const r0 = rng(99);
    for (let i = 0; i < 260; i++) {
      const side = Math.floor(r0() * 4);
      const along = r0(), depth = 1 + r0() * 7;
      const x = side < 2 ? along * (map.W + 14) - 7 : side === 2 ? -depth : map.W + depth - 1;
      const y = side >= 2 ? along * (map.H + 14) - 7 : side === 0 ? -depth : map.H + depth - 1;
      trees.push([x, y]);
    }
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 0.55, 6), mat('#6d4c41'), trees.length);
    const crown1 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.58, 0.95, 7), new THREE.MeshLambertMaterial({ flatShading: true }), trees.length);
    const crown2 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 0.75, 7), new THREE.MeshLambertMaterial({ flatShading: true }), trees.length);
    const r = rng(7);
    trees.forEach(([x, y], i) => {
      const s = 0.85 + r() * 0.35, rot = r() * Math.PI;
      const cx = x + 0.5 + (r() - 0.5) * 0.12, cz = y + 0.5 + (r() - 0.5) * 0.12;
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(s, s, s);
      dummy.position.set(cx, 0.27 * s, cz); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
      dummy.position.set(cx, 0.95 * s, cz); dummy.updateMatrix(); crown1.setMatrixAt(i, dummy.matrix);
      dummy.position.set(cx, 1.42 * s, cz); dummy.updateMatrix(); crown2.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.31 + (r() - 0.5) * 0.05, 0.5, 0.3 + r() * 0.06);
      crown1.setColorAt(i, col);
      crown2.setColorAt(i, col.offsetHSL(0, 0, 0.06));
    });
    for (const m of [trunk, crown1, crown2]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }

    if (hedges.length) {
      const hedge = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.7, 1), mat('#3d8b3d'), hedges.length);
      const hedgeTop = new THREE.InstancedMesh(new THREE.BoxGeometry(0.92, 0.14, 0.92), mat('#57a957'), hedges.length);
      hedges.forEach(([x, y], i) => {
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
        dummy.position.set(x + 0.5, 0.35, y + 0.5); dummy.updateMatrix(); hedge.setMatrixAt(i, dummy.matrix);
        dummy.position.set(x + 0.5, 0.74, y + 0.5); dummy.updateMatrix(); hedgeTop.setMatrixAt(i, dummy.matrix);
      });
      for (const m of [hedge, hedgeTop]) { m.castShadow = true; m.receiveShadow = true; root.add(m); }
    }
    if (tall.length) {
      const blade = new THREE.InstancedMesh(new THREE.ConeGeometry(0.07, 0.34, 4), mat('#4fa83a'), tall.length * 5);
      const rt = rng(3);
      tall.forEach(([x, y], i) => {
        for (let k = 0; k < 5; k++) {
          dummy.position.set(x + 0.15 + rt() * 0.7, 0.2, y + 0.15 + rt() * 0.7);
          dummy.rotation.set((rt() - 0.5) * 0.3, rt() * 3, (rt() - 0.5) * 0.3);
          const s = 0.8 + rt() * 0.5;
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          blade.setMatrixAt(i * 5 + k, dummy.matrix);
        }
      });
      blade.receiveShadow = true;
      root.add(blade);
    }
    for (const [x, y] of fences) {
      root.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.1), mat('#a0703c')), { position: new THREE.Vector3(x + 0.5, 0.45, y + 0.5) }));
    }
  }

  // ---------- Oggetti della mappa ----------
  function fadeable(group) {
    // materiali propri, così l'edificio può diventare trasparente quando copre il giocatore
    const list = [];
    const clones = new Map();
    group.traverse((m) => {
      if (!m.isMesh || !m.material || m.material.isMeshBasicMaterial && m.material.map) return;
      if (!clones.has(m.material)) { const c = m.material.clone(); clones.set(m.material, c); list.push(c); }
      m.material = clones.get(m.material);
    });
    group.traverse((m) => { if (m.isMesh && m.material.map) list.push(m.material); });
    return list;
  }

  function buildObjects(map) {
    for (const o of map.objects) {
      if (o.type === 'building') {
        const b = o.kind === 'observatory' ? makeObservatory(o) : makeBuilding(o);
        root.add(b);
        state.buildings.push({ o, g: b, mats: fadeable(b), fade: 1 });
      } else if (o.type === 'boss') {
        const b = makeBossHall(o, o.name);
        root.add(b);
        state.buildings.push({ o, g: b, mats: fadeable(b), fade: 1 });
      } else if (o.type === 'sign') {
        const color = o.kind === 'building' ? o.building.color : o.kind === 'observatory' ? o.obs.color : '#c08a52';
        const label = o.kind === 'building' ? o.building.glyph : o.kind === 'observatory' ? o.obs.glyph : o.kind === 'district' ? `Q${o.levelIndex + 1}` : o.kind === 'thesis' ? 'TESI' : 'VIALE';
        const s = makeSign(color, label);
        s.position.set(o.x + 0.5, 0, o.y + 0.5);
        root.add(s);
      } else if (o.type === 'gate') {
        const g = makeGate(o.tiles, o.gate === 'boss' ? 'boss' : 'district');
        root.add(g);
        state.gates.push({ o, g });
      } else if (o.type === 'npc') {
        const avatar = o.avatar || avatarFromLook(LOOKS[o.look] || LOOKS.student1);
        const ch = makeCharacter(avatar);
        ch.position.set(o.x + 0.5, 0, o.y + 0.5);
        ch.rotation.y = DIR_ANGLE[o.dir] || 0;
        root.add(ch);
        let bubble = null;
        if (o.person) {
          bubble = makeBubble(o.person.kind);
          bubble.position.set(0, 1.45, 0);
          ch.add(bubble);
        }
        state.npcs.push({ o, ch, bubble, angle: ch.rotation.y, seed: Math.random() * 1000 });
      }
    }
  }

  function load(map) {
    state.map = map;
    buildGround(map);
    buildNature(map);
    buildObjects(map);
  }

  function setPlayer(avatar) {
    if (state.player) root.remove(state.player);
    state.player = makeCharacter(avatar);
    root.add(state.player);
  }

  function setPet(pet) {
    if (state.pet) root.remove(state.pet);
    state.pet = pet ? makePet(pet.species, pet.color) : null;
    if (state.pet) root.add(state.pet);
  }

  function setGateStates(fn) { for (const { o, g } of state.gates) g.userData.setState(fn(o)); }

  function setBadges(has) {
    for (const b of state.buildings) if (b.g.userData.flag) b.g.userData.flag.visible = !!(b.o.id && has(b.o.id));
  }

  function setTalked(has) {
    for (const n of state.npcs) if (n.bubble) n.bubble.visible = !has(n.o.person.id);
  }

  function faceNpc(o, dir) {
    const n = state.npcs.find((x) => x.o === o);
    if (n) n.target = dir ? DIR_ANGLE[dir] : null;
  }

  function setZoom(z) { zoom = Math.max(0.6, Math.min(1.6, z)); }

  // ---------- Fotogramma ----------
  const tmp = new THREE.Vector3();
  function frame(f) {
    const { t, dt } = f;
    const k = Math.min(1, dt / 90);
    if (state.player && f.player) {
      const p = f.player;
      state.player.position.set(p.x + 0.5, 0, p.y + 0.5);
      state.playerAngle = lerpAngle(state.playerAngle, DIR_ANGLE[p.dir], Math.min(1, dt / 60));
      state.player.rotation.y = state.playerAngle;
      animateCharacter(state.player, p.phase, p.moving, t);
    }
    if (state.pet && f.pet) {
      const p = f.pet;
      state.pet.position.set(p.x + 0.5, 0, p.y + 0.5);
      state.petAngle = lerpAngle(state.petAngle, DIR_ANGLE[p.dir] ?? 0, Math.min(1, dt / 80));
      state.pet.rotation.y = state.petAngle;
      animatePet(state.pet, t, p.moving);
    }
    for (const n of state.npcs) {
      const idle = n.o.dir ? DIR_ANGLE[n.o.dir] : 0;
      n.angle = lerpAngle(n.angle, n.target ?? idle, k * 0.5);
      n.ch.rotation.y = n.angle;
      animateCharacter(n.ch, 0, false, t + n.seed);
      if (n.bubble) n.bubble.position.y = 1.45 + Math.sin((t + n.seed) / 300) * 0.04;
    }
    for (const b of state.buildings) {
      const fl = b.g.userData.flag;
      if (fl && fl.visible) b.g.userData.cloth.rotation.y = Math.sin(t / 300) * 0.25;
    }
    // camera
    if (f.player) {
      const px = f.player.x + 0.5, pz = f.player.y + 0.5;
      const portrait = camera.aspect < 0.9 ? 1.35 : 1;
      const target = tmp.set(px, 0.6, pz - 0.6);
      const desired = target.clone().addScaledVector(CAM_OFFSET, zoom * portrait);
      if (!state.camInit) { state.camPos.copy(desired); state.camTarget.copy(target); state.camInit = true; }
      state.camPos.lerp(desired, Math.min(1, dt / 140));
      state.camTarget.lerp(target, Math.min(1, dt / 140));
      camera.position.copy(state.camPos);
      camera.lookAt(state.camTarget);
      scene.fog.near = 22 * zoom * portrait; scene.fog.far = 42 * zoom * portrait;
      sun.position.set(px - 7, 14, pz + 6);
      sun.target.position.set(px, 0, pz);
      // edifici che coprono il giocatore diventano trasparenti
      for (const b of state.buildings) {
        const o = b.o;
        const front = o.y + o.h;
        const covers = px > o.x - 0.6 && px < o.x + o.w + 0.6 && pz < o.y + 0.6 && o.y - pz < 4.5 && front > pz;
        const want = covers ? 0.3 : 1;
        b.fade += (want - b.fade) * Math.min(1, dt / 120);
        const tr = b.fade < 0.99;
        for (const m of b.mats) { m.transparent = tr; m.opacity = b.fade; m.depthWrite = !tr; }
      }
    }
    renderer.render(scene, camera);
  }

  // Coordinate di schermo (px CSS) di un punto della mappa, per i fumetti HTML.
  function project(x, y, h) {
    const v = new THREE.Vector3(x + 0.5, h, y + 0.5).project(camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, visible: v.z < 1 };
  }

  resize();
  return { renderer, scene, camera, load, setPlayer, setPet, setGateStates, setBadges, setTalked, faceNpc, frame, project, resize, setZoom, get zoom() { return zoom; } };
}

// Anteprima 3D per la schermata di creazione del personaggio.
export function createPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 20);
  camera.position.set(0, 1.1, 3.6);
  camera.lookAt(0, 0.55, 0);
  scene.add(new THREE.HemisphereLight('#ffffff', '#88aa66', 2));
  const d = new THREE.DirectionalLight('#ffffff', 1.8);
  d.position.set(2, 3, 3);
  scene.add(d);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.08, 24), mat('#7ec850'));
  pad.position.y = -0.04;
  scene.add(pad);
  let ch = null, pet = null, raf = 0, alive = true;
  const set = (avatar, petCfg) => {
    if (ch) scene.remove(ch);
    if (pet) scene.remove(pet);
    ch = makeCharacter(avatar);
    ch.position.x = -0.25;
    scene.add(ch);
    pet = petCfg ? makePet(petCfg.species, petCfg.color) : null;
    if (pet) { pet.position.set(0.5, 0, 0.25); scene.add(pet); }
  };
  const loop = (t) => {
    if (!alive) return;
    if (ch) ch.rotation.y = Math.sin(t / 1400) * 0.6;
    if (pet) { pet.rotation.y = -0.4 + Math.sin(t / 1100) * 0.3; animatePet(pet, t, false); }
    if (ch) animateCharacter(ch, 0, false, t);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return {
    set,
    dispose() { alive = false; cancelAnimationFrame(raf); renderer.dispose(); }
  };
}
