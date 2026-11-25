/**
 * Vista generica per i moduli pianificati nelle fasi successive.
 * Mostra lo scopo del modulo e lo stato reale dei dati già presenti.
 */

import { html, render } from '../utils/dom.js';
import { getSection, hrefFor } from '../config/modules.js';
import { icon } from '../components/icons.js';

export default {
  mount(container, { module }) {
    const section = getSection(module.section);
    render(container, html`
      <div class="view-enter">
        <header class="page-head">
          <div>
            <p class="page-head__eyebrow">${section?.label}</p>
            <h2 class="page-head__title">${module.label}</h2>
          </div>
        </header>

        <div class="upcoming">
          <section class="card upcoming__hero" aria-labelledby="upcoming-title">
            <div class="upcoming__icon">${icon(module.icon)}</div>
            <span class="badge badge--info">${icon('clock', 'icon--sm')}In sviluppo</span>
            <h3 class="upcoming__title" id="upcoming-title" style="margin-top:var(--sp-4)">Il modulo ${module.label} è in arrivo</h3>
            <p class="upcoming__text">${module.description}</p>
            <p class="upcoming__text">La struttura dati è già pronta: quando il modulo sarà attivo, i dati compariranno automaticamente anche nella dashboard.</p>
            <div class="upcoming__actions">
              <a class="btn btn--primary" href="${hrefFor('dashboard')}">${icon('dashboard', 'icon--sm')}<span>Torna alla dashboard</span></a>
            </div>
          </section>

          <aside class="card" aria-labelledby="features-title">
            <div class="card__head">
              <h3 class="card__title" id="features-title">${icon('flag')}Cosa includerà</h3>
            </div>
            <div class="card__body">
              <ul class="feature-list">
                ${(module.features || []).map((f) => html`<li>${icon('check', 'icon--sm')}<span>${f}</span></li>`)}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    `);
  },
};
