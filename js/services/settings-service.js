/**
 * Servizio impostazioni: legge e scrive i record dello store "settings"
 * e mantiene allineato lo stato globale.
 *
 * Ogni gruppo di impostazioni è un record con id fisso
 * (es. "profile", "studio").
 */

import { STORES, get, upsert } from '../core/database.js';
import { appState } from '../core/state.js';
import { loadPreferences, savePreferences, resetPreferences } from '../core/preferences.js';

const GROUPS = ['profile', 'studio'];

/** Carica tutte le impostazioni nello stato globale. */
export async function loadSettings() {
  const state = appState.get();
  const patch = { preferences: loadPreferences() };

  const records = await Promise.all(GROUPS.map((id) => get(STORES.SETTINGS, id)));
  GROUPS.forEach((id, i) => {
    const record = records[i];
    if (record?.values) patch[id] = { ...state[id], ...record.values };
  });

  appState.set(patch);
}

/**
 * Salva un gruppo di impostazioni.
 * @param {'profile'|'studio'} group
 * @param {object} values
 */
export async function saveSettingsGroup(group, values) {
  if (!GROUPS.includes(group)) throw new Error(`Gruppo impostazioni sconosciuto: ${group}`);
  const clean = sanitize(values);
  await upsert(STORES.SETTINGS, { id: group, values: clean });
  appState.set((s) => ({ [group]: { ...s[group], ...clean } }));
}

/** Aggiorna una o più preferenze UI (localStorage). */
export function updatePreferences(patch) {
  const next = { ...appState.get().preferences, ...patch };
  savePreferences(next);
  appState.set({ preferences: next });
}

export function restoreDefaultPreferences() {
  appState.set({ preferences: resetPreferences() });
}

/** Rimuove spazi superflui dalle stringhe. */
function sanitize(values) {
  const out = {};
  Object.entries(values).forEach(([k, v]) => {
    out[k] = typeof v === 'string' ? v.trim() : v;
  });
  return out;
}
