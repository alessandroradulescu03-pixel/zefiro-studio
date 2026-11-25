/**
 * Accesso con Supabase Auth, senza librerie: poche chiamate fetch.
 * La sessione resta nel browser (localStorage) e si rinnova da sola.
 * All'avvio il token viene verificato con Supabase (non basta la copia locale),
 * e i dati del CRM sono comunque protetti lato server dalla Row Level Security.
 */
import { AUTH } from '../config/auth.js';

const STORE = 'zefiro.auth.v1';
const base = () => AUTH.url.replace(/\/+$/, '') + '/auth/v1';

export const authConfigured = () => Boolean(AUTH.url && AUTH.key);

function readSession() {
  try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; }
}
function writeSession(s) {
  try { s ? localStorage.setItem(STORE, JSON.stringify(s)) : localStorage.removeItem(STORE); } catch { /* storage non disponibile */ }
}

const isAllowed = (email) => AUTH.allowed.map((e) => e.toLowerCase()).includes(String(email || '').toLowerCase());

function toSession(data) {
  const expiresAt = data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
  return { access: data.access_token, refresh: data.refresh_token, expiresAt, email: data.user?.email || '' };
}

class NetworkError extends Error {}

async function tokenRequest(grant, body) {
  let res;
  try {
    res = await fetch(`${base()}/token?grant_type=${grant}`, {
      method: 'POST',
      headers: { apikey: AUTH.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new NetworkError('Non riesco a collegarmi. Controlla la connessione e riprova.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = String(data.error_description || data.msg || data.message || data.error || '');
    if (/invalid.*(credentials|grant)|invalid login/i.test(msg)) throw new Error('Email o password non corretti.');
    if (/not confirmed/i.test(msg)) throw new Error('Questo utente non è ancora confermato: in Supabase crealo con "Auto Confirm User".');
    if (/rate|too many/i.test(msg)) throw new Error('Troppi tentativi. Aspetta un minuto e riprova.');
    if (res.status === 401 || /api key/i.test(msg)) throw new Error('Chiave del progetto non valida: controlla js/config/auth.js.');
    throw new Error('Accesso non riuscito. Riprova tra poco.');
  }
  return toSession(data);
}

let refreshing = null;   // un solo rinnovo alla volta, anche con più richieste in parallelo

async function refreshSession(s) {
  if (!refreshing) {
    refreshing = tokenRequest('refresh_token', { refresh_token: s.refresh })
      .then((fresh) => { writeSession(fresh); return fresh; })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

/**
 * Sessione valida (rinnovata se sta per scadere) oppure null.
 * Senza rete la sessione NON viene cancellata: si riprova al prossimo accesso.
 */
export async function getSession({ force = false } = {}) {
  const s = readSession();
  if (!s || !s.refresh || !isAllowed(s.email)) return null;
  if (!force && s.expiresAt - 60 > Date.now() / 1000) return s;
  try {
    return await refreshSession(s);
  } catch (err) {
    if (err instanceof NetworkError) return s;
    writeSession(null);
    return null;
  }
}

/** Token da usare nelle chiamate al database (rinnovato se serve). */
export async function getAccessToken({ force = false } = {}) {
  const s = await getSession({ force });
  return s?.access || null;
}

/** Email dell'utente collegato. */
export const currentEmail = () => readSession()?.email || '';

/**
 * Controlla con Supabase che il token sia autentico e appartenga a un utente
 * abilitato. Una sessione inventata o revocata viene scartata.
 */
async function verifyWithServer(s) {
  const check = (token) => fetch(`${base()}/user`, { headers: { apikey: AUTH.key, Authorization: `Bearer ${token}` } });
  let res;
  try { res = await check(s.access); } catch { return s; } // offline: si entra, i dati arriveranno quando torna la rete
  if (res.status === 401 || res.status === 403) {
    const fresh = await getSession({ force: true });
    if (!fresh || fresh === s) return null;
    try { res = await check(fresh.access); } catch { return fresh; }
    if (!res.ok) return null;
    s = fresh;
  }
  if (!res.ok) return s; // errore temporaneo del server: non blocchiamo l'accesso
  const user = await res.json().catch(() => null);
  return user && isAllowed(user.email) ? s : null;
}

/** Sessione scaduta mentre l'app è aperta: si torna al login. */
export function sessionExpired() {
  writeSession(null);
  location.reload();
}

export async function signIn(email, password) {
  if (!isAllowed(email)) throw new Error('Questa email non è abilitata al gestionale.');
  const s = await tokenRequest('password', { email: email.trim(), password });
  if (!isAllowed(s.email)) throw new Error('Questa email non è abilitata al gestionale.');
  writeSession(s);
  return s;
}

export async function signOut() {
  const s = readSession();
  writeSession(null);
  if (s?.access) {
    fetch(`${base()}/logout`, { method: 'POST', headers: { apikey: AUTH.key, Authorization: `Bearer ${s.access}` } }).catch(() => {});
  }
}

/* -------- Schermata di accesso -------- */

/** Risolve quando l'utente è dentro. Finché non entra, il gestionale non parte. */
export function requireLogin() {
  return new Promise(async (resolve) => {
    if (!authConfigured()) { showGate({ setup: true }); return; }
    let s = await getSession();
    if (s) s = await verifyWithServer(s);
    if (s) { resolve(s); return; }
    writeSession(null);
    showGate({ onDone: resolve });
  });
}

function showGate({ setup = false, onDone } = {}) {
  const gate = document.createElement('div');
  gate.className = 'auth-gate';
  gate.innerHTML = `
    <form class="auth-card" novalidate>
      <img class="auth-card__logo" src="assets/img/brand/zefiro-logo-scuro.svg" alt="ZEFIRO Digital Studio" width="168" height="40">
      <h1 class="auth-card__title">Studio Manager</h1>
      ${setup
        ? `<p class="auth-card__text">L'accesso non è ancora configurato. Apri <b>js/config/auth.js</b> e inserisci la chiave <b>publishable</b> del progetto Supabase, poi ricarica la pagina.</p>`
        : `<p class="auth-card__text">Accedi per continuare.</p>
           <label class="field"><span class="field__label">Email</span>
             <input class="input" type="email" name="email" autocomplete="username" required></label>
           <label class="field"><span class="field__label">Password</span>
             <input class="input" type="password" name="password" autocomplete="current-password" required></label>
           <p class="auth-card__error" role="alert" hidden></p>
           <button class="btn btn--primary auth-card__btn" type="submit">Entra</button>`}
    </form>`;
  document.body.appendChild(gate);
  document.documentElement.classList.add('is-locked');
  if (setup) return;

  const form = gate.querySelector('form');
  const err = gate.querySelector('.auth-card__error');
  const btn = gate.querySelector('button[type="submit"]');
  form.email.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!form.email.value || !form.password.value) { err.textContent = 'Inserisci email e password.'; err.hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Accesso…';
    try {
      const s = await signIn(form.email.value, form.password.value);
      gate.remove();
      document.documentElement.classList.remove('is-locked');
      onDone(s);
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      btn.disabled = false; btn.textContent = 'Entra';
      form.password.value = ''; form.password.focus();
    }
  });
}
