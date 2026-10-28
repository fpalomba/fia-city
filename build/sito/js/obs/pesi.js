// Osservatorio dei Pesi: una piccola rete 2-3-1 impara XOR davanti agli occhi dello studente.
// Si vedono il forward pass (impulsi verso l'output), la loss, la backpropagation (impulsi all'indietro,
// linee che si illuminano in base al gradiente) e la discesa del gradiente (le linee cambiano spessore).
// L'ultimo esperimento mostra la "valle" della loss con una palla, per capire il ruolo del learning rate.

const FONT = '"Pixelify Sans", sans-serif';
const X = [[0, 0], [0, 1], [1, 0], [1, 1]];
const Y = [0, 1, 1, 0];
const sig = (z) => 1 / (1 + Math.exp(-z));

// Parametri in un array piatto: W1[j][k] → j*2+k (0..5), b1[j] → 6+j, W2[j] → 9+j, b2 → 12.
function initParams(seed) {
  let s = seed >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return Array.from({ length: 13 }, () => r() * 2 - 1);
}
function forward(p, x) {
  const z1 = [0, 1, 2].map((j) => p[j * 2] * x[0] + p[j * 2 + 1] * x[1] + p[6 + j]);
  const h = z1.map(sig);
  const z2 = h[0] * p[9] + h[1] * p[10] + h[2] * p[11] + p[12];
  return { x, z1, h, z2, o: sig(z2) };
}
function gradient(p, f, y) {
  const g = new Array(13).fill(0);
  const d = -2 * (y - f.o) * f.o * (1 - f.o);
  for (let j = 0; j < 3; j++) {
    const dh = d * p[9 + j] * f.h[j] * (1 - f.h[j]);
    g[9 + j] = d * f.h[j];
    g[j * 2] = dh * f.x[0]; g[j * 2 + 1] = dh * f.x[1]; g[6 + j] = dh;
  }
  g[12] = d;
  return g;
}
const lossOf = (p, i) => (Y[i] - forward(p, X[i]).o) ** 2;
const avgLoss = (p) => (lossOf(p, 0) + lossOf(p, 1) + lossOf(p, 2) + lossOf(p, 3)) / 4;

// Nodi e archi della rete (posizioni relative all'area della rete).
const NODES = {
  x1: { col: 0, row: 0, label: 'x₁' }, x2: { col: 0, row: 1, label: 'x₂' }, bi: { col: 0, row: 2, label: '1', bias: true },
  h1: { col: 1, row: 0, label: 'h₁' }, h2: { col: 1, row: 1, label: 'h₂' }, h3: { col: 1, row: 2, label: 'h₃' }, bh: { col: 1, row: 3, label: '1', bias: true },
  o: { col: 2, row: 1, label: 'ŷ' }
};
const EDGES = [];
['h1', 'h2', 'h3'].forEach((h, j) => {
  EDGES.push({ a: 'x1', b: h, k: j * 2, name: `w(x₁→${NODES[h].label})`, layer: 1 });
  EDGES.push({ a: 'x2', b: h, k: j * 2 + 1, name: `w(x₂→${NODES[h].label})`, layer: 1 });
  EDGES.push({ a: 'bi', b: h, k: 6 + j, name: `bias di ${NODES[h].label}`, layer: 1 });
  EDGES.push({ a: h, b: 'o', k: 9 + j, name: `w(${NODES[h].label}→ŷ)`, layer: 2 });
});
EDGES.push({ a: 'bh', b: 'o', k: 12, name: 'bias di ŷ', layer: 2 });

