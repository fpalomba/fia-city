// Osservatori: approfondimenti immersivi e non valutati sugli argomenti più ostici del corso.
// Ogni osservatorio è un modulo in js/obs/ che riceve un palco (canvas 2D o 3D) e un pannello guida
// con i passi da seguire, e mostra in movimento quello che succede (pesi che cambiano, centroidi che
// si spostano, entropia che scende...). Alla fine c'è una domanda «Prova tu» con spiegazione.
import { screen, el } from './ui.js';
import { sfx } from './audio.js';

// Elenco degli osservatori: nome, lezione di riferimento e modulo che lo disegna.
export const OBSERVATORIES = [
  { id: 'percettrone', module: 'percettrone', levelId: 'L4', name: 'Osservatorio del Percettrone', glyph: 'P', color: '#7048e8',
    lesson: 'Lezione 10 · Deep Learning', district: 'Distretto Deep', topic: 'Il percettrone impara una frontiera: AND sì, XOR no, finché non aggiungiamo uno strato.' },
  { id: 'pesi', module: 'pesi', levelId: 'L4', name: 'Osservatorio dei Pesi', glyph: 'W', color: '#d6336c',
    lesson: 'Lezione 10 · Deep Learning', district: 'Distretto Deep', topic: 'Training di una rete neurale: forward pass, loss, backpropagation e discesa del gradiente.' },
  { id: 'attenzione', module: 'attenzione', levelId: 'L4', name: "Osservatorio dell'Attenzione", glyph: 'A', color: '#1098ad',
    lesson: 'Lezione 11 · Large Language Model', district: 'Distretto Deep', topic: 'Self-attention, maschera causale e scelta del prossimo token con la temperatura.' },
  { id: 'entropia', module: 'entropia', levelId: 'L3', name: "Osservatorio dell'Entropia", glyph: 'H', color: '#2f9e44',
    lesson: 'Lezione 6 · Classificazione', district: 'Rione Shallow', topic: 'Albero decisionale: entropia, information gain e scelta della radice.' },
  { id: 'cluster', module: 'cluster', levelId: 'L3', name: 'Osservatorio dei Cluster', glyph: 'K', color: '#e8590c',
    lesson: 'Lezione 8 · Clustering', district: 'Rione Shallow', topic: 'K-means passo per passo, la scelta di k con il gomito e i limiti dell\'algoritmo.' },
  { id: 'compromesso', module: 'compromesso', levelId: 'L2', name: 'Osservatorio del Compromesso', glyph: 'B', color: '#1971c2',
    lesson: 'Lezione 3 · Teoria dell\'apprendimento', district: "Borgo dell'Apprendimento", topic: 'Bias e varianza, underfitting e overfitting: errore sul training e sui dati nuovi.' }
];

// ---------------- Strumenti per i moduli ----------------

