/**
 * Sidebar: costruita dal registro moduli, aggiorna voce attiva,
 * modalità (full / rail / drawer) e scheda utente in base allo stato.
 */

import { html, render, on } from '../utils/dom.js';
import { SECTIONS, MODULES, hrefFor } from '../config/modules.js';
import { appState } from '../core/state.js';
import { updatePreferences } from '../services/settings-service.js';
import { icon, brandImage, BRAND } from './icons.js';
import { initials } from '../utils/format.js';

export const DESKTOP_QUERY = '(min-width: 1101px)';

export function mountSidebar(el) {
  render(el, html`
    <div class="sidebar__head">
      <a class="brand" href="${hrefFor('dashboard')}" aria-label="ZEFIRO Studio Manager — Dashboard">
        ${brandImage(BRAND.logoDark, { className: 'brand__logo', width: 127, height: 32 })}
        ${brandImage(BRAND.symbolDark, { className: 'brand__symbol', width: 36, height: 26 })}
        <span class="brand__product">Studio<br>Manager</span>
      </a>
      <button type="button" class="sidebar__close" data-action="close-nav" aria-label="Chiudi menu">
        ${icon('x', 'icon--sm')}
      </button>
    </div>

    <nav class="sidebar__nav" aria-label="Moduli">
      <button type="button" class="sidebar__expand" data-action="expand-sidebar"
        aria-label="Espandi barra laterale" data-tooltip="Espandi" hidden>
        ${icon('chevrons-right', 'icon--sm')}
      </button>
      ${SECTIONS.map((section) => html`
        <div class="nav-section">
          <p class="nav-section__title" id="nav-${section.id}">${section.label}</p>
          <ul class="nav-section__list" aria-labelledby="nav-${section.id}">
            ${MODULES.filter((m) => m.section === section.id).map((m) => html`
              <li>
                <a class="nav-link" href="${hrefFor(m.id)}" data-module="${m.id}" data-tooltip="${m.label}">
                  ${icon(m.icon)}
                  <span class="nav-link__label">${m.label}</span>
                  ${m.status === 'planned' ? html`<span class="nav-link__tag" title="Disponibile nelle prossime fasi">Presto</span>` : ''}
                </a>
              </li>`)}
          </ul>
        </div>`)}
    </nav>

    <div class="sidebar__foot">
      <button type="button" class="sidebar__collapse" data-action="collapse-sidebar">
        ${icon('chevrons-left', 'icon--sm')}<span>Riduci barra</span>
      </button>
      <a class="user-chip" href="${hrefFor('settings', 'profilo')}" data-tooltip="Profilo">
        <span class="avatar avatar--sm" data-slot="avatar"></span>
        <span class="user-chip__text">
          <span class="user-chip__name" data-slot="user-name"></span>
          <span class="user-chip__meta"><span class="dot" data-slot="db-dot"></span><span data-slot="db-label"></span></span>
        </span>
      </a>
    </div>
  `);

  const expandBtn = el.querySelector('[data-action="expand-sidebar"]');
  const collapseBtn = el.querySelector('[data-action="collapse-sidebar"]');

  on(el, 'click', '[data-action="close-nav"]', () => appState.set({ navOpen: false }));
  on(el, 'click', '[data-action="collapse-sidebar"]', () => updatePreferences({ sidebarCompact: true }));
  on(el, 'click', '[data-action="expand-sidebar"]', () => updatePreferences({ sidebarCompact: false }));

  // Nel drawer, la scelta di una voce chiude il menu
  on(el, 'click', '.nav-link, .user-chip, .brand', () => {
    if (appState.get().navMode === 'drawer') appState.set({ navOpen: false });
  });

  const update = (state) => {
    // Voce attiva
    el.querySelectorAll('.nav-link').forEach((link) => {
      if (link.dataset.module === state.route?.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    // Pulsanti di controllo
    collapseBtn.hidden = state.navMode !== 'full';
    expandBtn.hidden = !(state.navMode === 'rail' && window.matchMedia(DESKTOP_QUERY).matches);

    // Scheda utente
    const name = state.profile.name || 'Profilo da configurare';
    const ini = initials(state.profile.name);
    const avatar = el.querySelector('[data-slot="avatar"]');
    avatar.textContent = ini || '';
    avatar.classList.toggle('avatar--empty', !ini);
    if (!ini) avatar.innerHTML = String(icon('user', 'icon--sm'));
    el.querySelector('[data-slot="user-name"]').textContent = name;

    const dot = el.querySelector('[data-slot="db-dot"]');
    const label = el.querySelector('[data-slot="db-label"]');
    dot.className = `dot ${state.dbStatus === 'ready' ? 'dot--success' : state.dbStatus === 'error' ? 'dot--danger' : 'dot--warning'}`;
    label.textContent = state.dbStatus === 'ready' ? 'Sincronizzato online'
      : state.dbStatus === 'error' ? 'Database non disponibile' : 'Connessione…';
  };

  update(appState.get());
  appState.subscribe(update);
}
