/**
 * Attività (#/attivita): tutte le cose da fare, con scadenza, progetto e cliente.
 */

import { html, render, on } from '../utils/dom.js';
import { list, onDataChange } from '../core/api.js';
import { TASK_STATUS, PRIORITY } from '../config/crm.js';
import { editTask, toggleTask, deleteRow } from '../services/crm-service.js';
import { emptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { daysFromToday } from '../utils/format.js';
import { badge, pageHead, button, toolbar, row, loadingList, errorBox, ilike, due } from './crm-ui.js';

const STATUS_FILTER = [
  { value: 'aperte', label: 'Da completare' },
  ...TASK_STATUS.map((o) => ({ value: o.value, label: o.label })),
  { value: 'tutte', label: 'Tutte' },
];

/** Gruppi per le attività aperte. */
function groupOf(t) {
  if (t.status === 'fatto') return 'Completate';
  if (!t.due_date) return 'Senza scadenza';
  const d = daysFromToday(t.due_date);
  if (d < 0) return 'In ritardo';
  if (d === 0) return 'Oggi';
  if (d <= 7) return 'Prossimi 7 giorni';
  return 'Più avanti';
}
const GROUP_ORDER = ['In ritardo', 'Oggi', 'Prossimi 7 giorni', 'Più avanti', 'Senza scadenza', 'Completate'];

export default {
  mount(container) {
    const state = { q: '', status: 'aperte', rows: null, error: '' };
    let timer;

    render(container, html`
      <div class="view-enter">
        ${pageHead({ title: 'Attività', text: 'Le cose da fare, ordinate per scadenza. Spunta il cerchio per completarle.', actions: button('new', 'Nuova attività', { primary: true }) })}
        ${toolbar({ placeholder: 'Cerca un\'attività…', filters: [{ name: 'status', label: 'Stato', options: STATUS_FILTER, value: state.status }] })}
        <div data-slot="list"></div>
      </div>`);
    const slot = container.querySelector('[data-slot="list"]');

    const draw = () => {
      if (state.error) return render(slot, html`<div class="card"><div class="card__body">${errorBox(state.error)}</div></div>`);
      if (!state.rows) return render(slot, html`<div class="card"><div class="card__body">${loadingList()}</div></div>`);
      if (!state.rows.length) {
        return render(slot, html`<div class="card">${emptyState(state.q || state.status !== 'aperte'
          ? { icon: 'search', title: 'Nessuna attività trovata', text: 'Prova a cambiare la ricerca o il filtro.', compact: true }
          : { icon: 'check-square', title: 'Tutto fatto!', text: 'Non hai attività da completare.', actions: [{ label: 'Nuova attività', action: 'new', primary: true, icon: 'plus' }] })}</div>`);
      }
      const groups = new Map(GROUP_ORDER.map((g) => [g, []]));
      state.rows.forEach((t) => groups.get(groupOf(t)).push(t));
      render(slot, html`${[...groups].filter(([, items]) => items.length).map(([name, items]) => html`
        <section class="card crm-section crm-group">
          <div class="card__head"><h3 class="card__title">${name} <span class="crm-count">${items.length}</span></h3></div>
          <div class="card__body">
            <ul class="crm-list">${items.map((t) => row({
              id: t.id, action: 'edit', check: { action: 'toggle', done: t.status === 'fatto' },
              title: t.title,
              meta: [t.project?.name, t.client?.name].filter(Boolean).join(' · ') || 'Generale',
              aside: html`${t.priority === 'alta' ? badge(PRIORITY, 'alta') : ''} ${t.status === 'in_corso' ? badge(TASK_STATUS, 'in_corso') : ''} ${t.status !== 'fatto' ? due(t.due_date) : ''}
                <button type="button" class="icon-btn" data-action="delete" data-id="${t.id}" aria-label="Elimina attività">${icon('trash', 'icon--sm')}</button>`,
              muted: t.status === 'fatto',
            }))}</ul>
          </div>
        </section>`)}`);
    };

    const load = async () => {
      state.error = '';
      const query = {
        select: '*,project:projects(id,name),client:clients(id,name)',
        order: 'due_date.asc.nullslast,created_at.asc', limit: '1000',
      };
      if (state.status === 'aperte') query.status = 'neq.fatto';
      else if (state.status !== 'tutte') query.status = `eq.${state.status}`;
      if (state.q) query.title = `ilike.${ilike(state.q)}`;
      try { state.rows = await list('tasks', query); } catch (err) { state.error = err.message; }
      draw();
    };

    const find = (tid) => state.rows?.find((t) => t.id === tid);
    const act = (fn) => async (...args) => { try { await fn(...args); } catch (err) { toast.error(err.message); } };

    const offs = [
      on(container, 'click', '[data-action="new"]', act(() => editTask())),
      on(container, 'click', '[data-action="reload"]', load),
      on(container, 'click', '[data-action="edit"]', act((_e, el) => editTask(find(el.dataset.id)))),
      on(container, 'click', '[data-action="toggle"]', act((_e, el) => toggleTask(find(el.dataset.id)))),
      on(container, 'click', '[data-action="delete"]', act((_e, el) => { const t = find(el.dataset.id); return deleteRow('tasks', t, t.title); })),
      on(container, 'input', '[data-role="search"]', (_e, el) => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.q = el.value.trim(); load(); }, 250);
      }),
      on(container, 'change', '[data-role="filter"]', (_e, el) => { state.status = el.value; state.rows = null; draw(); load(); }),
      onDataChange((d) => { if (['tasks', 'projects', 'clients'].includes(d.table)) load(); }),
    ];

    draw();
    load();
    return () => { clearTimeout(timer); offs.forEach((off) => off()); };
  },
};
