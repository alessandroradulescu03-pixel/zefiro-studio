/**
 * Router basato su hash (#/percorso) — compatibile con GitHub Pages,
 * nessuna configurazione server necessaria.
 *
 * Formato: #/<modulo>/<segmento>/<segmento>…
 */

import { MODULES, DEFAULT_MODULE, getModuleByPath, getModuleById } from '../config/modules.js';
import { appState } from './state.js';

/** Legge l'hash corrente e restituisce { module, segments }. */
export function parseHash(hash = location.hash) {
  const clean = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  const [path = '', ...segments] = clean.split('/').filter(Boolean).map(decodeURIComponent);
  const module = getModuleByPath(path);
  return { module, segments, path };
}

/** Naviga verso un modulo (aggiorna l'hash). */
export function navigate(moduleId, ...segments) {
  const mod = getModuleById(moduleId) || getModuleById(DEFAULT_MODULE);
  const target = `#/${[mod.path, ...segments].map(encodeURIComponent).join('/')}`;
  if (location.hash === target) {
    handleRoute(); // forza il refresh della vista
  } else {
    location.hash = target;
  }
}

/** Sostituisce l'URL senza aggiungere voci alla cronologia. */
export function replaceSegments(moduleId, ...segments) {
  const mod = getModuleById(moduleId);
  const target = `#/${[mod.path, ...segments].map(encodeURIComponent).join('/')}`;
  history.replaceState(null, '', target);
  appState.set({ route: { id: mod.id, segments } });
}

let listener = null;

function handleRoute() {
  const { module, segments, path } = parseHash();

  if (!module) {
    // Hash vuoto o sconosciuto → dashboard
    const fallback = getModuleById(DEFAULT_MODULE);
    if (path) console.info(`[router] percorso sconosciuto "${path}", reindirizzo alla dashboard`);
    history.replaceState(null, '', `#/${fallback.path}`);
    listener?.({ module: fallback, segments: [] });
    return;
  }
  listener?.({ module, segments });
}

/**
 * Avvia il router.
 * @param {(route: {module: object, segments: string[]}) => void} onRoute
 */
export function startRouter(onRoute) {
  listener = onRoute;
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export { MODULES };
