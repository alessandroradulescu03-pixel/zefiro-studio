/**
 * Note (#/note): appunti liberi o collegati a un cliente / progetto.
 * Le note in evidenza restano sempre in cima.
 */

import { html, render, on } from '../utils/dom.js';
import { hrefFor } from '../config/modules.js';
import { list, onDataChange } from '../core/api.js';
import { editNote, toggleNotePin, deleteRow, clientOptions } from '../services/crm-service.js';
import { emptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { formatRelative } from '../utils/format.js';
import { pageHead, button, toolbar, loadingList, errorBox, ilike } from './crm-ui.js';

export const noteTitle = (n) => n.title || n.body.split('\n')[0].slice(0, 60) || 'Nota';

/** Scheda di una nota, usata anche nelle schede cliente e progetto. */
export function noteCard(n, { showLinks = true } = {}) {
  const excerpt = n.title ? n.body : n.body.split('\n').slice(1).join('\n');
  return html`
    <article class="note ${n.pinned ? 'is-pinned' : ''}">
      <button type="button" class="note__open" data-action="edit-note" data-id="${n.id}" aria-label="Apri la nota ${noteTitle(n)}">
        <h3 class="note__title">${noteTitle(n)}</h3>
        ${excerpt.trim() ? html`<p class="note__body">${excerpt.length > 320 ? `${excerpt.slice(0, 320)}…` : excerpt}</p>` : ''}
      </button>
      <footer class="note__foot">
        ${showLinks && (n.client || n.project) ? html`<span class="note__links">
          ${n.client ? html`<a class="note__chip" href="${hrefFor('clients', n.client.id)}">${icon('users', 'icon--sm')}${n.client.name}</a>` : ''}
          ${n.project ? html`<a class="note__chip" href="${hrefFor('projects', n.project.id)}">${icon('folder', 'icon--sm')}${n.project.name}</a>` : ''}
        </span>` : html`<span class="note__date">${formatRelative(n.updated_at)}</span>`}
        <span class="note__tools">
          <button type="button" class="icon-btn ${n.pinned ? 'is-on' : ''}" data-action="pin-note" data-id="${n.id}"
            aria-pressed="${String(n.pinned)}" aria-label="${n.pinned ? 'Togli dall\'evidenza' : 'Metti in evidenza'}" title="${n.pinned ? 'Togli dall\'evidenza' : 'In evidenza'}">${icon('flag', 'icon--sm')}</button>
          <button type="button" class="icon-btn" data-action="delete-note" data-id="${n.id}" aria-label="Elimina la nota" title="Elimina">${icon('trash', 'icon--sm')}</button>
        </span>
      </footer>
    </article>`;
}

/** Collega i pulsanti delle schede nota dentro un contenitore. */
export function bindNoteActions(container, findNote) {
  const act = (fn) => async (_e, el) => { try { await fn(findNote(el.dataset.id)); } catch (err) { toast.error(err.message); } };
  return [
    on(container, 'click', '[data-action="edit-note"]', act((n) => editNote(n))),
    on(container, 'click', '[data-action="pin-note"]', act((n) => toggleNotePin(n))),
    on(container, 'click', '[data-action="delete-note"]', act((n) => deleteRow('notes', n, noteTitle(n)))),
  ];
}

export default {
  mount(container) {
    const state = { q: '', filter: 'tutte', rows: null, error: '', clients: [] };
    let timer;

    const filters = () => [{
      name: 'filter', label: 'Mostra',
      options: [
        { value: 'tutte', label: 'Tutte le note' },
        { value: 'evidenza', label: '📌 In evidenza' },
        { value: 'libere', label: 'Non collegate' },
        ...state.clients.map((c) => ({ value: `c:${c.value}`, label: `Cliente: ${c.label}` })),
      ],
      value: state.filter,
    }];

    const frame = () => render(container, html`
      <div class="view-enter">
        ${pageHead({ eyebrow: 'Management', title: 'Note', text: 'Appunti veloci: cosa ti ha detto un cliente, idee, scelte di colori e font…', actions: button('new', 'Nuova nota', { primary: true }) })}
        ${toolbar({ placeholder: 'Cerca nelle note…', filters: filters(), search: state.q })}
        <div data-slot="list"></div>
      </div>`);
    frame();
    let slot = container.querySelector('[data-slot="list"]');

    const draw = () => {
      if (state.error) return render(slot, html`<div class="card"><div class="card__body">${errorBox(state.error)}</div></div>`);
      if (!state.rows) return render(slot, html`<div class="card"><div class="card__body">${loadingList()}</div></div>`);
      if (!state.rows.length) {
        return render(slot, html`<div class="card">${emptyState(state.q || state.filter !== 'tutte'
          ? { icon: 'search', title: 'Nessuna nota trovata', text: 'Prova a cambiare la ricerca o il filtro.', compact: true }
          : { icon: 'note', title: 'Ancora nessuna nota', text: 'Scrivi qui gli appunti che oggi tieni sparsi tra Note, WhatsApp e post-it.', actions: [{ label: 'Nuova nota', action: 'new', primary: true, icon: 'plus' }] })}</div>`);
      }
      render(slot, html`<div class="notes-grid">${state.rows.map((n) => noteCard(n))}</div>`);
    };

    const load = async () => {
      state.error = '';
      const query = { select: '*,client:clients(id,name),project:projects(id,name)', order: 'pinned.desc,updated_at.desc', limit: '500' };
      if (state.filter === 'evidenza') query.pinned = 'eq.true';
      else if (state.filter === 'libere') { query.client_id = 'is.null'; query.project_id = 'is.null'; }
      else if (state.filter.startsWith('c:')) query.client_id = `eq.${state.filter.slice(2)}`;
      if (state.q) query.or = `(title.ilike.${ilike(state.q)},body.ilike.${ilike(state.q)})`;
      try { state.rows = await list('notes', query); } catch (err) { state.error = err.message; }
      draw();
    };

    const offs = [
      on(container, 'click', '[data-action="new"]', async () => {
        const preset = state.filter.startsWith('c:') ? { client_id: state.filter.slice(2) } : {};
        try { await editNote(null, preset); } catch (err) { toast.error(err.message); }
      }),
      on(container, 'click', '[data-action="reload"]', load),
      on(container, 'input', '[data-role="search"]', (_e, el) => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.q = el.value.trim(); load(); }, 250);
      }),
      on(container, 'change', '[data-role="filter"]', (_e, el) => { state.filter = el.value; state.rows = null; draw(); load(); }),
      ...bindNoteActions(container, (id) => state.rows?.find((n) => n.id === id)),
      onDataChange((d) => { if (['notes', 'clients', 'projects'].includes(d.table)) load(); }),
    ];

    draw();
    load();
    clientOptions().then((c) => {
      state.clients = c;
      const sel = container.querySelector('[data-role="filter"]');
      if (sel) {
        const current = sel.value;
        sel.innerHTML = String(html`${filters()[0].options.map((opt) => html`<option value="${opt.value}">${opt.label}</option>`)}`);
        sel.value = current;
      }
    }).catch(() => {});

    return () => { clearTimeout(timer); offs.forEach((off) => off()); };
  },
};
