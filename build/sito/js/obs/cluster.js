// Osservatorio dei Cluster: k-means passo per passo (slide 14-17), l'effetto dei centroidi iniziali,
// la scelta di k con il gomito e la silhouette (slide 42-43) e il limite delle forme non convesse (slide 24-27).

const FONT = '"Pixelify Sans", sans-serif';
const COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ffa94d', '#3bc9db', '#f783ac', '#a9e34b', '#e599f7'];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r) { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function blobs() {
  const r = rng(7), out = [];
  [[2.0, 7.8], [8.0, 8.0], [5.0, 2.0]].forEach(([cx, cy]) => { for (let i = 0; i < 18; i++) out.push({ x: cx + gauss(r) * 0.7, y: cy + gauss(r) * 0.7 }); });
  return out;
}
function moons() {
  const r = rng(11), out = [];
  for (let i = 0; i < 40; i++) { const t = Math.PI * i / 39; out.push({ x: 3 + 2.6 * Math.cos(t) + gauss(r) * 0.18, y: 4.6 + 2.6 * Math.sin(t) + gauss(r) * 0.18 }); }
  for (let i = 0; i < 40; i++) { const t = Math.PI * i / 39; out.push({ x: 5.6 - 2.6 * Math.cos(t) + gauss(r) * 0.18, y: 5.4 - 2.6 * Math.sin(t) + gauss(r) * 0.18 }); }
  return out;
}
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const nearest = (p, cs) => cs.reduce((best, c, j) => (d2(p, c) < d2(p, cs[best]) ? j : best), 0);
const sse = (pts, cs, as) => pts.reduce((s, p, i) => s + d2(p, cs[as[i]]), 0);
function runKmeans(pts, k, r) {
  const idx = [];
  while (idx.length < k) { const i = Math.floor(r() * pts.length); if (!idx.includes(i)) idx.push(i); }
  let cs = idx.map((i) => ({ ...pts[i] })), as = pts.map((p) => nearest(p, cs));
  for (let it = 0; it < 100; it++) {
    cs = cs.map((c, j) => { const m = pts.filter((_, i) => as[i] === j); return m.length ? { x: m.reduce((s, p) => s + p.x, 0) / m.length, y: m.reduce((s, p) => s + p.y, 0) / m.length } : c; });
    const nas = pts.map((p) => nearest(p, cs));
    if (nas.every((a, i) => a === as[i])) break;
    as = nas;
  }
  return { cs, as, sse: sse(pts, cs, as) };
}
function silhouette(pts, as, k) {
  if (k < 2) return { mean: 0, s: pts.map(() => 0) };
  const s = pts.map((p, i) => {
    const mean = (j) => { const m = pts.filter((q, t) => t !== i && as[t] === j); return m.length ? m.reduce((acc, q) => acc + Math.sqrt(d2(p, q)), 0) / m.length : 0; };
    const a = mean(as[i]);
    let b = Infinity;
    for (let j = 0; j < k; j++) if (j !== as[i] && as.includes(j)) b = Math.min(b, mean(j));
    if (!Number.isFinite(b)) return 0;
    return (b - a) / Math.max(a, b);
  });
  return { mean: s.reduce((x, y) => x + y, 0) / s.length, s };
}

