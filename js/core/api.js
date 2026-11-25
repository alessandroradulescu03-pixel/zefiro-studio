/**
 * Accesso ai dati del CRM su Supabase (API REST di PostgREST), senza librerie.
 * ------------------------------------------------------------------------
 * Ogni chiamata porta il token dell'utente collegato: è la Row Level Security
 * del database a decidere cosa si può leggere e scrivere.
 *
 *   const clienti = await list('clients', { select: '*', order: 'name.asc', status: 'eq.attivo' });
 *   const c = await insert('clients', { name: 'Rossi Srl' });
 *   await update('clients', c.id, { phone: '035…' });
 *   await remove('clients', c.id);
 */

import { AUTH } from '../config/auth.js';
import { getAccessToken, sessionExpired } from './auth.js';

const rest = () => AUTH.url.replace(/\/+$/, '') + '/rest/v1';

/* ---------------- Notifica modifiche ---------------- */

const bus = new EventTarget();

/** Avvisa a ogni scrittura (la dashboard e le liste si aggiornano da sole). */
export function onDataChange(fn) {
  const handler = (event) => fn(event.detail);
  bus.addEventListener('change', handler);
  return () => bus.removeEventListener('change', handler);
}
const emit = (table, type, id) => bus.dispatchEvent(new CustomEvent('change', { detail: { table, type, id } }));

/* ---------------- Errori leggibili ---------------- */

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function translate(status, body) {
  const code = body?.code || '';
  const msg = `${body?.message || ''} ${body?.details || ''}`;
  if (code === '23503') {
    return /is still referenced/i.test(msg)
      ? 'Non si può eliminare: ci sono altri elementi collegati (es. progetti di questo cliente). Archivialo invece di eliminarlo.'
      : 'L\'elemento collegato non esiste più. Ricarica la pagina e riprova.';
  }
  if (code === '23514') return 'Uno dei valori non è valido: controlla i campi del modulo.';
  if (code === '23505') return 'Esiste già un elemento identico.';
  if (code === '22P02' || code === '22007' || code === '22008') return 'Un campo contiene un valore nel formato sbagliato (es. una data).';
  if (code === '42501' || /row-level security/i.test(msg)) return 'Operazione non consentita per il tuo utente.';
  if (code === 'PGRST205' || code === '42P01') return 'Il database non è aggiornato: manca una tabella. Esegui supabase/crm-schema.sql.';
  if (status === 404) return 'Elemento non trovato: potrebbe essere stato eliminato.';
  if (status >= 500) return 'Il server di Supabase non risponde correttamente. Riprova tra poco.';
  return 'Operazione non riuscita. Riprova.';
}

/* ---------------- Richiesta base ---------------- */

/**
 * @param {string} method
 * @param {string} path  es. "clients"
 * @param {{ query?: Record<string,string>, body?: any, prefer?: string, retry?: boolean }} [opts]
 */
async function request(method, path, { query = {}, body, prefer, retry = true } = {}) {
  const token = await getAccessToken();
  if (!token) { sessionExpired(); throw new ApiError('Sessione scaduta: effettua di nuovo l\'accesso.', { status: 401 }); }

  const url = new URL(`${rest()}/${path}`);
  Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v); });

  const headers = { apikey: AUTH.key, Authorization: `Bearer ${token}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('Connessione assente: i dati non sono stati salvati. Controlla la rete e riprova.', { status: 0 });
  }

  // token scaduto o revocato: un tentativo di rinnovo, poi si torna al login
  if (res.status === 401 && retry) {
    const fresh = await getAccessToken({ force: true });
    if (fresh) return request(method, path, { query, body, prefer, retry: false });
    sessionExpired();
  }

  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    console.error('[api]', method, path, res.status, data);
    throw new ApiError(translate(res.status, data), { status: res.status, code: data?.code, details: data });
  }
  return { data, headers: res.headers };
}

/* ---------------- CRUD ---------------- */

/** Elenco con filtri PostgREST (es. { status: 'eq.attivo', order: 'name.asc' }). */
export async function list(table, query = {}) {
  const { data } = await request('GET', table, { query: { select: '*', ...query } });
  return Array.isArray(data) ? data : [];
}

/** Un singolo elemento per id, oppure null. */
export async function getOne(table, id, select = '*') {
  const rows = await list(table, { select, id: `eq.${id}`, limit: '1' });
  return rows[0] || null;
}

/** Numero di righe che rispettano i filtri. */
export async function count(table, query = {}) {
  const { headers } = await request('GET', table, { query: { select: 'id', limit: '1', ...query }, prefer: 'count=exact' });
  const range = headers.get('content-range') || '';
  const total = Number(range.split('/')[1]);
  return Number.isFinite(total) ? total : 0;
}

export async function insert(table, row) {
  const { data } = await request('POST', table, { body: clean(row), prefer: 'return=representation' });
  const saved = Array.isArray(data) ? data[0] : data;
  emit(table, 'insert', saved?.id);
  return saved;
}

export async function update(table, id, patch) {
  const { data } = await request('PATCH', table, { query: { id: `eq.${id}` }, body: clean(patch), prefer: 'return=representation' });
  const saved = Array.isArray(data) ? data[0] : data;
  if (!saved) throw new ApiError('Elemento non trovato: potrebbe essere stato eliminato.', { status: 404 });
  emit(table, 'update', id);
  return saved;
}

export async function remove(table, id) {
  const { data } = await request('DELETE', table, { query: { id: `eq.${id}` }, prefer: 'return=representation' });
  if (Array.isArray(data) && !data.length) throw new ApiError('Elemento non trovato: potrebbe essere già stato eliminato.', { status: 404 });
  emit(table, 'delete', id);
}

/** Non si inviano mai campi gestiti dal database. */
function clean(row) {
  const out = { ...row };
  ['id', 'owner_id', 'created_at', 'updated_at'].forEach((k) => delete out[k]);
  Object.keys(out).forEach((k) => {
    if (out[k] !== null && typeof out[k] === 'object' && !Array.isArray(out[k])) delete out[k]; // relazioni incluse nelle letture
  });
  return out;
}
