/**
 * Pezzi di interfaccia condivisi dalle viste del CRM.
 */

import { html } from '../utils/dom.js';
import { icon } from '../components/icons.js';
import { labelOf } from '../config/crm.js';
import { daysFromToday, formatDate, formatDateTime } from '../utils/format.js';

export const badge = (list, value) => {
  const o = labelOf(list, value);
  return html`<span class="badge ${o.tone ? `badge--${o.tone}` : ''}">${o.label}</span>`;
};

export function pageHead({ eyebrow = 'Workspace', title, text = '', actions = '' }) {
  return html`
    <header class="page-head">
      <div>
        <p class="page-head__eyebrow">${eyebrow}</p>
        <h2 class="page-head__title">${title}</h2>
        ${text ? html`<p class="page-head__text">${text}</p>` : ''}
      </div>
      ${actions ? html`<div class="page-head__actions">${actions}</div>` : ''}
    </header>`;
}

export const button = (action, label, { iconName = 'plus', primary = false, small = false, danger = false, data = {} } = {}) => html`
  <button type="button" class="btn ${primary ? 'btn--primary' : ''} ${danger ? 'btn--danger' : ''} ${small ? 'btn--sm' : ''}"
    data-action="${action}" ${Object.entries(data).map(([k, v]) => html`data-${k}="${v}" `)}>
    ${iconName ? icon(iconName, 'icon--sm') : ''}<span>${label}</span>
  </button>`;

/** Barra con ricerca e filtri. filters: [{ name, label, options:[{value,label}], value }] */
export function toolbar({ search = '', placeholder = 'Cerca…', filters = [] }) {
  return html`
    <div class="crm-toolbar">
      <label class="crm-search">
        ${icon('search', 'icon--sm crm-search__icon')}
        <span class="sr-only">Cerca</span>
        <input class="input" type="search" data-role="search" value="${search}" placeholder="${placeholder}" autocomplete="off">
      </label>
      ${filters.map((f) => html`
        <label class="crm-filter">
          <span class="sr-only">${f.label}</span>
          <select class="select" data-role="filter" data-name="${f.name}">
            ${f.options.map((o) => html`<option value="${o.value}" ${o.value === f.value ? 'selected' : ''}>${o.label}</option>`)}
          </select>
        </label>`)}
    </div>`;
}

/** Testo e colore di una scadenza. */
export function due(date, { withTime = false } = {}) {
  if (!date) return '';
  const days = daysFromToday(date);
  let text;
  if (days < -1) text = `Scaduta da ${-days} giorni`;
  else if (days === -1) text = 'Scaduta ieri';
  else if (days === 0) text = 'Oggi';
  else if (days === 1) text = 'Domani';
  else text = withTime ? formatDateTime(date) : formatDate(date);
  if (withTime && (days === 0 || days === 1)) text += ` · ${new Date(date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`;
  const tone = days < 0 ? 'danger' : days <= 2 ? 'warning' : '';
  return html`<span class="badge ${tone ? `badge--${tone}` : ''}">${icon('clock', 'icon--sm')}${text}</span>`;
}

export const money = (n) => (n === null || n === undefined ? '' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n));

/** Riga di elenco cliccabile. */
export function row({ href = '', action = '', id = '', iconName = '', check = null, title, meta = '', aside = '', muted = false }) {
  const main = html`
    <span class="crm-row__main">
      <span class="crm-row__title">${title}</span>
      ${meta ? html`<span class="crm-row__meta">${meta}</span>` : ''}
    </span>`;
  return html`
    <li class="crm-row ${muted ? 'is-muted' : ''}">
      ${check ? html`
        <button type="button" class="crm-check ${check.done ? 'is-done' : ''}" data-action="${check.action}" data-id="${id}"
          aria-label="${check.done ? 'Segna come da fare' : 'Segna come fatto'}" aria-pressed="${String(check.done)}">${icon('check', 'icon--sm')}</button>`
        : iconName ? html`<span class="list-row__icon">${icon(iconName, 'icon--sm')}</span>` : ''}
      ${href
        ? html`<a class="crm-row__link" href="${href}">${main}</a>`
        : html`<button type="button" class="crm-row__link" data-action="${action}" data-id="${id}">${main}</button>`}
      ${aside ? html`<span class="crm-row__aside">${aside}</span>` : ''}
    </li>`;
}

export const loadingList = () => html`
  <ul class="crm-list" aria-hidden="true">
    ${[1, 2, 3, 4].map(() => html`
      <li class="crm-row"><span class="crm-row__main">
        <span class="skeleton" style="display:block;width:45%;height:12px"></span>
        <span class="skeleton" style="display:block;width:25%;height:10px;margin-top:8px"></span>
      </span></li>`)}
  </ul>`;

export const errorBox = (message) => html`
  <div class="crm-error" role="alert">${icon('alert-triangle', 'icon--sm')}<span>${message}</span>
    <button type="button" class="btn btn--sm" data-action="reload">Riprova</button></div>`;

/** Ricerca: testo sicuro per il filtro ilike di PostgREST. */
export const ilike = (q) => `*${q.replace(/[,()*%\\]/g, ' ').trim()}*`;

/** Una sezione (card) con titolo e pulsante. */
export function section({ title, iconName, count, action = '', body }) {
  return html`
    <section class="card crm-section">
      <div class="card__head">
        <h3 class="card__title">${icon(iconName)}${title}${count !== undefined ? html` <span class="crm-count">${count}</span>` : ''}</h3>
        ${action}
      </div>
      <div class="card__body">${body}</div>
    </section>`;
}
