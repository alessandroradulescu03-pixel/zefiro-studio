/**
 * Stato globale dell'applicazione.
 * Store minimale con sottoscrizioni: nessuna dipendenza esterna.
 *
 * Contiene solo stato di sessione / UI e una copia in memoria delle
 * impostazioni lette da IndexedDB. I dati operativi (clienti, progetti…)
 * vengono sempre letti dal database dai singoli moduli.
 */

/**
 * @template S
 * @param {S} initialState
 */
export function createStore(initialState) {
  let state = { ...initialState };
  const listeners = new Set();

  return {
    /** @returns {S} */
    get: () => state,

    /**
     * Aggiorna lo stato in modo superficiale e notifica i listener.
     * @param {Partial<S> | ((s: S) => Partial<S>)} patch
     */
    set(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      const prev = state;
      state = { ...state, ...next };
      listeners.forEach((fn) => fn(state, prev));
    },

    /**
     * @param {(state: S, prev: S) => void} fn
     * @returns {() => void}
     */
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/** Stato condiviso dall'intera applicazione. */
export const appState = createStore({
  /** Stato del database: 'opening' | 'ready' | 'error' */
  dbStatus: 'opening',
  dbError: null,

  /** Rotta corrente, es. { id: 'dashboard', params: {} } */
  route: null,

  /** Impostazioni persistite (IndexedDB, store "settings") */
  profile: { name: '', role: '', email: '' },
  studio: { name: 'ZEFIRO Digital Studio', email: '', phone: '', website: '', vat: '', address: '' },

  /** Preferenze di interfaccia (localStorage) */
  preferences: { sidebarCompact: false, reducedMotion: false, showMotto: true },

  /** Modalità di navigazione calcolata dalla viewport: 'full' | 'rail' | 'drawer' */
  navMode: 'full',
  navOpen: false,
});