// Canvas 2D che riempie il contenitore e si ridisegna quando cambia dimensione (con densità di pixel corretta).
export function canvas2d(container, draw) {
  const canvas = el('canvas', { class: 'obs-canvas' });
  container.append(canvas);
  const ctx = canvas.getContext('2d');
  const state = { w: 0, h: 0 };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = Math.max(10, r.width); state.h = Math.max(10, r.height);
    canvas.width = Math.round(state.w * dpr); canvas.height = Math.round(state.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (draw) draw(ctx, state.w, state.h);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  requestAnimationFrame(resize);
  return {
    canvas, ctx,
    get w() { return state.w; }, get h() { return state.h; },
    redraw() { if (draw && state.w) draw(ctx, state.w, state.h); },
    dispose() { ro.disconnect(); }
  };
}

// Guida a passi: titolo, testo e pulsanti Indietro/Avanti. Ogni passo può avere enter() per animare il palco.
export function guide(side, steps, { onFinish } = {}) {
  let i = -1;
  const count = el('div', { class: 'obs-count' });
  const title = el('h3', { class: 'obs-title' });
  const body = el('div', { class: 'obs-text' });
  const extra = el('div', { class: 'obs-extra' });
  const prev = el('button', { class: 'btn small', onclick: () => go(i - 1) }, '◀ Indietro');
  const next = el('button', { class: 'btn small primary', onclick: () => go(i + 1) }, 'Avanti ▶');
  const dots = el('div', { class: 'obs-dots' });
  side.append(el('div', { class: 'obs-guide' }, el('div', { class: 'row' }, count, el('div', { class: 'spacer' }), dots), title, body, extra,
    el('div', { class: 'row obs-nav' }, prev, el('div', { class: 'spacer' }), next)));
  function go(k) {
    if (k < 0 || k >= steps.length) { if (k >= steps.length && onFinish) onFinish(); return; }
    if (i >= 0 && steps[i].leave) steps[i].leave();
    i = k;
    const s = steps[i];
    count.textContent = `Passo ${i + 1} di ${steps.length}`;
    dots.innerHTML = '';
    steps.forEach((_, j) => dots.append(el('span', { class: 'dot' + (j < i ? ' done' : j === i ? ' on' : '') })));
    title.textContent = s.title;
    body.innerHTML = '';
    body.append(...[].concat(typeof s.text === 'function' ? s.text() : s.text).map((t) => (t instanceof Node ? t : el('p', { html: t }))));
    extra.innerHTML = '';
    if (s.enter) { const r = s.enter(extra); if (r instanceof Node) extra.append(r); }
    prev.disabled = i === 0;
    next.textContent = i === steps.length - 1 ? (onFinish ? 'Prova tu ▶' : 'Fine') : 'Avanti ▶';
    next.disabled = i === steps.length - 1 && !onFinish;
    sfx.blip();
  }
  go(0);
  return { go, get index() { return i; } };
}

// Domanda finale non valutata, con spiegazione per ogni risposta.
export function tryIt(container, { question, options, answer, explain }) {
  container.innerHTML = '';
  const fb = el('div', { class: 'obs-fb hidden' });
  const btns = options.map((o, k) => el('button', { class: 'btn small', onclick: () => {
    btns.forEach((b, j) => { b.disabled = true; if (j === answer) b.classList.add('good'); else if (j === k) b.classList.add('bad'); });
    fb.className = 'obs-fb ' + (k === answer ? 'ok' : 'ko');
    fb.innerHTML = (k === answer ? '<b>✔ Esatto!</b> ' : '<b>✘ Non proprio.</b> ') + explain;
    if (k === answer) sfx.correct(); else sfx.wrong();
  } }, o));
  container.append(el('div', { class: 'obs-try' }, el('h3', {}, '🔭 Prova tu'), el('p', {}, question), el('div', { class: 'obs-opts' }, btns), fb,
    el('p', { class: 'muted', style: 'font-size:14px;margin-top:10px' }, 'Questa domanda non conta per il voto: serve a fissare quello che hai visto.')));
}

// Cursore con etichetta e valore.
export function slider(label, { min, max, step = 1, value, format = (v) => v }, onInput) {
  const out = el('b', {}, format(value));
  const input = el('input', { type: 'range', min, max, step, value, oninput: (e) => { const v = +e.target.value; out.textContent = format(v); onInput(v); } });
  return el('label', { class: 'obs-slider' }, el('span', {}, label), input, out);
}

// Pulsante play/pausa che chiama tick() a intervalli; restituisce { node, stop(), playing }.
export function player(tick, ms = 600, label = 'Avvia') {
  let timer = 0;
  const btn = el('button', { class: 'btn small secondary', onclick: () => (timer ? stop() : start()) }, `▶ ${label}`);
  const start = () => { timer = setInterval(() => { if (tick() === false) stop(); }, ms); btn.textContent = '⏸ Pausa'; };
  const stop = () => { clearInterval(timer); timer = 0; btn.textContent = `▶ ${label}`; };
  return { node: btn, start, stop, get playing() { return !!timer; } };
}

// Numero all'italiana (virgola decimale).
export const num = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : String(v));

// ---------------- Apertura di un osservatorio ----------------

export async function openObservatory(meta, { onClose } = {}) {
  const stage = el('div', { class: 'obs-stage' });
  const side = el('div', { class: 'obs-side' });
  let mod = null, handle = null;
  const close = () => {
    try { if (handle && handle.dispose) handle.dispose(); } catch (e) { console.error(e); }
    document.querySelector('#screen').classList.remove('obs-mode');
    screen.close();
    if (onClose) onClose();
  };
  document.querySelector('#screen').classList.add('obs-mode');
  screen.open(el('div', { class: 'panel obs' },
    el('div', { class: 'row obs-head' },
      el('span', { class: 'glyph', style: `background:${meta.color}` }, meta.glyph),
      el('div', {}, el('h2', { style: 'margin:0' }, meta.name), el('div', { class: 'muted', style: 'font-size:14px' }, `${meta.lesson} · approfondimento, non valutato`)),
      el('div', { class: 'spacer' }),
      el('button', { class: 'btn small', onclick: close }, '✕ Esci')),
    el('div', { class: 'obs-grid' }, stage, side)));
  try {
    mod = await import(`./obs/${meta.module}.js`);
    handle = mod.mount({ stage, side, meta, close, guide, tryIt, slider, player, canvas2d, num, el });
  } catch (e) {
    console.error(e);
    side.append(el('p', {}, 'Non è stato possibile aprire questo osservatorio.'));
  }
  return close;
}
