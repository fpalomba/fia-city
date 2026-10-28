// Il compagno di studio: dialoghi, schede di ripasso (Leitner) e commenti mentre esplori.
import { say, ask, screen, el } from './ui.js';
import { sfx } from './audio.js';
import { speciesOf, gx } from './profile.js';

const ICON = { robot: '🤖', gufo: '🦉', drago: '🐉' };
export const petIcon = (pet) => ICON[pet && pet.species] || '🐾';

const TIPS = [
  'Il Prof lo dice sempre: leggi le slide almeno una volta, tutte. Sono la mappa: poi esplora il territorio con libro, esercizi e domande.',
  'Gli esempi fatti a voce a lezione restano impressi più delle definizioni: annotali.',
  'Se un concetto non ti torna, prova un\'altra fonte: il libro di testo, un compagno, il ricevimento.',
  'Inventa un esempio tuo per ogni concetto. Se ci riesci, l\'hai capito davvero.',
  'Discutere con i compagni fa venire fuori dubbi che da sol{o|a|ə} non avresti notato.',
  'Ogni tanto alza lo sguardo dal libro: l\'IA è nei giornali, nei telefoni, nei supermercati. Prova a riconoscere agenti e ambienti nella vita di tutti i giorni.',
  'Leggi ogni domanda fino in fondo, soprattutto se c\'è un «NON». Le sorprese stanno alla fine.',
  'Leggi tutte le opzioni prima di scegliere: a volte la risposta giusta è «Nessuna delle precedenti».',
  'Occhio alle opzioni con una sola parola cambiata, tipo «diminuzione» al posto di «aumento».',
  'Un\'affermazione può essere vera ma riferita a un altro concetto. Chiediti sempre: parla proprio di questo?',
  'In ogni edificio per il voto conta il primo tentativo: ragiona prima di cliccare, poi rigioca per ripassare.',
  'Se hai dubbi, domande o perplessità, scrivi direttamente al Prof. Davvero!',
  'Ripassare rispondendo a memoria funziona meglio che rileggere. Facciamo qualche scheda insieme?',
  'Un quartiere alla volta, seguendo le lezioni. Studiare poco ma spesso batte la notte prima dell\'esame.',
  'La razionalità non implica l\'onniscienza: non serve sapere tutto, serve scegliere bene con ciò che sai.'
];

