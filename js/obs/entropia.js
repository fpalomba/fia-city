// Osservatorio dell'Entropia: costruire un albero decisionale sul dataset della frutta (slide 18-31).
// Lo studente vede il dataset, gioca con l'entropia di un cesto, sceglie la domanda della radice
// confrontando l'information gain, divide il ramo giallo e fa scendere il frutto misterioso.

const FONT = '"Pixelify Sans", sans-serif';
const D = [
  ['Mela', 'Verde', 57, 62], ['Banana', 'Giallo', 40, 180], ['Mela', 'Verde', 69, 72], ['Arancia', 'Arancione', 35, 30],
  ['Arancia', 'Arancione', 45, 35], ['Arancia', 'Arancione', 50, 45], ['Banana', 'Giallo', 40, 170], ['Banana', 'Giallo', 30, 140],
  ['Mela', 'Giallo', 60, 62], ['Mela', 'Giallo', 52, 58]
].map(([cls, col, alt, lar]) => ({ cls, col, alt, lar }));
const MYSTERY = { cls: '?', col: 'Giallo', alt: 58, lar: 63 };
const CLASSES = ['Mela', 'Banana', 'Arancia'];
const CCOL = { Mela: '#e03131', Banana: '#fab005', Arancia: '#f76707', '?': '#f8f9fa' };
const ATTR_COL = { Verde: '#69db7c', Giallo: '#ffe066', Arancione: '#ffa94d' };

const log2 = (x) => Math.log(x) / Math.log(2);
function H(items) {
  const n = items.length;
  if (!n) return 0;
  return CLASSES.reduce((s, c) => { const k = items.filter((d) => d.cls === c).length; return k ? s - (k / n) * log2(k / n) : s; }, 0);
}
function partition(items, split) {
  if (split.attr === 'col') return ['Verde', 'Giallo', 'Arancione'].map((v) => ({ label: v, items: items.filter((d) => d.col === v) })).filter((p) => p.items.length);
  const name = split.attr === 'alt' ? 'altezza' : 'larghezza';
  return [{ label: `${name} ≤ ${split.thr}`, items: items.filter((d) => d[split.attr] <= split.thr) }, { label: `${name} > ${split.thr}`, items: items.filter((d) => d[split.attr] > split.thr) }].filter((p) => p.items.length);
}
function gain(items, split) {
  return H(items) - partition(items, split).reduce((s, p) => s + (p.items.length / items.length) * H(p.items), 0);
}
const majority = (items) => CLASSES.map((c) => [c, items.filter((d) => d.cls === c).length]).sort((a, b) => b[1] - a[1])[0][0];
const pure = (items) => new Set(items.map((d) => d.cls)).size <= 1;