export function mount(ctx) {
  const { stage, side, el, num } = ctx;
  let p = initParams(3);
  let shown = p.slice();            // pesi disegnati (interpolati durante un aggiornamento)
  let tween = null;                 // { from, to, t0, dur }
  let cur = null;                   // esempio attivo: { i, f, g }
  let pulses = [];                  // { edges:[k], t0, dur, back }
  let glow = null;                  // gradienti da mostrare sugli archi
  let showValues = false, mode = 'net';
  let history = [avgLoss(p)], epoch = 0;
  let eta = 1;
  const valley = { eta: 1.5, w: -3.2, trail: [], steps: 0 };
  let raf = 0, alive = true;

  const legend = el('div', { class: 'obs-legend' });
  const hud = el('div', { class: 'obs-hud' });
  const cv = ctx.canvas2d(stage, () => {});
  stage.append(legend, hud);
  const tryBox = el('div');
  side.append(tryBox);

  const now = () => performance.now() / 1000;
  const setLegend = (html) => { legend.innerHTML = html; legend.style.display = html && stage.clientWidth > 560 ? '' : 'none'; };
  const setHud = (html) => { hud.innerHTML = html; hud.style.display = html ? '' : 'none'; };

  // ---------- layout ----------
  function layout(w, h) {
    const wide = w > 700;
    const net = wide ? { x: 10, y: 50, w: w * 0.6 - 10, h: h - 70 } : { x: 6, y: 62, w: w - 12, h: h * 0.6 - 76 };
    const chart = wide ? { x: w * 0.62, y: 112, w: w * 0.36, h: h * 0.3 } : { x: 10, y: h * 0.62 + 6, w: w * 0.56 - 14, h: h * 0.38 - 16 };
    const sq = wide ? Math.min(w * 0.3, h * 0.42) : Math.min(w * 0.37, h * 0.38 - 30);
    const map = wide ? { x: w * 0.62 + (w * 0.36 - sq) / 2, y: h * 0.5 + 20, s: sq } : { x: w * 0.6 - 4, y: h * 0.62 + 18, s: sq };
    const pos = {};
    const rows = [3, 4, 1];
    for (const [id, n] of Object.entries(NODES)) {
      const cx = net.x + net.w * (0.13 + n.col * 0.37);
      const count = rows[n.col];
      const cy = n.col === 2 ? net.y + net.h * 0.45 : net.y + net.h * ((n.row + 0.6) / (count + 0.2));
      pos[id] = { x: cx, y: cy };
    }
    return { wide, net, chart, map, pos, r: Math.max(14, Math.min(26, net.h / 14)) };
  }

  // ---------- disegno ----------
  function draw() {
    const g = cv.ctx, w = cv.w, h = cv.h;
    if (!w) return;
    const t = now();
    if (tween) {
      const k = Math.min(1, (t - tween.t0) / tween.dur);
      const e = k * k * (3 - 2 * k);
      shown = tween.from.map((v, i) => v + (tween.to[i] - v) * e);
      if (k >= 1) tween = null;
    }
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#10121c'; g.fillRect(0, 0, w, h);
    if (mode === 'valley') return drawValley(g, w, h);
    const L = layout(w, h);
    drawNet(g, L, t);
    drawChart(g, L.chart);
    drawMap(g, L.map);
  }

  function drawNet(g, L, t) {
    const { pos, r } = L;
    const gmax = glow ? Math.max(1e-9, ...glow.map(Math.abs)) : 1;
    for (const e of EDGES) {
      const a = pos[e.a], b = pos[e.b], wv = shown[e.k];
      if (glow) {
        const q = Math.abs(glow[e.k]) / gmax;
        g.strokeStyle = `rgba(255,170,40,${0.25 + 0.6 * q})`;
        g.lineWidth = 4 + 16 * q;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
      g.strokeStyle = wv >= 0 ? '#4dabf7' : '#ff6b6b';
      g.globalAlpha = NODES[e.a].bias ? 0.75 : 1;
      g.lineWidth = 1 + Math.min(Math.abs(wv), 7) * 1.4;
      g.setLineDash(NODES[e.a].bias ? [6, 5] : []);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.setLineDash([]); g.globalAlpha = 1;
    }
    // impulsi
    pulses = pulses.filter((pu) => t < pu.t0 + pu.dur + 0.05);
    for (const pu of pulses) {
      const k = (t - pu.t0) / pu.dur;
      if (k < 0 || k > 1) continue;
      for (const idx of pu.edges) {
        const e = EDGES[idx];
        const a = pu.back ? pos[e.b] : pos[e.a], b = pu.back ? pos[e.a] : pos[e.b];
        const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
        g.fillStyle = pu.back ? '#ffa94d' : '#ffe066';
        g.shadowColor = g.fillStyle; g.shadowBlur = 14;
        g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
      }
    }
    // valori sugli archi
    if (showValues || glow) {
      g.font = `bold ${L.wide ? 13 : 11}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const e of EDGES) {
        const a = pos[e.a], b = pos[e.b];
        const f = e.layer === 1 ? 0.3 : 0.55;
        const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
        const txt = glow ? num(glow[e.k], 3) : num(shown[e.k], 2);
        const tw = g.measureText(txt).width + 8;
        g.fillStyle = glow ? 'rgba(60,30,0,.9)' : 'rgba(16,18,28,.85)';
        g.fillRect(x - tw / 2, y - 9, tw, 18);
        g.fillStyle = glow ? '#ffd8a8' : '#f8f9fa';
        g.fillText(txt, x, y);
      }
    }
    // nodi
    const act = cur ? { x1: cur.f.x[0], x2: cur.f.x[1], h1: cur.f.h[0], h2: cur.f.h[1], h3: cur.f.h[2], o: cur.f.o, bi: 1, bh: 1 } : null;
    for (const [id, n] of Object.entries(NODES)) {
      const P = pos[id], rr = n.bias ? r * 0.65 : r;
      const a = act ? act[id] : null;
      g.fillStyle = n.bias ? '#495057' : a == null ? '#343a40' : `rgb(${Math.round(60 + 195 * a)},${Math.round(60 + 164 * a)},${Math.round(70 + 32 * a)})`;
      g.strokeStyle = '#f8f9fa'; g.lineWidth = 3;
      g.beginPath(); g.arc(P.x, P.y, rr, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = a != null && a > 0.55 && !n.bias ? '#10121c' : '#f8f9fa';
      g.font = `bold ${Math.round(rr * 0.75)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(a != null && !n.bias ? num(a, 2) : n.label, P.x, P.y);
      if (a != null && !n.bias) { g.fillStyle = '#adb5bd'; g.font = `13px ${FONT}`; g.fillText(n.label, P.x, P.y - rr - 10); }
    }
    if (L.wide) g.fillStyle = '#868e96', g.font = `13px ${FONT}`, g.textAlign = 'center';
    if (L.wide) ['input', 'hidden layer', 'output'].forEach((s, c) => g.fillText(s, L.net.x + L.net.w * (0.13 + c * 0.37), L.net.y + L.net.h + 8));
  }

  function drawChart(g, c) {
    g.strokeStyle = '#495057'; g.lineWidth = 2; g.strokeRect(c.x, c.y, c.w, c.h);
    g.fillStyle = '#ced4da'; g.font = `14px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'bottom';
    g.fillText(`loss media · epoca ${epoch}`, c.x, c.y - 4);
    const maxL = Math.max(0.3, ...history);
    const n = Math.max(2, history.length);
    g.strokeStyle = '#ffd43b'; g.lineWidth = 3; g.beginPath();
    history.forEach((v, i) => { const x = c.x + 4 + (c.w - 8) * (i / (n - 1)), y = c.y + c.h - 4 - (c.h - 8) * (v / maxL); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    g.fillStyle = '#ffd43b'; g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText(num(history[history.length - 1], 3), c.x + c.w - 4, c.y + 4);
  }

  function drawMap(g, m) {
    const N = 26, cell = m.s / N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x1 = -0.25 + 1.5 * (i + 0.5) / N, x2 = 1.25 - 1.5 * (j + 0.5) / N;
      const o = forward(shown, [x1, x2]).o;
      g.fillStyle = `rgb(${Math.round(40 + 200 * o)},${Math.round(60 + 120 * o)},${Math.round(140 - 90 * o)})`;
      g.fillRect(m.x + i * cell, m.y + j * cell, cell + 0.6, cell + 0.6);
    }
    g.strokeStyle = '#f8f9fa'; g.lineWidth = 2; g.strokeRect(m.x, m.y, m.s, m.s);
    X.forEach((x, i) => {
      const px = m.x + m.s * (x[0] + 0.25) / 1.5, py = m.y + m.s * (1.25 - x[1]) / 1.5;
      g.fillStyle = Y[i] ? '#ffe066' : '#1c7ed6'; g.strokeStyle = cur && cur.i === i ? '#fff' : '#10121c'; g.lineWidth = cur && cur.i === i ? 4 : 3;
      g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill(); g.stroke();
    });
    g.fillStyle = '#ced4da'; g.font = `14px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'bottom';
    g.fillText(m.s < 200 ? 'risposta della rete' : 'risposta della rete su (x₁, x₂)', m.x, m.y - 4);
  }

  // Valle della loss in funzione di un solo peso: L(w) = (w − 2)² / 4 + 0,3 (esempio illustrativo).
  const VL = (w) => (w - 2) ** 2 / 4 + 0.3;
  const VG = (w) => (w - 2) / 2;
  function drawValley(g, w, h) {
    const x0 = 40, x1 = w - 20, y0 = 70, y1 = h - 40;
    const wx = (v) => x0 + (x1 - x0) * (v + 5) / 14, ly = (v) => y1 - (y1 - y0) * Math.min(v, 12.5) / 12.5;
    g.fillStyle = '#1b2a1f'; g.beginPath(); g.moveTo(x0, y1);
    for (let v = -5; v <= 9.001; v += 0.05) g.lineTo(wx(v), ly(VL(v)));
    g.lineTo(x1, y1); g.closePath(); g.fill();
    g.strokeStyle = '#69db7c'; g.lineWidth = 4; g.beginPath();
    for (let v = -5; v <= 9.001; v += 0.05) v === -5 ? g.moveTo(wx(v), ly(VL(v))) : g.lineTo(wx(v), ly(VL(v)));
    g.stroke();
    g.strokeStyle = '#495057'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y1); g.lineTo(x1, y1); g.stroke();
    g.fillStyle = '#ced4da'; g.font = `15px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText('peso w →', x1, y1 + 8);
    g.textAlign = 'center'; g.fillText('minimo', wx(2), ly(VL(2)) + 10);
    // scia dei passi
    g.strokeStyle = 'rgba(255,212,59,.7)'; g.lineWidth = 2; g.setLineDash([5, 4]); g.beginPath();
    valley.trail.forEach((v, i) => { const x = wx(v), y = ly(VL(v)); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke(); g.setLineDash([]);
    valley.trail.forEach((v) => { g.fillStyle = 'rgba(255,212,59,.6)'; g.beginPath(); g.arc(wx(v), ly(VL(v)), 4, 0, Math.PI * 2); g.fill(); });
    // palla e freccia del gradiente
    const bw = valley.w, bx = wx(bw), by = ly(VL(bw));
    if (Math.abs(bw) < 60) {
      const gr = VG(bw), dir = -Math.sign(gr), len = Math.min(120, 30 + Math.abs(gr) * 30);
      g.strokeStyle = '#ffa94d'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, by - 22); g.lineTo(bx + dir * len, by - 22); g.stroke();
      g.fillStyle = '#ffa94d'; g.beginPath(); g.moveTo(bx + dir * (len + 10), by - 22); g.lineTo(bx + dir * len, by - 29); g.lineTo(bx + dir * len, by - 15); g.fill();
      g.fillStyle = '#ff6b6b'; g.strokeStyle = '#fff'; g.lineWidth = 3;
      g.beginPath(); g.arc(bx, by - 10, 10, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }

  function loop() { if (!alive) return; draw(); raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);

  // ---------- azioni ----------
  const t0 = () => now();
  function runForward(i) {
    cur = { i, f: forward(p, X[i]), g: null };
    glow = null;
    const s = t0();
    pulses.push({ edges: EDGES.map((e, k) => (e.layer === 1 ? k : -1)).filter((k) => k >= 0), t0: s, dur: 0.8 });
    pulses.push({ edges: EDGES.map((e, k) => (e.layer === 2 ? k : -1)).filter((k) => k >= 0), t0: s + 0.8, dur: 0.8 });
    showHud();
  }
  function runBackward() {
    if (!cur) runForward(1);
    cur.f = forward(p, X[cur.i]);
    cur.g = gradient(p, cur.f, Y[cur.i]);
    const s = t0();
    pulses.push({ edges: EDGES.map((e, k) => (e.layer === 2 ? k : -1)).filter((k) => k >= 0), t0: s, dur: 0.8, back: true });
    pulses.push({ edges: EDGES.map((e, k) => (e.layer === 1 ? k : -1)).filter((k) => k >= 0), t0: s + 0.8, dur: 0.8, back: true });
    setTimeout(() => { if (alive && cur && cur.g) glow = cur.g; }, 300);
  }
  function applyUpdate() {
    if (!cur) runForward(1);
    const f = forward(p, X[cur.i]);
    const g = gradient(p, f, Y[cur.i]);
    const before = (Y[cur.i] - f.o) ** 2;
    const next = p.map((v, k) => v - eta * g[k]);
    tween = { from: p.slice(), to: next, t0: t0(), dur: 0.9 };
    p = next;
    glow = null;
    cur = { i: cur.i, f: forward(p, X[cur.i]), g: null };
    showHud();
    return { before, after: (Y[cur.i] - cur.f.o) ** 2, g };
  }
  function trainEpochs(n) {
    for (let e = 0; e < n; e++) {
      for (let i = 0; i < 4; i++) {
        const f = forward(p, X[i]), g = gradient(p, f, Y[i]);
        for (let k = 0; k < 13; k++) p[k] -= eta * g[k];
      }
      epoch++;
      history.push(avgLoss(p));
    }
    if (history.length > 400) history = history.filter((_, i) => i % 2 === 0 || i === history.length - 1);
    shown = p.slice(); tween = null;
    if (cur) cur.f = forward(p, X[cur.i]);
    showHud();
  }
  function resetNet(seed = 3) {
    p = initParams(seed); shown = p.slice(); tween = null; cur = null; glow = null; pulses = [];
    history = [avgLoss(p)]; epoch = 0;
  }
  function showHud() {
    if (mode !== 'net') return;
    if (!cur) { setHud(`Epoca <b>${epoch}</b><br>loss media <b>${num(history[history.length - 1], 3)}</b>`); return; }
    const y = Y[cur.i], o = cur.f.o;
    setHud(`Esempio (${X[cur.i].join(', ')}) → y = <b>${y}</b><br>ŷ = <b>${num(o, 2)}</b> · L = <b>${num((y - o) ** 2, 3)}</b><br>Epoca <b>${epoch}</b>`);
  }
  const NET_LEGEND = '<span style="color:#1971c2">━</span> peso positivo · <span style="color:#e03131">━</span> negativo<br>spessore = forza del peso · <span style="color:#868e96">┅</span> bias';

  const exampleButtons = (onPick) => el('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px' },
    X.map((x, i) => el('button', { class: 'btn small', onclick: () => onPick(i) }, `(${x[0]}, ${x[1]}) → ${Y[i]}`)));

  const steps = [
    {
      title: 'Una rete che deve imparare XOR',
      text: [
        'Questa è una piccola rete multi-strato (MLP, slide 27-30): due input, uno strato nascosto con tre neuroni e un output.',
        'Ogni linea è un <b>peso</b>, cioè la forza con cui un neurone influenza il successivo (slide 16). Blu vuol dire positivo, rosso negativo, e più la linea è spessa più il peso conta. Le linee tratteggiate sono i bias, il neurone “1” delle slide.',
        'I pesi partono a caso, quindi la rete per ora non sa nulla. Il compito è lo XOR, che un percettrone da solo non riesce a imparare (slide 26). A destra vedi la loss e cosa risponde la rete in ogni punto del piano.',
        'Una differenza rispetto alle slide: qui ogni neurone usa la <b>sigmoide</b> σ(z) = 1/(1+e<sup>−z</sup>) invece del gradino. Dà valori tra 0 e 1 e si può derivare, cosa che servirà alla backpropagation.'
      ],
      enter(extra) {
        mode = 'net'; resetNet(); setLegend(NET_LEGEND); showHud(); showValues = false;
        extra.append(el('button', { class: 'btn small', onclick: (e) => { showValues = !showValues; e.target.textContent = showValues ? 'Nascondi i valori dei pesi' : 'Mostra i valori dei pesi'; } }, 'Mostra i valori dei pesi'));
      }
    },
    {
      title: 'Forward pass: la rete prova a rispondere',
      text: [
        'Scegli un esempio qui sotto e guarda gli impulsi gialli: il segnale va dagli input verso l\'output.',
        'Ogni neurone fa la stessa cosa: calcola la somma pesata z = w₁x₁ + w₂x₂ + b e poi la passa nella sigmoide. Il numero dentro il cerchio è il risultato, e il colore si accende quando è vicino a 1.',
        'Alla fine arriva la predizione ŷ. Con i pesi casuali, di solito è lontana dalla risposta giusta.'
      ],
      enter(extra) {
        mode = 'net'; glow = null; setLegend(NET_LEGEND);
        const out = el('div', { class: 'muted', style: 'font-size:15px' });
        extra.append(exampleButtons((i) => {
          runForward(i);
          const f = cur.f;
          out.innerHTML = `h = (${f.h.map((v) => num(v, 2)).join('; ')})<br>z dell'output = ${num(f.z2, 2)} → ŷ = σ(z) = <b>${num(f.o, 2)}</b>, risposta corretta y = <b>${Y[i]}</b>`;
        }), out);
        showHud();
      }
    },
    {
      title: 'La loss: quanto ha sbagliato?',
      text: () => {
        const i = cur ? cur.i : 1, f = forward(p, X[i]);
        return [
          'La loss trasforma l\'errore in un numero da rendere più piccolo possibile (slide 32). Usiamo quella delle slide: L = (y − ŷ)².',
          'Nell\'esempio della slide 37 la rete prevedeva ŷ = 0,30 mentre la risposta era y = 1, quindi L = (1 − 0,30)² = 0,49.',
          `Qui, per l'esempio (${X[i].join(', ')}), la rete dà ŷ = ${num(f.o, 2)} e la risposta è y = ${Y[i]}, quindi L = (${Y[i]} − ${num(f.o, 2)})² = <b>${num((Y[i] - f.o) ** 2, 3)}</b>.`,
          'Prova gli altri esempi: la loss cambia da un esempio all\'altro, e la curva gialla a destra ne mostra la media sui quattro.'
        ];
      },
      enter(extra) {
        mode = 'net'; glow = null; setLegend(NET_LEGEND);
        if (!cur) runForward(1);
        const bars = el('div');
        const paint = () => {
          const y = Y[cur.i], o = cur.f.o, L = (y - o) ** 2;
          bars.innerHTML = `<div style="font-size:15px">ŷ = ${num(o, 2)} <span style="display:inline-block;width:${Math.round(o * 160)}px;height:12px;background:#ffd43b;border:2px solid #222"></span></div>`
            + `<div style="font-size:15px">y = ${y} <span style="display:inline-block;width:${y * 160}px;height:12px;background:#51cf66;border:2px solid #222"></span></div>`
            + `<div style="font-size:15px">L = ${num(L, 3)} <span style="display:inline-block;width:${Math.round(L * 160)}px;height:12px;background:#ff6b6b;border:2px solid #222"></span></div>`;
        };
        extra.append(exampleButtons((i) => { runForward(i); paint(); }), bars);
        paint();
      }
    },
    {
      title: 'Backpropagation: di chi è la colpa?',
      text: [
        'La loss è alta: bisogna correggere la rete. Ma quale peso, e di quanto? Premi il pulsante e guarda gli impulsi arancioni: l\'errore parte dall\'output e torna indietro attraverso la rete (slide 38).',
        'Per ogni peso la rete calcola un <b>gradiente</b>, la derivata ∂L/∂w: dice come cambia la loss se aumenti un poco quel peso (slide 39). Le linee che si illuminano di più sono quelle che hanno contribuito di più all\'errore, e il numero è il loro gradiente.',
        'Se il gradiente è positivo, aumentare quel peso farebbe salire la loss, quindi conviene abbassarlo. Se è negativo, conviene alzarlo.'
      ],
      enter(extra) {
        mode = 'net'; setLegend(NET_LEGEND + '<br><span style="color:#e8590c">━</span> alone = gradiente grande');
        if (!cur) runForward(1);
        const out = el('div', { class: 'muted', style: 'font-size:15px' });
        extra.append(el('button', { class: 'btn small primary', onclick: () => {
          runBackward();
          const top = EDGES.map((e) => ({ e, g: cur.g[e.k] })).sort((a, b) => Math.abs(b.g) - Math.abs(a.g)).slice(0, 3);
          out.innerHTML = 'I tre gradienti più grandi:<br>' + top.map((t) => `${t.e.name}: <b>${num(t.g, 3)}</b>`).join('<br>');
        } }, '◀ Propaga l\'errore all\'indietro'), out);
      },
      leave() { glow = null; }
    },
    {
      title: 'Discesa del gradiente: correggiamo i pesi',
      text: [
        'Ora usiamo i gradienti per spostare ogni peso nella direzione che fa scendere la loss (slide 40):',
        '<code>w ← w − η · ∂L/∂w</code>',
        'η è il learning rate: non decide la direzione, che viene dal gradiente, ma quanto è lungo il passo (slide 23). Qui η = 1.',
        'Premi <b>Aggiorna i pesi</b> e guarda le linee cambiare spessore e colore. Premilo più volte sullo stesso esempio: la sua loss scende. Poi guarda gli altri esempi, perché migliorare su uno può peggiorare un altro.'
      ],
      enter(extra) {
        mode = 'net'; glow = null; setLegend(NET_LEGEND); eta = 1;
        if (!cur) runForward(1);
        const out = el('div', { class: 'muted', style: 'font-size:15px' });
        extra.append(exampleButtons((i) => { runForward(i); out.textContent = ''; }),
          el('button', { class: 'btn small primary', onclick: () => {
            const r = applyUpdate();
            const k = EDGES.reduce((a, e) => (Math.abs(r.g[e.k]) > Math.abs(r.g[a.k]) ? e : a), EDGES[0]);
            out.innerHTML = `Loss su (${X[cur.i].join(', ')}): da <b>${num(r.before, 3)}</b> a <b>${num(r.after, 3)}</b><br>Il peso che si è mosso di più: ${k.name} (${num(tween.from[k.k], 2)} → ${num(p[k.k], 2)})`;
          } }, 'Aggiorna i pesi ▶'), out);
      }
    },
    {
      title: 'Epoche: ripetiamo su tutti gli esempi',
      text: [
        'Passare una volta su tutti gli esempi del training set si chiama <b>epoca</b> (slide 24). Per ogni esempio la rete fa forward pass, loss, backpropagation e aggiornamento, proprio come hai fatto tu a mano.',
        'Avvia il training e guarda tre cose insieme: la curva della loss che scende, i pesi che si riorganizzano e il quadrato a destra, dove compare la forma dello XOR (angoli opposti dello stesso colore).',
        'Nessuno ha detto ai neuroni nascosti “impara OR” o “impara AND”: le rappresentazioni utili emergono dal training (slide 30).'
      ],
      enter(extra) {
        mode = 'net'; glow = null; cur = null; setLegend(NET_LEGEND); eta = 1; resetNet(); showHud();
        const pl = ctx.player(() => { trainEpochs(4); if (history[history.length - 1] < 0.004 || epoch > 2500) return false; }, 50, 'Avvia il training');
        extra.append(el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, pl.node,
          el('button', { class: 'btn small', onclick: () => { pl.stop(); resetNet(Math.floor(Math.random() * 1000) + 1); showHud(); } }, 'Ricomincia con pesi casuali')));
        steps[5].pl = pl;
      },
      leave() { if (steps[5].pl) steps[5].pl.stop(); }
    },
    {
      title: 'Che succede se cambio il learning rate?',
      text: [
        'Immagina la loss come una valle, in funzione di un solo peso (esempio illustrativo: una rete vera ha migliaia di pesi, ma l\'idea è la stessa). La discesa del gradiente è la palla rossa, la freccia arancione indica la direzione in discesa e η è la lunghezza del passo.',
        'Prova questi valori: <b>0,2</b> (si arriva, ma molto lentamente), <b>1,5</b> (pochi passi), <b>3,5</b> (la palla rimbalza da una parte all\'altra) e <b>4,5</b> (i rimbalzi crescono e la loss esplode).',
        'Per questo η è un iperparametro da scegliere con cura: troppo piccolo spreca epoche, troppo grande impedisce di convergere.'
      ],
      enter(extra) {
        mode = 'valley'; setLegend(''); const pl = ctx.player(() => vstep(), 450, 'Avvia la discesa');
        const reset = () => { valley.w = -3.2; valley.trail = [-3.2]; valley.steps = 0; vhud(); };
        function vstep() {
          if (Math.abs(valley.w) > 60) return false;
          valley.w = valley.w - valley.eta * VG(valley.w); valley.trail.push(valley.w); valley.steps++;
          if (valley.trail.length > 40) valley.trail.shift();
          vhud();
          if (Math.abs(valley.w - 2) < 0.01 || valley.steps > 60) return false;
        }
        function vhud() {
          const L = VL(valley.w);
          setHud(Math.abs(valley.w) > 60 ? `Passo ${valley.steps}<br><b style="color:#c92a2a">La loss è esplosa!</b>` : `η = <b>${num(valley.eta, 1)}</b> · passo <b>${valley.steps}</b><br>w = ${num(valley.w, 2)} · L = <b>${num(L, 3)}</b>`);
        }
        extra.append(ctx.slider('Learning rate η', { min: 0.1, max: 5, step: 0.1, value: valley.eta, format: (v) => num(v, 1) }, (v) => { valley.eta = v; pl.stop(); reset(); }),
          el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, el('button', { class: 'btn small', onclick: () => { pl.stop(); vstep(); } }, 'Un passo'), pl.node,
            el('button', { class: 'btn small', onclick: () => { pl.stop(); reset(); } }, 'Ricomincia')));
        reset();
        steps[6].pl = pl;
      },
      leave() { if (steps[6].pl) steps[6].pl.stop(); }
    },
    {
      title: 'Riassumendo',
      text: [
        'Ogni passo del training ripete sempre lo stesso ciclo: <b>forward pass</b> (la rete prova), <b>loss</b> (quanto ha sbagliato), <b>backpropagation</b> (quanto ogni peso è responsabile) e <b>discesa del gradiente</b> (ogni peso si sposta un poco nella direzione giusta).',
        'Il progettista sceglie architettura, funzione di attivazione, loss, learning rate e dati. La rete impara i pesi, e con loro le rappresentazioni interne (slide 42).',
        'L\'obiettivo non è portare a zero l\'errore sul training set, ma ottenere un modello che funzioni anche su dati nuovi.'
      ],
      enter() { mode = 'net'; glow = null; cur = null; setLegend(NET_LEGEND); eta = 1; resetNet(); trainEpochs(700); showHud(); }
    }
  ];

  ctx.guide(side, steps, {
    onFinish() {
      ctx.tryIt(tryBox, {
        question: 'Durante la backpropagation alcune linee si illuminavano di arancione più di altre. Che cosa indicava quella luce?',
        options: [
          'Il gradiente: quanto la loss cambierebbe modificando quel peso',
          'Il nuovo valore che il peso avrà dopo l\'aggiornamento',
          'Il learning rate scelto per quella connessione',
          'L\'output del neurone a cui arriva la linea'
        ],
        answer: 0,
        explain: 'La luce era proporzionale a |∂L/∂w|, cioè a quanto quel peso ha contribuito all\'errore. Solo dopo, nella discesa del gradiente, il peso viene spostato di η · ∂L/∂w. Il learning rate è uno solo per tutta la rete e non viene appreso.'
      });
      tryBox.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return {
    dispose() {
      alive = false; cancelAnimationFrame(raf); cv.dispose();
      steps.forEach((s) => s.pl && s.pl.stop());
    }
  };
}
