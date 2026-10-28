// Mini-giochi interattivi. Ogni mini-gioco monta la propria interfaccia per un item,
// risolve `submitted` con la risposta dello studente e mostra la correzione con `reveal`.
import { el } from './ui.js';
import { sfx } from './audio.js';
import { portrait, drawChar, LOOKS } from './sprites.js';

const PAIR_COLORS = ['#e4572e', '#2e86ab', '#2f9e44', '#8064a2', '#e8a317', '#d6336c', '#1098ad', '#5c940d'];

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function keyHandler(map) {
  const fn = (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const h = map[e.key];
    if (h) { e.preventDefault(); h(e); }
  };
  window.addEventListener('keydown', fn);
  return () => window.removeEventListener('keydown', fn);
}

// ---------- Quiz in stile lotta (domanda a scelta multipla) ----------
function battle(stage, item, ctx) {
  const d = deferred();
  const head = el('div', { class: 'row', style: 'margin-bottom:10px' },
    portrait(ctx.npcLook, 64), el('div', { class: 'muted' }, `${ctx.npcName} ti sfida!`));
  const prompt = el('div', { class: 'battle-prompt' }, item.prompt);
  const btns = item.options.map((o, i) => el('button', { class: 'btn', 'data-id': o.id, onclick: () => choose(o.id) },
    el('span', { class: 'k' }, String(i + 1)), o.label));
  const node = el('div', {}, head, prompt, el('div', { class: 'options' }, btns));
  let chosen = null;
  const off = keyHandler(Object.fromEntries(item.options.map((o, i) => [String(i + 1), () => choose(o.id)])));
  function choose(id) {
    if (chosen) return;
    chosen = id;
    off();
    btns.forEach((b) => { b.disabled = true; if (b.dataset.id === id) b.classList.add('selected'); });
    d.resolve(id);
  }
  return {
    node, submitted: d.promise,
    reveal(fb) {
      btns.forEach((b) => {
        b.classList.remove('selected');
        if (b.dataset.id === fb.solution) b.classList.add('good');
        else if (b.dataset.id === chosen) b.classList.add('bad');
      });
    },
    destroy: off
  };
}

// ---------- Duello: l'obiezione attacca, scegli la contro-risposta ----------
function duel(stage, item, ctx) {
  const st = ctx.stageState;
  if (st.hp === undefined) st.hp = 100;
  const d = deferred();
  const bar = el('div', { class: 'hpbar' }, el('div', { style: `width:${st.hp}%` }));
  const crowd = el('div', { style: 'text-align:center' }, portrait('student1', 72), el('div', { class: 'muted', style: 'font-size:14px' }, 'Pubblico scettico'), bar);
  const node = el('div', {},
    el('div', { class: 'duel-arena' }, el('div', { class: 'speech' }, item.prompt), crowd),
    el('div', { class: 'muted', style: 'margin-bottom:8px' }, 'Come rispose Turing?'));
  let chosen = null;
  const btns = item.options.map((o, i) => el('button', { class: 'btn', 'data-id': o.id, style: 'width:100%;margin-bottom:10px', onclick: () => choose(o.id) },
    el('span', { class: 'k', style: 'font-family:var(--font-title);font-size:10px;margin-right:8px;opacity:.7' }, String(i + 1)), o.label));
  node.append(...btns);
  const off = keyHandler(Object.fromEntries(item.options.map((o, i) => [String(i + 1), () => choose(o.id)])));
  function choose(id) {
    if (chosen) return;
    chosen = id; off();
    btns.forEach((b) => { b.disabled = true; if (b.dataset.id === id) b.classList.add('selected'); });
    d.resolve(id);
  }
  return {
    node, submitted: d.promise,
    reveal(fb) {
      btns.forEach((b) => { b.classList.remove('selected'); if (b.dataset.id === fb.solution) b.classList.add('good'); else if (b.dataset.id === chosen) b.classList.add('bad'); });
      if (fb.correct) {
        st.hp = Math.max(0, st.hp - Math.ceil(100 / ctx.stageSize));
        bar.firstChild.style.width = st.hp + '%';
        bar.className = 'hpbar' + (st.hp < 25 ? ' low' : st.hp < 55 ? ' mid' : '');
        crowd.classList.add('shake');
      }
    },
    destroy: off
  };
}

