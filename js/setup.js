// Creazione del personaggio: identità (non binaria), aspetto dell'avatar e compagno di studio.
import { screen, el } from './ui.js';
import { sfx } from './audio.js';
import { createPreview } from './scene3d.js';
import {
  IDENTITIES, FORMS, SKINS, HAIRS, HAIR_COLORS, CLOTH_COLORS, BOTTOMS, ACCESSORIES, SPECIES, PET_COLORS,
  defaultProfile, randomAvatar, speciesOf
} from './profile.js';

const clone = (o) => JSON.parse(JSON.stringify(o));

export function runSetup(current, { first = true } = {}) {
  return new Promise((resolve) => {
    const p = clone(current || defaultProfile());
    let step = 0;
    let preview = null;

    const canvas = el('canvas', { width: 320, height: 380, class: 'preview3d', 'aria-label': 'Anteprima del personaggio' });
    const body = el('div', { class: 'setup-body' });
    const tabs = el('div', { class: 'setup-tabs' });
    const nav = el('div', { class: 'row', style: 'margin-top:14px' });
    const refresh = () => preview && preview.set(p.avatar, p.pet);

    const swatches = (list, value, onPick, labelOf) => el('div', { class: 'swatches' }, list.map((c) => {
      const b = el('button', {
        class: 'swatch' + (c === value ? ' on' : ''), style: `background:${c}`, title: labelOf ? labelOf(c) : c, 'aria-label': labelOf ? labelOf(c) : c,
        onclick: () => { onPick(c); sfx.blip(); render(); }
      });
      return b;
    }));
    const pills = (list, value, onPick) => el('div', { class: 'pills' }, list.map((o) => el('button', {
      class: 'btn small' + (o.id === value ? ' selected' : ''),
      onclick: () => { onPick(o.id); sfx.blip(); render(); }
    }, o.label)));
    const field = (label, ...ctl) => el('div', { class: 'field' }, el('div', { class: 'flabel' }, label), ...ctl);

    function stepIdentity() {
      const other = p.identity === 'altro'
        ? el('input', { maxlength: 30, placeholder: 'come ti descrivi (facoltativo)', value: p.identityText || '', oninput: (e) => { p.identityText = e.target.value; } })
        : null;
      return [
        el('h2', {}, 'Chi sei?'),
        el('p', { class: 'muted' }, 'Scegli liberamente, anche «preferisco non dirlo». Serve solo a personalizzare il gioco: non compare nel registro del docente e puoi cambiarlo quando vuoi dallo Zaino.'),
        field('Identità di genere', pills(IDENTITIES, p.identity, (id) => {
          p.identity = id;
          const def = IDENTITIES.find((x) => x.id === id);
          if (def && !p.formTouched) p.form = def.form;
        }), other),
        field('Come vuoi che si rivolgano a te i personaggi?', el('div', { class: 'pills' }, FORMS.map((f) => el('button', {
          class: 'btn small' + (f.id === p.form ? ' selected' : ''),
          onclick: () => { p.form = f.id; p.formTouched = true; sfx.blip(); render(); }
        }, `${f.label} · «${f.example}»`))))
      ];
    }

    function stepLook() {
      const a = p.avatar;
      return [
        el('h2', {}, 'Il tuo aspetto'),
        el('p', { class: 'muted' }, 'Ogni combinazione è disponibile per chiunque.'),
        field('Carnagione', swatches(SKINS, a.skin, (c) => { a.skin = c; })),
        field('Capelli', pills(HAIRS, a.hair, (id) => { a.hair = id; })),
        field('Colore dei capelli', swatches(HAIR_COLORS, a.hairColor, (c) => { a.hairColor = c; })),
        field('Maglia', swatches(CLOTH_COLORS, a.top, (c) => { a.top = c; })),
        field('Sotto', pills(BOTTOMS, a.bottom, (id) => { a.bottom = id; }), swatches(CLOTH_COLORS, a.bottomColor, (c) => { a.bottomColor = c; })),
        field('Accessorio', pills(ACCESSORIES, a.acc, (id) => { a.acc = id; })),
        el('button', { class: 'btn small', onclick: () => { p.avatar = randomAvatar(); sfx.select(); render(); } }, '🎲 Casuale')
      ];
    }

    function stepPet() {
      const sp = speciesOf(p.pet);
      const name = el('input', {
        maxlength: 14, value: p.pet.name, 'aria-label': 'Nome del compagno',
        oninput: (e) => { p.pet.name = e.target.value.replace(/[<>]/g, ''); }
      });
      return [
        el('h2', {}, 'Il tuo compagno di studio'),
        el('p', { class: 'muted' }, 'Ti seguirà ovunque e ti aiuterà a ripassare con schede e domande. Premi C (o il tasto 🐾) per parlarci.'),
        el('div', { class: 'species' }, SPECIES.map((s) => el('button', {
          class: 'species-card' + (s.id === sp.id ? ' on' : ''),
          onclick: () => {
            const wasDefault = !p.pet.name || SPECIES.some((x) => x.name === p.pet.name);
            p.pet.species = s.id;
            if (wasDefault) p.pet.name = s.name;
            if (PET_COLORS.indexOf(p.pet.color) < 0 || SPECIES.some((x) => x.color === p.pet.color)) p.pet.color = s.color;
            sfx.blip(); render();
          }
        }, el('b', {}, s.label), el('div', { class: 'muted' }, s.blurb)))),
        field('Colore', swatches(PET_COLORS, p.pet.color, (c) => { p.pet.color = c; })),
        field('Nome', name)
      ];
    }

    const STEPS = [['1 · Chi sei', stepIdentity], ['2 · Aspetto', stepLook], ['3 · Compagno', stepPet]];

    function finish() {
      if (!p.pet.name.trim()) p.pet.name = speciesOf(p.pet).name;
      p.pet.name = p.pet.name.trim();
      delete p.formTouched;
      if (preview) preview.dispose();
      screen.close();
      sfx.badge();
      resolve(p);
    }

    function render() {
      tabs.innerHTML = '';
      STEPS.forEach(([label], i) => tabs.append(el('button', { class: 'tab' + (i === step ? ' on' : ''), onclick: () => { step = i; render(); } }, label)));
      body.innerHTML = '';
      body.append(...STEPS[step][1]());
      nav.innerHTML = '';
      if (step > 0) nav.append(el('button', { class: 'btn', onclick: () => { step--; render(); } }, '◀ Indietro'));
      if (!first) nav.append(el('button', { class: 'btn', onclick: () => { if (preview) preview.dispose(); screen.close(); resolve(null); } }, 'Annulla'));
      nav.append(el('div', { class: 'spacer' }));
      if (step < STEPS.length - 1) nav.append(el('button', { class: 'btn primary', onclick: () => { step++; sfx.select(); render(); } }, 'Avanti ▶'));
      else nav.append(el('button', { class: 'btn primary', id: 'setup-done', onclick: finish }, first ? '▶ Inizia l\'avventura!' : '✔ Salva'));
      refresh();
    }

    screen.open(el('div', { class: 'panel setup' },
      el('h1', {}, first ? 'Crea il tuo personaggio' : 'Modifica personaggio'),
      tabs,
      el('div', { class: 'setup-grid' }, el('div', { class: 'preview-wrap' }, canvas), el('div', {}, body)),
      nav));
    try { preview = createPreview(canvas); } catch { preview = null; }
    render();
  });
}