const MOODS = {
  robot: ['Batteria al 97%. Il restante 3% è curiosità.', 'Sto aggiornando il mio modello del mondo. Tu sei la parte più interessante.', 'Funziono benissimo. Sono un agente basato sull\'utilità e la mia utilità è aiutarti.'],
  gufo: ['Benissimo! Ho appena finito un capitolo del libro. Due volte.', 'Mi chiedevo: un gufo che ripassa è un agente capace di apprendere?', 'Sto bene. Ma sto meglio quando mi fai domande.'],
  drago: ['Ho un fuoco dentro! Si chiama voglia di imparare.', 'Benone! Ho sputato fuoco su un dubbio e l\'ho sciolto.', 'Mi sento un po\' stocastico oggi, ma in senso buono.']
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createCompanion({ getWorld, getProgress, markDirty }) {
  const st = () => getProgress().state;
  const pet = () => (st().profile || {}).pet || { species: 'robot', name: 'Bit' };
  const nameOf = () => pet().name || speciesOf(pet()).name;
  const boxes = () => (st().cards = st().cards || {});

  function availableBuildings() {
    const w = getWorld(), pr = getProgress();
    return w.levels.flatMap((l, i) => (l.implemented && pr.levels[i] && pr.levels[i].unlocked ? l.buildings : []))
      .filter((b) => b.review && b.review.cards && b.review.cards.length);
  }

  const mastery = (b) => b.review.cards.filter((c) => (boxes()[c.id] || 0) >= 2).length;

  function pickCards(list, n = 5) {
    const bx = boxes();
    return list.map((c) => ({ c, k: (bx[c.card.id] || 0) + Math.random() * 0.9 }))
      .sort((a, b) => a.k - b.k).slice(0, n).map((x) => x.c);
  }

  // ---- sessione di schede ----
  function flashcards(cards, back) {
    let i = 0, ok = 0;
    const bx = boxes();
    const show = () => {
      if (i >= cards.length) return summary();
      const { card, building } = cards[i];
      const answer = el('div', { class: 'card-a hidden' }, card.a);
      const actions = el('div', { class: 'row', style: 'margin-top:14px;justify-content:center' });
      const reveal = el('button', { class: 'btn primary', onclick: () => {
        answer.classList.remove('hidden');
        sfx.select();
        actions.innerHTML = '';
        actions.append(
          el('button', { class: 'btn bad-btn', onclick: () => grade(false) }, '✗ Da ripassare'),
          el('button', { class: 'btn primary good-btn', onclick: () => grade(true) }, '✓ La sapevo'));
        actions.querySelector('.good-btn').focus();
      } }, 'Mostra la risposta');
      actions.append(reveal);
      screen.replace(el('div', { class: 'panel flash' },
        el('div', { class: 'row' }, el('h2', { style: 'margin:0' }, `${petIcon(pet())} Ripasso con ${nameOf()}`), el('div', { class: 'spacer' }), el('div', { class: 'muted' }, `Scheda ${i + 1}/${cards.length}`)),
        el('div', { class: 'muted', style: 'margin-top:8px' }, `${building.name} · ${building.slides}`),
        el('div', { class: 'card-q' }, card.q),
        el('div', { class: 'muted', style: 'text-align:center;font-size:14px' }, 'Prova a rispondere a voce o a mente, poi controlla.'),
        answer, actions));
      reveal.focus();
    };
    const grade = (knew) => {
      const id = cards[i].card.id;
      bx[id] = knew ? Math.min(3, (bx[id] || 0) + 1) : 0;
      if (knew) { ok++; sfx.correct(); } else sfx.partial();
      markDirty();
      i++;
      show();
    };
    const summary = () => {
      const sp = speciesOf(pet());
      const msg = ok === cards.length ? sp.voice.happy : ok >= cards.length / 2 ? 'Bene! Le schede «da ripassare» torneranno presto, così le fissiamo.' : 'Niente panico: le schede sbagliate tornano più spesso. Ripassa quelle slide e riproviamo!';
      screen.replace(el('div', { class: 'panel flash' },
        el('h2', {}, `${petIcon(pet())} ${nameOf()}`),
        el('p', {}, `Sapevi ${ok} schede su ${cards.length}.`),
        el('p', {}, gx(msg)),
        el('div', { class: 'row' },
          el('button', { class: 'btn', onclick: back }, '◀ Elenco argomenti'),
          el('div', { class: 'spacer' }),
          el('button', { class: 'btn primary', onclick: () => surprise() }, 'Altre 5 schede'),
          el('button', { class: 'btn', onclick: () => screen.close() }, 'Chiudi'))));
    };
    show();
  }

  const allCards = () => availableBuildings().flatMap((b) => b.review.cards.map((card) => ({ card, building: b })));

  function surprise() {
    const cards = pickCards(allCards(), 5);
    if (!cards.length) return screen.close();
    flashcards(cards, reviewScreen);
  }

  function summaryOf(b) {
    screen.replace(el('div', { class: 'panel flash' },
      el('h2', {}, `${petIcon(pet())} ${b.name}`),
      el('div', { class: 'muted' }, `${b.concept} · ${b.slides}`),
      el('ul', { class: 'recap' }, b.review.summary.map((s) => el('li', {}, s))),
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: reviewScreen }, '◀ Indietro'),
        el('div', { class: 'spacer' }),
        el('button', { class: 'btn primary', onclick: () => flashcards(pickCards(b.review.cards.map((card) => ({ card, building: b })), 4), reviewScreen) }, 'Fammi le domande'))));
  }

  function reviewScreen() {
    const list = availableBuildings();
    const total = list.reduce((a, b) => a + b.review.cards.length, 0);
    const sure = list.reduce((a, b) => a + mastery(b), 0);
    const rows = list.map((b) => el('div', { class: 'review-row' },
      el('span', { class: 'glyph', style: `background:${b.color}` }, b.glyph),
      el('div', { class: 'grow' }, el('b', {}, b.name), el('div', { class: 'muted', style: 'font-size:14px' }, b.concept),
        el('div', { class: 'meter' }, el('div', { style: `width:${(mastery(b) / b.review.cards.length) * 100}%` }))),
      el('button', { class: 'btn small', onclick: () => summaryOf(b) }, 'Riassunto'),
      el('button', { class: 'btn small primary', onclick: () => flashcards(pickCards(b.review.cards.map((card) => ({ card, building: b })), 4), reviewScreen) }, 'Schede')));
    const close = el('button', { class: 'btn', onclick: () => screen.close() }, 'Chiudi');
    const nodes = [el('div', { class: 'panel' },
      el('div', { class: 'row' }, el('h1', { style: 'margin:0' }, `${petIcon(pet())} Ripasso con ${nameOf()}`), el('div', { class: 'spacer' }), close),
      el('p', {}, `Schede sicure: ${sure}/${total}. Una scheda diventa sicura dopo due risposte giuste di fila; quelle sbagliate tornano più spesso.`),
      el('button', { class: 'btn primary', onclick: surprise, style: 'margin-bottom:12px' }, '🎲 5 schede a sorpresa (prima le più difficili)'),
      ...rows)];
    if (screen.active) screen.replace(...nodes); else screen.open(...nodes);
  }

  async function talk() {
    const sp = speciesOf(pet());
    const c = await ask(gx(`${sp.voice.hello} Cosa facciamo, {nome}?`), ['Ripassiamo insieme!', 'Un consiglio per l\'esame', 'Come stai?', 'Niente, grazie'], { name: nameOf() });
    if (c === 0) reviewScreen();
    else if (c === 1) await say(gx(pick(TIPS)), { name: nameOf() });
    else if (c === 2) await say(gx(pick(MOODS[sp.id] || MOODS.robot)), { name: nameOf() });
  }

  return { talk, reviewScreen, nameOf, tip: () => pick(TIPS), idleLine: () => speciesOf(pet()).voice.idle, hello: () => speciesOf(pet()).voice.hello };
}
