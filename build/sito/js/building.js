// Flusso di un edificio: introduzione, mini-giochi in sequenza con feedback, riepilogo e badge.
import { api } from './api.js';
import { el, screen, toast } from './ui.js';
import { sfx, music } from './audio.js';
import { portrait, badgeCanvas } from './sprites.js';
import { mountItem } from './minigames.js';
import { gx } from './profile.js';

const policyText = {
  first: 'conta il primo tentativo completato',
  best: 'conta il tentativo migliore',
  last: 'conta l\'ultimo tentativo',
  mean: 'conta la media dei tentativi'
};

function header(b, extra) {
  return el('div', { class: 'screen-head' },
    portrait(b.npc.look, 96),
    el('div', { style: 'flex:1' },
      el('h1', { style: 'color:#fff' }, b.name),
      el('div', { style: 'color:#dfe3f0' }, b.concept),
      el('div', { style: 'margin-top:8px' }, el('span', { class: 'tag' }, '📖 ' + b.slides), extra || null)),
    el('button', { class: 'btn small', onclick: () => closeBuilding() }, '✕ Esci'));
}

let onCloseCb = null;
function closeBuilding() {
  screen.close();
  music.play('city');
  if (onCloseCb) onCloseCb();
}

export function openBuilding(b, progress, onClose) {
  onCloseCb = onClose;
  music.stop();
  sfx.door();
  const info = progress.buildings[b.id] || {};
  const rules = progress.rules;
  const status = el('div', { class: 'row', style: 'margin:10px 0 0' },
    info.badge ? el('span', { class: 'tag gold' }, '🏅 Badge ottenuto') : el('span', { class: 'tag' }, 'Badge non ancora ottenuto'),
    info.attempts ? el('span', { class: 'tag' }, `Tentativi completati: ${info.attempts}`) : null,
    info.graded !== null && info.graded !== undefined ? el('span', { class: 'tag' }, `Voto registrato: ${info.graded}/100`) : null);
  const introLines = el('div', {}, b.intro.map((l) => el('p', { style: 'font-size:20px;line-height:1.45;margin:0 0 10px' }, gx(l))));
  const list = el('ol', { style: 'margin:6px 0 0' }, b.minigames.map((t) => el('li', {}, t)));
  const firstTime = !info.attempts;
  const ruleBox = el('div', { class: 'feedback', style: 'margin-top:14px' },
    el('b', {}, 'Regole: '),
    `per il badge serve almeno il ${rules.passThreshold}%. Puoi rigiocare quando vuoi, ma per il voto ${policyText[rules.scorePolicy]}. `,
    firstTime && rules.scorePolicy === 'first' ? el('b', {}, 'Questo è il tentativo che conta: prenditi il tempo che serve!') : null,
    info.inProgress ? el('div', { style: 'margin-top:6px' }, gx('Hai un tentativo in sospeso: riprenderai da dove eri rimast{o|a|ə}.')) : null);
  const start = el('button', { class: 'btn primary', onclick: () => run(b, onClose) }, info.inProgress ? '▶ Riprendi la prova' : (info.attempts ? '↻ Rigioca la prova' : '▶ Inizia la prova'));
  screen.open(
    header(b, status),
    el('div', { class: 'panel' },
      el('h3', {}, b.npc.name),
      introLines,
      el('div', { style: 'margin-top:10px' }, el('b', {}, 'Mini-giochi in questo edificio:'), list),
      ruleBox,
      el('div', { class: 'row', style: 'margin-top:16px' }, el('div', { class: 'spacer' }), el('button', { class: 'btn', onclick: () => closeBuilding() }, 'Torna in città'), start)));
  setTimeout(() => start.focus(), 50);
}

async function run(b, onClose) {
  let data;
  try {
    data = await api.startAttempt(b.id);
  } catch (e) {
    toast(e.message);
    return;
  }
  const answered = data.answered;
  let summary = null;
  for (let si = 0; si < data.stages.length; si++) {
    const stage = data.stages[si];
    const stageState = {};
    for (let ii = 0; ii < stage.items.length; ii++) {
      const item = stage.items[ii];
      if (answered[item.id]) continue;
      const res = await playItem(b, data, stage, si, ii, stageState, answered);
      if (!res) return; // uscita
      answered[item.id] = res.feedback;
      if (res.summary) summary = res.summary;
    }
  }
  if (summary) showSummary(b, summary, onClose);
  else { toast('Prova già completata.'); closeBuilding(); }
}

function dots(stage, answered, current) {
  return el('div', { class: 'progress-dots' }, stage.items.map((it, i) => {
    const fb = answered[it.id];
    const cls = i === current ? 'cur' : fb ? (fb.correct ? 'done' : fb.score > 0 ? 'part' : 'no') : '';
    return el('span', { class: cls, title: `Domanda ${i + 1}` });
  }));
}

