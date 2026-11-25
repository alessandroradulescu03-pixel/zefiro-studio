/**
 * Archivio (#/archivio/<scheda>): tutto ciò che è chiuso, in un posto solo,
 * con ricerca e ripristino. Non usa tabelle nuove: legge gli stati esistenti.
 */

import { html, render, on } from '../utils/dom.js';
import { hrefFor } from '../config/modules.js';
import { replaceSegments } from '../core/router.js';
import { list, update, onDataChange } from '../core/api.js';
import { PROJECT_STATUS, REQUEST_STATUS } from '../config/crm.js';
import { emptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { formatDate, formatRelative } from '../utils/format.js';
import { badge, pageHead, row, loadingList, errorBox, money } from './crm-ui.js';

const TABS = [
  { id: 'clienti', label: 'Clienti archiviati', icon: 'users' },
  { id: 'progetti', label: 'Progetti chiusi', icon: 'folder' },
  { id: 'contatti', label: 'Contatti chiusi', icon: 'inbox' },
  { id: 'fatte', label: 'Cose fatte', icon: 'check-square' },
];
const CLOSED_REQUESTS = ['accettata', 'rifiutata', 'archiviata'];

export default {
  mount(container, { segments }) {
    let tab = TABS.some((t) => t.id === segments[0]) ? segments[0] : 'clienti';
    if (segments[0] !== tab) replaceSegments('archive', tab);
    const state = { q: '', data: null, error: '' };

    const load = async () => {
      try {
        const [clients, projects, requests, tasks] = await Promise.all([
          list('clients', { select: 'id,name,contact_name,email,city,updated_at', status: 'eq.archiviato', order: 'updated_at.desc', limit: '1000' }),
          list('projects', { select: 'id,name,status,amount,completed_at,updated_at,client:clients(id,name)', status: 'in.(completato,annullato)', order: 'updated_at.desc', limit: '1000' }),
          list('requests', { select: 'id,title,status,source,received_at,contact_name,client:clients(id,name)', status: `in.(${CLOSED_REQUESTS.join(',')})`, order: 'received_at.desc', limit: '1000' }),
          list('tasks', { select: 'id,title,completed_at,updated_at,project:projects(id,name),client:clients(id,name)', status: 'eq.fatto', order: 'completed_at.desc.nullslast', limit: '300' }),
        ]);
        state.data = { clients, projects, requests, tasks };
        state.error = '';
      } catch (err) { state.error = err.message; }
      draw();
    };

    const match = (...fields) => {
      const q = state.q.toLowerCase();
      return !q || fields.some((f) => String(f || '').toLowerCase().includes(q));
    };

    const summary = () => {
      if (!state.data) return '';
      const done = state.data.projects.filter((p) => p.status === 'completato');
      const total = done.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      return html`
        <section class="arch-stats" aria-label="Riepilogo">
          <div class="arch-stat"><span class="arch-stat__n">${done.length}</span><span>progetti completati</span></div>
          <div class="arch-stat"><span class="arch-stat__n">${money(total) || '0,00 €'}</span><span>dai progetti completati</span></div>
          <div class="arch-stat"><span class="arch-stat__n">${state.data.requests.filter((r) => r.status === 'accettata').length}</span><span>contatti diventati lavoro</span></div>
          <div class="arch-stat"><span class="arch-stat__n">${state.data.tasks.length}${state.data.tasks.length >= 300 ? '+' : ''}</span><span>cose fatte</span></div>
        </section>`;
    };

    const body = () => {
      if (state.error) return errorBox(state.error);
      if (!state.data) return loadingList();
      const d = state.data;
      let items = [];
      if (tab === 'clienti') {
        items = d.clients.filter((c) => match(c.name, c.contact_name, c.email, c.city)).map((c) => row({
          href: hrefFor('clients', c.id), iconName: 'users', title: c.name,
          meta: [c.contact_name, c.email, `archiviato ${formatRelative(c.updated_at)}`].filter(Boolean).join(' · '),
          aside: restore('restore-client', c.id, 'Ripristina'),
        }));
      } else if (tab === 'progetti') {
        items = d.projects.filter((p) => match(p.name, p.client?.name)).map((p) => row({
          href: hrefFor('projects', p.id), iconName: 'folder', title: p.name,
          meta: [p.client?.name, p.amount !== null ? money(p.amount) : '', p.completed_at ? `completato il ${formatDate(p.completed_at)}` : ''].filter(Boolean).join(' · '),
          aside: html`${badge(PROJECT_STATUS, p.status)}${restore('reopen-project', p.id, 'Riapri')}`,
        }));
      } else if (tab === 'contatti') {
        items = d.requests.filter((r) => match(r.title, r.contact_name, r.client?.name)).map((r) => row({
          href: hrefFor('requests', r.id), iconName: 'inbox', title: r.title,
          meta: [r.client?.name || r.contact_name, formatDate(r.received_at)].filter(Boolean).join(' · '),
          aside: html`${badge(REQUEST_STATUS, r.status)}${restore('reopen-request', r.id, 'Riapri')}`,
        }));
      } else {
        items = d.tasks.filter((t) => match(t.title, t.project?.name, t.client?.name)).map((t) => row({
          iconName: 'check-square', action: 'noop', id: t.id, title: t.title,
          meta: [t.project?.name, t.client?.name, t.completed_at ? `fatto ${formatRelative(t.completed_at)}` : ''].filter(Boolean).join(' · '),
          aside: restore('undo-task', t.id, 'Rimetti da fare'),
        }));
      }
      if (!items.length) {
        return emptyState(state.q
          ? { icon: 'search', title: 'Niente trovato', text: 'Prova con un\'altra ricerca.', compact: true }
          : { icon: 'archive', title: 'Ancora vuoto', text: 'Qui finiscono clienti archiviati, progetti chiusi, contatti gestiti e cose fatte.', compact: true });
      }
      return html`<ul class="crm-list">${items}</ul>`;
    };

    const restore = (action, id, label) => html`
      <button type="button" class="btn btn--sm" data-action="${action}" data-id="${id}">${icon('arrow-up-right', 'icon--sm')}<span>${label}</span></button>`;

    const draw = () => {
      const counts = state.data ? { clienti: state.data.clients.length, progetti: state.data.projects.length, contatti: state.data.requests.length, fatte: state.data.tasks.length } : {};
      render(container, html`
        <div class="view-enter">
          ${pageHead({ eyebrow: 'Management', title: 'Archivio', text: 'Tutto quello che è chiuso, in un posto solo. Puoi sempre ripristinarlo.' })}
          ${summary()}
          <div class="arch-tabs" role="tablist" aria-label="Sezioni archivio">
            ${TABS.map((t) => html`
              <button type="button" class="arch-tab" role="tab" data-action="tab" data-tab="${t.id}" aria-selected="${String(t.id === tab)}">
                ${icon(t.icon, 'icon--sm')}<span>${t.label}</span>${counts[t.id] !== undefined ? html`<span class="crm-count">${counts[t.id]}</span>` : ''}
              </button>`)}
          </div>
          <div class="crm-toolbar">
            <label class="crm-search">
              ${icon('search', 'icon--sm crm-search__icon')}<span class="sr-only">Cerca</span>
              <input class="input" type="search" data-role="search" value="${state.q}" placeholder="Cerca nell'archivio…" autocomplete="off">
            </label>
          </div>
          <div class="card"><div class="card__body" data-slot="list">${body()}</div></div>
        </div>`);
    };

    const redrawList = () => { const slot = container.querySelector('[data-slot="list"]'); if (slot) render(slot, body()); };
    const act = (fn, msg) => async (_e, el) => {
      try { await fn(el.dataset.id); toast.success(msg); } catch (err) { toast.error(err.message); }
    };

    const offs = [
      on(container, 'click', '[data-action="tab"]', (_e, el) => { tab = el.dataset.tab; replaceSegments('archive', tab); draw(); }),
      on(container, 'input', '[data-role="search"]', (_e, el) => { state.q = el.value.trim(); redrawList(); }),
      on(container, 'click', '[data-action="reload"]', load),
      on(container, 'click', '[data-action="restore-client"]', act((id) => update('clients', id, { status: 'attivo' }), 'Cliente ripristinato.')),
      on(container, 'click', '[data-action="reopen-project"]', act((id) => update('projects', id, { status: 'in_corso', completed_at: null }), 'Progetto riaperto.')),
      on(container, 'click', '[data-action="reopen-request"]', act((id) => update('requests', id, { status: 'in_valutazione' }), 'Contatto riaperto.')),
      on(container, 'click', '[data-action="undo-task"]', act((id) => update('tasks', id, { status: 'da_fare', completed_at: null }), 'Rimesso tra le cose da fare.')),
      onDataChange(() => load()),
    ];

    draw();
    load();
    return () => offs.forEach((off) => off());
  },
};