export function mount(ctx) {
  const { stage, side, el, num } = ctx;
  let mode = 'scatter';
  let basket = { Mela: 4, Banana: 3, Arancia: 3 };
  let rootSplit = null, yellowSplit = null, traveller = null;   // traveller: { t0, path:[nodeKeys] }
  let raf = 0, alive = true;
  const hud = el('div', { class: 'obs-hud' });
  const cv = ctx.canvas2d(stage, () => {});
  stage.append(hud);
  const tryBox = el('div');
  side.append(tryBox);
  const now = () => performance.now() / 1000;
  const setHud = (h) => { hud.innerHTML = h; hud.style.display = h ? '' : 'none'; };

  // ---------- disegno ----------
  function dot(g, x, y, r, cls, col) {
    g.fillStyle = col ? ATTR_COL[col] : CCOL[cls]; g.strokeStyle = '#10121c'; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#10121c'; g.font = `bold ${Math.round(r * 1.1)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(cls === '?' ? '?' : cls[0], x, y + 1);
  }
  function draw() {
    const g = cv.ctx, w = cv.w, h = cv.h;
    if (!w) return;
    g.fillStyle = '#10121c'; g.fillRect(0, 0, w, h);
    if (mode === 'scatter') drawScatter(g, w, h);
    else if (mode === 'basket') drawBasket(g, w, h);
    else drawTree(g, w, h);
  }

  function drawScatter(g, w, h) {
    const P = { x: 70, y: 50, w: w - 100, h: h - 110 };
    const sx = (v) => P.x + P.w * v / 200, sy = (v) => P.y + P.h * (1 - (v - 20) / 60);
    g.strokeStyle = '#495057'; g.lineWidth = 2; g.strokeRect(P.x, P.y, P.w, P.h);
    g.fillStyle = '#adb5bd'; g.font = `15px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
    for (let v = 0; v <= 200; v += 40) g.fillText(v, sx(v), P.y + P.h + 6);
    g.fillText('larghezza (mm) →', P.x + P.w / 2, P.y + P.h + 26);
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let v = 20; v <= 80; v += 20) g.fillText(v, P.x - 8, sy(v));
    g.save(); g.translate(18, P.y + P.h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('altezza (mm) →', 0, 0); g.restore();
    [...D, MYSTERY].forEach((d) => {
      const x = sx(d.lar), y = sy(d.alt);
      g.fillStyle = ATTR_COL[d.col]; g.beginPath(); g.arc(x, y, 19, 0, Math.PI * 2); g.fill();
      dot(g, x, y, 12, d.cls);
    });
    g.fillStyle = '#ced4da'; g.font = `14px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('anello = colore del frutto · lettera = classe (M, B, A)', P.x + 6, P.y + 6);
  }

  function drawBasket(g, w, h) {
    const items = CLASSES.flatMap((c) => Array(basket[c]).fill(c));
    const n = items.length, cx = w / 2;
    const r = Math.min(18, w / 30);
    // cesto
    g.fillStyle = '#5f3d1e'; g.strokeStyle = '#a9743f'; g.lineWidth = 4;
    const bw = Math.min(w - 60, 520), bx = cx - bw / 2, by = h * 0.22, bh = h * 0.34;
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw, by); g.lineTo(bx + bw * 0.9, by + bh); g.lineTo(bx + bw * 0.1, by + bh); g.closePath(); g.fill(); g.stroke();
    const perRow = Math.max(1, Math.floor((bw * 0.8) / (r * 2.3)));
    items.forEach((c, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      dot(g, bx + bw * 0.1 + r + col * r * 2.3, by + bh - r - 6 - row * r * 2.2, r, c);
    });
    // valore dell'entropia
    const fake = items.map((c) => ({ cls: c }));
    const hv = H(fake), maxH = log2(3);
    const gx = cx - bw / 2, gy = by + bh + 50, gw = bw;
    g.fillStyle = '#343a40'; g.fillRect(gx, gy, gw, 22);
    g.fillStyle = hv < 0.01 ? '#51cf66' : hv > 1.4 ? '#ff6b6b' : '#ffd43b'; g.fillRect(gx, gy, gw * hv / maxH, 22);
    g.strokeStyle = '#f8f9fa'; g.lineWidth = 2; g.strokeRect(gx, gy, gw, 22);
    g.fillStyle = '#f8f9fa'; g.font = `bold 22px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillText(n ? `H = ${num(hv, 2)} bit` : 'cesto vuoto', cx, gy - 6);
    g.font = `14px ${FONT}`; g.textBaseline = 'top'; g.fillStyle = '#adb5bd';
    g.textAlign = 'left'; g.fillText('0: puro', gx, gy + 28);
    g.textAlign = 'right'; g.fillText(`${num(maxH, 2)}: massimo disordine con 3 classi`, gx + gw, gy + 28);
    g.textAlign = 'center'; g.fillStyle = '#ced4da'; g.font = `16px ${FONT}`;
    g.fillText(CLASSES.map((c) => `${c}: ${basket[c]}`).join('   '), cx, by - 34);
  }

  // Albero: radice, eventuale divisione, eventuale divisione del ramo giallo.
  function buildTree() {
    const root = { key: 'root', items: D, split: rootSplit, children: [] };
    if (rootSplit) root.children = partition(D, rootSplit).map((p) => ({ key: p.label, label: p.label, items: p.items, children: [] }));
    const yellow = root.children.find((c) => c.label === 'Giallo');
    if (yellow && yellowSplit) {
      yellow.split = yellowSplit;
      yellow.children = partition(yellow.items, yellowSplit).map((p) => ({ key: 'G:' + p.label, label: p.label, items: p.items, children: [] }));
    }
    return root;
  }
  function drawTree(g, w, h) {
    const root = buildTree();
    const narrow = w < 560;
    const bw = narrow ? Math.min(108, w / 3.3) : 150, bh = narrow ? 72 : 84;
    const pos = {};
    const place = (node, x, y, span, depth) => {
      pos[node.key] = { x, y, node };
      const n = node.children.length;
      node.children.forEach((c, i) => place(c, x - span / 2 + span * (i + 0.5) / n, y + (narrow ? h * 0.3 : h * 0.31), Math.max(span / n * (depth === 0 ? 1.4 : 1), bw * 2.3), depth + 1));
    };
    place(root, w / 2, narrow ? 44 : 26, w - 20, 0);
    // archi
    for (const { x, y, node } of Object.values(pos)) for (const c of node.children) {
      const q = pos[c.key];
      g.strokeStyle = '#adb5bd'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y + bh); g.lineTo(q.x, q.y); g.stroke();
      const mx = x + (q.x - x) * 0.62, my = y + bh + (q.y - y - bh) * 0.62;
      const lab = node.key === 'root' && !narrow ? c.label : c.label.replace(/^(larghezza|altezza) /, '');
      g.font = `bold ${narrow ? 12 : 14}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText(lab).width + 10;
      g.fillStyle = ATTR_COL[c.label] || '#e9ecef'; g.fillRect(mx - tw / 2, my - 10, tw, 20);
      g.fillStyle = '#10121c'; g.fillText(lab, mx, my);
    }
    // nodi
    for (const { x, y, node } of Object.values(pos)) {
      const leaf = !node.children.length && node.key !== 'root';
      const isPure = pure(node.items);
      g.fillStyle = leaf && isPure ? '#12351f' : '#1f2433'; g.strokeStyle = leaf && isPure ? '#51cf66' : '#f8f9fa'; g.lineWidth = 3;
      g.fillRect(x - bw / 2, y, bw, bh); g.strokeRect(x - bw / 2, y, bw, bh);
      g.fillStyle = '#f8f9fa'; g.font = `bold ${narrow ? 12 : 15}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'top';
      const head = node.key === 'root' ? (node.split ? (node.split.attr === 'col' ? 'Colore?' : node.split.attr === 'alt' ? 'Altezza?' : 'Larghezza?') : 'D (10 frutti)') : node.split ? 'Larghezza?' : leaf && isPure ? `foglia: ${node.items[0].cls}` : `${node.items.length} frutti`;
      g.fillText(head, x, y + 5);
      const r = narrow ? 6 : 8, gap = r * 2.2, rowN = Math.floor((bw - 10) / gap);
      node.items.forEach((d, i) => dot(g, x - (Math.min(rowN, node.items.length) - 1) * gap / 2 + (i % rowN) * gap, y + (narrow ? 30 : 35) + Math.floor(i / rowN) * gap, r, d.cls));
      g.fillStyle = H(node.items) < 1e-9 ? '#8ce99a' : '#ffd43b'; g.font = `${narrow ? 12 : 14}px ${FONT}`; g.textBaseline = 'bottom';
      g.fillText(`H = ${num(H(node.items), 2)}`, x, y + bh - 3);
    }
    // frutto misterioso che scende
    if (traveller) {
      const path = traveller.path.map((k) => pos[k]).filter(Boolean);
      const k = Math.min(path.length - 1, (now() - traveller.t0) / 1.1);
      const i = Math.floor(k), f = k - i;
      const a = path[i], b = path[Math.min(path.length - 1, i + 1)];
      const x = a.x + (b.x - a.x) * f + bw / 2 - 16, y = a.y + (b.y - a.y) * f + 16;
      g.fillStyle = ATTR_COL.Giallo; g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill();
      dot(g, x, y, 12, k >= path.length - 1 ? 'Mela' : '?');
    }
  }

  function loop() { if (!alive) return; draw(); raf = requestAnimationFrame(loop); }
  raf = requestAnimationFrame(loop);

  const table = () => el('table', { class: 'obs-table' },
    el('tr', {}, ...['Frutta', 'Colore', 'Alt.', 'Larg.'].map((t) => el('th', {}, t))),
    ...[...D, MYSTERY].map((d) => el('tr', {}, el('td', {}, d.cls), el('td', {}, d.col), el('td', {}, String(d.alt)), el('td', {}, String(d.lar)))));
  const gainLine = (items, split) => {
    const parts = partition(items, split), n = items.length;
    return `Gain = ${num(H(items), 2)} − (` + parts.map((p) => `${p.items.length}/${n}·${num(H(p.items), 2)}`).join(' + ') + `) = <b>${num(gain(items, split), 2)}</b>`;
  };

  const steps = [
    {
      title: 'Il dataset della frutta',
      text: [
        'Dieci frutti, ognuno con colore, altezza e larghezza, e la sua classe: mela, banana o arancia (slide 18). Nel grafico ogni frutto è un pallino: la lettera è la classe e l\'anello il colore.',
        'L\'ultimo frutto, con il punto interrogativo, è giallo, alto 58 e largo 63: dobbiamo capire che frutto è.',
        'Un albero decisionale lo fa con una serie di domande. Il problema è scegliere <b>quale domanda fare prima</b>.'
      ],
      enter(extra) { mode = 'scatter'; setHud(''); extra.append(table()); }
    },
    {
      title: 'Entropia: quanto è mescolato un cesto',
      text: [
        'L\'entropia misura il disordine di un insieme (slide 26): <code>H(D) = − Σ p(c) · log₂ p(c)</code>, dove p(c) è la frazione di elementi della classe c.',
        'Il cesto parte con i dieci frutti del dataset: 4 mele, 3 banane e 3 arance, quindi H = 1,57 come nella slide 29. Aggiungi e togli frutti e guarda la barra.',
        'Prova a lasciare una sola classe: l\'entropia va a 0, il cesto è <b>puro</b>. Prova a mettere lo stesso numero di frutti per classe: arrivi al massimo, log₂ 3 ≈ 1,58.'
      ],
      enter(extra) {
        mode = 'basket'; setHud(''); basket = { Mela: 4, Banana: 3, Arancia: 3 };
        extra.append(...CLASSES.map((c) => el('div', { class: 'row', style: 'gap:6px;align-items:center' },
          el('span', { style: `display:inline-block;width:86px;font-weight:600;color:${CCOL[c]}` }, c),
          el('button', { class: 'btn small', onclick: () => { basket[c] = Math.max(0, basket[c] - 1); } }, '−'),
          el('button', { class: 'btn small', onclick: () => { basket[c] = Math.min(8, basket[c] + 1); } }, '+'))));
      }
    },
    {
      title: 'Prima domanda: il colore',
      text: [
        'Dividiamo il dataset secondo il colore (slide 20). Guarda i tre rami: verde contiene solo mele e arancione solo arance, quindi hanno entropia 0. Il giallo è ancora mescolato: 3 banane e 2 mele, H = 0,97.',
        'L\'<b>information gain</b> (slide 28) misura quanto disordine abbiamo tolto: l\'entropia di partenza meno la media pesata delle entropie dei rami.',
        () => gainLine(D, { attr: 'col' }) + ', come nella slide 30.'
      ].map((t) => (typeof t === 'function' ? t() : t)),
      enter() { mode = 'tree'; rootSplit = { attr: 'col' }; yellowSplit = null; traveller = null; setHud(`Gain(D, Colore) = <b>${num(gain(D, { attr: 'col' }), 2)}</b>`); }
    },
    {
      title: 'E se chiedessi un\'altra cosa?',
      text: [
        'Le slide calcolano solo il gain del colore. Qui puoi confrontarlo con le altre due domande possibili, che sono numeriche: serve una soglia, del tipo “larghezza > 100?”.',
        'Scegli l\'attributo, muovi la soglia e guarda come si dividono i frutti e quanto vale il gain. Riesci a battere il colore?',
        'Alla radice va l\'attributo con il gain più alto, cioè quello che lascia rami più puri (slide 31).'
      ],
      enter(extra) {
        mode = 'tree'; yellowSplit = null; traveller = null;
        let attr = 'lar', thr = 100;
        const out = el('div', { class: 'muted', style: 'font-size:15px' });
        const best = { v: -1, txt: '' };
        const apply = () => {
          rootSplit = attr === 'col' ? { attr } : { attr, thr };
          const gv = gain(D, rootSplit);
          const name = attr === 'col' ? 'Colore' : `${attr === 'alt' ? 'Altezza' : 'Larghezza'} > ${thr}`;
          if (gv > best.v + 1e-9) { best.v = gv; best.txt = name; }
          setHud(`Gain(D, ${name}) = <b>${num(gv, 2)}</b>`);
          out.innerHTML = gainLine(D, rootSplit) + `<br>Il migliore che hai provato: ${best.txt} (${num(best.v, 2)})`;
          sl.style.display = attr === 'col' ? 'none' : '';
        };
        const sl = ctx.slider('Soglia (mm)', { min: 30, max: 175, step: 1, value: thr }, (v) => { thr = v; apply(); });
        extra.append(el('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' },
          el('button', { class: 'btn small', onclick: () => { attr = 'col'; apply(); } }, 'Colore'),
          el('button', { class: 'btn small', onclick: () => { attr = 'alt'; thr = Math.min(thr, 70); sl.querySelector('input').value = thr; sl.querySelector('b').textContent = thr; apply(); } }, 'Altezza'),
          el('button', { class: 'btn small', onclick: () => { attr = 'lar'; apply(); } }, 'Larghezza')), sl, out);
        apply();
      },
      leave() { rootSplit = { attr: 'col' }; }
    },
    {
      title: 'Il ramo giallo non è puro',
      text: [
        'Con il colore alla radice, il ramo giallo contiene ancora banane e mele. L\'algoritmo ripete lo stesso ragionamento solo su quei cinque frutti (slide 22).',
        'Muovi la soglia della larghezza: quando separa le banane (140, 170, 180) dalle mele (58, 62), entrambi i rami diventano puri e il gain arriva a 0,97, cioè tutta l\'entropia del ramo.',
        'La slide usa la soglia 80, ma qualsiasi valore tra 62 e 139 funziona. Quando tutti i rami sono puri, l\'albero si ferma e assegna le foglie (slide 23).'
      ],
      enter(extra) {
        mode = 'tree'; rootSplit = { attr: 'col' }; traveller = null;
        const yellow = D.filter((d) => d.col === 'Giallo');
        const out = el('div', { class: 'muted', style: 'font-size:15px' });
        const apply = (t) => { yellowSplit = { attr: 'lar', thr: t }; setHud(`Gain(giallo, larghezza > ${t}) = <b>${num(gain(yellow, yellowSplit), 2)}</b>`); out.innerHTML = gainLine(yellow, yellowSplit); };
        extra.append(ctx.slider('Soglia sulla larghezza (mm)', { min: 50, max: 175, step: 1, value: 55 }, apply), out);
        apply(55);
      },
      leave() { yellowSplit = { attr: 'lar', thr: 80 }; }
    },
    {
      title: 'Classifichiamo il frutto misterioso',
      text: [
        'L\'albero è completo. Ogni percorso dalla radice a una foglia è una regola (slide 24), per esempio <code>colore = giallo ∧ larghezza ≤ 80 ⇒ mela</code>.',
        'Premi il pulsante e segui il frutto misterioso (giallo, alto 58, largo 63) mentre scende l\'albero.'
      ],
      enter(extra) {
        mode = 'tree'; rootSplit = { attr: 'col' }; yellowSplit = { attr: 'lar', thr: 80 }; setHud('');
        const out = el('div', { class: 'muted', style: 'font-size:15px' });
        extra.append(el('button', { class: 'btn small primary', onclick: () => {
          traveller = { t0: now(), path: ['root', 'Giallo', 'G:larghezza ≤ 80'] };
          setTimeout(() => { if (alive) { out.innerHTML = 'Colore giallo, poi larghezza 63 ≤ 80: è una <b>mela</b>, come nella slide 25.'; setHud('Predizione: <b>Mela</b>'); } }, 2300);
        } }, 'Fai scendere il frutto ? ▶'), out);
      }
    },
    {
      title: 'Riassumendo',
      text: [
        'Per costruire l\'albero si ripete sempre lo stesso ciclo (slide 31): calcolare l\'entropia, scegliere l\'attributo con il gain più alto, creare il nodo e ripetere sui sottoinsiemi finché sono tutti puri.',
        'Il gain è alto quando una domanda lascia rami poco mescolati. Il colore vinceva alla radice perché isolava subito le mele verdi e tutte le arance.',
        'Nota: un albero che continua a dividere finché ogni foglia è pura può adattarsi troppo ai dati di training, un tema che ritrovi nell\'Osservatorio del Compromesso.'
      ],
      enter() { mode = 'tree'; rootSplit = { attr: 'col' }; yellowSplit = { attr: 'lar', thr: 80 }; traveller = null; setHud(''); }
    }
  ];

  ctx.guide(side, steps, {
    onFinish() {
      ctx.tryIt(tryBox, {
        question: 'Una domanda divide i 10 frutti in due rami: {4 mele} e {3 banane, 3 arance}. Un\'altra li divide in {2 mele, 2 banane, 1 arancia} e {2 mele, 1 banana, 2 arance}. Quale ha il gain più alto?',
        options: [
          'La seconda, perché i rami hanno la stessa dimensione',
          'Hanno lo stesso gain, perché i rami sono comunque due',
          'La prima, perché lascia un ramo puro e quindi più entropia viene tolta',
          'Non si può dire senza conoscere il frutto misterioso'
        ],
        answer: 2,
        explain: 'Il gain è l\'entropia di partenza meno la media pesata delle entropie dei rami. Il ramo con le 4 mele ha H = 0, quindi la media pesata scende molto. Nella seconda divisione ogni ramo resta mescolato quasi come all\'inizio, e il gain è vicino a zero: è come per il colore, che vinceva perché lasciava rami puri.'
      });
      tryBox.scrollIntoView({ behavior: 'smooth' });
    }
  });

  return { dispose() { alive = false; cancelAnimationFrame(raf); cv.dispose(); } };
}
