/**
 * Topbar: titolo della pagina, sezione, data e accesso al profilo.
 */

import { html, render, on } from '../utils/dom.js';
import { getModuleById, getSection, hrefFor } from '../config/modules.js';
import { appState } from '../core/state.js';
import { icon } from './icons.js';
import { formatTopbarDate, initials } from '../utils/format.js';
import { signOut } from '../core/auth.js';

export function mountTopbar(el) {
  render(el, html`
    <button type="button" class="icon-btn topbar__menu" data-action="open-nav"
      aria-label="Apri menu" aria-controls="sidebar" aria-expanded="false">
      ${icon('menu')}
    </button>
    <div class="topbar__title">
      <span class="topbar__crumb" data-slot="crumb"></span>
      <h1 class="topbar__heading" data-slot="heading">Studio Manager</h1>
    </div>
    <div class="topbar__actions">
      <time class="topbar__date" data-slot="date"></time>
      <a class="avatar avatar--sm" href="${hrefFor('settings', 'profilo')}" data-slot="avatar" aria-label="Apri il profilo"></a>
      <button type="button" class="btn btn--ghost btn--sm" data-action="logout" title="Esci dal gestionale">Esci</button>
    </div>
  `);

  on(el, 'click', '[data-action="open-nav"]', () => appState.set({ navOpen: true }));
  on(el, 'click', '[data-action="logout"]', async () => { await signOut(); location.reload(); });

  const dateEl = el.querySelector('[data-slot="date"]');
  const setDate = () => {
    const now = new Date();
    dateEl.textContent = formatTopbarDate(now);
    dateEl.dateTime = now.toISOString().slice(0, 10);
  };
  setDate();
  // Aggiorna la data allo scoccare della mezzanotte se l'app resta aperta
  setInterval(setDate, 60 * 1000);

  const update = (state) => {
    const mod = getModuleById(state.route?.id);
    el.querySelector('[data-slot="heading"]').textContent = mod?.label || 'Studio Manager';
    el.querySelector('[data-slot="crumb"]').textContent = getSection(mod?.section)?.label || '';
    el.querySelector('[data-action="open-nav"]').setAttribute('aria-expanded', String(state.navOpen));

    const avatar = el.querySelector('[data-slot="avatar"]');
    const ini = initials(state.profile.name);
    avatar.classList.toggle('avatar--empty', !ini);
    if (ini) avatar.textContent = ini;
    else avatar.innerHTML = String(icon('user', 'icon--sm'));
  };

  update(appState.get());
  appState.subscribe(update);
}
