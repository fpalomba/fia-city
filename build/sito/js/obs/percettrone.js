// Osservatorio del Percettrone: la regola di apprendimento sposta una retta nel piano.
// Sull'AND la retta trova una posizione che separa le classi; sullo XOR continua a saltare
// senza mai riuscirci; con uno strato nascosto (h1 = OR, h2 = AND) lo spazio si trasforma
// e una sola retta torna a bastare.

const FONT = '"Pixelify Sans", sans-serif';
const PTS = [[0, 0], [0, 1], [1, 0], [1, 1]];
const DATA = { AND: [0, 0, 0, 1], OR: [0, 1, 1, 1], XOR: [0, 1, 1, 0] };
const START = { w1: -0.4, w2: 0.6, th: 0.3 };   // pesi iniziali (esempio illustrativo)

export function mount(ctx) {
  const { stage, side, el, num } = ctx;
  let w1 = START.w1, w2 = START.w2, th = START.th, eta = 0.2;
  let task = 'AND', idx = 0, epoch = 0, errsEpoch = 0, lastErrs = null, current = -1, log = '';
  let pts = PTS.map((p) => p.slice());          // posizioni disegnate (cambiano nel passo dello strato nascosto)
  let hidden = false, morph = null;             // morph: { t0, dur, from, to }
  let raf = 0, alive = true, view = { w1, w2, th }, lineTween = null;

  const legend = el('div', { class: 'obs-legend' });
  const hud = el('div', { class: 'obs-hud' });
  const cv = ctx.canvas2d(stage, () => {});
  stage.append(legend, hud);
  const tryBox = el('div');
  side.append(tryBox);

  const step = (z) => (z > 0 ? 1 : 0);
  const predict = (x, a = w1, b = w2, t = th) => step(a * x[0] + b * x[1] - t);
  const labels = () => DATA[task];
  const errors = () => PTS.reduce((s, x, i) => s + (predict(x) !== labels()[i] ? 1 : 0), 0);
  const now = () => performance.now() / 1000;

  function setLine() { lineTween = { from: { ...view }, to: { w1, w2, th }, t0: now(), dur: 0.5 }; }
  function reset() { w1 = START.w1; w2 = START.w2; th = START.th; idx = 0; epoch = 0; errsEpoch = 0; lastErrs = null; current = -1; log = ''; setLine(); paintHud(); }

  // Un passo della Perceptron Learning Rule su un esempio (slide 17): w ← w + η(y − ŷ)x, con θ trattata come peso di x₀ = −1.
  function learnOne() {
    const i = idx, x = PTS[i], y = labels()[i];
    const z = w1 * x[0] + w2 * x[1] - th, yh = step(z), e = y - yh;
    const old = { w1, w2, th };
    w1 += eta * e * x[0]; w2 += eta * e * x[1]; th -= eta * e;
    if (e !== 0) errsEpoch++;
    current = i;
    log = `Esempio (${x.join(', ')}), y = ${y}: z = ${num(z, 2)} → ŷ = ${yh}. ` + (e === 0
      ? 'Predizione corretta: i pesi restano uguali.'
      : `Errore y − ŷ = ${e}: w₁ ${num(old.w1, 2)} → ${num(w1, 2)}, w₂ ${num(old.w2, 2)} → ${num(w2, 2)}, θ ${num(old.th, 2)} → ${num(th, 2)}.`);
    idx = (idx + 1) % 4;
    if (idx === 0) { epoch++; lastErrs = errsEpoch; errsEpoch = 0; }
    setLine(); paintHud();
    return e;
  }
  function paintHud() {
    const narrow = stage.clientWidth < 560;
    legend.style.display = narrow ? 'none' : '';
    const wrong = hidden ? 0 : errors();
    if (narrow) { hud.innerHTML = `${task} · epoca <b>${epoch}</b> · sbagliati ora: <b>${wrong}</b>`; return; }
    if (hidden) { hud.innerHTML = `Compito: <b>XOR</b> nello spazio (h₁, h₂)<br>Retta: h₁ − h₂ = 0,5<br>Punti sbagliati: <b>0</b>`; return; }
    hud.innerHTML = `Compito: <b>${task}</b> · η = ${num(eta, 2)}<br>w₁ = ${num(w1, 2)} · w₂ = ${num(w2, 2)} · θ = ${num(th, 2)}<br>Epoca <b>${epoch}</b>` +
      (lastErrs != null ? ` · errori nell'ultima epoca: <b>${lastErrs}</b>` : '') + `<br>Punti sbagliati ora: <b>${wrong}</b>`;
  }
  // ---------- disegno ----------
  function layout(w, h) {
    const wide = w > 700;
    const diag = wide ? { x: 10, y: 60, w: w * 0.34, h: h - 80 } : { x: 6, y: 34, w: w - 12, h: h * 0.3 - 10 };
    const size = wide ? Math.min(w * 0.58, h - 70) : Math.min(w - 40, h * 0.66 - 30);
    const plane = wide ? { x: w * 0.4 + (w * 0.58 - size) / 2, y: (h - size) / 2 + 10, s: size } : { x: (w - size) / 2, y: h * 0.33 + 14, s: size };
    return { wide, diag, plane };
  }
  function draw() {
    const g = cv.ctx, w = cv.w, h = cv.h;
    if (!w) return;
    const t = now();
    if (lineTween) {
      const k = Math.min(1, (t - lineTween.t0) / lineTween.dur), e = k * k * (3 - 2 * k);
      for (const key of ['w1', 'w2', 'th']) view[key] = lineTween.from[key] + (lineTween.to[key] - lineTween.from[key]) * e;
      if (k >= 1) lineTween = null;
    }
    if (morph) {
      const k = Math.min(1, (t - morph.t0) / morph.dur), e = k * k * (3 - 2 * k);
      pts = morph.from.map((p, i) => [p[0] + (morph.to[i][0] - p[0]) * e, p[1] + (morph.to[i][1] - p[1]) * e]);
      if (k >= 1) morph = null;
    }
    g.fillStyle = '#10121c'; g.fillRect(0, 0, w, h);
    const L = layout(w, h);
    drawDiagram(g, L.diag);
    drawPlane(g, L.plane);
  }

  function drawDiagram(g, d) {
    const x = current >= 0 ? PTS[current] : null;
    const n1 = { x: d.x + d.w * 0.14, y: d.y + d.h * 0.25 }, n2 = { x: d.x + d.w * 0.14, y: d.y + d.h * 0.62 };
    const sum = { x: d.x + d.w * 0.55, y: d.y + d.h * 0.44 }, out = { x: d.x + d.w * 0.88, y: d.y + d.h * 0.44 };
    const r = Math.max(14, Math.min(26, d.h / 9));
    const edge = (a, b, wv, label) => {
      g.strokeStyle = wv >= 0 ? '#4dabf7' : '#ff6b6b'; g.lineWidth = 2 + Math.min(Math.abs(wv), 3) * 4;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      g.fillStyle = '#f8f9fa'; g.font = `bold 14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${label} = ${num(wv, 2)}`, a.x + (b.x - a.x) * 0.45, a.y + (b.y - a.y) * 0.45 - 16);
    };
    if (hidden) {
      g.fillStyle = '#ced4da'; g.font = `15px ${FONT}`; g.textAlign = 'center';
      const lines = ['x₁, x₂', '↓', 'h₁ = x₁ ∨ x₂ (OR)', 'h₂ = x₁ ∧ x₂ (AND)', '↓', 'y = h₁ ∧ ¬h₂'];
      lines.forEach((s, i) => g.fillText(s, d.x + d.w / 2, d.y + d.h * 0.12 + i * Math.min(34, d.h / 7)));
      return;
    }
    edge(n1, sum, view.w1, 'w₁'); edge(n2, sum, view.w2, 'w₂');
    g.strokeStyle = '#adb5bd'; g.lineWidth = 3; g.beginPath(); g.moveTo(sum.x, sum.y); g.lineTo(out.x, out.y); g.stroke();
    const z = x ? view.w1 * x[0] + view.w2 * x[1] : null;
    const node = (p, txt, fill, sub) => {
      g.fillStyle = fill; g.strokeStyle = '#f8f9fa'; g.lineWidth = 3;
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#10121c'; g.font = `bold ${Math.round(r * 0.8)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, p.x, p.y);
      if (sub) { g.fillStyle = '#ced4da'; g.font = `14px ${FONT}`; g.fillText(sub, p.x, p.y + r + 14); }
    };
    node(n1, x ? String(x[0]) : 'x₁', '#e9ecef', 'x₁');
    node(n2, x ? String(x[1]) : 'x₂', '#e9ecef', 'x₂');
    node(sum, 'Σ', '#ffd43b', z != null ? `z = ${num(z, 2)}` : 'somma pesata');
    const yh = x ? step(z - view.th) : null;
    node(out, yh != null ? String(yh) : 'ŷ', yh === 1 ? '#ffe066' : yh === 0 ? '#74c0fc' : '#e9ecef', `θ = ${num(view.th, 2)}`);
  }

  function drawPlane(g, P) {
    const lo = -0.5, hi = 1.5, span = hi - lo;
    const sx = (v) => P.x + P.s * (v - lo) / span, sy = (v) => P.y + P.s * (hi - v) / span;
    // regioni colorate secondo la predizione
    const a = hidden ? 1 : view.w1, b = hidden ? -1 : view.w2, t = hidden ? 0.5 : view.th;
    const N = 40, c = P.s / N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const u = lo + span * (i + 0.5) / N, v = hi - span * (j + 0.5) / N;
      g.fillStyle = a * u + b * v - t > 0 ? '#5c4a12' : '#12304d';
      g.fillRect(P.x + i * c, P.y + j * c, c + 0.5, c + 0.5);
    }
    g.strokeStyle = '#495057'; g.lineWidth = 1;
    for (const v of [0, 1]) { g.beginPath(); g.moveTo(sx(v), P.y); g.lineTo(sx(v), P.y + P.s); g.moveTo(P.x, sy(v)); g.lineTo(P.x + P.s, sy(v)); g.stroke(); }
    g.strokeStyle = '#f8f9fa'; g.lineWidth = 2; g.strokeRect(P.x, P.y, P.s, P.s);
    // retta di frontiera a·u + b·v = t
    g.save(); g.beginPath(); g.rect(P.x, P.y, P.s, P.s); g.clip();
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath();
    if (Math.abs(b) > 1e-6) { g.moveTo(sx(lo), sy((t - a * lo) / b)); g.lineTo(sx(hi), sy((t - a * hi) / b)); }
    else if (Math.abs(a) > 1e-6) { g.moveTo(sx(t / a), sy(lo)); g.lineTo(sx(t / a), sy(hi)); }
    g.stroke(); g.restore();
    // punti
    const ys = labels();
    pts.forEach((p, i) => {
      const yhat = hidden ? (p[0] - p[1] - 0.5 > 0 ? 1 : 0) : step(view.w1 * PTS[i][0] + view.w2 * PTS[i][1] - view.th);
      const wrong = yhat !== ys[i];
      const X = sx(p[0]), Yp = sy(p[1]);
      g.fillStyle = ys[i] ? '#ffe066' : '#4dabf7'; g.strokeStyle = wrong ? '#ff3b3b' : '#10121c'; g.lineWidth = wrong ? 5 : 3;
      g.beginPath(); g.arc(X, Yp, 13, 0, Math.PI * 2); g.fill(); g.stroke();
      if (i === current && !hidden) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(X, Yp, 20, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#10121c'; g.font = `bold 14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(ys[i]), X, Yp + 1);
      if (wrong) { g.fillStyle = '#ff8787'; g.font = `bold 16px ${FONT}`; g.fillText('✘', X + 20, Yp - 16); }
    });
    g.fillStyle = '#ced4da'; g.font = `15px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
    g.fillText(hidden ? 'h₁ (OR) →' : 'x₁ →', P.x + P.s / 2, P.y + P.s + 4);
    g.save(); g.translate(P.x - 6, P.y + P.s / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'bottom'; g.fillText(hidden ? 'h₂ (AND) →' : 'x₂ →', 0, 0); g.restore();
  }

  function loop() { if (!alive) return; draw(); raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);

  const LEG = '<span style="color:#e8a33d">■</span> zona in cui ŷ = 1 · <span style="color:#1c6bb0">■</span> zona ŷ = 0<br>punto giallo: y = 1 · blu: y = 0 · <span style="color:#e03131">✘</span> sbagliato';
  legend.innerHTML = LEG;
  const logBox = () => el('div', { class: 'muted', style: 'font-size:15px;min-height:3em' });

  const steps = [
    {
      title: 'Un neurone, una retta',
      text: [
        'Il percettrone (slide 13) calcola la somma pesata z = w₁x₁ + w₂x₂ e la confronta con una soglia θ: se z supera θ risponde 1, altrimenti 0.',
        'Nel piano a destra questo diventa una <b>retta</b>, w₁x₁ + w₂x₂ = θ (slide 24): da una parte la zona gialla dove risponde 1, dall\'altra la zona blu dove risponde 0.',
        'Muovi i cursori e guarda la retta spostarsi. I quattro punti sono gli esempi dell\'AND (slide 25): prova a mettere il solo punto (1, 1) nella zona gialla.'
      ],
      enter(extra) {
        task = 'AND'; hidden = false; pts = PTS.map((p) => p.slice()); reset(); current = 3;
        const upd = () => { setLine(); paintHud(); };
        extra.append(
          ctx.slider('w₁', { min: -1.5, max: 1.5, step: 0.05, value: w1, format: (v) => num(v, 2) }, (v) => { w1 = v; upd(); }),
          ctx.slider('w₂', { min: -1.5, max: 1.5, step: 0.05, value: w2, format: (v) => num(v, 2) }, (v) => { w2 = v; upd(); }),
          ctx.slider('soglia θ', { min: -1, max: 2, step: 0.05, value: th, format: (v) => num(v, 2) }, (v) => { th = v; upd(); }));
      }
    },
    {
      title: 'La regola che sposta la retta',
      text: [
        'Trovare i pesi a mano è scomodo. Il percettrone li impara con la <b>Perceptron Learning Rule</b> (slide 17):',
        '<code>w ← w + η (y − ŷ) x</code>',
        'Se la risposta è giusta, y − ŷ = 0 e non cambia niente. Se è sbagliata, ogni peso si sposta in proporzione al suo input: gli input a 0 non vengono toccati. La soglia si comporta come un peso con input fisso, quindi si sposta in direzione opposta.',
        'Premi <b>Presenta un esempio</b> più volte e guarda la retta muoversi ogni volta che c\'è un errore. Qui η = 0,2.'
      ],
      enter(extra) {
        task = 'AND'; hidden = false; reset();
        const out = logBox();
        extra.append(el('button', { class: 'btn small primary', onclick: () => { learnOne(); out.textContent = log; } }, 'Presenta un esempio ▶'), out);
      }
    },
    {
      title: 'Epoche: l\'AND è linearmente separabile',
      text: [
        'Un passaggio su tutti e quattro gli esempi è un\'<b>epoca</b> (slide 24). Avvia il training e guarda il contatore degli errori.',
        'Dopo qualche epoca la retta trova una posizione che lascia (1, 1) da una parte e gli altri tre dall\'altra. Da lì in poi non ci sono più errori e i pesi smettono di cambiare.',
        'Succede perché l\'AND è <b>linearmente separabile</b>: esiste almeno una retta che separa le due classi (slide 25).'
      ],
      enter(extra) {
        task = 'AND'; hidden = false; reset();
        const out = logBox();
        const pl = ctx.player(() => { learnOne(); out.textContent = log; if (idx === 0 && lastErrs === 0) { out.textContent = `Un'epoca intera senza errori: il percettrone ha imparato l'AND in ${epoch} epoche.`; return false; } }, 380, 'Avvia il training');
        extra.append(el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, pl.node, el('button', { class: 'btn small', onclick: () => { pl.stop(); reset(); out.textContent = ''; } }, 'Ricomincia')), out);
        steps[2].pl = pl;
      },
      leave() { steps[2].pl && steps[2].pl.stop(); }
    },
    {
      title: 'Che succede se cambio il learning rate?',
      text: [
        'Il learning rate η decide quanto è grande ogni correzione (slide 23). Prova a cambiarlo e rilancia il training sull\'AND o sull\'OR.',
        'Con η molto piccolo la retta si muove a passetti e servono più epoche. Con η grande fa salti ampi. Sull\'AND e sull\'OR, però, alla fine ci arriva sempre: con dati linearmente separabili la regola converge.'
      ],
      enter(extra) {
        hidden = false; task = 'AND'; reset();
        const out = logBox();
        const pl = ctx.player(() => { learnOne(); if (idx === 0 && lastErrs === 0) { out.textContent = `${task} imparato in ${epoch} epoche con η = ${num(eta, 2)}.`; return false; } if (epoch > 60) { out.textContent = 'Fermato dopo 60 epoche.'; return false; } }, 120, 'Avvia il training');
        const pick = (t) => { pl.stop(); task = t; reset(); out.textContent = ''; };
        extra.append(ctx.slider('Learning rate η', { min: 0.02, max: 1, step: 0.02, value: eta, format: (v) => num(v, 2) }, (v) => { eta = v; pl.stop(); reset(); out.textContent = ''; }),
          el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, el('button', { class: 'btn small', onclick: () => pick('AND') }, 'AND'), el('button', { class: 'btn small', onclick: () => pick('OR') }, 'OR'), pl.node), out);
        steps[3].pl = pl;
      },
      leave() { steps[3].pl && steps[3].pl.stop(); eta = 0.2; }
    },
    {
      title: 'XOR: la retta non trova pace',
      text: [
        'Ora il compito è lo XOR (slide 26): (0, 1) e (1, 0) valgono 1, gli angoli (0, 0) e (1, 1) valgono 0.',
        'Avvia il training e lascialo andare: la retta continua a saltare e c\'è sempre almeno un punto sbagliato, epoca dopo epoca. Prova anche a cambiare η o a muovere la retta a mano con i cursori.',
        'Non è sfortuna e non servono più epoche: <b>nessuna retta</b> può mettere i due punti gialli da una parte e i due blu dall\'altra.'
      ],
      enter(extra) {
        hidden = false; task = 'XOR'; eta = 0.2; reset();
        const out = logBox();
        const pl = ctx.player(() => { learnOne(); out.textContent = `Epoca ${epoch}: ` + (lastErrs != null ? `${lastErrs} errori nell'ultima epoca.` : 'in corso…'); if (epoch >= 40) { out.textContent = 'Dopo 40 epoche ci sono ancora errori: con una sola retta lo XOR è impossibile.'; return false; } }, 160, 'Avvia il training');
        const upd = () => { setLine(); paintHud(); };
        extra.append(el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, pl.node, el('button', { class: 'btn small', onclick: () => { pl.stop(); reset(); out.textContent = ''; } }, 'Ricomincia')), out,
          ctx.slider('w₁', { min: -1.5, max: 1.5, step: 0.05, value: w1, format: (v) => num(v, 2) }, (v) => { pl.stop(); w1 = v; upd(); }),
          ctx.slider('w₂', { min: -1.5, max: 1.5, step: 0.05, value: w2, format: (v) => num(v, 2) }, (v) => { pl.stop(); w2 = v; upd(); }),
          ctx.slider('soglia θ', { min: -1, max: 2, step: 0.05, value: th, format: (v) => num(v, 2) }, (v) => { pl.stop(); th = v; upd(); }));
        steps[4].pl = pl;
      },
      leave() { steps[4].pl && steps[4].pl.stop(); }
    },
    {
      title: 'Uno strato nascosto cambia lo spazio',
      text: [
        'L\'idea delle reti neurali (slide 28-29): due neuroni nascosti calcolano nuove caratteristiche, h₁ = x₁ ∨ x₂ (OR) e h₂ = x₁ ∧ x₂ (AND). Il neurone di output non vede più x₁ e x₂, vede h₁ e h₂.',
        'Premi <b>Trasforma lo spazio</b> e segui i punti: (0, 1) e (1, 0) finiscono entrambi nel punto (1, 0) del nuovo spazio, mentre (1, 1) va in (1, 1). Ora una sola retta separa i gialli dai blu, ed è la regola XOR = h₁ ∧ ¬h₂.',
        'Il primo livello non risolve il problema: costruisce una rappresentazione in cui il problema diventa facile per il livello successivo.'
      ],
      enter(extra) {
        task = 'XOR'; current = -1; hidden = false; pts = PTS.map((p) => p.slice()); reset();
        const to = PTS.map(([a, b]) => [a || b ? 1 : 0, a && b ? 1 : 0]);
        const jitter = (p, i) => (i === 1 ? [p[0] - 0.06, p[1] + 0.06] : i === 2 ? [p[0] + 0.06, p[1] - 0.06] : p);
        const btn = el('button', { class: 'btn small primary', onclick: () => {
          if (!hidden) { hidden = true; morph = { t0: now(), dur: 1.6, from: PTS.map((p) => p.slice()), to: to.map(jitter) }; btn.textContent = '◀ Torna a x₁, x₂'; legend.innerHTML = LEG + '<br>retta: h₁ − h₂ = 0,5'; }
          else { hidden = false; morph = { t0: now(), dur: 1.2, from: pts.map((p) => p.slice()), to: PTS.map((p) => p.slice()) }; btn.textContent = 'Trasforma lo spazio ▶'; legend.innerHTML = LEG; }
          paintHud();
        } }, 'Trasforma lo spazio ▶');
        extra.append(btn);
      },
      leave() { hidden = false; morph = null; pts = PTS.map((p) => p.slice()); legend.innerHTML = LEG; }
    },
    {
      title: 'Dal percettrone alle reti',
      text: [
        'In una rete vera nessuno dice ai neuroni nascosti “impara OR” e “impara AND”: è il training a trovare pesi che producono rappresentazioni intermedie utili (slide 30).',
        'Per farlo il gradino non basta più, perché non dice di quanto si è sbagliato. Servono una loss, la backpropagation e la discesa del gradiente: le trovi in azione nell\'<b>Osservatorio dei Pesi</b>.',
        'Ricorda: un singolo percettrone impara solo frontiere lineari. Più livelli permettono frontiere più complesse.'
      ],
      enter() { task = 'XOR'; hidden = true; pts = PTS.map(([a, b], i) => { const p = [a || b ? 1 : 0, a && b ? 1 : 0]; return i === 1 ? [p[0] - 0.06, p[1] + 0.06] : i === 2 ? [p[0] + 0.06, p[1] - 0.06] : p; }); current = -1; paintHud(); }
    }
  ];

  ctx.guide(side, steps, {
    onFinish() {
      ctx.tryIt(tryBox, {
        question: 'Sullo XOR il percettrone continuava a sbagliare almeno un punto, epoca dopo epoca. Perché?',
        options: [
          'Il learning rate era troppo piccolo',
          'Non esiste una retta che separi i punti con y = 1 da quelli con y = 0',
          'Servivano molte più epoche di training',
          'I pesi iniziali erano stati scelti male'
        ],
        answer: 1,
        explain: 'Lo XOR non è linearmente separabile: qualunque retta lasci (0, 1) e (1, 0) da una parte ci lascia anche almeno uno degli altri due angoli. Cambiare η, epoche o pesi iniziali non serve (slide 26). Serve uno strato nascosto, che trasforma lo spazio come hai visto.'
      });
      tryBox.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return { dispose() { alive = false; cancelAnimationFrame(raf); cv.dispose(); steps.forEach((s) => s.pl && s.pl.stop()); } };
}
