// Client delle API del gioco. Due modalità:
// - server Node (npm start): API JSON sotto /api;
// - sito statico (GitHub Pages): i dati vanno alla web app Google Apps Script indicata in config.js.
import { API_URL } from './config.js';

const TOKEN_KEY = 'fiacity.token';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* storage non disponibile */ }
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function call(method, path, body, opts = {}) {
  const token = getToken();
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    keepalive: !!opts.keepalive
  });
  let data = null;
  try { data = await res.json(); } catch { /* risposta vuota */ }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || `Errore ${res.status}`);
  return data;
}

// Apps Script risponde sempre 200: l'esito è nel corpo ({ ok, data } oppure { ok: false, status, error }).
// Il corpo è text/plain per evitare la richiesta preliminare CORS, che Apps Script non gestisce.
async function gas(action, body = {}, opts = {}) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: getToken(), ...body }),
      keepalive: !!opts.keepalive
    });
  } catch {
    throw new ApiError(0, 'Connessione non riuscita: controlla la rete e riprova.');
  }
  let out = null;
  try { out = await res.json(); } catch { /* risposta non valida */ }
  if (!out) throw new ApiError(res.status || 500, 'Il server di Google non ha risposto correttamente. Riprova tra poco.');
  if (!out.ok) throw new ApiError(out.status || 500, out.error || 'Errore');
  return out.data;
}

const node = {
  login: (username) => call('POST', '/api/login', { username }),
  logout: () => call('POST', '/api/logout'),
  me: () => call('GET', '/api/me'),
  world: () => call('GET', '/api/world'),
  saveState: (state, keepalive) => call('POST', '/api/state', { state }, { keepalive }),
  startAttempt: (buildingId) => call('POST', '/api/attempts', { buildingId }),
  answer: (attemptId, itemId, response) => call('POST', `/api/attempts/${attemptId}/answer`, { itemId, response }),
  bossDialog: (readSlides, hasDoubts) => call('POST', '/api/boss/dialog', { readSlides, hasDoubts }),
  bossStart: () => call('POST', '/api/boss/start'),
  bossNext: () => call('POST', '/api/boss/next'),
  bossAnswer: (optionId) => call('POST', '/api/boss/answer', { optionId })
};

const sheet = {
  login: (username) => gas('login', { username }),
  logout: () => gas('logout'),
  me: () => gas('me'),
  // Il mondo (mappa, testi, ex-studenti) è un file statico generato con il sito: non contiene soluzioni.
  world: async () => {
    const r = await fetch('world.json');
    if (!r.ok) throw new ApiError(r.status, 'Impossibile caricare la città');
    return r.json();
  },
  saveState: (state, keepalive) => gas('state', { state }, { keepalive }),
  startAttempt: (buildingId) => gas('startAttempt', { buildingId }),
  answer: (attemptId, itemId, response) => gas('answer', { attemptId, itemId, response }),
  bossDialog: (readSlides, hasDoubts) => gas('bossDialog', { readSlides, hasDoubts }),
  bossStart: () => gas('bossStart'),
  bossNext: () => gas('bossNext'),
  bossAnswer: (optionId) => gas('bossAnswer', { optionId })
};

const backend = API_URL ? sheet : node;

export const api = {
  ...backend,
  hasToken: () => !!getToken(),
  // Con il foglio Google ogni salvataggio costa una chiamata lenta: la posizione si salva meno spesso.
  saveEveryMs: API_URL ? 30000 : 3000,
  async login(username) {
    const r = await backend.login(username);
    setToken(r.token);
    return r;
  },
  async logout() {
    try { await backend.logout(); } catch { /* ignora */ }
    setToken('');
  },
  clearToken: () => setToken('')
};
