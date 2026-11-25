/**
 * Clienti: elenco (#/clienti) e scheda cliente (#/clienti/<id>).
 */

import { html, render, on } from '../utils/dom.js';
import { hrefFor } from '../config/modules.js';
import { list, getOne, update, onDataChange } from '../core/api.js';
import { CLIENT_STATUS, PROJECT_STATUS, REQUEST_STATUS, TASK_STATUS, labelOf } from '../config/crm.js';
import {
  editClient, editProject, editRequest, editTask, editReminder, toggleTask, toggleReminder, deleteRow,
} from '../services/crm-service.js';
import { emptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { initials, formatRelative } from '../utils/format.js';
import {
  badge, pageHead, button, toolbar, row, loadingList, errorBox, ilike, section, due, money,
} from './crm-ui.js';

const STATUS_FILTER = [
  { value: 'operativi', label: 'Tutti tranne archiviati' },
  ...CLIENT_STATUS.map((o) => ({ value: o.value, label: o.label })),
  { value: 'tutti', label: 'Tutti' },
];

export default {
  mount(container, { segments }) {
    return segments[0] ? mountDetail(container, segments[0]) : mountList(container);
  },
};

/* ======================= ELENCO ======================= */

function mountList(container) {
  const state = { q: '', status: 'operativi', rows: null, error: '' };
  let timer;

  render(container, html`
    <div class="view-enter">
      ${pageHead({ title: 'Clienti', text: 'Anagrafica dei clienti dello studio.', actions: button('new', 'Nuovo cliente', { primary: true }) })}
      ${toolbar({ placeholder: 'Cerca per nome, referente o email…', filters: [{ name: 'status', label: 'Stato', options: STATUS_FILTER, value: state.status }] })}
      <div class="card"><div class="card__body" data-slot="list"></div></div>
    </div>`);
  const slot = container.querySelector('[data-slot="list"]');

  const draw = () => {
    if (state.error) return render(slot, errorBox(state.error));
    if (!state.rows) return render(slot, loadingList());
    if (!state.rows.length) {
      return render(slot, emptyState(state.q || state.status !== 'operativi'
        ? { icon: 'search', title: 'Nessun cliente trovato', text: 'Prova a cambiare la ricerca o il filtro.', compact: true }
        : { icon: 'users', title: 'Ancora nessun cliente', text: 'Aggiungi il primo cliente per iniziare a gestire richieste e progetti.', actions: [{ label: 'Nuovo cliente', action: 'new', primary: true, icon: 'plus' }] }));
    }
    render(slot, html`<ul class="crm-list">${state.rows.map((c) => row({
      href: hrefFor('clients', c.id),
      iconName: '',
      title: html`<span class="crm-avatar">${initials(c.name) || '?'}</span>${c.name}`,
      meta: [c.contact_name, c.email, c.phone, c.city].filter(Boolean).join(' · ') || 'Nessun contatto inserito',
      aside: badge(CLIENT_STATUS, c.status),
      muted: c.status === 'archiviato',
    }))}</ul>`);
  };

  const load = async () => {
    state.error = '';
    const query = { order: 'name.asc', limit: '500' };
    if (state.status === 'operativi') query.status = 'neq.archiviato';
    else if (state.status !== 'tutti') query.status = `eq.${state.status}`;
    if (state.q) query.or = `(name.ilike.${ilike(state.q)},contact_name.ilike.${ilike(state.q)},email.ilike.${ilike(state.q)})`;
    try { state.rows = await list('clients', query); } catch (err) { state.error = err.message; }
    draw();
  };

  const offs = [
    on(container, 'click', '[data-action="new"]', async () => {
      const c = await editClient();
      if (c) location.hash = hrefFor('clients', c.id);
    }),
    on(container, 'click', '[data-action="reload"]', load),
    on(container, 'input', '[data-role="search"]', (_e, el) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = el.value.trim(); load(); }, 250);
    }),
    on(container, 'change', '[data-role="filter"]', (_e, el) => { state.status = el.value; state.rows = null; draw(); load(); }),
    onDataChange((d) => { if (d.table === 'clients') load(); }),
  ];

  draw();
  load();
  return () => { clearTimeout(timer); offs.forEach((off) => off()); };
}

/* ======================= SCHEDA ======================= */

