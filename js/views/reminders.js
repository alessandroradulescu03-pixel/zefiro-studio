/**
 * Promemoria (#/promemoria): cose da ricordare a una data e ora precise.
 */

import { html, render, on } from '../utils/dom.js';
import { list, onDataChange } from '../core/api.js';
import { editReminder, toggleReminder, deleteRow } from '../services/crm-service.js';
import { emptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { formatDateTime } from '../utils/format.js';
import { pageHead, button, toolbar, row, loadingList, errorBox, due } from './crm-ui.js';

const FILTER = [
  { value: 'da_fare', label: 'Da fare' },
  { value: 'fatti', label: 'Fatti' },
  { value: 'tutti', label: 'Tutti' },
];

export default {
  mount(container) {
    const state = { show: 'da_fare', rows: null, error: '', q: '' };

    render(container, html`
      <div class="view-enter">
        ${pageHead({ eyebrow: 'Management', title: 'Promemoria', text: 'Richiami, consegne e scadenze da non dimenticare.', actions: button('new', 'Nuovo promemoria', { primary: true }) })}
        ${toolbar({ placeholder: 'Cerca un promemoria…', filters: [{ name: 'show', label: 'Mostra', options: FILTER, value: state.show }] })}
        <div class="card"><div class="card__body" data-slot="list"></div></div>
      </div>`);
    const slot = container.querySelector('[data-slot="list"]');

    const visible = () => (state.rows || []).filter((r) => !state.q || r.title.toLowerCase().includes(state.q.toLowerCase()));

    const draw = () => {
      if (state.error) return render(slot, errorBox(state.error));
      if (!state.rows) return render(slot, loadingList());
      const rows = visible();
      if (!rows.length) {
        return render(slot, emptyState(state.q || state.show !== 'da_fare'
          ? { icon: 'search', title: 'Nessun promemoria trovato', compact: true }
          : { icon: 'bell', title: 'Nessun promemoria in sospeso', text: 'Aggiungi un promemoria per richiamare un cliente o ricordarti una consegna.', actions: [{ label: 'Nuovo promemoria', action: 'new', primary: true, icon: 'plus' }] }));
      }
      render(slot, html`<ul class="crm-list">${rows.map((r) => row({
        id: r.id, action: 'edit', check: { action: 'toggle', done: r.done },
        title: r.title,
        meta: [formatDateTime(r.remind_at), r.client?.name, r.project?.name].filter(Boolean).join(' · '),
        aside: html`${r.done ? '' : due(r.remind_at, { withTime: true })}
          <button type="button" class="icon-btn" data-action="delete" data-id="${r.id}" aria-label="Elimina promemoria">${icon('trash', 'icon--sm')}</button>`,
        muted: r.done,
      }))}</ul>`);
    };

    const load = async () => {
      state.error = '';
      const query = { select: '*,client:clients(id,name),project:projects(id,name)', limit: '1000' };
      if (state.show === 'da_fare') { query.done = 'eq.false'; query.order = 'remind_at.asc'; }
      else if (state.show === 'fatti') { query.done = 'eq.true'; query.order = 'remind_at.desc'; }
      else query.order = 'done.asc,remind_at.asc';
      try { state.rows = await list('reminders', query); } catch (err) { state.error = err.message; }
      draw();
    };

    const find = (rid) => state.rows?.find((r) => r.id === rid);
    const act = (fn) => async (...args) => { try { await fn(...args); } catch (err) { toast.error(err.message); } };

    const offs = [
      on(container, 'click', '[data-action="new"]', act(() => editReminder())),
      on(container, 'click', '[data-action="reload"]', load),
      on(container, 'click', '[data-action="edit"]', act((_e, el) => editReminder(find(el.dataset.id)))),
      on(container, 'click', '[data-action="toggle"]', act((_e, el) => toggleReminder(find(el.dataset.id)))),
      on(container, 'click', '[data-action="delete"]', act((_e, el) => { const r = find(el.dataset.id); return deleteRow('reminders', r, r.title); })),
      on(container, 'input', '[data-role="search"]', (_e, el) => { state.q = el.value.trim(); draw(); }),
      on(container, 'change', '[data-role="filter"]', (_e, el) => { state.show = el.value; state.rows = null; draw(); load(); }),
      onDataChange((d) => { if (['reminders', 'projects', 'clients'].includes(d.table)) load(); }),
    ];

    draw();
    load();
    return () => offs.forEach((off) => off());
  },
};
