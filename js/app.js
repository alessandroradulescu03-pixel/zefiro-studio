/**
 * ZEFIRO Studio Manager — punto di ingresso.
 * Ordine di avvio:
 *   1. preferenze UI (localStorage) e layout responsive
 *   2. sidebar e topbar
 *   3. apertura IndexedDB + caricamento impostazioni
 *   4. avvio router
 * Prima di tutto: accesso (js/core/auth.js).
 */

import { appState } from './core/state.js';
import { openDatabase, onVersionChange } from './core/database.js';
import { startRouter } from './core/router.js';
import { showView, showDatabaseError } from './core/view-manager.js';
import { loadPreferences } from './core/preferences.js';
import { loadSettings } from './services/settings-service.js';
import { mountSidebar, DESKTOP_QUERY } from './components/sidebar.js';
import { mountTopbar } from './components/topbar.js';
import { toast } from './components/toast.js';
import { requireLogin } from './core/auth.js';
import { mountMotto } from './components/motto.js';

const MOBILE_QUERY = '(max-width: 760px)';

const els = {
  app: document.getElementById('app'),
  sidebar: document.getElementById('sidebar'),
  overlay: document.getElementById('sidebar-overlay'),
  topbar: document.getElementById('topbar'),
  main: document.getElementById('main'),
};

/* ---------------- Layout responsive ---------------- */

function computeNavMode(prefs) {
  if (window.matchMedia(MOBILE_QUERY).matches) return 'drawer';
  if (!window.matchMedia(DESKTOP_QUERY).matches) return 'rail';
  return prefs.sidebarCompact ? 'rail' : 'full';
}

function syncLayout() {
  const { preferences, navOpen } = appState.get();
  const navMode = computeNavMode(preferences);
  appState.set({ navMode, navOpen: navMode === 'drawer' ? navOpen : false });
}

function applyLayout(state, prev = {}) {
  // Se le preferenze cambiano la modalità, aggiorna lo stato e lascia
  // che la nuova notifica applichi il layout definitivo.
  if (state.preferences !== prev.preferences) {
    const mode = computeNavMode(state.preferences);
    if (mode !== state.navMode) {
      appState.set({ navMode: mode });
      return;
    }
  }

  els.app.dataset.nav = state.navMode;
  els.app.classList.toggle('is-nav-open', state.navOpen);
  document.documentElement.dataset.motion = state.preferences.reducedMotion ? 'reduced' : 'full';

  // Nel drawer chiuso la sidebar non deve essere raggiungibile da tastiera
  const hideSidebar = state.navMode === 'drawer' && !state.navOpen;
  els.sidebar.inert = hideSidebar;
  if (hideSidebar) els.sidebar.setAttribute('aria-hidden', 'true');
  else els.sidebar.removeAttribute('aria-hidden');

  // Overlay e gestione focus del drawer
  if (state.navOpen !== prev.navOpen) {
    if (state.navOpen) {
      els.overlay.hidden = false;
      document.body.style.overflow = 'hidden';
      els.sidebar.querySelector('.nav-link[aria-current="page"], .nav-link')?.focus();
    } else if (prev.navOpen) {
      document.body.style.overflow = '';
      // attende la transizione prima di nascondere l'overlay
      setTimeout(() => { if (!appState.get().navOpen) els.overlay.hidden = true; }, 320);
      if (state.navMode === 'drawer') els.topbar.querySelector('[data-action="open-nav"]')?.focus();
    }
  }
}

function bindLayoutEvents() {
  [MOBILE_QUERY, DESKTOP_QUERY].forEach((q) => {
    window.matchMedia(q).addEventListener('change', syncLayout);
  });
  els.overlay.addEventListener('click', () => appState.set({ navOpen: false }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && appState.get().navOpen) appState.set({ navOpen: false });
  });
}

/* ---------------- Avvio ---------------- */

async function boot() {
  // Il gestionale parte solo dopo l'accesso
  await requireLogin();

  appState.set({ preferences: loadPreferences() });
  appState.subscribe(applyLayout);
  syncLayout();
  applyLayout(appState.get());
  bindLayoutEvents();

  mountSidebar(els.sidebar);
  mountTopbar(els.topbar);
  mountMotto();

  try {
    await openDatabase();
    await loadSettings();
    appState.set({ dbStatus: 'ready', dbError: null });
  } catch (err) {
    console.error('[app] database', err);
    appState.set({ dbStatus: 'error', dbError: err.message });
    els.app.dataset.state = 'error';
    showDatabaseError(els.main, err);
    return;
  }

  onVersionChange(() => {
    toast.info('Il database è stato aggiornato in un\'altra scheda. Ricarica la pagina per continuare.', { duration: 10000 });
  });

  els.app.dataset.state = 'ready';
  startRouter((route) => showView(els.main, route));
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[app] promessa non gestita', event.reason);
  toast.error('Si è verificato un errore imprevisto.');
});

boot();
