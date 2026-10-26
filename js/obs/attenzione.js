// Osservatorio dell'Attenzione: self-attention sulla frase delle slide (Lezione 11, slide 35-38),
// maschera causale (slide 44-45) e scelta del prossimo token con temperatura, top-k e top-p (slide 48-50).
// I vettori sono piccoli e illustrativi (3 dimensioni), ma tutti i calcoli sono veri.

const FONT = '"Pixelify Sans", sans-serif';
const TOK = ['The', 'cat', 'sat', 'on', 'the', 'mat', 'because', 'it', 'was', 'tired'];
// Key e query illustrative; k(cat) e q(it) sono quelli della slide 36.
const K = [[-0.2, 0.3, -0.4], [0.5, -0.6, 1.0], [0.1, 0.5, -0.2], [-0.3, 0.4, -0.5], [-0.2, 0.3, -0.4], [0.3, 0.1, 0.6], [-0.4, 0.2, -0.3], [0.1, 0, 0.3], [0, 0.6, -0.2], [0.2, -0.3, 0.5]];
const Q = [[0.3, 0.2, 0.1], [0.2, 0.6, 0.1], [0.6, -0.4, 0.8], [0.1, 0.2, 0.9], [0.3, 0.2, 0.1], [0.5, 0.5, -0.2], [0.2, -0.2, 0.6], [0.4, -0.7, 1.2], [0.5, -0.5, 0.9], [0.6, -0.8, 1.1]];
// Value come colori: il risultato z della self-attention diventa una miscela di colori.
const V = [[120, 120, 130], [255, 146, 43], [77, 171, 247], [120, 120, 130], [120, 120, 130], [105, 219, 124], [120, 120, 130], [200, 200, 210], [120, 120, 130], [218, 119, 242]];
const DK = 3;
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function softmax(z) { const m = Math.max(...z.filter(Number.isFinite)); const e = z.map((v) => (Number.isFinite(v) ? Math.exp(v - m) : 0)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); }
const rgb = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;

// Prossimo token dopo "The cat is": logits illustrativi.
const NEXT = [['tired', 3.0], ['sleeping', 2.4], ['black', 1.9], ['on', 1.4], ['happy', 1.2], ['here', 0.8], ['a', 0.3], ['mat', -0.5]];