function mountDetail(container, id) {
  let data = null;
  let error = '';

  const load = async () => {
    try {
      const [client, projects, requests, tasks, reminders] = await Promise.all([
        getOne('clients', id),
        list('projects', { client_id: `eq.${id}`, order: 'created_at.desc' }),
        list('requests', { client_id: `eq.${id}`, order: 'received_at.desc' }),
        list('tasks', { client_id: `eq.${id}`, order: 'due_date.asc.nullslast,created_at.asc' }).then(openFirst),
        list('reminders', { client_id: `eq.${id}`, done: 'eq.false', order: 'remind_at.asc' }),
      ]);
      data = { client, projects, requests, tasks, reminders };
      error = '';
    } catch (err) { error = err.message; }
    draw();
  };

  const draw = () => {
    if (error) return render(container, html`<div class="view-enter">${backLink()}${errorBox(error)}</div>`);
    if (!data) return render(container, html`<div class="view-enter">${backLink()}<div class="card"><div class="card__body">${loadingList()}</div></div></div>`);
    const { client: c } = data;
    if (!c) {
      return render(container, html`<div class="view-enter">${backLink()}<div class="card">${emptyState({
        icon: 'users', title: 'Cliente non trovato', text: 'Potrebbe essere stato eliminato.', actions: [{ label: 'Torna ai clienti', href: hrefFor('clients'), primary: true }],
      })}</div></div>`);
    }
    const archived = c.status === 'archiviato';
    render(container, html`
      <div class="view-enter">
        ${backLink()}
        <header class="crm-detail-head">
          <span class="crm-avatar crm-avatar--lg">${initials(c.name) || '?'}</span>
          <div class="crm-detail-head__text">
            <h2 class="page-head__title">${c.name}</h2>
            <p class="crm-detail-head__meta">${badge(CLIENT_STATUS, c.status)} <span>${c.kind === 'privato' ? 'Privato' : 'Azienda'}</span>${c.source ? html` · <span>da ${c.source}</span>` : ''}</p>
          </div>
          <div class="page-head__actions">
            ${button('edit', 'Modifica', { iconName: 'settings' })}
            ${archived ? button('unarchive', 'Riattiva', { iconName: 'arrow-up-right' }) : button('archive', 'Archivia', { iconName: 'archive' })}
            ${button('delete', 'Elimina', { iconName: 'trash', danger: true })}
          </div>
        </header>

        <div class="crm-detail">
          <div class="crm-detail__main">
            ${section({
              title: 'Progetti', iconName: 'folder', count: data.projects.length,
              action: button('new-project', 'Nuovo', { small: true }),
              body: data.projects.length ? html`<ul class="crm-list">${data.projects.map((p) => row({
                href: hrefFor('projects', p.id), iconName: 'folder', title: p.name,
                meta: [p.amount !== null ? money(p.amount) : '', p.due_date ? `scadenza ${new Date(p.due_date).toLocaleDateString('it-IT')}` : ''].filter(Boolean).join(' · '),
                aside: badge(PROJECT_STATUS, p.status), muted: ['completato', 'annullato'].includes(p.status),
              }))}</ul>` : emptyState({ icon: 'folder', title: 'Nessun progetto', compact: true }),
            })}
            ${section({
              title: 'Richieste', iconName: 'inbox', count: data.requests.length,
              action: button('new-request', 'Nuova', { small: true }),
              body: data.requests.length ? html`<ul class="crm-list">${data.requests.map((r) => row({
                href: hrefFor('requests', r.id), iconName: 'inbox', title: r.title,
                meta: formatRelative(r.received_at), aside: badge(REQUEST_STATUS, r.status),
              }))}</ul>` : emptyState({ icon: 'inbox', title: 'Nessuna richiesta', compact: true }),
            })}
            ${section({
              title: 'Attività', iconName: 'check-square', count: data.tasks.filter((t) => t.status !== 'fatto').length,
              action: button('new-task', 'Nuova', { small: true }),
              body: data.tasks.length ? html`<ul class="crm-list">${data.tasks.map((t) => row({
                id: t.id, action: 'edit-task', check: { action: 'toggle-task', done: t.status === 'fatto' },
                title: t.title, meta: labelOf(TASK_STATUS, t.status).label,
                aside: t.status !== 'fatto' ? due(t.due_date) : '', muted: t.status === 'fatto',
              }))}</ul>` : emptyState({ icon: 'check-square', title: 'Nessuna attività', compact: true }),
            })}
          </div>

          <aside class="crm-detail__side">
            <section class="card crm-section">
              <div class="card__head"><h3 class="card__title">${icon('user')}Contatti</h3></div>
              <div class="card__body">
                <dl class="crm-kv">
                  ${kv('Referente', c.contact_name)}
                  ${kv('Email', c.email, c.email ? `mailto:${c.email}` : '')}
                  ${kv('Telefono', c.phone, c.phone ? `tel:${c.phone.replace(/\s+/g, '')}` : '')}
                  ${kv('Sito', c.website, /^https?:\/\//i.test(c.website) ? c.website : '')}
                  ${kv('Partita IVA', c.vat_number)}
                  ${kv('Codice fiscale', c.tax_code)}
                  ${kv('Indirizzo', [c.address, [c.zip, c.city, c.province ? `(${c.province})` : ''].filter(Boolean).join(' ')].filter(Boolean).join(', '))}
                </dl>
              </div>
            </section>
            ${section({
              title: 'Promemoria', iconName: 'bell', count: data.reminders.length,
              action: button('new-reminder', 'Nuovo', { small: true }),
              body: data.reminders.length ? html`<ul class="crm-list">${data.reminders.map((r) => row({
                id: r.id, action: 'edit-reminder', check: { action: 'toggle-reminder', done: r.done },
                title: r.title, aside: due(r.remind_at, { withTime: true }),
              }))}</ul>` : emptyState({ icon: 'bell', title: 'Nessun promemoria', compact: true }),
            })}
            ${c.notes ? html`
              <section class="card crm-section">
                <div class="card__head"><h3 class="card__title">${icon('note')}Note</h3></div>
                <div class="card__body"><p class="crm-notes">${c.notes}</p></div>
              </section>` : ''}
          </aside>
        </div>
      </div>`);
  };

  const find = (listName, rid) => data?.[listName]?.find((x) => x.id === rid);
  const act = (fn) => async (...args) => { try { await fn(...args); } catch (err) { toast.error(err.message); } };

  const offs = [
    on(container, 'click', '[data-action="reload"]', load),
    on(container, 'click', '[data-action="edit"]', act(() => editClient(data.client))),
    on(container, 'click', '[data-action="archive"]', act(async () => { await update('clients', id, { status: 'archiviato' }); toast.success('Cliente archiviato.'); })),
    on(container, 'click', '[data-action="unarchive"]', act(async () => { await update('clients', id, { status: 'attivo' }); toast.success('Cliente riattivato.'); })),
    on(container, 'click', '[data-action="delete"]', act(async () => {
      if (await deleteRow('clients', data.client, data.client.name)) location.hash = hrefFor('clients');
    })),
    on(container, 'click', '[data-action="new-project"]', act(() => editProject(null, { client_id: id }))),
    on(container, 'click', '[data-action="new-request"]', act(() => editRequest(null, { client_id: id }))),
    on(container, 'click', '[data-action="new-task"]', act(() => editTask(null, { client_id: id }))),
    on(container, 'click', '[data-action="new-reminder"]', act(() => editReminder(null, { client_id: id }))),
    on(container, 'click', '[data-action="edit-task"]', act((_e, el) => editTask(find('tasks', el.dataset.id)))),
    on(container, 'click', '[data-action="toggle-task"]', act((_e, el) => toggleTask(find('tasks', el.dataset.id)))),
    on(container, 'click', '[data-action="edit-reminder"]', act((_e, el) => editReminder(find('reminders', el.dataset.id)))),
    on(container, 'click', '[data-action="toggle-reminder"]', act((_e, el) => toggleReminder(find('reminders', el.dataset.id)))),
    onDataChange(() => load()),
  ];

  draw();
  load();
  return () => offs.forEach((off) => off());
}

/** Attività aperte prima, quelle fatte in fondo. */
export const openFirst = (rows) => [...rows].sort((a, b) => (a.status === 'fatto') - (b.status === 'fatto'));

const backLink = () => html`<a class="crm-back" href="${hrefFor('clients')}">${icon('chevrons-left', 'icon--sm')}<span>Tutti i clienti</span></a>`;

function kv(label, value, href = '') {
  return html`<div class="crm-kv__row"><dt>${label}</dt><dd>${value ? (href ? html`<a class="link" href="${href}" ${href.startsWith('http') ? html`target="_blank" rel="noopener noreferrer"` : ''}>${value}</a>` : value) : html`<span class="crm-empty">—</span>`}</dd></div>`;
}
