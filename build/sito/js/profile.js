// Profilo del giocatore: identità, forma con cui rivolgersi, avatar e compagno di studio.
// L'identità serve solo a personalizzare il gioco: non compare nella dashboard del docente.

export const IDENTITIES = [
  { id: 'donna', label: 'Donna', form: 'f' },
  { id: 'uomo', label: 'Uomo', form: 'm' },
  { id: 'nonbinaria', label: 'Persona non binaria', form: 'n' },
  { id: 'fluid', label: 'Genderfluid', form: 'n' },
  { id: 'altro', label: 'Mi descrivo così…', form: 'n' },
  { id: 'nd', label: 'Preferisco non dirlo', form: 'n' }
];

export const FORMS = [
  { id: 'f', label: 'Al femminile', example: 'Benvenuta!' },
  { id: 'm', label: 'Al maschile', example: 'Benvenuto!' },
  { id: 'n', label: 'In forma neutra', example: 'Benvenutə!' }
];

export const SKINS = ['#ffdbc4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
export const HAIRS = [
  { id: 'corti', label: 'Corti' }, { id: 'lunghi', label: 'Lunghi' }, { id: 'coda', label: 'Coda' },
  { id: 'chignon', label: 'Chignon' }, { id: 'ricci', label: 'Ricci' }, { id: 'rasati', label: 'Rasati' }
];
export const HAIR_COLORS = ['#111111', '#3b2a1a', '#7b4a2a', '#d9822b', '#e8c07d', '#dcdcdc', '#7b3f9e', '#4dabf7', '#e64980', '#2f9e44'];
export const CLOTH_COLORS = ['#e4572e', '#2e86ab', '#2f9e44', '#f2c14e', '#7b3f9e', '#e64980', '#212529', '#f1ede1', '#12b886', '#364fc7'];
export const BOTTOMS = [{ id: 'pantaloni', label: 'Pantaloni' }, { id: 'gonna', label: 'Gonna' }, { id: 'pantaloncini', label: 'Pantaloncini' }];
export const ACCESSORIES = [
  { id: 'nessuno', label: 'Nessuno' }, { id: 'occhiali', label: 'Occhiali' }, { id: 'berretto', label: 'Berretto' },
  { id: 'cuffie', label: 'Cuffie' }, { id: 'fiocco', label: 'Fiocco' }
];

export const SPECIES = [
  { id: 'robot', label: 'Robottino', name: 'Bit', color: '#4dabf7',
    blurb: 'Un piccolo robot che fluttua. Preciso, un po\' pignolo, adora le definizioni esatte.',
    voice: { hello: 'Bip bip! Sistemi pronti.', happy: 'Bip! Risposta memorizzata con successo.', idle: 'Bzz... sto ricalcolando la mia funzione di utilità.' } },
  { id: 'gufo', label: 'Gufetto', name: 'Minerva', color: '#a9744f',
    blurb: 'Un gufo saggio e curioso. Ama le domande più delle risposte.',
    voice: { hello: 'Uh-uh! Eccomi qui.', happy: 'Uh-uh! Che bella risposta.', idle: 'Uh-uh... di notte ripasso meglio.' } },
  { id: 'drago', label: 'Draghetto', name: 'Darty', color: '#51cf66',
    blurb: 'Un draghetto pieno di energia, chiamato come la conferenza di Dartmouth.',
    voice: { hello: 'Grrr! Pronto a sputare fuoco... sui dubbi!', happy: 'Fiammata di gioia!', idle: 'Ho fame. Di conoscenza, ovviamente.' } }
];
export const PET_COLORS = ['#4dabf7', '#51cf66', '#ff922b', '#f06595', '#ffd43b', '#9775fa', '#a9744f', '#dee2e6'];

export function defaultProfile() {
  return {
    identity: 'nd', identityText: '', form: 'n',
    avatar: { skin: SKINS[1], hair: 'corti', hairColor: HAIR_COLORS[1], top: CLOTH_COLORS[1], bottom: 'pantaloni', bottomColor: CLOTH_COLORS[6], acc: 'nessuno' },
    pet: { species: 'robot', name: 'Bit', color: SPECIES[0].color }
  };
}

export function randomAvatar() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return {
    skin: pick(SKINS), hair: pick(HAIRS).id, hairColor: pick(HAIR_COLORS), top: pick(CLOTH_COLORS),
    bottom: pick(BOTTOMS).id, bottomColor: pick(CLOTH_COLORS), acc: pick(ACCESSORIES).id
  };
}

export const speciesOf = (pet) => SPECIES.find((s) => s.id === (pet && pet.species)) || SPECIES[0];

// Contesto per i testi: forma grammaticale, username e nome del compagno.
const ctx = { form: 'n', name: '', pet: '' };
export function setTextContext(c) { Object.assign(ctx, c); }

// "Benvenut{o|a|ə}" -> declinato secondo la forma scelta; {nome} e {pet} sostituiti.
export function gx(text) {
  if (typeof text !== 'string') return text;
  const idx = { m: 0, f: 1, n: 2 }[ctx.form] ?? 2;
  return text
    .replace(/\{([^{}|]*)\|([^{}|]*)\|([^{}|]*)\}/g, (_, m, f, n) => [m, f, n][idx])
    .replace(/\{nome\}/g, ctx.name)
    .replace(/\{pet\}/g, ctx.pet);
}

// Converte l'avatar 3D nel "look" usato dagli sprite 2D (battaglia col boss, ritratti).
export function lookFromAvatar(a) {
  return {
    skin: a.skin, hair: a.hairColor, shirt: a.top,
    pants: a.bottom === 'pantaloni' ? a.bottomColor : a.skin,
    long: a.hair === 'lunghi' || a.hair === 'coda',
    bun: a.hair === 'chignon',
    glasses: a.acc === 'occhiali',
    cap: a.acc === 'berretto' ? a.top : undefined
  };
}
