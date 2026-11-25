/**
 * Progetti: elenco (#/progetti) e scheda progetto (#/progetti/<id>).
 */

import { html, render, on } from '../utils/dom.js';
import { hrefFor } from '../config/modules.js';
import { list, getOne, update, onDataChange } from '../core/api.js';
import { PROJECT_STATUS, ACTIVE_PROJECTS, REQUEST_STATUS, TASK_STATUS, labelOf } from '../config/crm.js';
import {
  editProject, editTask, editReminder, editNote, toggleTask, toggleReminder, deleteRow,
} from '../services/crm-service.js';
import { emptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { formatDate, formatRelative } from '../utils/format.js';
import { noteCard, bindNoteActions } from './notes.js';
import {
  badge, pageHead, button, toolbar, row, loadingList, errorBox, ilike, section, due, money,
} from './crm-ui.js';

const STATUS_FILTER = [
  { value: 'attivi', label: 'In lavorazione' },
  ...PROJECT_STATUS.map((o) => ({ value: o.value, label: o.label })),
  { value: 'tutti', label: 'Tutti' },
];

const openFirst = (rows) => [...rows].sort((a, b) => (a.status === 'fatto') - (b.status === 'fatto'));

export default {
  mount(container, { segments }) {
    return segments[0] ? mountDetail(container, segments[0]) : mountList(container);
  },
};

/* ======================= ELENCO ======================= */

function mountList(container) {
  const state = { q: '', status: 'attivi', rows: null, error: '' };
  let timer;

  render(container, html`
    <div class="view-enter">
      ${pageHead({ title: 'Progetti', text: 'I lavori dello studio, con stato, scadenza e cliente.', actions: button('new', 'Nuovo progetto', { primary: true }) })}
      ${toolbar({ placeholder: 'Cerca un progetto…', filters: [{ name: 'status', label: 'Stato', options: STATUS_FILTER, value: state.status }] })}
      <div class="card"><div class="card__body" data-slot="list"></div></div>
    </div>`);
  const slot = container.querySelector('[data-slot="list"]');

  const draw = () => {
    if (state.error) return render(slot, errorBox(state.error));
    if (!state.rows) return render(slot, loadingList());
    if (!state.rows.length) {
      return render(slot, emptyState(state.q || state.status !== 'attivi'
        ? { icon: 'search', title: 'Nessun progetto trovato', text: 'Prova a cambiare la ricerca o il filtro.', compact: true }
        : { icon: 'folder', title: 'Nessun progetto in lavorazione', text: 'Crea un progetto, oppure trasforma in progetto un contatto in arrivo.', actions: [{ label: 'Nuovo progetto', action: 'new', primary: true, icon: 'plus' }] }));
    }
    render(slot, html`<ul class="crm-list">${state.rows.map((p) => row({
      href: hrefFor('projects', p.id), iconName: 'folder', title: p.name,
      meta: [p.client?.name || 'Senza cliente', p.amount !== null ? money(p.amount) : ''].filter(Boolean).join(' · '),
      aside: html`${ACTIVE_PROJECTS.includes(p.status) ? due(p.due_date) : ''} ${badge(PROJECT_STATUS, p.status)}`,
      muted: ['completato', 'annullato'].includes(p.status),
    }))}</ul>`);
  };

  const load = async () => {
    state.error = '';
    const query = { select: '*,client:clients(id,name)', order: 'due_date.asc.nullslast,created_at.desc', limit: '500' };
    if (state.status === 'attivi') query.status = `in.(${ACTIVE_PROJECTS.join(',')})`;
    else if (state.status !== 'tutti') query.status = `eq.${state.status}`;
    if (state.q) query.name = `ilike.${ilike(state.q)}`;
    try { state.rows = await list('projects', query); } catch (err) { state.error = err.message; }
    draw();
  };

  const offs = [
    on(container, 'click', '[data-action="new"]', async () => {
      try { const p = await editProject(); if (p) location.hash = hrefFor('projects', p.id); } catch (err) { toast.error(err.message); }
    }),
    on(container, 'click', '[data-action="reload"]', load),
    on(container, 'input', '[data-role="search"]', (_e, el) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = el.value.trim(); load(); }, 250);
    }),
    on(container, 'change', '[data-role="filter"]', (_e, el) => { state.status = el.value; state.rows = null; draw(); load(); }),
    onDataChange((d) => { if (d.table === 'projects') load(); }),
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
      const [project, tasks, reminders, requests, notes] = await Promise.all([
        getOne('projects', id, '*,client:clients(id,name)'),
        list('tasks', { project_id: `eq.${id}`, order: 'due_date.asc.nullslast,created_at.asc' }).then(openFirst),
        list('reminders', { project_id: `eq.${id}`, done: 'eq.false', order: 'remind_at.asc' }),
        list('requests', { project_id: `eq.${id}`, order: 'received_at.desc' }),
        list('notes', { project_id: `eq.${id}`, order: 'pinned.desc,updated_at.desc' }).catch(() => []),
      ]);
      data = { project, tasks, reminders, requests, notes };
      error = '';
    } catch (err) { error = err.message; }
    draw();
  };

  const draw = () => {
    if (error) return render(container, html`<div class="view-enter">${backLink()}${errorBox(error)}</div>`);
    if (!data) return render(container, html`<div class="view-enter">${backLink()}<div class="card"><div class="card__body">${loadingList()}</div></div></div>`);
    const p = data.project;
    if (!p) {
      return render(container, html`<div class="view-enter">${backLink()}<div class="card">${emptyState({
        icon: 'folder', title: 'Progetto non trovato', text: 'Potrebbe essere stato eliminato.', actions: [{ label: 'Torna ai progetti', href: hrefFor('projects'), primary: true }],
      })}</div></div>`);
    }
    const open = data.tasks.filter((t) => t.status !== 'fatto').length;
    const total = data.tasks.length;
    const pct = total ? Math.round(((total - open) / total) * 100) : 0;
    const closed = ['completato', 'annullato'].includes(p.status);

    render(container, html`
      <div class="view-enter">
        ${backLink()}
        <header class="crm-detail-head">
          <span class="crm-avatar crm-avatar--lg">${icon('folder')}</span>
          <div class="crm-detail-head__text">
            <h2 class="page-head__title">${p.name}</h2>
            <p class="crm-detail-head__meta">${badge(PROJECT_STATUS, p.status)}
              ${p.client ? html`<a class="link" href="${hrefFor('clients', p.client.id)}">${p.client.name}</a>` : html`<span>Senza cliente</span>`}</p>
          </div>
          <div class="page-head__actions">
            ${closed ? '' : button('complete', 'Completa', { iconName: 'check' })}
            ${button('edit', 'Modifica', { iconName: 'settings' })}
            ${button('delete', 'Elimina', { iconName: 'trash', danger: true })}
          </div>
        </header>

        <div class="crm-detail">
          <div class="crm-detail__main">
            ${section({
              title: 'Da fare', iconName: 'check-square', count: `${total - open}/${total}`,
              action: button('new-task', 'Aggiungi', { small: true }),
              body: html`
                ${total ? html`<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Cose fatte">
                  <div class="progress__bar" style="width:${pct}%"></div></div>` : ''}
                ${total ? html`<ul class="crm-list" style="margin-top:var(--sp-3)">${data.tasks.map((t) => row({
                  id: t.id, action: 'edit-task', check: { action: 'toggle-task', done: t.status === 'fatto' },
                  title: t.title, meta: labelOf(TASK_STATUS, t.status).label,
                  aside: t.status !== 'fatto' ? due(t.due_date) : '', muted: t.status === 'fatto',
                }))}</ul>` : emptyState({ icon: 'check-square', title: 'Niente da fare', text: 'Aggiungi qui le cose da fare e le modifiche chieste dal cliente, e spuntale man mano.', compact: true })}`,
            })}
            ${section({
              title: 'Note', iconName: 'note', count: data.notes.length,
              action: button('new-note', 'Aggiungi', { small: true }),
              body: data.notes.length ? html`<div class="notes-stack">${data.notes.map((n) => noteCard(n, { showLinks: false }))}</div>`
                : emptyState({ icon: 'note', title: 'Nessuna nota', text: 'Scelte di colori, font, accessi, cosa ti ha chiesto il cliente…', compact: true }),
            })}
            ${p.description ? html`
              <section class="card crm-section">
                <div class="card__head"><h3 class="card__title">${icon('info')}Descrizione</h3></div>
                <div class="card__body"><p class="crm-notes">${p.description}</p></div>
              </section>` : ''}
          </div>

          <aside class="crm-detail__side">
            <section class="card crm-section">
              <div class="card__head"><h3 class="card__title">${icon('info')}Dettagli</h3></div>
              <div class="card__body">
                <dl class="crm-kv">
                  ${kv('Importo', p.amount !== null ? money(p.amount) : '')}
                  ${kv('Inizio', p.start_date ? formatDate(p.start_date) : '')}
                  ${kv('Scadenza', p.due_date ? (closed ? formatDate(p.due_date) : due(p.due_date)) : '')}
                  ${kv('Completato il', p.completed_at ? formatDate(p.completed_at) : '')}
                  ${kv('Creato', formatRelative(p.created_at))}
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
            ${data.requests.length ? section({
              title: 'Contatto di origine', iconName: 'inbox',
              body: html`<ul class="crm-list">${data.requests.map((r) => row({
                href: hrefFor('requests', r.id), title: r.title, meta: formatRelative(r.received_at), aside: badge(REQUEST_STATUS, r.status),
              }))}</ul>`,
            }) : ''}
          </aside>
        </div>
      </div>`);
  };

  const find = (listName, rid) => data?.[listName]?.find((x) => x.id === rid);
  const act = (fn) => async (...args) => { try { await fn(...args); } catch (err) { toast.error(err.message); } };

  const offs = [
    on(container, 'click', '[data-action="reload"]', load),
    on(container, 'click', '[data-action="edit"]', act(() => editProject(data.project))),
    on(container, 'click', '[data-action="complete"]', act(async () => {
      await update('projects', id, { status: 'completato', completed_at: new Date().toISOString() });
      toast.success('Progetto completato 🎉');
    })),
    on(container, 'click', '[data-action="delete"]', act(async () => {
      if (await deleteRow('projects', data.project, data.project.name)) location.hash = hrefFor('projects');
    })),
    on(container, 'click', '[data-action="new-task"]', act(() => editTask(null, { project_id: id, client_id: data.project.client_id }))),
    on(container, 'click', '[data-action="new-reminder"]', act(() => editReminder(null, { project_id: id, client_id: data.project.client_id }))),
    on(container, 'click', '[data-action="new-note"]', act(() => editNote(null, { project_id: id, client_id: data.project.client_id }))),
    ...bindNoteActions(container, (nid) => find('notes', nid)),
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

const backLink = () => html`<a class="crm-back" href="${hrefFor('projects')}">${icon('chevrons-left', 'icon--sm')}<span>Tutti i progetti</span></a>`;
const kv = (label, value) => html`<div class="crm-kv__row"><dt>${label}</dt><dd>${value || html`<span class="crm-empty">—</span>`}</dd></div>`;