export function mount(ctx) {
  const { stage, side, el, num } = ctx;
  let pts = blobs(), k = 3, cents = [], assign = null, iter = 0, done = false;
  let tween = null, lines = 0, curve = null, picked = -1, chartK = null;
  let raf = 0, alive = true, R = rng(1);
  const hud = el('div', { class: 'obs-hud' });
  const legend = el('div', { class: 'obs-legend' });
  const cv = ctx.canvas2d(stage, () => {});
  stage.append(legend, hud);
  const tryBox = el('div');
  side.append(tryBox);
  const now = () => performance.now() / 1000;
  const setHud = (h) => { hud.innerHTML = h; hud.style.display = h ? '' : 'none'; };
  const setLegend = (h) => { legend.innerHTML = h; legend.style.display = h && stage.clientWidth > 560 ? '' : 'none'; };
  let geo = null;

  // ---------- k-means passo per passo ----------
  function initCentroids(custom) {
    if (custom) cents = custom.map((c) => ({ ...c }));
    else {
      const idx = [];
      while (idx.length < k) { const i = Math.floor(R() * pts.length); if (!idx.includes(i)) idx.push(i); }
      cents = idx.map((i) => ({ ...pts[i] }));
    }
    assign = null; iter = 0; done = false; tween = null; showHud();
  }
  function doAssign() {
    const nas = pts.map((p) => nearest(p, cents));
    const changed = !assign || nas.some((a, i) => a !== assign[i]);
    assign = nas; lines = now(); showHud();
    return changed;
  }
  function doUpdate() {
    if (!assign) doAssign();
    const next = cents.map((c, j) => { const m = pts.filter((_, i) => assign[i] === j); return m.length ? { x: m.reduce((s, p) => s + p.x, 0) / m.length, y: m.reduce((s, p) => s + p.y, 0) / m.length } : { ...c }; });
    tween = { from: cents.map((c) => ({ ...c })), to: next, t0: now(), dur: 0.8 };
    const moved = next.some((c, j) => d2(c, cents[j]) > 1e-10);
    cents = next; iter++; showHud();
    return moved;
  }
  // Un ciclo completo: assegna e aggiorna; si ferma quando le assegnazioni non cambiano più (slide 17, step #4).
  function cycle() {
    const changed = doAssign();
    if (!changed && iter > 0) { done = true; showHud(); return false; }
    setTimeout(() => { if (alive) doUpdate(); }, 350);
  }
  function showHud() {
    const s = assign ? sse(pts, cents, assign) : null;
    setHud(`k = <b>${cents.length || k}</b> · iterazione <b>${iter}</b>` + (s != null ? `<br>SSE = <b>${num(s, 1)}</b>` : '') + (done ? '<br><b style="color:#2b8a3e">Convergenza raggiunta</b>' : ''));
  }

  // ---------- disegno ----------
  function draw() {
    const g = cv.ctx, w = cv.w, h = cv.h;
    if (!w) return;
    g.fillStyle = '#10121c'; g.fillRect(0, 0, w, h);
    const narrow = w < 560;
    let plot, chart = null;
    if (curve) {
      if (narrow) { const s = Math.min(w - 30, h * 0.58); plot = { x: (w - s) / 2, y: 36, s }; chart = { x: 34, y: 46 + s + 22, w: w - 50, h: h - s - 96 }; }
      else { const s = Math.min(w * 0.56, h - 60); plot = { x: 24, y: (h - s) / 2 + 8, s }; chart = { x: 24 + s + 50, y: h * 0.25, w: w - s - 100, h: h * 0.5 }; }
    } else { const s = Math.min(w - 40, h - 50); plot = { x: (w - s) / 2, y: (h - s) / 2 + 12, s }; }
    geo = plot;
    const sx = (v) => plot.x + plot.s * v / 10, sy = (v) => plot.y + plot.s * (1 - v / 10);
    g.strokeStyle = '#343a40'; g.lineWidth = 2; g.strokeRect(plot.x, plot.y, plot.s, plot.s);
    let shown = cents;
    if (tween) {
      const q = Math.min(1, (now() - tween.t0) / tween.dur), e = q * q * (3 - 2 * q);
      shown = tween.from.map((c, j) => ({ x: c.x + (tween.to[j].x - c.x) * e, y: c.y + (tween.to[j].y - c.y) * e }));
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([4, 4]); g.lineWidth = 2;
      tween.from.forEach((c, j) => { g.beginPath(); g.moveTo(sx(c.x), sy(c.y)); g.lineTo(sx(shown[j].x), sy(shown[j].y)); g.stroke(); });
      g.setLineDash([]);
      if (q >= 1) tween = null;
    }
    // linee di assegnazione che sfumano
    const la = Math.max(0, 1 - (now() - lines) / 1.2);
    if (assign && la > 0) {
      g.lineWidth = 1.5;
      pts.forEach((p, i) => { g.strokeStyle = COLORS[assign[i] % 10]; g.globalAlpha = la * 0.7; g.beginPath(); g.moveTo(sx(p.x), sy(p.y)); g.lineTo(sx(shown[assign[i]].x), sy(shown[assign[i]].y)); g.stroke(); });
      g.globalAlpha = 1;
    }
    // silhouette del punto scelto
    if (picked >= 0 && assign) {
      const p = pts[picked];
      pts.forEach((q, t) => { if (t === picked) return; const own = assign[t] === assign[picked]; if (!own && assign[t] !== nearestOther(picked)) return;
        g.strokeStyle = own ? 'rgba(255,255,255,.55)' : 'rgba(255,146,43,.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx(p.x), sy(p.y)); g.lineTo(sx(q.x), sy(q.y)); g.stroke(); });
    }
    pts.forEach((p, i) => {
      g.fillStyle = assign ? COLORS[assign[i] % 10] : '#ced4da';
      g.strokeStyle = i === picked ? '#fff' : '#10121c'; g.lineWidth = i === picked ? 3 : 1.5;
      g.beginPath(); g.arc(sx(p.x), sy(p.y), i === picked ? 8 : 6, 0, Math.PI * 2); g.fill(); g.stroke();
    });
    shown.forEach((c, j) => {
      const x = sx(c.x), y = sy(c.y);
      g.fillStyle = COLORS[j % 10]; g.strokeStyle = '#fff'; g.lineWidth = 3;
      g.beginPath();
      for (let t = 0; t < 10; t++) { const a = -Math.PI / 2 + t * Math.PI / 5, r = t % 2 ? 7 : 16; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
      g.closePath(); g.fill(); g.stroke();
    });
    if (chart) drawChart(g, chart);
  }
  function nearestOther(i) {
    const k2 = cents.length; let best = -1, bv = Infinity;
    for (let j = 0; j < k2; j++) { if (j === assign[i]) continue; const m = pts.filter((_, t) => assign[t] === j); if (!m.length) continue; const v = m.reduce((s, q) => s + Math.sqrt(d2(pts[i], q)), 0) / m.length; if (v < bv) { bv = v; best = j; } }
    return best;
  }
  function drawChart(g, c) {
    const vals = curve.values, n = vals.length, max = Math.max(...vals.map((v) => v.y)) || 1, min = curve.kind === 'sil' ? Math.min(0, ...vals.map((v) => v.y)) : 0;
    g.strokeStyle = '#868e96'; g.lineWidth = 2; g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x, c.y + c.h); g.lineTo(c.x + c.w, c.y + c.h); g.stroke();
    g.fillStyle = '#ced4da'; g.font = `15px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'bottom';
    g.fillText(curve.kind === 'sil' ? 'silhouette media al variare di k' : 'SSE al variare di k (gomito)', c.x, c.y - 8);
    const px = (i) => c.x + 14 + (c.w - 28) * i / (n - 1), py = (v) => c.y + c.h - (c.h - 10) * (v - min) / (max - min);
    g.strokeStyle = curve.kind === 'sil' ? '#69db7c' : '#ffd43b'; g.lineWidth = 3; g.beginPath();
    vals.forEach((v, i) => (i ? g.lineTo(px(i), py(v.y)) : g.moveTo(px(i), py(v.y)))); g.stroke();
    vals.forEach((v, i) => {
      const on = v.k === chartK;
      g.fillStyle = on ? '#fff' : g.strokeStyle; g.beginPath(); g.arc(px(i), py(v.y), on ? 8 : 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#adb5bd'; g.font = `14px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(String(v.k), px(i), c.y + c.h + 4);
    });
    curve.hit = vals.map((v, i) => ({ k: v.k, x: px(i), y: py(v.y) }));
  }

  function loop() { if (!alive) return; draw(); raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);

  // Click: su un punto del grafico (scelta di k) o su un punto del piano (silhouette).
  const onClick = (e) => {
    const r = cv.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (curve && curve.hit) { const h = curve.hit.find((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < 400); if (h) { curve.onPick(h.k); return; } }
    if (onPointPick && geo && assign) {
      let best = -1, bv = 300;
      pts.forEach((p, i) => { const dx = geo.x + geo.s * p.x / 10 - x, dy = geo.y + geo.s * (1 - p.y / 10) - y, v = dx * dx + dy * dy; if (v < bv) { bv = v; best = i; } });
      if (best >= 0) onPointPick(best);
    }
  };
  let onPointPick = null;
  cv.canvas.addEventListener('click', onClick);

  const bestOf = (k2, runs = 12) => { const r = rng(100 + k2); let best = null; for (let t = 0; t < runs; t++) { const res = runKmeans(pts, k2, r); if (!best || res.sse < best.sse) best = res; } return best; };
  const showResult = (res) => { cents = res.cs.map((c) => ({ ...c })); assign = res.as.slice(); iter = 0; done = true; tween = null; lines = now(); };
  const LEG = '<span style="font-size:18px">★</span> centroide · pallino = punto del dataset<br>il colore indica il cluster assegnato';
  const out = () => el('div', { class: 'muted', style: 'font-size:15px' });

  const steps = [
    {
      title: 'Punti senza etichetta',
      text: [
        'Questi 54 punti non hanno una classe: è un problema <b>non supervisionato</b>. Vogliamo raggrupparli in modo che i punti dello stesso gruppo siano vicini tra loro e lontani dagli altri gruppi (slide 2-4).',
        'A occhio vedi tre gruppi. K-means deve trovarli da solo, usando solo le distanze euclidee tra i punti (slide 9). Il dataset è un esempio illustrativo.'
      ],
      enter() { pts = blobs(); curve = null; picked = -1; onPointPick = null; cents = []; assign = null; iter = 0; done = false; setLegend(LEG); setHud(''); }
    },
    {
      title: 'Passo 1: k centroidi a caso',
      text: [
        'K-means vuole sapere subito quanti gruppi cercare: è il parametro <b>k</b>. Poi sceglie k punti a caso come rappresentanti, i <b>centroidi</b> (slide 14).',
        'Scegli k e premi il pulsante quante volte vuoi: ogni volta le stelle partono da punti diversi.'
      ],
      enter(extra) {
        curve = null; picked = -1; onPointPick = null; assign = null; setLegend(LEG);
        extra.append(ctx.slider('Numero di cluster k', { min: 2, max: 6, step: 1, value: k }, (v) => { k = v; initCentroids(); }),
          el('button', { class: 'btn small primary', onclick: () => initCentroids() }, 'Scegli i centroidi a caso 🎲'));
        initCentroids();
      }
    },
    {
      title: 'Passi 2 e 3: assegna e sposta',
      text: [
        '<b>Assegna</b>: ogni punto va al centroide più vicino, e prende il suo colore (slide 15).',
        '<b>Aggiorna</b>: ogni centroide si sposta nella media dei punti che gli sono stati assegnati, cioè nel loro baricentro (slide 16). Segui la linea tratteggiata.',
        'Alterna i due pulsanti e guarda l\'SSE, la somma delle distanze al quadrato dai centroidi (slide 12): scende a ogni giro. Quando le assegnazioni non cambiano più l\'algoritmo si ferma (slide 17).'
      ],
      enter(extra) {
        curve = null; picked = -1; onPointPick = null; setLegend(LEG);
        if (!cents.length || cents.length !== k) initCentroids(); else { assign = null; iter = 0; done = false; showHud(); }
        const o = out();
        const pl = ctx.player(() => { const r = cycle(); if (r === false) o.textContent = `Le assegnazioni non cambiano più: k-means ha finito in ${iter} iterazioni.`; return r; }, 1100, 'Ripeti fino alla fine');
        extra.append(el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
          el('button', { class: 'btn small primary', onclick: () => { const c = doAssign(); if (!c && iter > 0) { done = true; showHud(); o.textContent = 'Nessun punto ha cambiato cluster: abbiamo finito.'; } } }, '1 · Assegna'),
          el('button', { class: 'btn small primary', onclick: () => { doUpdate(); } }, '2 · Aggiorna i centroidi')),
        el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, pl.node, el('button', { class: 'btn small', onclick: () => { pl.stop(); initCentroids(); o.textContent = ''; } }, 'Nuova partenza 🎲')), o);
        steps[2].pl = pl;
      },
      leave() { steps[2].pl && steps[2].pl.stop(); }
    },
    {
      title: 'Che succede se la partenza è sfortunata?',
      text: [
        'Il risultato dipende dai centroidi iniziali (slide 19 e 22). Premi <b>Partenza sfortunata</b>: due stelle partono nello stesso gruppo in alto a sinistra e la terza a metà strada tra gli altri due gruppi.',
        'Lascia finire l\'algoritmo: si ferma, ma con un gruppo diviso in due e due gruppi uniti. È un <b>ottimo locale</b>, e l\'SSE finale è molto più alto.',
        'Per questo in pratica si lancia k-means più volte da partenze diverse e si tiene il risultato con l\'SSE più basso.'
      ],
      enter(extra) {
        curve = null; picked = -1; onPointPick = null; k = 3; setLegend(LEG); initCentroids();
        const o = out();
        const results = [];
        const pl = ctx.player(() => { const r = cycle(); if (r === false) { results.push(sse(pts, cents, assign)); o.innerHTML = 'SSE finali delle tue prove: ' + results.map((v) => `<b>${num(v, 1)}</b>`).join(', '); } return r; }, 900, 'Avvia k-means');
        extra.append(el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
          el('button', { class: 'btn small', onclick: () => { pl.stop(); initCentroids([{ x: 1.4, y: 7.8 }, { x: 2.6, y: 7.8 }, { x: 6.5, y: 5 }]); pl.start(); } }, 'Partenza sfortunata'),
          el('button', { class: 'btn small', onclick: () => { pl.stop(); initCentroids(); pl.start(); } }, 'Partenza casuale 🎲')), pl.node, o);
        steps[3].pl = pl;
      },
      leave() { steps[3].pl && steps[3].pl.stop(); }
    },
    {
      title: 'Quale k? Il metodo del gomito',
      text: [
        'Finora abbiamo usato k = 3 perché lo vedevamo a occhio. Con dati veri non si può. Il metodo del <b>gomito</b> (slide 42) calcola l\'SSE per diversi valori di k.',
        'Clicca i punti della curva per vedere il clustering di ogni k. L\'SSE scende sempre, ma da 1 a 3 crolla e poi cala piano: il “gomito” indica un buon compromesso.',
        'Con un cluster per punto l\'SSE sarebbe 0, ma vorrebbe dire non fare clustering.'
      ],
      enter() {
        picked = -1; onPointPick = null; setLegend('');
        const vals = [];
        for (let kk = 1; kk <= 8; kk++) vals.push({ k: kk, y: bestOf(kk).sse });
        curve = { kind: 'sse', values: vals, onPick: (kk) => { chartK = kk; showResult(bestOf(kk)); setHud(`k = <b>${kk}</b><br>SSE = <b>${num(vals[kk - 1].y, 1)}</b>`); } };
        curve.onPick(3);
      }
    },
    {
      title: 'Silhouette: coesione e separazione',
      text: [
        'La <b>silhouette</b> (slide 43) guarda ogni punto: a(i) è la distanza media dagli altri punti del suo cluster, b(i) quella dai punti del cluster più vicino. Poi s(i) = (b(i) − a(i)) / max(a(i), b(i)).',
        'Clicca un punto nel piano: le linee bianche vanno al suo cluster, quelle arancioni al cluster vicino. Un s(i) vicino a 1 vuol dire che il punto sta bene dove sta.',
        'La curva mostra la media di s(i) per ogni k: qui il massimo è a k = 3. Clicca la curva per confrontare.'
      ],
      enter() {
        setLegend('');
        const vals = [];
        for (let kk = 2; kk <= 8; kk++) { const res = bestOf(kk); vals.push({ k: kk, y: silhouette(pts, res.as, kk).mean }); }
        let sil = null;
        const pick = (kk) => { chartK = kk; const res = bestOf(kk); showResult(res); sil = silhouette(pts, res.as, kk); picked = -1; setHud(`k = <b>${kk}</b><br>silhouette media = <b>${num(sil.mean, 2)}</b>`); };
        curve = { kind: 'sil', values: vals, onPick: pick };
        onPointPick = (i) => {
          picked = i;
          const same = pts.filter((_, t) => t !== i && assign[t] === assign[i]);
          const a = same.length ? same.reduce((s, q) => s + Math.sqrt(d2(pts[i], q)), 0) / same.length : 0;
          const o = nearestOther(i), other = pts.filter((_, t) => assign[t] === o);
          const b = other.reduce((s, q) => s + Math.sqrt(d2(pts[i], q)), 0) / other.length;
          setHud(`k = <b>${chartK}</b> · punto scelto<br>a(i) = ${num(a, 2)} · b(i) = ${num(b, 2)}<br>s(i) = <b>${num((b - a) / Math.max(a, b), 2)}</b> · media ${num(sil.mean, 2)}`);
        };
        pick(3);
      },
      leave() { picked = -1; onPointPick = null; }
    },
    {
      title: 'Quando k-means sbaglia: le mezze lune',
      text: [
        'K-means funziona bene se i gruppi sono compatti, tondi e ben separati (slide 19). Qui ci sono due mezze lune intrecciate (slide 24).',
        'Con k = 2 k-means taglia le lune con una linea dritta: ogni centroide si prende un pezzo di entrambe. Aumenta k e guarda: con tanti piccoli cluster le lune vengono seguite meglio (slide 26-27), poi si possono unire i cluster vicini.',
        'Gli algoritmi basati sulla densità, come DBSCAN, trovano invece forme arbitrarie (slide 39-40).'
      ],
      enter(extra) {
        curve = null; picked = -1; onPointPick = null; pts = moons(); setLegend(LEG);
        const show = (kk) => { const res = bestOf(kk, 10); showResult(res); setHud(`Mezze lune · k = <b>${kk}</b><br>SSE = <b>${num(res.sse, 1)}</b>`); };
        extra.append(ctx.slider('Numero di cluster k', { min: 2, max: 10, step: 1, value: 2 }, show));
        show(2);
      },
      leave() { pts = blobs(); }
    }
  ];

  ctx.guide(side, steps, {
    onFinish() {
      ctx.tryIt(tryBox, {
        question: 'Nel grafico del gomito l\'SSE scendeva sempre aumentando k. Perché non scegliamo semplicemente il k con l\'SSE più basso?',
        options: [
          'Perché un k grande rende k-means troppo lento',
          'Perché con un cluster per ogni punto l\'SSE va a 0, ma i gruppi non dicono più nulla',
          'Perché l\'SSE più basso si ottiene sempre con k = 2',
          'Perché l\'SSE dipende solo dai centroidi iniziali'
        ],
        answer: 1,
        explain: 'L\'SSE misura quanto i punti sono vicini al loro centroide, e aggiungere centroidi lo riduce sempre. Al limite, un centroide per punto dà SSE = 0, che significa non fare clustering (slide 42). Si cerca il gomito, dove aggiungere un cluster smette di aiutare molto, o il massimo della silhouette.'
      });
      tryBox.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return { dispose() { alive = false; cancelAnimationFrame(raf); cv.canvas.removeEventListener('click', onClick); cv.dispose(); steps.forEach((s) => s.pl && s.pl.stop()); } };
}
