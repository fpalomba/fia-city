// Scontro finale con il Prof. Palomba: dialogo di apertura e lotta a domande con barra della vita.
import { gx } from './profile.js';
import { api } from './api.js';
import { el, say as sayBox, ask as askBox, toast } from './ui.js';
import { sfx, music } from './audio.js';
import { createBossArena } from './bossarena.js';

// Estrae le battute senza ripeterle finché non sono state usate tutte, così il Prof non dice due volte di fila la stessa cosa.
const bags = new Map();
const pick = (arr) => {
  if (!arr || !arr.length) return '';
  let bag = bags.get(arr);
  if (!bag || !bag.length) {
    bag = arr.slice().sort(() => Math.random() - 0.5);
    const last = bags.get(`${arr.length}:last`);
    if (bag.length > 1 && bag[bag.length - 1] === last) bag.unshift(bag.pop());
    bags.set(arr, bag);
  }
  const line = bag.pop();
  bags.set(`${arr.length}:last`, line);
  return line;
};
const fill = (s, name) => s.replace(/\{name\}/g, name);
const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

let bossData = null; // contenuti di content/boss.json, caricati da main

export function setBossContent(content) { bossData = content; }

export async function enterBoss(progress, world, onClose) {
  const B = bossData;
  const name = progress.username;
  if (!progress.boss.unlocked) {
    await sayBox(B.lockedLines, { name: 'Usciere' });
    return;
  }
  music.play('boss');
  const D = B.dialog;
  if (progress.boss.final) {
    const again = await askBox(`Bentornat{o|a|ə} ${name}. Hai già superato il mio esame con voto ${fmt(progress.boss.final.grade)}. Vuoi sfidarmi di nuovo, solo per la gloria? (il voto non cambia)`, ['Sì, sfidiamoci!', 'No, grazie'], { name: B.name });
    if (again !== 0) { music.play('city'); return; }
  }
  // Riprende uno scontro in corso senza ripetere il dialogo
  let run;
  try { run = await api.bossStart(); } catch (e) { toast(e.message); music.play('city'); return; }
  const stage = openStage(progress);
  const say = (lines, opts) => { stage.arena?.talk(60); return sayBox(lines, opts).finally(() => stage.arena?.quiet()); };
  const ask = (text, choices, opts) => { stage.arena?.talk(60); return askBox(text, choices, opts).finally(() => stage.arena?.quiet()); };
  if (run.correct + run.wrong === 0) {
    await say(fill(D.greeting, name), { name: B.name });
    const read = await ask(D.readSlidesQuestion, ['Sì, tutte!', 'Ehm... non proprio'], { name: B.name });
    let readSlides = 'si';
    if (read === 0) {
      await say(D.readSlidesYes, { name: B.name });
    } else {
      const c = await ask(D.readSlidesNo, D.readSlidesNoChoices, { name: B.name });
      if (c === 0) {
        await say(D.readSlidesLeave, { name: B.name });
        try { await api.bossDialog('no', false); } catch { /* ignora */ }
        stage.close();
        music.play('city');
        return;
      }
      readSlides = 'insisto';
      await say(D.readSlidesInsist, { name: B.name });
    }
    const doubts = await ask(D.doubtsQuestion, ['Sì', 'No'], { name: B.name });
    if (doubts === 0) await say(D.doubtsYes, { name: B.name });
    else await say(D.doubtsNo, { name: B.name });
    try { await api.bossDialog(readSlides, doubts === 0); } catch { /* ignora */ }
    await say(D.battleStart, { name: B.name });
  } else {
    await say(`Riprendiamo da dove eravamo rimasti, ${name}.`, { name: B.name });
  }
  await battle(run, world, progress, onClose, stage);
}

function hpClass(hp, max) { const r = hp / max; return 'hpbar' + (r < 0.25 ? ' low' : r < 0.55 ? ' mid' : ''); }

// Apre l'Aula Magna in 3D: il Prof è già lì durante il dialogo di apertura.
function openStage(progress) {
  const root = document.querySelector('#boss');
  root.innerHTML = '';
  root.classList.remove('hidden', 'phase2');
  root.classList.add('intro');
  const canvas = el('canvas', { class: 'arena3d', 'aria-label': 'Il Prof. Palomba nell\'Aula Magna' });
  const arenaDiv = el('div', { class: 'arena' }, canvas);
  root.append(arenaDiv);
  const profile = (progress.state && progress.state.profile) || {};
  let arena = null;
  try { arena = createBossArena(canvas, { avatar: profile.avatar, pet: profile.pet }); } catch (e) { console.error(e); }
  return {
    root, arenaDiv, arena,
    close() { if (arena) arena.dispose(); root.classList.add('hidden'); root.classList.remove('intro', 'phase2'); root.innerHTML = ''; }
  };
}