export function mount(ctx) {
  const { stage, side, el, num } = ctx;
  let mode = 'sentence', sel = 7, hover = -1, scale = 1, showBars = 'none', mixT = -1, masked = false;
  let T = 1, topK = 8, topP = 1, sampled = null, counts = NEXT.map(() => 0);
  let raf = 0, alive = true, hits = [];
  const hud = el('div', { class: 'obs-hud' });
  const legend = el('div', { class: 'obs-legend' });
  const cv = ctx.canvas2d(stage, () => {});
  stage.append(legend, hud);
  const tryBox = el('div');
  side.append(tryBox);
  const now = () => performance.now() / 1000;
  const setHud = (h) => { hud.innerHTML = h; hud.style.display = h ? '' : 'none'; };
  const setLegend = (h) => { legend.innerHTML = h; legend.style.display = h && stage.clientWidth > 560 ? '' : 'none'; };

  const scores = (i) => TOK.map((_, j) => (masked && j > i ? -Infinity : dot(Q[i], K[j]) / Math.sqrt(DK) * scale));
  const weights = (i) => softmax(scores(i));
  const mix = (i) => { const a = weights(i); return [0, 1, 2].map((c) => a.reduce((s, w, j) => s + w * V[j][c], 0)); };
  function nextProbs() {
    const p = softmax(NEXT.map(([, z]) => z / T));
    const order = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    const keep = new Set(); let cum = 0;
    for (const [v, i] of order) { if (keep.size >= topK) break; if (cum >= topP - 1e-9 && keep.size) break; keep.add(i); cum += v; }
    const s = [...keep].reduce((a, i) => a + p[i], 0);
    return { p, keep, q: p.map((v, i) => (keep.has(i) ? v / s : 0)) };
  }

  // ---------- disegno ----------
  function tokenBoxes(g, w, h) {
    const narrow = w < 560;
    const rows = narrow ? [TOK.slice(0, 5), TOK.slice(5)] : [TOK];
    const y0 = narrow ? h * 0.36 : h * 0.42;
    const boxes = [];
    g.font = `bold ${narrow ? 15 : 18}px ${FONT}`;
    rows.forEach((row, r) => {
      const ws = row.map((t) => g.measureText(t).width + 18);
      const gap = 10, total = ws.reduce((a, b) => a + b, 0) + gap * (row.length - 1);
      let x = (w - total) / 2;
      row.forEach((t, k) => { boxes.push({ x, y: y0 + r * 74, w: ws[k], h: 34 }); x += ws[k] + gap; });
    });
    return boxes;
  }
  function draw() {
    const g = cv.ctx, w = cv.w, h = cv.h;
    if (!w) return;
    g.fillStyle = '#10121c'; g.fillRect(0, 0, w, h);
    if (mode === 'sentence') drawSentence(g, w, h);
    else if (mode === 'matrix') drawMatrix(g, w, h);
    else drawNext(g, w, h);
  }
  function drawSentence(g, w, h) {
    const boxes = tokenBoxes(g, w, h);
    hits = boxes.map((b, i) => ({ ...b, i }));
    const a = weights(sel);
    // archi di attenzione dal token scelto
    if (showBars === 'weight' || showBars === 'value') {
      boxes.forEach((b, j) => {
        if (j === sel || a[j] < 1e-6) return;
        const s = boxes[sel], x1 = s.x + s.w / 2, x2 = b.x + b.w / 2, y1 = s.y, y2 = b.y;
        const lift = 40 + Math.abs(x2 - x1) * 0.25 + (y1 !== y2 ? 20 : 0);
        g.strokeStyle = `rgba(255,212,59,${0.25 + 0.75 * Math.min(1, a[j] * 3)})`; g.lineWidth = 1 + a[j] * (w < 560 ? 22 : 40);
        g.beginPath(); g.moveTo(x1, y1 - 2); g.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - lift, x2, y2 - 2); g.stroke();
      });
    }
    // colori che fluiscono (value)
    const k = mixT < 0 ? 0 : Math.min(1, (now() - mixT) / 1.6);
    boxes.forEach((b, j) => {
      let fill = j === sel ? '#f8f9fa' : '#2b3040';
      if (showBars === 'value') fill = j === sel ? rgb(V[sel].map((v, c) => v + (mix(sel)[c] - v) * k)) : rgb(V[j]);
      g.fillStyle = fill; g.strokeStyle = j === sel ? '#ffd43b' : j === hover ? '#4dabf7' : '#f8f9fa'; g.lineWidth = j === sel ? 4 : 2;
      g.fillRect(b.x, b.y, b.w, b.h); g.strokeRect(b.x, b.y, b.w, b.h);
      g.fillStyle = j === sel || showBars === 'value' ? '#10121c' : '#f8f9fa';
      g.font = `bold ${w < 560 ? 15 : 18}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(TOK[j], b.x + b.w / 2, b.y + b.h / 2 + 1);
      if (showBars === 'score' || showBars === 'weight' || showBars === 'value') {
        const val = showBars === 'score' ? scores(sel)[j] : a[j];
        const bh = showBars === 'score' ? Math.max(-1, Math.min(1, val / 1.4)) * 28 : val * 60;
        g.fillStyle = showBars === 'score' ? (val >= 0 ? '#4dabf7' : '#ff6b6b') : '#ffd43b';
        const base = b.y + b.h + (showBars === 'score' ? 56 : 88);
        if (w >= 560 || showBars === 'score') g.fillRect(b.x + 4, bh >= 0 ? base - bh : base, b.w - 8, Math.abs(bh));
        g.fillStyle = '#ced4da'; g.font = `${w < 560 ? 11 : 13}px ${FONT}`;
        g.fillText(Number.isFinite(val) ? num(val, 2) : '−∞', b.x + b.w / 2, b.y + b.h + 12);
      }
    });
  }
  function drawMatrix(g, w, h) {
    const n = TOK.length, narrow = w < 560;
    const lab = narrow ? 58 : 80, cell = Math.min((w - lab - 20) / n, (h - lab - 80) / n);
    const x0 = (w - lab - cell * n) / 2 + lab, y0 = (h - lab - cell * n) / 2 + lab + 14;
    hits = [];
    g.font = `${narrow ? 11 : 14}px ${FONT}`; g.textBaseline = 'middle';
    for (let i = 0; i < n; i++) {
      const a = weights(i);
      g.fillStyle = i === sel ? '#ffd43b' : '#ced4da'; g.textAlign = 'right'; g.fillText(TOK[i], x0 - 6, y0 + (i + 0.5) * cell);
      for (let j = 0; j < n; j++) {
        const fut = masked && j > i;
        g.fillStyle = fut ? '#000' : `rgba(255,212,59,${Math.min(1, a[j] * 2.2)})`;
        g.fillRect(x0 + j * cell, y0 + i * cell, cell - 2, cell - 2);
        if (fut && cell > 22) { g.fillStyle = '#495057'; g.textAlign = 'center'; g.fillText('−∞', x0 + (j + 0.5) * cell, y0 + (i + 0.5) * cell); }
        else if (cell > 34) { g.fillStyle = a[j] > 0.3 ? '#10121c' : '#adb5bd'; g.textAlign = 'center'; g.font = `${narrow ? 10 : 12}px ${FONT}`; g.fillText(num(a[j], 2), x0 + (j + 0.5) * cell, y0 + (i + 0.5) * cell); g.font = `${narrow ? 11 : 14}px ${FONT}`; }
      }
      hits.push({ x: x0 - lab, y: y0 + i * cell, w: lab + cell * n, h: cell, i });
    }
    g.strokeStyle = '#ffd43b'; g.lineWidth = 3; g.strokeRect(x0 - 2, y0 + sel * cell - 1, cell * n + 1, cell);
    g.save();
    for (let j = 0; j < n; j++) { g.translate(0, 0); g.save(); g.translate(x0 + (j + 0.5) * cell, y0 - 8); g.rotate(-Math.PI / 3); g.fillStyle = '#ced4da'; g.textAlign = 'left'; g.fillText(TOK[j], 0, 0); g.restore(); }
    g.restore();
    g.fillStyle = '#868e96'; g.textAlign = 'center'; g.textBaseline = 'top'; g.font = `13px ${FONT}`;
    g.fillText('riga = token che guarda · colonna = token guardato', w / 2, y0 + cell * n + 6);
  }
  function drawNext(g, w, h) {
    const { p, keep, q } = nextProbs(), narrow = w < 560;
    g.fillStyle = '#f8f9fa'; g.font = `bold ${narrow ? 18 : 24}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(`The cat is ${sampled != null ? NEXT[sampled][0] : '___'}`, w / 2, 60);
    const left = narrow ? 80 : 130, right = w - (narrow ? 60 : 90), top = 120, rowH = Math.min(46, (h - top - 30) / NEXT.length);
    NEXT.forEach(([t], i) => {
      const y = top + i * rowH;
      g.fillStyle = keep.has(i) ? '#f8f9fa' : '#495057'; g.font = `${narrow ? 14 : 17}px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillText(t, left - 10, y + rowH / 2);
      g.fillStyle = '#2b3040'; g.fillRect(left, y + 6, right - left, rowH - 12);
      g.fillStyle = 'rgba(77,171,247,.45)'; g.fillRect(left, y + 6, (right - left) * p[i], rowH - 12);
      if (keep.has(i)) { g.fillStyle = i === sampled ? '#ffd43b' : '#4dabf7'; g.fillRect(left, y + rowH / 2 - 3, (right - left) * q[i], 6); }
      g.fillStyle = '#ced4da'; g.textAlign = 'left'; g.font = `${narrow ? 12 : 14}px ${FONT}`;
      g.fillText(`${num(p[i] * 100, 0)}%` + (counts[i] ? ` · ${counts[i]}×` : ''), right + 6, y + rowH / 2);
    });
  }
  function loop() { if (!alive) return; draw(); raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);

  let onPick = null;
  const onClick = (e) => {
    const r = cv.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = hits.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (hit && onPick) onPick(hit.i);
  };
  cv.canvas.addEventListener('click', onClick);
  const vec = (v) => `[${v.map((x) => num(x, 1)).join('; ')}]`;
  const out = () => el('div', { class: 'muted', style: 'font-size:15px' });

  const steps = [
    {
      title: 'A chi si riferisce “it”?',
      text: [
        'Nella frase <i>The cat sat on the mat because it was tired</i> (slide 35), “it” è il gatto e non il tappeto. Per capirlo bisogna mettere in relazione parole lontane.',
        'Il Transformer divide il testo in <b>token</b> e trasforma ogni token in un vettore, l\'<b>embedding</b> (slide 31-33). Da solo, però, l\'embedding di “it” non sa niente delle altre parole.',
        'L\'<b>attention</b> (slide 30) serve a questo: ogni token decide quanto peso dare agli altri. Clicca una parola per sceglierla, poi vai avanti con “it”.'
      ],
      enter() { mode = 'sentence'; showBars = 'none'; scale = 1; masked = false; sel = 7; setLegend(''); setHud('Token scelto: <b>it</b>'); onPick = (i) => { sel = i; setHud(`Token scelto: <b>${TOK[i]}</b>`); }; }
    },
    {
      title: 'Query e key: chi è rilevante?',
      text: [
        'Ogni token produce una <b>query</b> q (che cosa sto cercando?) e una <b>key</b> k (su cosa posso essere confrontato?) (slide 34-36).',
        'Il punteggio tra due token è il prodotto scalare q · k, diviso per √d<sub>k</sub>. Con i vettori della slide 36: q(it) · k(cat) = 0,4·0,5 + (−0,7)·(−0,6) + 1,2·1,0 = <b>1,82</b>. Le slide non danno il numero: l\'abbiamo calcolato noi.',
        'Le barre sotto le parole sono i punteggi di “it” con ogni token (diviso √3 ≈ 1,73). Clicca un token per vedere i suoi vettori. Gli altri vettori sono illustrativi.'
      ],
      enter() {
        mode = 'sentence'; showBars = 'score'; sel = 7; scale = 1; masked = false; setLegend('');
        const show = (j) => setHud(`q(it) = ${vec(Q[7])}<br>k(${TOK[j]}) = ${vec(K[j])}<br>q · k = <b>${num(dot(Q[7], K[j]), 2)}</b> → /√3 = <b>${num(dot(Q[7], K[j]) / Math.sqrt(3), 2)}</b>`);
        onPick = (j) => { hover = j; show(j); };
        hover = 1; show(1);
      },
      leave() { hover = -1; }
    },
    {
      title: 'Dai punteggi ai pesi con la softmax',
      text: [
        'La softmax trasforma i punteggi in pesi α tra 0 e 1 che sommano a 1 (slide 38). Gli archi gialli sono i pesi: più sono spessi, più “it” guarda quel token. Il più forte va a “cat”.',
        '<b>Che succede se</b> i punteggi diventano più grandi? Muovi il cursore: moltiplicare i punteggi rende la softmax più “estrema”, fino a guardare un solo token. Succede quando d<sub>k</sub> cresce, ed è per questo che si divide per √d<sub>k</sub> (slide 38).'
      ],
      enter(extra) {
        mode = 'sentence'; showBars = 'weight'; sel = 7; scale = 1; masked = false; onPick = null; setLegend('');
        const upd = () => { const a = weights(7); setHud(`α(it → cat) = <b>${num(a[1], 2)}</b> · α(it → mat) = ${num(a[5], 2)}<br>somma dei pesi = ${num(a.reduce((x, y) => x + y, 0), 2)}`); };
        extra.append(ctx.slider('Moltiplica i punteggi per', { min: 0.2, max: 8, step: 0.1, value: 1, format: (v) => num(v, 1) + '×' }, (v) => { scale = v; upd(); }));
        upd();
      },
      leave() { scale = 1; }
    },
    {
      title: 'Value: “it” prende informazione da “cat”',
      text: [
        'Il terzo vettore è il <b>value</b> v: l\'informazione che ogni token mette a disposizione (slide 34). Qui ogni value è un colore: arancione per “cat”, verde per “mat”, viola per “tired”.',
        'Il nuovo vettore di “it” è la media pesata dei value: <code>z = Σ α<sub>j</sub> v<sub>j</sub></code> (slide 37). Premi il pulsante e guarda il colore di “it” cambiare: prende soprattutto il colore di “cat”.',
        'In una riga: <code>Attention(Q, K, V) = softmax(QKᵀ / √d<sub>k</sub>) V</code>. Clicca altre parole per vedere da chi prendono colore.'
      ],
      enter(extra) {
        mode = 'sentence'; showBars = 'value'; sel = 7; scale = 1; masked = false; mixT = -1; setLegend('');
        onPick = (i) => { sel = i; mixT = now(); setHud(`Token scelto: <b>${TOK[i]}</b>`); };
        extra.append(el('button', { class: 'btn small primary', onclick: () => { mixT = now(); } }, 'Calcola z per il token scelto ▶'));
        setHud('Token scelto: <b>it</b>');
      }
    },
    {
      title: 'Tutti guardano tutti',
      text: [
        'La self-attention non lo fa solo per “it”: ogni token calcola i suoi pesi verso tutti gli altri, tutti insieme, con le matrici Q, K e V.',
        'Nella griglia ogni riga è un token che guarda e ogni colonna un token guardato; più la casella è gialla, più il peso è alto. Clicca una riga per evidenziarla.',
        'Un Transformer usa più “teste” in parallelo (multi-head, slide 39), ognuna con le sue matrici, quindi con griglie diverse.'
      ],
      enter() { mode = 'matrix'; masked = false; scale = 1; sel = 7; setLegend(''); onPick = (i) => { sel = i; const a = weights(i); const j = a.indexOf(Math.max(...a)); setHud(`<b>${TOK[i]}</b> guarda soprattutto <b>${TOK[j]}</b> (${num(a[j], 2)})`); }; onPick(7); }
    },
    {
      title: 'Maschera causale: niente sbirciate',
      text: [
        'Il decoder genera un token alla volta, quindi durante il training non può guardare le parole che vengono dopo: sarebbe un data leakage (slide 44, con l\'esempio “The cat is tired”).',
        'Attiva la maschera: ai punteggi dei token futuri si aggiunge −∞, e dopo la softmax il loro peso diventa 0 (slide 45). Guarda la griglia: tutto ciò che sta a destra della diagonale si spegne.',
        'Nota che “it” può ancora guardare “cat”, che viene prima, ma non “tired”.'
      ],
      enter(extra) {
        mode = 'matrix'; scale = 1; sel = 7; masked = false; setLegend('');
        onPick = (i) => { sel = i; const a = weights(i); const j = a.indexOf(Math.max(...a)); setHud(`<b>${TOK[i]}</b> guarda soprattutto <b>${TOK[j]}</b> (${num(a[j], 2)})` + (masked ? '<br>maschera attiva' : '')); };
        const btn = el('button', { class: 'btn small primary', onclick: () => { masked = !masked; btn.textContent = masked ? 'Togli la maschera' : 'Attiva la maschera causale'; onPick(sel); } }, 'Attiva la maschera causale');
        extra.append(btn);
        onPick(7);
      },
      leave() { masked = false; }
    },
    {
      title: 'Il prossimo token: temperatura, top-k, top-p',
      text: [
        'Alla fine il modello produce un logit per ogni token del vocabolario e la softmax li trasforma in probabilità (slide 48). Qui il contesto è “The cat is” (logit illustrativi).',
        'La <b>temperatura</b> divide i logit prima della softmax (slide 50): bassa rende quasi certo il token più probabile, alta appiattisce la distribuzione. <b>Top-k</b> tiene solo i k più probabili, <b>top-p</b> il gruppo più piccolo che arriva a probabilità p.',
        'Le barre chiare sono le probabilità, la linea blu le probabilità tra i candidati rimasti. Premi <b>Campiona</b> più volte e conta quante volte esce ogni parola.'
      ],
      enter(extra) {
        mode = 'next'; T = 1; topK = 8; topP = 1; sampled = null; counts = NEXT.map(() => 0); onPick = null; setLegend('');
        const upd = () => { const { keep } = nextProbs(); setHud(`T = <b>${num(T, 1)}</b> · top-k = <b>${topK}</b> · top-p = <b>${num(topP, 2)}</b><br>candidati: <b>${keep.size}</b>`); };
        const reset = () => { counts = NEXT.map(() => 0); sampled = null; upd(); };
        const sample = () => { const { q } = nextProbs(); let r = Math.random(), i = 0; for (; i < q.length - 1; i++) { r -= q[i]; if (r <= 0) break; } while (q[i] === 0) i--; sampled = i; counts[i]++; upd(); };
        extra.append(
          ctx.slider('Temperatura T', { min: 0.1, max: 3, step: 0.1, value: 1, format: (v) => num(v, 1) }, (v) => { T = v; reset(); }),
          ctx.slider('Top-k', { min: 1, max: 8, step: 1, value: 8 }, (v) => { topK = v; reset(); }),
          ctx.slider('Top-p', { min: 0.1, max: 1, step: 0.05, value: 1, format: (v) => num(v, 2) }, (v) => { topP = v; reset(); }),
          el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
            el('button', { class: 'btn small primary', onclick: sample }, 'Campiona 🎲'),
            el('button', { class: 'btn small', onclick: () => { for (let t = 0; t < 20; t++) sample(); } }, 'Campiona 20 volte')));
        upd();
      }
    }
  ];

  ctx.guide(side, steps, {
    onFinish() {
      ctx.tryIt(tryBox, {
        question: 'Hai alzato la temperatura fino a 3, lasciando top-k = 8 e top-p = 1. Che cosa è successo alle probabilità dei token?',
        options: [
          'Sono diventate più simili tra loro, e parole poco probabili come “mat” sono uscite più spesso',
          '“tired” è diventato ancora più probabile',
          'Il modello ha scartato i token meno probabili',
          'Le probabilità non sono cambiate, è cambiato solo l\'ordine'
        ],
        answer: 0,
        explain: 'Dividere i logit per una temperatura alta riduce le differenze tra loro, quindi la softmax distribuisce la probabilità in modo più uniforme e il modello diventa più “creativo” (slide 50). A scartare i token sono top-k e top-p, non la temperatura.'
      });
      tryBox.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return { dispose() { alive = false; cancelAnimationFrame(raf); cv.canvas.removeEventListener('click', onClick); cv.dispose(); } };
}
