// Box di dialogo stile RPG, scelte multiple, toast e schermate a tutto schermo.
import { sfx } from './audio.js';
import { gx } from './profile.js';

const $ = (sel) => document.querySelector(sel);
const dlg = $('#dialog');
const dlgText = dlg.querySelector('.text');
const dlgName = dlg.querySelector('.name');
const dlgNext = dlg.querySelector('.next');
const dlgChoices = dlg.querySelector('.choices');
const screenEl = $('#screen');
const screenWrap = screenEl.querySelector('.wrap');

let dialogActive = false;
let screenActive = false;

export const isBusy = () => dialogActive || screenActive || !$('#boss').classList.contains('hidden');

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) e.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function typeLine(text) {
  return new Promise((resolve) => {
    dlgText.textContent = '';
    dlgNext.classList.add('hidden');
    let i = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      dlgText.textContent = text;
      dlgNext.classList.remove('hidden');
      resolve();
    };
    const timer = setInterval(() => {
      i += 2;
      dlgText.textContent = text.slice(0, i);
      if (i % 6 === 0) sfx.blip();
      if (i >= text.length) finish();
    }, 22);
    typeLine.skip = finish;
  });
}

function waitAdvance() {
  return new Promise((resolve) => {
    const onKey = (e) => {
      if ([' ', 'Enter', 'z', 'Z', 'Escape'].includes(e.key)) { e.preventDefault(); cleanup(); resolve(); }
    };
    const onClick = () => { cleanup(); resolve(); };
    const cleanup = () => { window.removeEventListener('keydown', onKey, true); dlg.removeEventListener('pointerup', onClick); document.removeEventListener('fiacity-a', onClick); };
    setTimeout(() => {
      window.addEventListener('keydown', onKey, true);
      dlg.addEventListener('pointerup', onClick);
      document.addEventListener('fiacity-a', onClick);
    }, 60);
  });
}

function waitSkipOrEnd(typing) {
  // durante la digitazione, un tasto mostra subito tutta la riga
  return new Promise((resolve) => {
    const onKey = (e) => { if ([' ', 'Enter', 'z', 'Z'].includes(e.key)) { e.preventDefault(); typeLine.skip && typeLine.skip(); } };
    const onClick = () => typeLine.skip && typeLine.skip();
    window.addEventListener('keydown', onKey, true);
    dlg.addEventListener('pointerup', onClick);
    document.addEventListener('fiacity-a', onClick);
    typing.then(() => {
      window.removeEventListener('keydown', onKey, true);
      dlg.removeEventListener('pointerup', onClick);
      document.removeEventListener('fiacity-a', onClick);
      resolve();
    });
  });
}

function showDialog(name) {
  dialogActive = true;
  dlg.classList.remove('hidden');
  dlgChoices.innerHTML = '';
  if (name) { dlgName.textContent = name; dlgName.classList.remove('hidden'); } else dlgName.classList.add('hidden');
}
function hideDialog() {
  dialogActive = false;
  dlg.classList.add('hidden');
  dlgChoices.innerHTML = '';
}

export async function say(lines, opts = {}) {
  const arr = Array.isArray(lines) ? lines : [lines];
  showDialog(opts.name);
  for (const line of arr) {
    await waitSkipOrEnd(typeLine(gx(line)));
    await waitAdvance();
    sfx.select();
  }
  if (!opts.keepOpen) hideDialog();
}

export async function ask(text, choices, opts = {}) {
  showDialog(opts.name);
  await waitSkipOrEnd(typeLine(gx(text)));
  dlgNext.classList.add('hidden');
  return new Promise((resolve) => {
    let sel = 0;
    const btns = choices.map((c, i) => el('button', { class: 'btn', onclick: () => pick(i) }, gx(c)));
    dlgChoices.append(...btns);
    const focus = () => btns.forEach((b, i) => b.classList.toggle('selected', i === sel));
    focus();
    const onKey = (e) => {
      if (e.key === 'ArrowDown' || e.key === 's') { sel = (sel + 1) % btns.length; focus(); sfx.blip(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 'w') { sel = (sel - 1 + btns.length) % btns.length; focus(); sfx.blip(); e.preventDefault(); }
      else if ([' ', 'Enter', 'z', 'Z'].includes(e.key)) { e.preventDefault(); pick(sel); }
    };
    const onA = () => pick(sel);
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('fiacity-a', onA);
    function pick(i) {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fiacity-a', onA);
      sfx.select();
      if (!opts.keepOpen) hideDialog(); else dlgChoices.innerHTML = '';
      resolve(i);
    }
  });
}

let toastTimer = null;
export function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.querySelector('.panel').textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

export const screen = {
  open(...nodes) {
    screenActive = true;
    screenWrap.innerHTML = '';
    screenWrap.append(...nodes);
    screenEl.classList.remove('hidden');
    screenEl.scrollTop = 0;
  },
  replace(...nodes) {
    screenWrap.innerHTML = '';
    screenWrap.append(...nodes);
    screenEl.scrollTop = 0;
  },
  close() {
    screenActive = false;
    screenEl.classList.add('hidden');
    screenWrap.innerHTML = '';
  },
  get wrap() { return screenWrap; },
  get active() { return screenActive; }
};