function battle(run, world, progress, onClose, stage) {
  return new Promise((resolveBattle) => {
    const B = bossData;
    const { root, arenaDiv, arena } = stage;
    root.classList.remove('intro');
    const hpBar = el('div', { class: hpClass(run.hp, run.maxHp) }, el('div', { style: `width:${(run.hp / run.maxHp) * 100}%` }));
    const hpText = el('span', {}, `${run.hp}/${run.maxHp}`);
    const hearts = el('div', { class: 'hearts' });
    const speech = el('div', { class: 'speech speech-boss hidden' });
    const qBox = el('div', { class: 'q' });
    const timer = el('div', { class: 'timer' }, el('div', {}));
    const opts = el('div', { class: 'options' });
    const fbLine = el('div', { class: 'hidden', style: 'margin-top:10px' });
    arenaDiv.append(
      el('div', { class: 'infobox enemy-info' }, el('div', { class: 'panel' },
        el('div', { class: 'nm' }, el('span', {}, B.name.toUpperCase()), el('span', {}, 'Lv.30')),
        el('div', { style: 'font-size:14px;margin:2px 0 6px' }, B.title),
        hpBar, el('div', { style: 'text-align:right;font-size:14px' }, 'HP ', hpText))),
      el('div', { class: 'infobox player-info' }, el('div', { class: 'panel' },
        el('div', { class: 'nm' }, el('span', {}, progress.username.toUpperCase()), el('span', {}, `✔ ${run.correct}`)),
        hearts)),
      speech);
    root.append(el('div', { class: 'textbox' }, el('div', { class: 'panel' }, qBox, timer, opts, fbLine)));

    const state = { ...run };
    const renderStatus = () => {
      hpBar.className = hpClass(state.hp, state.maxHp);
      hpBar.firstChild.style.width = `${(state.hp / state.maxHp) * 100}%`;
      hpText.textContent = `${state.hp}/${state.maxHp}`;
      hearts.textContent = '♥'.repeat(Math.max(0, state.lives)) + '♡'.repeat(Math.max(0, state.maxLives - state.lives));
      root.classList.toggle('phase2', state.phase === 2);
      arena?.setPhase(state.phase);
      root.querySelector('.player-info .nm span:last-child').textContent = `✔ ${state.correct}`;
    };
    renderStatus();

    // Fumetto del Prof. Resta visibile per ms millisecondi; un clic sul fumetto lo chiude prima.
    let speechTimer = 0, speechDone = null;
    const hideSpeech = () => {
      clearTimeout(speechTimer);
      speech.classList.add('hidden');
      arena?.quiet();
      if (speechDone) { const d = speechDone; speechDone = null; d(); }
    };
    speech.addEventListener('click', hideSpeech);
    const showSpeech = (text, ms) => {
      hideSpeech();
      speech.textContent = gx(text);
      speech.classList.remove('hidden');
      const head = arena?.profHead();
      if (head && head.w > 760) { speech.style.right = `${Math.round(head.w - head.x + 90)}px`; speech.style.bottom = `${Math.round(head.h - head.y - 20)}px`; }
      arena?.talk(ms / 1000);
      speechTimer = setTimeout(hideSpeech, ms);
    };
    const talk = (text, ms = 2600) => new Promise((r) => {
      showSpeech(text, ms);
      speechDone = r;
      const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.removeEventListener('keydown', onKey); hideSpeech(); } };
      setTimeout(() => window.addEventListener('keydown', onKey), 250);
      const prev = speechDone;
      speechDone = () => { window.removeEventListener('keydown', onKey); prev(); };
    });
    let streak = 0;

    let raf = 0;
    let offKeys = () => {};

    async function nextQuestion() {
      let q;
      try { q = await api.bossNext(); } catch (e) { toast(e.message); return end(); }
      Object.assign(state, q.run);
      renderStatus();
      hideSpeech();
      const question = q.question;
      const lvl = world.levels.find((l) => l.id === question.level);
      qBox.innerHTML = '';
      qBox.append(el('span', { class: 'lvl' }, lvl ? lvl.name : question.level), question.prompt);
      fbLine.classList.add('hidden');
      opts.innerHTML = '';
      let answered = false;
      const btns = question.options.map((o, i) => el('button', { class: 'btn', 'data-id': o.id, onclick: () => choose(o.id) }, el('span', { class: 'k' }, String(i + 1)), o.label));
      opts.append(...btns);
      const limit = q.timeLimitSec * 1000;
      const t0 = performance.now() - (q.timeLimitSec - q.remainingSec) * 1000;
      const bar = timer.firstChild;
      const tick = () => {
        const left = Math.max(0, 1 - (performance.now() - t0) / limit);
        bar.style.width = `${left * 100}%`;
        bar.style.background = left < 0.25 ? 'var(--bad)' : left < 0.5 ? 'var(--warn)' : 'var(--accent-2)';
        if (left <= 0) { choose(''); return; }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      const onKey = (e) => { const i = Number(e.key) - 1; if (i >= 0 && i < btns.length) { e.preventDefault(); choose(btns[i].dataset.id); } };
      window.addEventListener('keydown', onKey);
      offKeys = () => window.removeEventListener('keydown', onKey);

      async function choose(id) {
        if (answered) return;
        answered = true;
        cancelAnimationFrame(raf);
        offKeys();
        btns.forEach((b) => { b.disabled = true; });
        let r;
        try { r = await api.bossAnswer(id); } catch (e) { toast(e.message); return end(); }
        btns.forEach((b) => {
          if (b.dataset.id === r.solution) b.classList.add('good');
          else if (b.dataset.id === id) b.classList.add('bad');
        });
        Object.assign(state, r.run);
        fbLine.className = `feedback ${r.correct ? 'ok' : 'ko'}`;
        fbLine.innerHTML = '';
        fbLine.append(el('b', {}, r.correct ? '✔ Esatto! ' : r.timedOut ? '⌛ Tempo scaduto! ' : '✘ Non proprio. '), r.explain || '', r.ref ? el('span', { class: 'muted' }, ` (📖 ${r.ref})`) : '');
        if (r.correct) {
          sfx.hit();
          arena?.hitBoss();
        } else {
          sfx.wrong();
          arena?.hitPlayer();
        }
        renderStatus();
        const finished = state.finished;
        streak = r.correct ? streak + 1 : 0;
        if (finished) {
          await talk(r.correct ? pick(B.battle.onCorrect) : pick(B.battle.onWrong), 1800);
          return finish(r);
        }
        // Battuta adatta al momento: serie di risposte giuste, ultimo cuore, vittoria vicina, cambio di fase.
        let line;
        if (r.phaseChanged) line = B.battle.phase2;
        else if (r.correct && state.hp <= 20 && B.battle.onNearWin) line = pick(B.battle.onNearWin);
        else if (r.correct && streak >= 3 && streak % 3 === 0 && B.battle.onStreak) line = pick(B.battle.onStreak);
        else if (!r.correct && state.lives === 1 && B.battle.onLastLife) line = pick(B.battle.onLastLife);
        else line = r.correct ? pick(B.battle.onCorrect) : r.timedOut ? pick(B.battle.onTimeout) : pick(B.battle.onWrong);
        line = fill(line, progress.username);
        showSpeech(r.healed ? `${line} (+${r.healed} HP)` : line, r.phaseChanged ? 6000 : 3500);
        if (r.phaseChanged) fbLine.append(el('div', { class: 'muted', style: 'margin-top:6px' }, `⚡ Fase 2: ${(world.boss && world.boss.config && world.boss.config.phase2TimeLimitSec) || 18} secondi per domanda, e ogni errore fa recuperare HP al Prof.`));
        await waitContinue();
        nextQuestion();
      }
    }

    function waitContinue() {
      return new Promise((resolve) => {
        const btn = el('button', { class: 'btn primary', style: 'margin-top:10px' }, 'Prossima domanda ▶');
        fbLine.append(el('div', { style: 'text-align:right' }, btn));
        const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(); } };
        const done = () => { window.removeEventListener('keydown', onKey); resolve(); };
        btn.addEventListener('click', done);
        setTimeout(() => window.addEventListener('keydown', onKey), 300);
        btn.focus({ preventScroll: true });
      });
    }

    async function finish(r) {
      const name = progress.username;
      if (state.won) {
        arena?.faint('boss');
        sfx.win();
        music.stop();
        for (const l of B.battle.win) await talk(fill(l, name), 2600);
        showGrade(r.final);
      } else {
        sfx.lose();
        music.stop();
        arena?.faint('player');
        for (const l of B.battle.lose) await talk(fill(l, name), 2600);
        showLose();
      }
    }

    function card(...children) {
      root.querySelector('.textbox').style.visibility = 'hidden';
      const box = el('div', { class: 'panel', style: 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,92%);text-align:center;z-index:5' }, ...children);
      root.append(box);
      return box;
    }

    function showGrade(final) {
      const back = el('button', { class: 'btn primary', onclick: end }, 'Torna in città ▶');
      card(
        el('h2', {}, '🎓 Hai convinto il Prof. Palomba!'),
        el('p', {}, 'Voto dello scontro finale: ', el('b', {}, '30/30')),
        el('p', {}, 'Media dei quiz negli edifici: ', el('b', {}, `${fmt(final.quizAvg30)}/30`)),
        el('div', { class: 'score-big', style: 'margin:10px 0' }, `${fmt(final.grade)}/30`),
        el('p', { class: 'muted' }, `Voto finale = (30 + ${fmt(final.quizAvg30)}) / 2${final.first ? '' : ' · (voto già registrato in precedenza)'}`),
        back);
      back.focus();
    }

    function showLose() {
      const back = el('button', { class: 'btn primary', onclick: end }, 'Torna in città ▶');
      card(
        el('h2', {}, 'Sconfitta...'),
        el('p', {}, `Risposte corrette: ${state.correct} · errori: ${state.wrong}`),
        el('p', { class: 'muted' }, 'Puoi ritentare lo scontro quando vuoi. Ripassa negli edifici, con il tuo compagno e sui tuoi appunti!'),
        back);
      back.focus();
    }

    function end() {
      cancelAnimationFrame(raf);
      offKeys();
      stage.close();
      music.play('city');
      if (onClose) onClose();
      resolveBattle();
    }

    nextQuestion();
  });
}
