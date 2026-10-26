// Osservatorio del Compromesso: bias, varianza, underfitting e overfitting (Lezione 3, slide 15-24).
// Le slide non hanno figure su questo tema: qui usiamo un esempio illustrativo, una regressione
// polinomiale su dati generati da una curva nascosta più rumore. I calcoli (minimi quadrati, errori) sono veri.

const FONT = '"Pixelify Sans", sans-serif';
const truth = (x) => 0.5 + 0.32 * Math.sin(5.2 * x - 0.6) + 0.12 * x;
const NOISE = 0.09;

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function sample(n, r) { return Array.from({ length: n }, () => { const x = 0.03 + 0.94 * r(); return { x, y: truth(x) + gauss(r) * NOISE }; }).sort((a, b) => a.x - b.x); }

// Minimi quadrati per un polinomio di grado d (x riportata in [-1, 1], piccola regolarizzazione per stabilità numerica).
function fit(pts, d) {
  const m = d + 1, A = Array.from({ length: m }, () => new Array(m).fill(0)), b = new Array(m).fill(0);
  for (const p of pts) {
    const u = p.x * 2 - 1, pw = [1];
    for (let k = 1; k < m; k++) pw.push(pw[k - 1] * u);
    for (let i = 0; i < m; i++) { b[i] += pw[i] * p.y; for (let j = 0; j < m; j++) A[i][j] += pw[i] * pw[j]; }
  }
  for (let i = 0; i < m; i++) A[i][i] += 1e-7;
  for (let c = 0; c < m; c++) {
    let piv = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < m; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const w = b.map((v, i) => v / A[i][i]);
  return (x) => { const u = x * 2 - 1; let s = 0, pw = 1; for (const c of w) { s += c * pw; pw *= u; } return s; };
}
const mse = (f, pts) => pts.reduce((s, p) => s + (f(p.x) - p.y) ** 2, 0) / pts.length;

export function mount(ctx) {
  const { stage, side, el, num } = ctx;
  let seed = 3, n = 14, degree = 3;
  let train = sample(n, rng(seed)), test = sample(60, rng(999));
  let model = fit(train, degree), ghosts = [], showTruth = false, showTest = true, curve = null;
  let raf = 0, alive = true, hits = [];
  const hud = el('div', { class: 'obs-hud' });
  const legend = el('div', { class: 'obs-legend' });
  const cv = ctx.canvas2d(stage, () => {});
  stage.append(legend, hud);
  const tryBox = el('div');
  side.append(tryBox);
  const setLegend = (h) => { legend.innerHTML = h; legend.style.display = h && stage.clientWidth > 560 ? '' : 'none'; };

  function refit() { model = fit(train, degree); paintHud(); }
  function newTrain() { seed++; train = sample(n, rng(seed)); refit(); }
  function paintHud() {
    hud.innerHTML = `Grado del polinomio: <b>${degree}</b> · punti di training: <b>${n}</b><br>Errore sul training: <b>${num(mse(model, train), 4)}</b><br>Errore su dati nuovi: <b>${num(mse(model, test), 4)}</b>`;
  }
  // Errore medio su molti training set diversi, per ogni grado (curva del compromesso).
  function tradeoff() {
    const vals = [];
    for (let d = 0; d <= 10; d++) {
      let tr = 0, te = 0;
      for (let t = 0; t < 25; t++) { const s = sample(n, rng(500 + t)); const f = fit(s, d); tr += mse(f, s); te += Math.min(1, mse(f, test)); }
      vals.push({ d, tr: tr / 25, te: te / 25 });
    }
    return vals;
  }

  // ---------- disegno ----------
  function draw() {
    const g = cv.ctx, w = cv.w, h = cv.h;
    if (!w) return;
    g.fillStyle = '#10121c'; g.fillRect(0, 0, w, h);
    const narrow = w < 560;
    let P = narrow ? { x: 34, y: 60, w: w - 48, h: h * (curve ? 0.5 : 0.8) } : { x: 50, y: 70, w: (curve ? w * 0.55 : w - 80), h: h - 120 };
    const sx = (x) => P.x + P.w * x, sy = (y) => P.y + P.h * (1 - (y + 0.05) / 1.1);
    g.strokeStyle = '#343a40'; g.lineWidth = 2; g.strokeRect(P.x, P.y, P.w, P.h);
    g.fillStyle = '#868e96'; g.font = `14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText('x →', P.x + P.w / 2, P.y + P.h + 6);
    g.save(); g.beginPath(); g.rect(P.x, P.y, P.w, P.h); g.clip();
    const plot = (f, color, width, dash) => {
      g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash || []); g.beginPath();
      for (let i = 0; i <= 200; i++) { const x = i / 200, y = Math.max(-2, Math.min(3, f(x))); i ? g.lineTo(sx(x), sy(y)) : g.moveTo(sx(x), sy(y)); }
      g.stroke(); g.setLineDash([]);
    };
    if (showTruth) plot(truth, '#69db7c', 3, [8, 6]);
    ghosts.forEach((f) => plot(f, 'rgba(255,212,59,.28)', 2));
    if (showTest) test.forEach((p) => { g.strokeStyle = '#74c0fc'; g.lineWidth = 2; g.beginPath(); g.arc(sx(p.x), sy(p.y), 4, 0, Math.PI * 2); g.stroke(); });
    plot(model, '#ffd43b', 4);
    train.forEach((p) => { g.fillStyle = '#ff6b6b'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(sx(p.x), sy(p.y), 6, 0, Math.PI * 2); g.fill(); g.stroke(); });
    g.restore();
    if (curve) {
      const C = narrow ? { x: 46, y: P.y + P.h + 52, w: w - 70, h: h - P.y - P.h - 90 } : { x: P.x + P.w + 60, y: h * 0.22, w: w - P.x - P.w - 90, h: h * 0.52 };
      drawCurve(g, C);
    }
  }
  function drawCurve(g, C) {
    const lo = Math.log10(0.001), hi = Math.log10(1);
    const px = (d) => C.x + C.w * d / 10, py = (v) => C.y + C.h * (1 - (Math.log10(Math.max(0.001, Math.min(1, v))) - lo) / (hi - lo));
    g.strokeStyle = '#868e96'; g.lineWidth = 2; g.beginPath(); g.moveTo(C.x, C.y); g.lineTo(C.x, C.y + C.h); g.lineTo(C.x + C.w, C.y + C.h); g.stroke();
    g.fillStyle = '#ced4da'; g.font = `14px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'bottom';
    g.fillText('errore medio (scala log)', C.x, C.y - 8);
    const line = (key, color) => { g.strokeStyle = color; g.lineWidth = 3; g.beginPath(); curve.forEach((v, i) => (i ? g.lineTo(px(v.d), py(v[key])) : g.moveTo(px(v.d), py(v[key])))); g.stroke(); };
    line('tr', '#ff6b6b'); line('te', '#74c0fc');
    hits = [];
    curve.forEach((v) => {
      const on = v.d === degree;
      g.fillStyle = on ? '#fff' : '#74c0fc'; g.beginPath(); g.arc(px(v.d), py(v.te), on ? 8 : 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = on ? '#fff' : '#ff6b6b'; g.beginPath(); g.arc(px(v.d), py(v.tr), on ? 7 : 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#adb5bd'; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(String(v.d), px(v.d), C.y + C.h + 4);
      hits.push({ x: px(v.d), d: v.d });
    });
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillStyle = '#ff6b6b'; g.fillText('● training', C.x + 8, C.y + 4);
    g.fillStyle = '#74c0fc'; g.fillText('● dati nuovi', C.x + 8, C.y + 22);
    g.fillStyle = '#868e96'; g.textAlign = 'center'; g.fillText('grado →', C.x + C.w / 2, C.y + C.h + 22);
    curve.box = C;
  }
  function loop() { if (!alive) return; draw(); raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);

  let degSlider = null;
  const setDegree = (d) => { degree = d; refit(); if (degSlider) { degSlider.querySelector('input').value = d; degSlider.querySelector('b').textContent = d; } };
  const onClick = (e) => {
    if (!curve || !curve.box) return;
    const r = cv.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (y < curve.box.y - 10 || y > curve.box.y + curve.box.h + 30) return;
    const hit = hits.reduce((b, q) => (Math.abs(q.x - x) < Math.abs(b.x - x) ? q : b), hits[0]);
    if (hit && Math.abs(hit.x - x) < 24) setDegree(hit.d);
  };
  cv.canvas.addEventListener('click', onClick);
  const LEG = '<span style="color:#e03131">●</span> training · <span style="color:#1c7ed6">○</span> dati nuovi (test)<br><span style="color:#e8a33d">━</span> modello · <span style="color:#2f9e44">┅</span> curva vera';
  const degreeSlider = () => (degSlider = ctx.slider('Complessità: grado del polinomio', { min: 0, max: 10, step: 1, value: degree }, (v) => { degree = v; refit(); }));

  const steps = [
    {
      title: 'Imparare una curva dai dati',
      text: [
        'Esempio illustrativo (le slide non hanno una figura su questo tema): i punti rossi sono il training set, generati da una curva nascosta più un po\' di rumore. Il rumore è l\'<b>errore irriducibile</b>: anche lo stesso x può dare y diversi (slide 17-18).',
        'Il modello è un polinomio, e il suo <b>grado</b> ne regola la flessibilità: grado 1 è una retta, gradi alti sono curve che possono piegarsi molto. I cerchi blu sono dati nuovi che il modello non ha mai visto.',
        'Premi il pulsante per vedere la curva vera, quella che vorremmo imparare.'
      ],
      enter(extra) {
        degree = 3; n = 14; seed = 3; train = sample(n, rng(seed)); ghosts = []; curve = null; showTruth = false; refit(); setLegend(LEG);
        extra.append(el('button', { class: 'btn small', onclick: (e) => { showTruth = !showTruth; e.target.textContent = showTruth ? 'Nascondi la curva vera' : 'Mostra la curva vera'; } }, 'Mostra la curva vera'));
      }
    },
    {
      title: 'Troppo semplice: underfitting',
      text: [
        'Porta il grado a 0 o 1. La retta non riesce a seguire la forma dei dati: sbaglia molto già sul training, e allo stesso modo sui dati nuovi.',
        'È l\'<b>underfitting</b> (slide 22): il modello ha un <b>bias</b> alto, cioè commette sempre lo stesso tipo di errore. Le slide lo paragonano a uno studente superficiale. Si riconosce perché va male già sul training.'
      ],
      enter(extra) { curve = null; ghosts = []; showTruth = false; setLegend(LEG); extra.append(degreeSlider()); setDegree(1); }
    },
    {
      title: 'Troppo flessibile: overfitting',
      text: [
        'Ora porta il grado a 9 o 10. La curva passa vicinissima a ogni punto rosso, e l\'errore sul training diventa il più basso di tutti.',
        'Ma guarda i cerchi blu: tra un punto e l\'altro la curva fa onde che non c\'entrano niente, e sui dati nuovi l\'errore sale. Il modello ha imparato anche il rumore.',
        'È l\'<b>overfitting</b> (slide 23), lo studente che impara a memoria: bene sul training, male sui dati nuovi. Per accorgersene bisogna confrontare i due errori.'
      ],
      enter(extra) { curve = null; ghosts = []; showTruth = false; setLegend(LEG); extra.append(degreeSlider()); setDegree(10); }
    },
    {
      title: 'Che succede se cambio il training set?',
      text: [
        'La <b>varianza</b> misura quanto cambia il modello se cambiano i dati di training (slide 19). Premi più volte <b>Nuovo training set</b>: le curve precedenti restano in trasparenza.',
        'Con grado 1 le rette si somigliano tutte, ma sono tutte lontane dalla curva vera: varianza bassa, bias alto. Con grado 10 ogni training set produce una curva diversa: varianza alta.',
        'Con un grado intermedio, intorno a 2-4, le curve sono simili tra loro e vicine alla curva vera.'
      ],
      enter(extra) {
        curve = null; showTruth = true; setLegend(LEG); ghosts = [];
        extra.append(degreeSlider(), el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
          el('button', { class: 'btn small primary', onclick: () => { ghosts.push(model); if (ghosts.length > 8) ghosts.shift(); newTrain(); } }, 'Nuovo training set 🎲'),
          el('button', { class: 'btn small', onclick: () => { ghosts = []; } }, 'Pulisci')));
        degSlider.querySelector('input').addEventListener('input', () => { ghosts = []; });
        setDegree(10);
      }
    },
    {
      title: 'Il compromesso bias-varianza',
      text: [
        'Il grafico mostra l\'errore medio su 25 training set diversi, per ogni grado. La curva rossa (training) scende sempre: più il modello è flessibile, meglio si adatta ai dati che vede.',
        'La curva blu (dati nuovi) prima scende, poi risale: a sinistra domina il bias, a destra la varianza. Il punto più basso è il miglior <b>compromesso</b> tra flessibilità e comportamento su dati mai visti (slide 20-21).',
        'Clicca un grado nel grafico per vedere il modello corrispondente.'
      ],
      enter() { showTruth = false; ghosts = []; setLegend(''); degSlider = null; curve = tradeoff(); const best = curve.reduce((a, b) => (b.te < a.te ? b : a)); setDegree(best.d); }
    },
    {
      title: 'Come si combatte l\'overfitting?',
      text: [
        'Tra i rimedi delle slide (slide 24) c\'è il più semplice: <b>più dati</b>. Tieni il grado a 10 e aumenta il numero di punti di training.',
        'Con tanti punti la curva non riesce più a inseguire il rumore di ognuno e torna vicina a quella vera. Lo stesso grado che prima andava in overfitting ora generalizza meglio.',
        'Altri rimedi citati nelle slide: selezionare le feature, la convalida incrociata e la scelta dei parametri del modello.'
      ],
      enter(extra) {
        curve = null; ghosts = []; showTruth = true; setLegend(LEG); degree = 10;
        extra.append(ctx.slider('Punti di training', { min: 12, max: 80, step: 1, value: 14 }, (v) => { n = v; train = sample(n, rng(seed)); refit(); }));
        n = 14; train = sample(n, rng(seed)); refit();
      },
      leave() { n = 14; train = sample(n, rng(seed)); refit(); }
    }
  ];

  ctx.guide(side, steps, {
    onFinish() {
      ctx.tryIt(tryBox, {
        question: 'Un modello ha errore quasi zero sul training set ma sbaglia molto su dati nuovi. Che cosa sta succedendo?',
        options: [
          'Underfitting: il modello è troppo semplice e ha bias alto',
          'Overfitting: il modello ha imparato anche il rumore e ha varianza alta',
          'È solo errore irriducibile, non si può fare niente',
          'Il modello è perfetto: conta solo l\'errore sul training'
        ],
        answer: 1,
        explain: 'È quello che hai visto con il grado 10: la curva passava per tutti i punti rossi ma faceva onde sui dati nuovi, e cambiava molto a ogni nuovo training set. Bene sul training e male sui dati nuovi è la firma dell\'overfitting (slide 23). L\'underfitting invece va male già sul training.'
      });
      tryBox.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return { dispose() { alive = false; cancelAnimationFrame(raf); cv.canvas.removeEventListener('click', onClick); cv.dispose(); } };
}
