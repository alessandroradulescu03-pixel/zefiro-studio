/**
 * Preferenze di interfaccia NON critiche, salvate in localStorage.
 * Nessun dato operativo passa da qui.
 */

const KEY = 'zefiro.preferences.v1';

export const DEFAULT_PREFERENCES = Object.freeze({
  sidebarCompact: false,
  reducedMotion: false,
  showMotto: true,
});

export function loadPreferences() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...pickKnown(parsed) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pickKnown(prefs)));
    return true;
  } catch {
    return false; // storage pieno o disabilitato: la preferenza resta valida per la sessione
  }
}

export function resetPreferences() {
  try { localStorage.removeItem(KEY); } catch { /* ignorato */ }
  return { ...DEFAULT_PREFERENCES };
}

function pickKnown(obj) {
  const out = {};
  Object.keys(DEFAULT_PREFERENCES).forEach((k) => {
    if (typeof obj?.[k] === typeof DEFAULT_PREFERENCES[k]) out[k] = obj[k];
  });
  return out;
}
