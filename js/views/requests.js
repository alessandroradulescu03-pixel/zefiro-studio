/**
 * Richieste: elenco (#/richieste) e scheda richiesta (#/richieste/<id>).
 * Una richiesta può diventare cliente e/o progetto con un clic.
 */

import { html, render, on } from '../utils/dom.js';
import { hrefFor } from '../config/modules.js';
import { list, getOne, update, onDataChange } from '../core/api.js';
import { REQUEST_STATUS, REQUEST_SOURCE, PRIORITY, OPEN_REQUESTS, labelOf } from '../config/crm.js';
import {
  editRequest, convertRequestToClient, convertRequestToProject, deleteRow,
} from '../services/crm-service.js';
import { emptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { formatDateTime, formatRelative } from '../utils/format.js';
import {
  badge, pageHead, button, toolbar, row, loadingList, errorBox, ilike, section,
} from './crm-ui.js';

const STATUS_FILTER = [
  { value: 'aperte', label: 'Da gestire' },
  ...REQUEST_STATUS.map((o) => ({ value: o.value, label: o.label })),
  { value: 'tutte', label: 'Tutte' },
];
const SOURCE_FILTER = [{ value: '', label: 'Tutte le provenienze' }, ...REQUEST_SOURCE.map((o) => ({ value: o.value, label: o.label }))];

export default {
  mount(container, { segments }) {
    return segments[0] ? mountDetail(container, segments[0]) : mountList(container);
  },
};

const who = (r) => r.client?.name || r.contact_name || r.contact_email || 'Contatto non indicato';

/* ======================= ELENCO ======================= */

function mountList(container) {
  const state = { q: '', status: 'aperte', source: '', rows: null, error: '' };
  let timer;

  render(container, html`
    <div class="view-enter">
      ${pageHead({ title: 'Contatti in arrivo', text: 'Chi ti scrive per un lavoro (Instagram, WhatsApp, email, sito…). Valutalo e trasformalo in cliente e progetto con un clic.', actions: button('new', 'Nuovo contatto', { primary: true }) })}
      ${toolbar({
        placeholder: 'Cerca per nome, email o cosa chiede…',
        filters: [
          { name: 'status', label: 'Stato', options: STATUS_FILTER, value: state.status },
          { name: 'source', label: 'Provenienza', options: SOURCE_FILTER, value: state.source },
        ],
      })}
      <div class="card"><div class="card__body" data-slot="list"></div></div>
    </div>`);
  const slot = container.querySelector('[data-slot="list"]');

  const draw = () => {
    if (state.error) return render(slot, errorBox(state.error));
    if (!state.rows) return render(slot, loadingList());
    if (!state.rows.length) {
      return render(slot, emptyState(state.q || state.status !== 'aperte' || state.source
        ? { icon: 'search', title: 'Nessun contatto trovato', text: 'Prova a cambiare la ricerca o i filtri.', compact: true }
        : { icon: 'inbox', title: 'Nessun contatto da gestire', text: 'Quando qualcuno ti scrive per un lavoro, registralo qui.', actions: [{ label: 'Nuovo contatto', action: 'new', primary: true, icon: 'plus' }] }));
    }
    render(slot, html`<ul class="crm-list">${state.rows.map((r) => row({
      href: hrefFor('requests', r.id), iconName: 'inbox', title: r.title,
      meta: `${who(r)} · ${labelOf(REQUEST_SOURCE, r.source).label} · ${formatRelative(r.received_at)}`,
      aside: html`${r.priority === 'alta' ? badge(PRIORITY, r.priority) : ''} ${badge(REQUEST_STATUS, r.status)}`,
      muted: !OPEN_REQUESTS.includes(r.status),
    }))}</ul>`);
  };

  const load = async () => {
    state.error = '';
    const query = { select: '*,client:clients(id,name)', order: 'received_at.desc', limit: '500' };
    if (state.status === 'aperte') query.status = `in.(${OPEN_REQUESTS.join(',')})`;
    else if (state.status !== 'tutte') query.status = `eq.${state.status}`;
    if (state.source) query.source = `eq.${state.source}`;
    if (state.q) query.or = `(title.ilike.${ilike(state.q)},contact_name.ilike.${ilike(state.q)},contact_email.ilike.${ilike(state.q)})`;
    try { state.rows = await list('requests', query); } catch (err) { state.error = err.message; }
    draw();
  };

  const offs = [
    on(container, 'click', '[data-action="new"]', async () => {
      try { const r = await editRequest(); if (r) location.hash = hrefFor('requests', r.id); } catch (err) { toast.error(err.message); }
    }),
    on(container, 'click', '[data-action="reload"]', load),
    on(container, 'input', '[data-role="search"]', (_e, el) => {
      clearTimeout(timer);
      timer = setTimeout(() => { state.q = el.value.trim(); load(); }, 250);
    }),
    on(container, 'change', '[data-role="filter"]', (_e, el) => { state[el.dataset.name] = el.value; state.rows = null; draw(); load(); }),
    onDataChange((d) => { if (d.table === 'requests') load(); }),
  ];

  draw();
  load();
  return () => { clearTimeout(timer); offs.forEach((off) => off()); };
}

/* ======================= SCHEDA ======================= */

function mountDetail(container, id) {
  let req;
  let error = '';
  let loaded = false;

  const load = async () => {
    try { req = await getOne('requests', id, '*,client:clients(id,name),project:projects(id,name)'); error = ''; } catch (err) { error = err.message; }
    loaded = true;
    draw();
  };

  const draw = () => {
    if (error) return render(container, html`<div class="view-enter">${backLink()}${errorBox(error)}</div>`);
    if (!loaded) return render(container, html`<div class="view-enter">${backLink()}<div class="card"><div class="card__body">${loadingList()}</div></div></div>`);
    if (!req) {
      return render(container, html`<div class="view-enter">${backLink()}<div class="card">${emptyState({
        icon: 'inbox', title: 'Contatto non trovato', text: 'Potrebbe essere stato eliminato.', actions: [{ label: 'Torna ai contatti', href: hrefFor('requests'), primary: true }],
      })}</div></div>`);
    }
    const r = req;
    const open = OPEN_REQUESTS.includes(r.status);
    render(container, html`
      <div class="view-enter">
        ${backLink()}
        <header class="crm-detail-head">
          <span class="crm-avatar crm-avatar--lg">${icon('inbox')}</span>
          <div class="crm-detail-head__text">
            <h2 class="page-head__title">${r.title}</h2>
            <p class="crm-detail-head__meta">${badge(REQUEST_STATUS, r.status)} ${badge(PRIORITY, r.priority)}
              <span>${labelOf(REQUEST_SOURCE, r.source).label} · ${formatDateTime(r.received_at)}</span></p>
          </div>
          <div class="page-head__actions">
            ${button('edit', 'Modifica', { iconName: 'settings' })}
            ${button('delete', 'Elimina', { iconName: 'trash', danger: true })}
          </div>
        </header>

        <div class="crm-detail">
          <div class="crm-detail__main">
            <section class="card crm-section">
              <div class="card__head"><h3 class="card__title">${icon('note')}Cosa chiede</h3></div>
              <div class="card__body">${r.description ? html`<p class="crm-notes">${r.description}</p>` : html`<p class="crm-empty">Nessuna descrizione.</p>`}</div>
            </section>

            ${section({
              title: 'Prossimi passi', iconName: 'rocket',
              body: html`
                <div class="crm-steps">
                  ${r.client
                    ? html`<a class="crm-step is-done" href="${hrefFor('clients', r.client.id)}">${icon('check', 'icon--sm')}<span>Cliente: <strong>${r.client.name}</strong></span></a>`
                    : html`<button type="button" class="crm-step" data-action="to-client">${icon('users', 'icon--sm')}<span>Crea il cliente da questo contatto</span></button>`}
                  ${r.project
                    ? html`<a class="crm-step is-done" href="${hrefFor('projects', r.project.id)}">${icon('check', 'icon--sm')}<span>Progetto: <strong>${r.project.name}</strong></span></a>`
                    : html`<button type="button" class="crm-step" data-action="to-project">${icon('folder', 'icon--sm')}<span>Trasforma in progetto${r.client ? '' : ' (anche senza cliente)'}</span></button>`}
                  ${open ? html`
                    <div class="crm-step-row">
                      ${r.status === 'nuova' ? button('set-status', 'In valutazione', { small: true, iconName: 'clock', data: { status: 'in_valutazione' } }) : ''}
                      ${r.status !== 'preventivo_inviato' ? button('set-status', 'Preventivo inviato', { small: true, iconName: 'file-text', data: { status: 'preventivo_inviato' } }) : ''}
                      ${button('set-status', 'Non interessato', { small: true, iconName: 'x', data: { status: 'rifiutata' } })}
                    </div>` : html`<div class="crm-step-row">${button('set-status', 'Riapri', { small: true, iconName: 'arrow-up-right', data: { status: 'in_valutazione' } })}</div>`}
                </div>`,
            })}
          </div>

          <aside class="crm-detail__side">
            <section class="card crm-section">
              <div class="card__head"><h3 class="card__title">${icon('user')}Contatto</h3></div>
              <div class="card__body">
                <dl class="crm-kv">
                  ${kv('Nome', r.contact_name)}
                  ${kv('Email', r.contact_email, r.contact_email ? `mailto:${r.contact_email}` : '')}
                  ${kv('Telefono', r.contact_phone, r.contact_phone ? `tel:${r.contact_phone.replace(/\s+/g, '')}` : '')}
                  ${kv('Budget', r.budget)}
                </dl>
              </div>
            </section>
          </aside>
        </div>
      </div>`);
  };

  const act = (fn) => async (...args) => { try { await fn(...args); } catch (err) { toast.error(err.message); } };

  const offs = [
    on(container, 'click', '[data-action="reload"]', load),
    on(container, 'click', '[data-action="edit"]', act(() => editRequest(req))),
    on(container, 'click', '[data-action="delete"]', act(async () => {
      if (await deleteRow('requests', req, req.title)) location.hash = hrefFor('requests');
    })),
    on(container, 'click', '[data-action="to-client"]', act(() => convertRequestToClient(req))),
    on(container, 'click', '[data-action="to-project"]', act(() => convertRequestToProject(req))),
    on(container, 'click', '[data-action="set-status"]', act(async (_e, el) => {
      await update('requests', id, { status: el.dataset.status });
      toast.success(`Stato: ${labelOf(REQUEST_STATUS, el.dataset.status).label}.`);
    })),
    onDataChange(() => load()),
  ];

  draw();
  load();
  return () => offs.forEach((off) => off());
}

const backLink = () => html`<a class="crm-back" href="${hrefFor('requests')}">${icon('chevrons-left', 'icon--sm')}<span>Tutti i contatti in arrivo</span></a>`;

function kv(label, value, href = '') {
  return html`<div class="crm-kv__row"><dt>${label}</dt><dd>${value ? (href ? html`<a class="link" href="${href}">${value}</a>` : value) : html`<span class="crm-empty">—</span>`}</dd></div>`;
}
