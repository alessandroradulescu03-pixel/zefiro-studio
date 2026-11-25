/**
 * Gestore delle viste: carica il modulo della rotta, lo monta nel
 * contenitore principale ed esegue la pulizia della vista precedente.
 *
 * Contratto di una vista (js/views/*.js):
 *   export default {
 *     mount(container, { module, segments }) → (opzionale) funzione di cleanup
 *   }
 */

import { html, render } from '../utils/dom.js';
import { appState } from './state.js';
import { icon } from '../components/icons.js';
import { emptyState } from '../components/empty-state.js';
import { hrefFor } from '../config/modules.js';

let cleanup = null;
let navigationId = 0;

export async function showView(container, { module, segments }) {
  const current = ++navigationId;
  const sameModule = appState.get().route?.id === module.id;
  appState.set({ route: { id: module.id, segments } });
  document.title = `${module.label} · ZEFIRO Studio Manager`;

  try {
    const view = module.status === 'ready'
      ? (await module.load()).default
      : (await import('../views/upcoming.js')).default;

    if (current !== navigationId) return; // è arrivata un'altra navigazione nel frattempo

    runCleanup();
    container.innerHTML = '';
    const result = view.mount(container, { module, segments });
    cleanup = typeof result === 'function' ? result : null;

    if (!sameModule) {
      window.scrollTo({ top: 0 });
      container.focus({ preventScroll: true });
    }
  } catch (err) {
    if (current !== navigationId) return;
    console.error(`[view] errore nel caricamento di "${module.id}"`, err);
    runCleanup();
    render(container, html`
      <div class="card fatal">
        ${emptyState({
          icon: 'alert-triangle',
          title: 'Impossibile aprire questa sezione',
          text: 'Si è verificato un errore durante il caricamento. Ricarica la pagina; se il problema persiste controlla la console del browser.',
          actions: [{ label: 'Torna alla dashboard', href: hrefFor('dashboard'), primary: true, icon: 'dashboard' }],
        })}
      </div>
    `);
  }
}

function runCleanup() {
  if (!cleanup) return;
  try { cleanup(); } catch (err) { console.error('[view] errore nella pulizia', err); }
  cleanup = null;
}

/** Schermata mostrata se il database non può essere aperto. */
export function showDatabaseError(container, error) {
  runCleanup();
  render(container, html`
    <div class="card fatal" role="alert">
      <div class="empty">
        <div class="empty__icon" style="background:var(--danger-soft);color:var(--danger);border-color:rgba(240,106,106,.3)">${icon('database')}</div>
        <p class="empty__title">Database non disponibile</p>
        <p class="empty__text">${error?.message || 'Impossibile aprire il database locale.'}</p>
        <p class="empty__text">Studio Manager salva i dati in IndexedDB: verifica di non essere in navigazione privata e che il browser consenta l'archiviazione dei siti.</p>
        <div class="empty__actions">
          <button type="button" class="btn btn--primary" data-action="reload">${icon('arrow-right', 'icon--sm')}<span>Riprova</span></button>
        </div>
      </div>
    </div>
  `);
  container.querySelector('[data-action="reload"]').addEventListener('click', () => location.reload());
}