// ---------- Vero/Falso a tempo ----------
function rush(stage, item, ctx) {
  const d = deferred();
  const limit = (stage.timeLimitSec || 15) * 1000;
  const bar = el('div', {});
  const card = el('div', { class: 'rush-card' }, item.prompt);
  const bt = el('button', { class: 'btn good', onclick: () => choose(true) }, '← VERO');
  const bf = el('button', { class: 'btn bad', onclick: () => choose(false) }, 'FALSO →');
  const node = el('div', {}, card, el('div', { class: 'timer' }, bar), el('div', { class: 'tf-buttons' }, bt, bf));
  let chosen;
  const t0 = performance.now();
  let raf = 0;
  const tick = () => {
    const left = Math.max(0, 1 - (performance.now() - t0) / limit);
    bar.style.width = (left * 100) + '%';
    bar.style.background = left < 0.25 ? 'var(--bad)' : left < 0.5 ? 'var(--warn)' : 'var(--accent-2)';
    if (left <= 0) { choose(null); return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const off = keyHandler({ ArrowLeft: () => choose(true), ArrowRight: () => choose(false), v: () => choose(true), f: () => choose(false) });
  function choose(v) {
    if (chosen !== undefined) return;
    chosen = v; off(); cancelAnimationFrame(raf);
    bt.disabled = bf.disabled = true;
    if (v === null) card.append(el('div', { style: 'font-family:var(--font-title);font-size:12px;color:var(--bad);margin-top:10px' }, 'Tempo scaduto!'));
    d.resolve(v);
  }
  return {
    node, submitted: d.promise, autoContinue: true,
    reveal(fb) {
      bt.classList.toggle('selected', fb.solution === true);
      bf.classList.toggle('selected', fb.solution === false);
      card.style.borderColor = fb.correct ? 'var(--good)' : 'var(--bad)';
    },
    destroy() { off(); cancelAnimationFrame(raf); }
  };
}

// ---------- Collegamenti (match) ----------
function connect(stage, item) {
  const d = deferred();
  const pairs = {}; // leftId -> rightId
  let selLeft = null;
  let revealed = null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const leftBtns = item.left.map((l) => el('button', { class: 'btn', 'data-id': l.id, onclick: () => clickLeft(l.id) }, el('span', { class: 'pair-mark' }, '·'), l.label));
  const rightBtns = item.right.map((r) => el('button', { class: 'btn', 'data-id': r.id, onclick: () => clickRight(r.id) }, el('span', { class: 'pair-mark' }, '·'), r.label));
  const box = el('div', { class: 'connect' },
    el('div', { class: 'col' }, el('h3', {}, item.leftTitle || ''), leftBtns),
    el('div', { class: 'col' }, el('h3', {}, item.rightTitle || ''), rightBtns));
  box.prepend(svg);
  const submit = el('button', { class: 'btn primary', disabled: true, onclick: () => { if (Object.keys(pairs).length === item.left.length) { lock(); d.resolve({ ...pairs }); } } }, '✔ Conferma i collegamenti');
  const node = el('div', {}, box, el('div', { class: 'row', style: 'margin-top:16px' }, el('span', { class: 'muted' }, 'Clicca un collegamento già fatto per annullarlo.'), el('div', { class: 'spacer' }), submit));

  const colorOf = (leftId) => PAIR_COLORS[item.left.findIndex((l) => l.id === leftId) % PAIR_COLORS.length];
  function refresh() {
    const rightToLeft = Object.fromEntries(Object.entries(pairs).map(([l, r]) => [r, l]));
    leftBtns.forEach((b, i) => {
      const id = b.dataset.id;
      const mark = b.querySelector('.pair-mark');
      const paired = pairs[id];
      mark.style.background = paired ? colorOf(id) : '';
      mark.textContent = paired ? String(i + 1) : '·';
      b.classList.toggle('selected', selLeft === id);
    });
    rightBtns.forEach((b) => {
      const l = rightToLeft[b.dataset.id];
      const mark = b.querySelector('.pair-mark');
      mark.style.background = l ? colorOf(l) : '';
      mark.textContent = l ? String(item.left.findIndex((x) => x.id === l) + 1) : '·';
    });
    submit.disabled = Object.keys(pairs).length !== item.left.length;
    drawLines();
  }
  function drawLines() {
    const br = box.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${br.width} ${br.height}`);
    svg.innerHTML = '';
    const lines = revealed ? Object.entries(pairs).map(([l, r]) => [l, r, revealed[l] === r ? '#2f9e44' : '#c92a2a']) : Object.entries(pairs).map(([l, r]) => [l, r, colorOf(l)]);
    for (const [l, r, col] of lines) {
      const lb = leftBtns.find((b) => b.dataset.id === l).getBoundingClientRect();
      const rb = rightBtns.find((b) => b.dataset.id === r).getBoundingClientRect();
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', lb.right - br.left); line.setAttribute('y1', lb.top + lb.height / 2 - br.top);
      line.setAttribute('x2', rb.left - br.left); line.setAttribute('y2', rb.top + rb.height / 2 - br.top);
      line.setAttribute('stroke', col); line.setAttribute('stroke-width', '4'); line.setAttribute('stroke-linecap', 'round');
      svg.append(line);
    }
  }
  function clickLeft(id) {
    if (revealed || submit.dataset.locked) return;
    if (pairs[id]) { delete pairs[id]; selLeft = null; sfx.blip(); refresh(); return; }
    selLeft = id; sfx.blip(); refresh();
  }
  function clickRight(id) {
    if (revealed || submit.dataset.locked) return;
    const owner = Object.keys(pairs).find((l) => pairs[l] === id);
    if (!selLeft) { if (owner) { delete pairs[owner]; sfx.blip(); refresh(); } return; }
    if (owner) delete pairs[owner];
    pairs[selLeft] = id;
    // seleziona automaticamente il prossimo elemento libero
    selLeft = item.left.map((l) => l.id).find((l) => !pairs[l]) || null;
    sfx.select(); refresh();
  }
  function lock() { submit.dataset.locked = '1'; submit.disabled = true; [...leftBtns, ...rightBtns].forEach((b) => { b.disabled = true; b.classList.remove('selected'); }); }
  const onResize = () => drawLines();
  window.addEventListener('resize', onResize);
  requestAnimationFrame(refresh);
  return {
    node, submitted: d.promise,
    reveal(fb) {
      revealed = fb.solution;
      leftBtns.forEach((b) => {
        const ok = pairs[b.dataset.id] === fb.solution[b.dataset.id];
        b.classList.add(ok ? 'good' : 'bad');
        if (!ok) {
          const right = item.right.find((r) => r.id === fb.solution[b.dataset.id]);
          b.append(el('div', { style: 'font-size:14px;color:var(--bad);margin-top:4px' }, `→ corretto: ${right ? right.label : '?'}`));
        }
      });
      requestAnimationFrame(drawLines);
    },
    destroy() { window.removeEventListener('resize', onResize); }
  };
}

// ---------- Linea del tempo (ordinamento) ----------
function timeline(stage, item) {
  const d = deferred();
  let order = item.entries.map((e) => e.id);
  const list = el('div', { class: 'timeline' });
  const cards = new Map();
  let locked = false;
  for (const e of item.entries) {
    const up = el('button', { class: 'btn', title: 'Su', onclick: (ev) => { ev.stopPropagation(); move(e.id, -1); } }, '▲');
    const down = el('button', { class: 'btn', title: 'Giù', onclick: (ev) => { ev.stopPropagation(); move(e.id, 1); } }, '▼');
    const card = el('div', { class: 'card', 'data-id': e.id }, el('span', { class: 'grip' }, '⣿'), el('span', { class: 'label' }, e.label), el('span', { class: 'year hidden' }), el('div', { class: 'arrows' }, up, down));
    cards.set(e.id, card);
    card.addEventListener('pointerdown', (ev) => startDrag(ev, e.id));
  }
  const render = () => { list.innerHTML = ''; order.forEach((id) => list.append(cards.get(id))); };
  render();
  function move(id, delta) {
    if (locked) return;
    const i = order.indexOf(id), j = i + delta;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    sfx.blip(); render();
  }
  function startDrag(ev, id) {
    if (locked || ev.target.closest('button')) return;
    const card = cards.get(id);
    card.classList.add('dragging');
    card.setPointerCapture(ev.pointerId);
    const onMove = (e) => {
      const others = order.filter((x) => x !== id);
      let idx = others.length;
      for (let k = 0; k < others.length; k++) {
        const r = cards.get(others[k]).getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { idx = k; break; }
      }
      const next = [...others.slice(0, idx), id, ...others.slice(idx)];
      if (next.join() !== order.join()) { order = next; render(); }
    };
    const onUp = () => {
      card.classList.remove('dragging');
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointercancel', onUp);
    };
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', onUp);
    card.addEventListener('pointercancel', onUp);
  }
  const submit = el('button', { class: 'btn primary', onclick: () => { locked = true; submit.disabled = true; d.resolve(order.slice()); } }, '✔ Conferma l\'ordine');
  const node = el('div', {},
    el('div', { class: 'muted', style: 'margin-bottom:8px' }, '▲ più antico'),
    list,
    el('div', { class: 'row', style: 'margin-top:8px' }, el('span', { class: 'muted' }, '▼ più recente'), el('div', { class: 'spacer' }), submit));
  return {
    node, submitted: d.promise,
    reveal(fb) {
      order.forEach((id, i) => {
        const c = cards.get(id);
        c.classList.add(fb.solution[i] === id ? 'ok' : 'ko');
        const y = c.querySelector('.year');
        y.textContent = (fb.reveal && fb.reveal[id]) || '';
        y.classList.remove('hidden');
        c.querySelector('.arrows').remove();
      });
      if (!fb.correct) {
        const corr = el('ol', { style: 'margin:12px 0 0' }, fb.solution.map((id) => el('li', {}, `${fb.reveal[id] || ''} · ${item.entries.find((e) => e.id === id).label}`)));
        node.append(el('div', { style: 'margin-top:10px' }, el('b', {}, 'Ordine corretto:'), corr));
      }
    }
  };
}

// ---------- Smistamento in categorie ----------
function bins(stage, item) {
  const d = deferred();
  const placed = {}; // entryId -> catId
  let locked = false;
  const deck = el('div', { class: 'deck' });
  const binEls = new Map();
  const counter = el('span', { class: 'muted' });
  const binsBox = el('div', { class: 'bins' });
  item.categories.forEach((c, i) => {
    const list = el('div', {});
    const b = el('div', { class: 'bin' }, el('button', { class: 'btn secondary', onclick: () => drop(c.id) }, `${i + 1} · ${c.label}`), list);
    binEls.set(c.id, list);
    binsBox.append(b);
  });
  const submit = el('button', { class: 'btn primary', disabled: true, onclick: () => { locked = true; submit.disabled = true; d.resolve({ ...placed }); } }, '✔ Conferma lo smistamento');
  const current = () => item.entries.find((e) => !placed[e.id]);
  function render() {
    deck.innerHTML = '';
    const cur = current();
    if (cur) deck.append(el('div', { class: 'card' }, cur.label));
    else deck.append(el('div', { class: 'muted' }, 'Tutte le carte sono state smistate. Controlla e conferma!'));
    for (const [cid, list] of binEls) {
      list.innerHTML = '';
      for (const e of item.entries.filter((x) => placed[x.id] === cid)) {
        list.append(el('button', { class: 'chip-card', 'data-id': e.id, onclick: () => { if (!locked) { delete placed[e.id]; sfx.blip(); render(); } } }, e.label));
      }
    }
    const n = Object.keys(placed).length;
    counter.textContent = `${n}/${item.entries.length} smistate`;
    submit.disabled = locked || n !== item.entries.length;
  }
  function drop(catId) {
    if (locked) return;
    const cur = current();
    if (!cur) return;
    placed[cur.id] = catId;
    sfx.select(); render();
  }
  const off = keyHandler(Object.fromEntries(item.categories.map((c, i) => [String(i + 1), () => drop(c.id)])));
  render();
  const node = el('div', {}, deck, binsBox, el('div', { class: 'row', style: 'margin-top:14px' }, counter, el('div', { class: 'spacer' }), submit));
  return {
    node, submitted: d.promise.then((r) => { off(); return r; }),
    reveal(fb) {
      for (const list of binEls.values()) {
        for (const chip of list.children) {
          const id = chip.dataset.id;
          const ok = fb.solution[id] === placed[id];
          chip.classList.add(ok ? 'ok' : 'ko');
          chip.disabled = true;
          if (!ok) {
            const cat = item.categories.find((c) => c.id === fb.solution[id]);
            chip.append(el('span', { class: 'should' }, `→ ${cat ? cat.label : '?'}`));
          }
        }
      }
    },
    destroy: off
  };
}

// ---------- Tabella a griglia (proprietà degli ambienti) ----------
function grid(stage, item) {
  const d = deferred();
  const resp = {};
  let locked = false;
  const cells = new Map();
  const thead = el('tr', {}, el('th', {}, ''), item.cols.map((c) => el('th', {}, c.label)));
  const rows = item.rows.map((r) => el('tr', {}, el('td', { class: 'rowh' }, r.label), item.cols.map((c, ci) => {
    if (!r.ask[ci]) return el('td', {}, el('div', { class: 'na', title: 'Non richiesto' }, '—'));
    const key = `${r.id}:${ci}`;
    const b = el('button', { class: 'btn', onclick: () => cycle(key, c) }, '?');
    const td = el('td', {}, b);
    cells.set(key, { b, td, col: c });
    return td;
  })));
  const total = cells.size;
  const counter = el('span', { class: 'muted' });
  const submit = el('button', { class: 'btn primary', disabled: true, onclick: () => { locked = true; submit.disabled = true; d.resolve({ ...resp }); } }, '✔ Pubblica il bollettino');
  function cycle(key, col) {
    if (locked) return;
    const cur = resp[key];
    resp[key] = cur === undefined ? 0 : (cur + 1) % col.options.length;
    const c = cells.get(key);
    c.b.textContent = col.options[resp[key]];
    c.b.classList.add('selected');
    sfx.blip();
    update();
  }
  function update() {
    const n = Object.keys(resp).length;
    counter.textContent = `${n}/${total} caselle compilate`;
    submit.disabled = locked || n !== total;
  }
  update();
  const node = el('div', {},
    el('div', { class: 'grid-wrap' }, el('table', { class: 'grid' }, el('thead', {}, thead), el('tbody', {}, rows))),
    el('div', { class: 'row', style: 'margin-top:14px' }, counter, el('div', { class: 'spacer' }), submit));
  return {
    node, submitted: d.promise,
    reveal(fb) {
      for (const [key, c] of cells) {
        const ok = Number(resp[key]) === fb.solution[key];
        c.td.classList.add(ok ? 'cell-ok' : 'cell-ko');
        c.b.disabled = true;
        c.b.classList.remove('selected');
        if (!ok) c.b.append(el('span', { class: 'should' }, `→ ${c.col.options[fb.solution[key]]}`));
      }
    }
  };
}

// ---------- Mondo dell'aspirapolvere: tabella + simulazione ----------
function vacuum(stage, item) {
  const d = deferred();
  const col = item.cols[0];
  const resp = {};
  let locked = false;
  const rowsEls = item.rows.map((r) => {
    const key = `${r.id}:0`;
    const btns = col.options.map((o, oi) => el('button', { class: 'btn', onclick: () => { if (locked) return; resp[key] = oi; btns.forEach((b, bi) => b.classList.toggle('selected', bi === oi)); sfx.blip(); update(); } }, o));
    return { r, key, btns, node: el('div', { class: 'vacuum-row' }, el('div', { class: 'percept' }, r.label), el('div', { class: 'acts' }, btns)) };
  });
  const submit = el('button', { class: 'btn primary', disabled: true, onclick: () => { locked = true; submit.disabled = true; d.resolve({ ...resp }); } }, '▶ Carica il programma e avvia');
  function update() { submit.disabled = locked || Object.keys(resp).length !== rowsEls.length; }
  const sim = el('div', { class: 'vacuum-sim hidden' });
  const node = el('div', {}, rowsEls.map((x) => x.node), el('div', { class: 'row', style: 'margin-top:8px' }, el('div', { class: 'spacer' }), submit), sim);

  function tableFrom(map) {
    const t = {};
    for (const x of rowsEls) t[x.r.label] = col.options[map[x.key]];
    return t;
  }
  function quickScore(table) {
    const w = { A: true, B: true };
    let pos = 'A', score = 0;
    for (let i = 0; i < 10; i++) {
      const a = table[`[${pos}, ${w[pos] ? 'Sporco' : 'Pulito'}]`];
      if (a === 'Aspira') w[pos] = false; else if (a === 'Destra') pos = 'B'; else if (a === 'Sinistra') pos = 'A';
      score += (w.A ? 0 : 1) + (w.B ? 0 : 1);
    }
    return score;
  }
  function simulate(table, canvas, label) {
    const g = canvas.getContext('2d');
    const world = { A: true, B: true }; // true = sporco
    let pos = 'A', score = 0, step = 0;
    const draw = (action) => {
      g.fillStyle = '#b5dce8'; g.fillRect(0, 0, 96, 56);
      g.fillStyle = '#2b2f45'; g.fillRect(47, 0, 2, 56);
      g.font = '6px "Press Start 2P", monospace'; g.fillStyle = '#2b2f45';
      g.fillText('A', 4, 10); g.fillText('B', 52, 10);
      for (const [room, ox] of [['A', 0], ['B', 48]]) {
        if (world[room]) { g.fillStyle = '#8d6e63'; for (let k = 0; k < 6; k++) g.fillRect(ox + 12 + (k * 7) % 22, 34 + (k * 5) % 12, 4, 3); }
      }
      const rx = pos === 'A' ? 14 : 62;
      g.fillStyle = '#9b2335'; g.fillRect(rx, 18, 16, 10); g.fillStyle = '#1d1f2b'; g.fillRect(rx + 2, 28, 4, 4); g.fillRect(rx + 10, 28, 4, 4);
      g.fillStyle = '#f2c14e'; g.fillRect(rx + 6, 20, 4, 3);
      label.textContent = `Passo ${step}/10 · azione: ${action || '—'} · prestazione: ${score} punti`;
    };
    draw();
    return new Promise((resolve) => {
      const timer = setInterval(() => {
        const percept = `[${pos}, ${world[pos] ? 'Sporco' : 'Pulito'}]`;
        const action = table[percept];
        if (action === 'Aspira') world[pos] = false;
        else if (action === 'Destra') pos = 'B';
        else if (action === 'Sinistra') pos = 'A';
        step++;
        score += (world.A ? 0 : 1) + (world.B ? 0 : 1);
        draw(action);
        if (step >= 10) { clearInterval(timer); resolve(score); }
      }, 450);
    });
  }
  return {
    node, submitted: d.promise,
    reveal(fb) {
      for (const x of rowsEls) {
        const ok = resp[x.key] === fb.solution[x.key];
        x.btns.forEach((b, bi) => {
          b.disabled = true;
          b.classList.remove('selected');
          if (bi === fb.solution[x.key]) b.classList.add('good');
          else if (bi === resp[x.key] && !ok) b.classList.add('bad');
        });
      }
      sim.classList.remove('hidden');
      const c1 = el('canvas', { width: 96, height: 56, style: 'width:288px;height:168px' });
      const l1 = el('div', {});
      sim.append(c1, el('div', {}, el('b', {}, 'Il tuo robot all\'opera'), el('div', { class: 'muted' }, 'Misura di prestazione: +1 punto per ogni stanza pulita a ogni passo.'), l1));
      simulate(tableFrom(resp), c1, l1).then((score) => {
        const best = quickScore(tableFrom(fb.solution));
        l1.textContent += score >= best ? ' · Ottimo: è il massimo possibile!' : ` · Con la tabella corretta avresti ottenuto ${best} punti.`;
      });
    }
  };
}

const PRESENTATIONS = { battle, duel, rush, connect, timeline, bins, grid, vacuum };

export function mountItem(stage, item, ctx) {
  let pres = stage.presentation;
  if (!PRESENTATIONS[pres]) {
    pres = { mcq: 'battle', tf: 'rush', match: 'connect', order: 'timeline', categorize: 'bins', matrix: 'grid' }[item.kind];
  }
  return PRESENTATIONS[pres](stage, item, ctx);
}

export { drawChar, LOOKS };
