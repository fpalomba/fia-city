// Effetti sonori e musichette chiptune generati al volo con WebAudio (nessun file audio esterno).
let ctx = null;
let master = null;
let muted = false;
let musicTimer = null;
let musicName = null;

try { muted = localStorage.getItem('fiacity.muted') === '1'; } catch { /* ignora */ }

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.18;
  master.connect(ctx.destination);
  return ctx;
}

function tone(freq, start, dur, type = 'square', vol = 1) {
  const c = ensure();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(master);
  o.start(start);
  o.stop(start + dur + 0.02);
}

const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // nota MIDI -> Hz

function seq(notes, step = 0.09, type = 'square', vol = 0.7) {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  let t = c.currentTime + 0.02;
  for (const n of notes) {
    if (n !== null) tone(N(n), t, step * 0.95, type, vol);
    t += step;
  }
}

export const sfx = {
  unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); },
  blip() { seq([84], 0.03, 'square', 0.25); },
  select() { seq([76, 83], 0.05); },
  bump() { seq([40], 0.08, 'triangle', 0.6); },
  door() { seq([60, 64, 67], 0.06, 'triangle'); },
  correct() { seq([72, 76, 79, 84], 0.07); },
  partial() { seq([72, 74, 76], 0.08, 'triangle'); },
  wrong() { seq([55, 50], 0.14, 'sawtooth', 0.5); },
  badge() { seq([72, 72, 72, 76, null, 74, 77, 79, null, 84, 84], 0.11); },
  hit() { seq([90, 70, 50], 0.04, 'sawtooth', 0.6); },
  win() { seq([67, 72, 76, 79, null, 76, 79, 84, 84, 84], 0.13); },
  lose() { seq([67, 63, 60, 55, 48], 0.18, 'triangle'); }
};

const SONGS = {
  city: { step: 0.2, type: 'triangle', vol: 0.35, notes: [60, 64, 67, 72, 67, 64, 62, 65, 69, 74, 69, 65, 64, 67, 71, 76, 71, 67, 65, 64, 62, 59, 62, 55] },
  boss: { step: 0.12, type: 'square', vol: 0.3, notes: [45, 57, 45, 57, 48, 60, 47, 59, 45, 57, 45, 57, 52, 64, 51, 63, 45, 57, 45, 57, 48, 60, 50, 62, 53, 65, 52, 64, 51, 63, 50, 62] }
};

export const music = {
  play(name) {
    if (musicName === name) return;
    this.stop();
    musicName = name;
    const song = SONGS[name];
    if (!song) return;
    const loop = () => { if (!muted) seq(song.notes, song.step, song.type, song.vol); };
    loop();
    musicTimer = setInterval(loop, song.notes.length * song.step * 1000);
  },
  stop() { clearInterval(musicTimer); musicTimer = null; musicName = null; },
  current: () => musicName
};

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('fiacity.muted', muted ? '1' : '0'); } catch { /* ignora */ }
  if (master) master.gain.value = muted ? 0 : 0.18;
  return muted;
}
export const isMuted = () => muted;
