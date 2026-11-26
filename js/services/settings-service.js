/**
 * Servizio impostazioni.
 *
 * Profilo, dati dello studio e preferenze vivono su Supabase (tabella
 * user_settings, una riga per utente) così sono uguali su computer e telefono.
 * IndexedDB/localStorage restano come copia locale: l'app si apre subito
 * anche offline, e se la tabella non esiste ancora tutto funziona come prima.
 */

import { STORES, get, upsert } from '../core/database.js';
import { list, upsertMine } from '../core/api.js';
import { appState } from '../core/state.js';
import { toast } from '../components/toast.js';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences, resetPreferences } from '../core/preferences.js';

const GROUPS = ['profile', 'studio'];
const TABLE = 'user_settings';
/** Preferenze uguali su tutti i dispositivi (la barra ridotta resta per dispositivo). */
const SYNCED_PREFS = ['reducedMotion', 'showMotto'];

let cloudReady = false; // la tabella esiste e risponde

/** Carica le impostazioni: prima la copia locale, poi quella online. */
export async function loadSettings() {
  const state = appState.get();
  const patch = { preferences: loadPreferences() };

  const records = await Promise.all(GROUPS.map((id) => get(STORES.SETTINGS, id)));
  const local = {};
  GROUPS.forEach((id, i) => {
    const record = records[i];
    if (record?.values) { local[id] = record.values; patch[id] = { ...state[id], ...record.values }; }
  });
  appState.set(patch);

  await syncFromCloud(local);
}

async function syncFromCloud(local) {
  let row;
  try {
    [row] = await list(TABLE, { select: 'profile,studio,preferences', limit: '1' });
    cloudReady = true;
  } catch (err) {
    cloudReady = false;
    if (err.status !== 404 && err.code !== 'PGRST205' && err.code !== '42P01') console.warn('[settings] online non disponibile', err);
    return;
  }

  const s = appState.get();
  const patch = {};
  const push = {};
  for (const g of GROUPS) {
    if (hasValues(row?.[g])) {
      patch[g] = { ...s[g], ...row[g] };
      await upsert(STORES.SETTINGS, { id: g, values: row[g] }); // aggiorna la copia locale
    } else if (hasValues(local[g])) {
      push[g] = local[g]; // online è vuoto ma qui c'è: lo porta online (prima sincronizzazione)
    }
  }
  if (row?.preferences && Object.keys(row.preferences).length) {
    const prefs = { ...s.preferences, ...pickSynced(row.preferences) };
    savePreferences(prefs);
    patch.preferences = prefs;
  } else if (Object.keys(push).length) {
    push.preferences = pickSynced(s.preferences);
  }
  if (Object.keys(push).length) {
    try { await upsertMine(TABLE, push); } catch (err) { console.warn('[settings] primo invio non riuscito', err); }
  }
  appState.set(patch);
}

/**
 * Salva un gruppo di impostazioni (locale + online).
 * @param {'profile'|'studio'} group
 * @param {object} values
 */
export async function saveSettingsGroup(group, values) {
  if (!GROUPS.includes(group)) throw new Error(`Gruppo impostazioni sconosciuto: ${group}`);
  const merged = { ...appState.get()[group], ...sanitize(values) };
  if (cloudReady) await upsertMine(TABLE, { [group]: merged }); // se fallisce, l'errore arriva al modulo
  await upsert(STORES.SETTINGS, { id: group, values: merged });
  appState.set({ [group]: merged });
}

/** Aggiorna una o più preferenze UI. */
export function updatePreferences(patch) {
  const next = { ...appState.get().preferences, ...patch };
  savePreferences(next);
  appState.set({ preferences: next });
  if (Object.keys(patch).some((k) => SYNCED_PREFS.includes(k))) pushPrefs(next);
}

export function restoreDefaultPreferences() {
  const prefs = resetPreferences();
  appState.set({ preferences: prefs });
  pushPrefs(prefs);
}

function pushPrefs(prefs) {
  if (!cloudReady) return;
  upsertMine(TABLE, { preferences: pickSynced(prefs) })
    .catch(() => toast.error('Preferenza salvata solo su questo dispositivo: connessione assente.'));
}

/** True se le impostazioni sono sincronizzate online. */
export const settingsSynced = () => cloudReady;

function pickSynced(prefs = {}) {
  const out = {};
  SYNCED_PREFS.forEach((k) => { if (typeof prefs[k] === typeof DEFAULT_PREFERENCES[k]) out[k] = prefs[k]; });
  return out;
}

function hasValues(obj) {
  return Boolean(obj) && typeof obj === 'object' && Object.values(obj).some((v) => v !== '' && v !== null && v !== undefined);
}

/** Rimuove spazi superflui dalle stringhe. */
function sanitize(values) {
  const out = {};
  Object.entries(values).forEach(([k, v]) => {
    out[k] = typeof v === 'string' ? v.trim() : v;
  });
  return out;
}
