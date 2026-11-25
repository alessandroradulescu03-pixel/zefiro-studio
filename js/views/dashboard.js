/**
 * Vista Dashboard.
 * Si aggiorna automaticamente quando cambia il database o il profilo.
 */

import { html, render } from '../utils/dom.js';
import { onChange } from '../core/database.js';
import { appState } from '../core/state.js';
import { hrefFor } from '../config/modules.js';
import { ENTITY_TYPES, ACTIVITY_ACTIONS } from '../config/domain.js';
import { getDashboardData } from '../services/dashboard-service.js';
import { icon, brandImage, BRAND } from '../components/icons.js';
import { emptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import {
  greeting, formatDateLong, formatNumber, formatRelative, formatMonthShort, plural,
} from '../utils/format.js';

const STATS = [
  { key: 'clients', label: 'Clienti', icon: 'users', module: 'clients' },
  { key: 'activeProjects', label: 'Progetti attivi', icon: 'folder', module: 'projects' },
  { key: 'openRequests', label: 'Richieste aperte', icon: 'inbox', module: 'requests' },
  { key: 'openTasks', label: 'Attività da completare', icon: 'check-square', module: 'tasks' },
];

export default {
  mount(container) {
    let data = null;
    let disposed = false;

    const draw = () => {
      if (disposed) return;
      render(container, template(appState.get(), data));
    };

    const load = async () => {
      try {
        data = await getDashboardData();
        draw();
      } catch (err) {
        console.error('[dashboard]', err);
        toast.error('Impossibile caricare i dati della dashboard.');
      }
    };

    draw(); // scheletro immediato
    load();

    // Debounce leggero per scritture ravvicinate
    let pending;
    const offDb = onChange(() => {
      clearTimeout(pending);
      pending = setTimeout(load, 120);
    });
    const offState = appState.subscribe((s, prev) => {
      if (s.profile !== prev.profile || s.studio !== prev.studio) draw();
    });

    return () => {
      disposed = true;
      clearTimeout(pending);
      offDb();
      offState();
    };
  },
};

/* ---------------- Template ---------------- */

function template(state, data) {
  const name = state.profile.name?.split(/\s+/)[0];
  return html`
    <div class="dash view-enter">
      ${hero(state, name, data)}
      ${statsGrid(data)}
      ${data ? onboarding(state, data) : ''}
      <div class="dash-grid">
        ${deadlinesCard(data)}
        ${activityCard(data)}
      </div>
    </div>
  `;
}

function hero(state, name, data) {
  return html`
    <section class="hero" aria-labelledby="dash-title">
      ${brandImage(BRAND.symbolDark, { className: 'hero__symbol' })}
      <div class="hero__content">
        <p class="hero__date">${icon('calendar', 'icon--sm')}<span>${formatDateLong()}</span></p>
        <h2 class="hero__title" id="dash-title">${greeting()}${name ? html`, <span>${name}</span>` : ''}</h2>
        <p class="hero__summary">${summary(state, data)}</p>
      </div>
      ${!state.profile.name ? html`
        <div class="hero__actions">
          <a class="btn btn--primary" href="${hrefFor('settings', 'profilo')}">${icon('user', 'icon--sm')}<span>Configura il profilo</span></a>
        </div>` : ''}
    </section>
  `;
}

function summary(state, data) {
  if (!data) return 'Caricamento del riepilogo…';
  const { counts, overdue, deadlines } = data;
  const studio = state.studio.name || 'lo studio';
  const nothing = counts.clients + counts.activeProjects + counts.openRequests + counts.openTasks === 0;
  if (nothing) return `Benvenuto in Studio Manager. Qui troverai il riepilogo del lavoro di ${studio} non appena inizierai a inserire clienti e progetti.`;

  const parts = [];
  parts.push(`Hai ${plural(counts.activeProjects, 'progetto attivo', 'progetti attivi')} e ${plural(counts.openTasks, 'attività da completare', 'attività da completare')}`);
  if (overdue) parts.push(`${plural(overdue, 'scadenza è già passata', 'scadenze sono già passate')}`);
  else if (deadlines.length) parts.push(`la prossima scadenza è ${dueLabel(deadlines[0].days).toLowerCase()}`);
  return `${parts.join('; ')}.`;
}

function statsGrid(data) {
  return html`
    <section class="stats" aria-label="Indicatori principali">
      ${STATS.map((s) => html`
        <a class="stat" href="${hrefFor(s.module)}">
          <div class="stat__top">
            <span class="stat__icon">${icon(s.icon)}</span>
            <span class="stat__arrow">${icon('arrow-up-right', 'icon--sm')}</span>
          </div>
          <div>
            <div class="stat__value">${data ? formatNumber(data.counts[s.key]) : html`<span class="skeleton" style="display:block"></span>`}</div>
            <div class="stat__label">${s.label}</div>
          </div>
        </a>`)}
    </section>
  `;
}

/** Checklist "Primi passi", basata su dati reali. Sparisce quando completata. */
function onboarding(state, data) {
  const steps = [
    { done: Boolean(state.profile.name), title: 'Configura il tuo profilo', desc: 'Nome e ruolo per personalizzare il gestionale', href: hrefFor('settings', 'profilo') },
    { done: Boolean(state.studio.email || state.studio.vat || state.studio.phone), title: 'Completa i dati dello studio', desc: 'Contatti e dati fiscali di ZEFIRO Digital Studio', href: hrefFor('settings', 'studio') },
    { done: data.counts.clients > 0, title: 'Aggiungi il primo cliente', desc: 'Disponibile con il modulo Clienti', href: hrefFor('clients') },
    { done: data.counts.totalProjects > 0, title: 'Crea il primo progetto', desc: 'Disponibile con il modulo Progetti', href: hrefFor('projects') },
  ];
  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return '';
  const pct = Math.round((completed / steps.length) * 100);

  return html`
    <section class="card" aria-labelledby="steps-title">
      <div class="card__head">
        <div>
          <h3 class="card__title" id="steps-title">${icon('rocket')}Primi passi</h3>
          <p class="card__subtitle">${completed} di ${steps.length} completati</p>
        </div>
        <span class="badge badge--info tabular">${pct}%</span>
      </div>
      <div class="card__body">
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Avanzamento configurazione">
          <div class="progress__bar" style="width:${pct}%"></div>
        </div>
        <div class="steps" style="margin-top:var(--sp-5)">
          ${steps.map((s) => html`
            <a class="step ${s.done ? 'is-done' : ''}" href="${s.href}">
              <span class="step__check">${icon('check', 'icon--sm')}</span>
              <span class="step__body">
                <span class="step__title" style="display:block">${s.title}</span>
                <span class="step__desc">${s.desc}</span>
              </span>
              <span class="step__go">${icon('chevron-right', 'icon--sm')}</span>
              <span class="sr-only">${s.done ? '(completato)' : '(da fare)'}</span>
            </a>`)}
        </div>
      </div>
    </section>
  `;
}

function deadlinesCard(data) {
  return html`
    <section class="card" aria-labelledby="deadlines-title">
      <div class="card__head">
        <div>
          <h3 class="card__title" id="deadlines-title">${icon('clock')}Prossime scadenze</h3>
          <p class="card__subtitle">Progetti, attività, preventivi e promemoria nei prossimi 30 giorni</p>
        </div>
      </div>
      <div class="card__body">
        ${!data ? skeletonRows() : data.deadlines.length ? html`
          <ul class="list-rows">
            ${data.deadlines.map((d) => {
              const type = ENTITY_TYPES[d.type];
              const date = new Date(d.date);
              return html`
                <li class="list-row">
                  <span class="deadline__date" aria-hidden="true">
                    <span class="deadline__day">${date.getDate()}</span>
                    <span class="deadline__month">${formatMonthShort(date)}</span>
                  </span>
                  <div class="list-row__main">
                    <p class="list-row__title">${d.title}</p>
                    <p class="list-row__meta">${type.label}</p>
                  </div>
                  <span class="badge ${badgeFor(d.days)}">${dueLabel(d.days)}</span>
                </li>`;
            })}
          </ul>` : emptyState({
            icon: 'calendar',
            title: 'Nessuna scadenza in programma',
            text: 'Le scadenze di progetti, attività, preventivi e promemoria compariranno qui automaticamente.',
            compact: true,
            actions: [{ label: 'Apri il calendario', href: hrefFor('calendar'), icon: 'calendar' }],
          })}
      </div>
    </section>
  `;
}

function activityCard(data) {
  return html`
    <section class="card" aria-labelledby="activity-title">
      <div class="card__head">
        <div>
          <h3 class="card__title" id="activity-title">${icon('activity')}Attività recenti</h3>
          <p class="card__subtitle">Le ultime operazioni registrate nel gestionale</p>
        </div>
      </div>
      <div class="card__body">
        ${!data ? skeletonRows() : data.recent.length ? html`
          <ul class="list-rows">
            ${data.recent.map((a) => {
              const type = ENTITY_TYPES[a.entityType] || { label: 'Elemento', icon: 'info' };
              return html`
                <li class="list-row">
                  <span class="list-row__icon">${icon(type.icon, 'icon--sm')}</span>
                  <div class="list-row__main">
                    <p class="list-row__title">${a.title}</p>
                    <p class="list-row__meta">${type.label} ${ACTIVITY_ACTIONS[a.action] || a.action}</p>
                  </div>
                  <time class="list-row__meta" datetime="${a.createdAt}">${formatRelative(a.createdAt)}</time>
                </li>`;
            })}
          </ul>` : emptyState({
            icon: 'activity',
            title: 'Ancora nessuna attività',
            text: 'Ogni operazione su clienti, progetti e preventivi verrà registrata qui, così avrai sempre sotto controllo cosa è cambiato.',
            compact: true,
            actions: [{ label: 'Vai alla timeline', href: hrefFor('timeline'), icon: 'arrow-right' }],
          })}
      </div>
    </section>
  `;
}

function skeletonRows() {
  return html`
    <div class="list-rows" aria-hidden="true">
      ${[1, 2, 3].map(() => html`
        <div class="list-row">
          <span class="skeleton" style="width:36px;height:36px"></span>
          <div class="list-row__main">
            <span class="skeleton" style="display:block;width:60%;height:12px"></span>
            <span class="skeleton" style="display:block;width:35%;height:10px;margin-top:8px"></span>
          </div>
        </div>`)}
    </div>
  `;
}

function dueLabel(days) {
  if (days < -1) return `Scaduta da ${-days} giorni`;
  if (days === -1) return 'Scaduta ieri';
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Domani';
  return `Tra ${days} giorni`;
}

function badgeFor(days) {
  if (days < 0) return 'badge--danger';
  if (days <= 2) return 'badge--warning';
  return 'badge--info';
}