function playItem(b, data, stage, si, ii, stageState, answered) {
  return new Promise((resolve) => {
    const ctx = { npcLook: b.npc.look, npcName: b.npc.name, stageState, stageSize: stage.items.length };
    const mg = mountItem(stage, stage.items[ii], ctx);
    const fbBox = el('div', {});
    const panel = el('div', { class: 'panel' },
      stage.instructions ? el('p', { class: 'instructions' }, stage.instructions) : null,
      stage.items.length > 1 ? dots(stage, answered, ii) : null,
      mg.node, fbBox);
    const stageHead = el('div', { class: 'row', style: 'margin-top:4px' },
      el('div', { class: 'stage-title' }, `Prova ${si + 1}/${data.stages.length} · ${stage.title}`));
    screen.replace(header(b), stageHead, panel);

    mg.submitted.then(async (response) => {
      let res;
      try {
        res = await api.answer(data.attemptId, stage.items[ii].id, response);
      } catch (e) {
        toast(e.message);
        if (mg.destroy) mg.destroy();
        resolve(null);
        closeBuilding();
        return;
      }
      const fb = res.feedback;
      mg.reveal(fb);
      if (fb.correct) sfx.correct(); else if (fb.score > 0) sfx.partial(); else sfx.wrong();
      const pct = Math.round(fb.score * 100);
      const cls = fb.correct ? 'ok' : fb.score > 0 ? 'part' : 'ko';
      const verdict = fb.correct ? '✔ Corretto!' : fb.score > 0 ? `◐ Parzialmente corretto (${pct}%)` : (response === null ? '⌛ Tempo scaduto' : '✘ Sbagliato');
      const isLast = !!res.summary;
      const btn = el('button', { class: 'btn primary' }, isLast ? 'Vedi il risultato ▶' : 'Continua ▶');
      let auto = null;
      const go = () => {
        clearTimeout(auto);
        window.removeEventListener('keydown', onKey);
        if (mg.destroy) mg.destroy();
        resolve(res);
      };
      const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
      btn.addEventListener('click', go);
      fbBox.append(el('div', { class: `feedback ${cls}` },
        el('div', { class: 'verdict' }, verdict),
        fb.explain ? el('div', {}, fb.explain) : null,
        fb.ref ? el('div', { class: 'ref' }, `📖 Rivedi: ${fb.ref}`) : null,
        el('div', { class: 'row', style: 'margin-top:10px' }, el('div', { class: 'spacer' }), btn)));
      setTimeout(() => { window.addEventListener('keydown', onKey); btn.focus({ preventScroll: true }); }, 250);
      fbBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (mg.autoContinue && !isLast) auto = setTimeout(go, fb.correct ? 2200 : 4500);
    });
  });
}

function showSummary(b, s, onClose) {
  const color = b.color;
  const badge = badgeCanvas(color, b.glyph, s.hasBadge);
  badge.className = s.newBadge ? 'badge-big' : '';
  badge.style.width = badge.style.height = '120px';
  badge.style.imageRendering = 'pixelated';
  if (s.newBadge) sfx.badge(); else if (s.passed) sfx.correct(); else sfx.wrong();
  const msg = s.newBadge ? `Hai ottenuto il badge «${b.name}»!`
    : s.passed ? 'Prova superata! Avevi già questo badge.'
      : `Non hai raggiunto il ${s.passThreshold}%: niente badge per ora. Ripassa l'argomento e riprova!`;
  const extra = [];
  if (s.levelComplete) extra.push(el('div', { class: 'feedback ok' }, '🎉 Hai completato tutti gli edifici del quartiere! Il prossimo quartiere è sbloccato.'));
  if (s.bossUnlocked) extra.push(el('div', { class: 'feedback part', style: 'margin-top:10px' }, '⚠ Le porte dell\'Aula Magna del Test Finale sono aperte. Il Prof. Palomba ti aspetta in cima al Viale degli Algoritmi...'));
  const retry = el('button', { class: 'btn', onclick: () => run(b, onClose) }, '↻ Riprova');
  const back = el('button', { class: 'btn primary', onclick: () => closeBuilding() }, 'Torna in città ▶');
  screen.replace(header(b), el('div', { class: 'panel', style: 'text-align:center' },
    el('h2', {}, 'Prova completata'),
    badge,
    el('div', { class: 'score-big', style: 'margin:12px 0' }, `${s.score}/100`),
    el('p', { style: 'font-size:20px' }, msg),
    el('p', { class: 'muted' }, `Voto registrato per questo edificio: ${s.graded}/100 (${policyText[s.scorePolicy]}; tentativi completati: ${s.attempts}).`),
    ...extra,
    el('div', { class: 'row', style: 'justify-content:center;margin-top:16px' }, retry, back)));
  setTimeout(() => back.focus(), 50);
}
