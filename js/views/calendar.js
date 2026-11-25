/**
 * Calendario (#/calendario/AAAA-MM): vista del mese con attività, richieste,
 * scadenze dei progetti e promemoria. Cliccando un giorno si vede l'elenco
 * di quel giorno, con aggiunta rapida.
 */

import { html, render, on } from '../utils/dom.js';
import { hrefFor } from '../config/modules.js';
import { replaceSegments } from '../core/router.js';
import { list, onDataChange } from '../core/api.js';
import { TASK_STATUS, REQUEST_STATUS, PROJECT_STATUS, labelOf } from '../config/crm.js';
import { editTask, editReminder, toggleTask, toggleReminder } from '../services/crm-service.js';
import { emptyState } from '../components/empty-state.js';
import { toast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { formatDateLong } from '../utils/format.js';
import { badge, pageHead, button, errorBox } from './crm-ui.js';

const TYPES = {
  task: { label: 'Da fare', icon: 'check-square' },
  request: { label: 'Contatti in arrivo', icon: 'inbox' },
  project: { label: 'Scadenze progetti', icon: 'folder' },
  reminder: { label: 'Promemoria', icon: 'bell' },
};
const SINGULAR = { task: 'Da fare', request: 'Contatto in arrivo', project: 'Scadenza progetto', reminder: 'Promemoria' };
const PREFS_KEY = 'zefiro.calendar.types';
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

const pad = (n) => String(n).padStart(2, '0');
/** Chiave del giorno nel fuso locale: "2026-11-26". */
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Le date "solo giorno" del database (AAAA-MM-GG) vanno lette come giorno locale, non UTC. */
const fromDateOnly = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function loadTypes() {
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (saved && typeof saved === 'object') return { task: true, request: true, project: true, reminder: true, ...saved };
  } catch { /* preferenze non disponibili */ }
  return { task: true, request: true, project: true, reminder: true };
}
function saveTypes(types) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(types)); } catch { /* ignorato */ } }

function parseMonth(seg) {
  const m = /^(\d{4})-(\d{2})$/.exec(seg || '');
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
const monthSeg = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

/** Primo lunedì della griglia e 42 giorni (6 settimane). */
function gridDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // lunedì = 0
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

export default {
  mount(container, { segments }) {
    let month = parseMonth(segments[0]);
    if (segments[0] !== monthSeg(month)) replaceSegments('calendar', monthSeg(month));
    const today = dayKey(new Date());
    let selected = month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear()
      ? today : dayKey(month);
    let types = loadTypes();
    let byDay = null;   // Map dayKey → eventi
    let error = '';
    let loadId = 0;

    /* ---------- dati ---------- */
    const load = async () => {
      const id = ++loadId;
      const days = gridDays(month);
      const from = days[0];
      const to = new Date(days[41]); to.setDate(to.getDate() + 1);
      const fromD = dayKey(from); const toD = dayKey(to);
      const fromTs = from.toISOString(); const toTs = to.toISOString();
      try {
        const [tasks, requests, projects, reminders] = await Promise.all([
          list('tasks', { select: 'id,title,status,priority,due_date,project:projects(id,name),client:clients(id,name)', and: `(due_date.gte.${fromD},due_date.lt.${toD})`, order: 'due_date.asc', limit: '1000' }),
          list('requests', { select: 'id,title,status,source,received_at,contact_name,client:clients(id,name)', and: `(received_at.gte.${fromTs},received_at.lt.${toTs})`, order: 'received_at.asc', limit: '1000' }),
          list('projects', { select: 'id,name,status,due_date,client:clients(id,name)', and: `(due_date.gte.${fromD},due_date.lt.${toD})`, order: 'due_date.asc', limit: '1000' }),
          list('reminders', { select: 'id,title,done,remind_at,client:clients(id,name),project:projects(id,name)', and: `(remind_at.gte.${fromTs},remind_at.lt.${toTs})`, order: 'remind_at.asc', limit: '1000' }),
        ]);
        if (id !== loadId) return;
        const map = new Map();
        const add = (key, ev) => { if (!map.has(key)) map.set(key, []); map.get(key).push(ev); };
        tasks.forEach((t) => add(t.due_date, { type: 'task', id: t.id, title: t.title, done: t.status === 'fatto', row: t,
          meta: [t.project?.name, t.client?.name].filter(Boolean).join(' · '), sort: 2 }));
        requests.forEach((r) => { const d = new Date(r.received_at); add(dayKey(d), { type: 'request', id: r.id, title: r.title, row: r, time: timeFmt.format(d),
          meta: r.client?.name || r.contact_name || '', sort: 1, done: ['accettata', 'rifiutata', 'archiviata'].includes(r.status) }); });
        projects.forEach((p) => add(p.due_date, { type: 'project', id: p.id, title: p.name, row: p,
          meta: p.client?.name || '', sort: 0, done: ['completato', 'annullato'].includes(p.status) }));
        reminders.forEach((m) => { const d = new Date(m.remind_at); add(dayKey(d), { type: 'reminder', id: m.id, title: m.title, row: m, time: timeFmt.format(d),
          meta: [m.client?.name, m.project?.name].filter(Boolean).join(' · '), sort: 3, done: m.done }); });
        map.forEach((evs) => evs.sort((a, b) => a.done - b.done || a.sort - b.sort || String(a.time || '').localeCompare(String(b.time || ''))));
        byDay = map;
        error = '';
      } catch (err) {
        if (id !== loadId) return;
        error = err.message;
      }
      draw();
    };

    const visible = (key) => (byDay?.get(key) || []).filter((e) => types[e.type]);

    /* ---------- disegno ---------- */
    const draw = () => {
      const days = gridDays(month);
      const title = capitalize(monthFmt.format(month));
      render(container, html`
        <div class="view-enter">
          ${pageHead({
            title: 'Calendario',
            text: 'Cose da fare, contatti in arrivo, scadenze dei progetti e promemoria, giorno per giorno.',
            actions: html`${button('new-task', 'Da fare', {})}${button('new-reminder', 'Promemoria', { primary: true })}`,
          })}

          <div class="cal-bar">
            <div class="cal-nav">
              <button type="button" class="btn btn--icon" data-action="prev" aria-label="Mese precedente">${icon('chevrons-left', 'icon--sm')}</button>
              <h3 class="cal-title" aria-live="polite">${title}</h3>
              <button type="button" class="btn btn--icon" data-action="next" aria-label="Mese successivo">${icon('chevrons-right', 'icon--sm')}</button>
              <button type="button" class="btn btn--sm" data-action="today">Oggi</button>
            </div>
            <div class="cal-types" role="group" aria-label="Cosa mostrare">
              ${Object.entries(TYPES).map(([k, t]) => html`
                <button type="button" class="cal-type cal-type--${k} ${types[k] ? 'is-on' : ''}" data-action="type" data-type="${k}" aria-pressed="${String(types[k])}">
                  <span class="cal-dot"></span>${t.label}
                </button>`)}
            </div>
          </div>

          ${error ? errorBox(error) : ''}

          <div class="cal-layout">
            <section class="card cal-month" aria-label="${title}">
              <div class="cal-grid cal-grid--head" aria-hidden="true">${WEEKDAYS.map((w) => html`<div class="cal-wd">${w}</div>`)}</div>
              <div class="cal-grid" role="grid">
                ${days.map((d) => {
                  const key = dayKey(d);
                  const evs = visible(key);
                  const out = d.getMonth() !== month.getMonth();
                  const shown = evs.slice(0, 3);
                  return html`
                    <button type="button" class="cal-day ${out ? 'is-out' : ''} ${key === today ? 'is-today' : ''} ${key === selected ? 'is-selected' : ''}"
                      data-action="select" data-day="${key}" aria-pressed="${String(key === selected)}"
                      aria-label="${d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}${evs.length ? `, ${evs.length} elementi` : ''}">
                      <span class="cal-num">${d.getDate()}</span>
                      ${byDay ? html`
                        <span class="cal-chips">${shown.map((e) => html`<span class="cal-chip cal-chip--${e.type} ${e.done ? 'is-done' : ''}">${e.title}</span>`)}
                          ${evs.length > 3 ? html`<span class="cal-more">+${evs.length - 3}</span>` : ''}</span>
                        <span class="cal-dots">${evs.slice(0, 4).map((e) => html`<span class="cal-dot cal-dot--${e.type}"></span>`)}</span>` : ''}
                    </button>`;
                })}
              </div>
            </section>

            <section class="card cal-agenda" aria-labelledby="cal-agenda-title">
              <div class="card__head">
                <div>
                  <h3 class="card__title" id="cal-agenda-title">${icon('calendar')}${capitalize(formatDateLong(fromDateOnly(selected)))}</h3>
                  ${selected === today ? html`<p class="card__subtitle">Oggi</p>` : ''}
                </div>
              </div>
              <div class="card__body">${agenda()}</div>
              <div class="card__foot cal-agenda__foot">
                ${button('new-task-day', 'Da fare in questo giorno', { small: true })}
                ${button('new-reminder-day', 'Promemoria', { small: true })}
              </div>
            </section>
          </div>
        </div>`);
    };

    const agenda = () => {
      if (!byDay && !error) return html`<p class="crm-empty">Caricamento…</p>`;
      const evs = visible(selected);
      if (!evs.length) return emptyState({ icon: 'calendar', title: 'Niente in programma', text: 'In questo giorno non ci sono cose da fare, contatti, scadenze o promemoria.', compact: true });
      return html`<ul class="crm-list">${evs.map((e) => {
        const status = e.type === 'task' ? labelOf(TASK_STATUS, e.row.status).label
          : e.type === 'request' ? labelOf(REQUEST_STATUS, e.row.status).label
          : e.type === 'project' ? labelOf(PROJECT_STATUS, e.row.status).label : (e.done ? 'Fatto' : 'Da fare');
        const canCheck = e.type === 'task' || e.type === 'reminder';
        const main = html`
          <span class="crm-row__main">
            <span class="crm-row__title">${e.title}</span>
            <span class="crm-row__meta">${[SINGULAR[e.type], e.time, e.meta].filter(Boolean).join(' · ')}</span>
          </span>`;
        return html`
          <li class="crm-row cal-item cal-item--${e.type} ${e.done ? 'is-muted' : ''}">
            ${canCheck
              ? html`<button type="button" class="crm-check ${e.done ? 'is-done' : ''}" data-action="toggle" data-type="${e.type}" data-id="${e.id}"
                  aria-label="${e.done ? 'Segna come da fare' : 'Segna come fatto'}" aria-pressed="${String(e.done)}">${icon('check', 'icon--sm')}</button>`
              : html`<span class="list-row__icon cal-ico--${e.type}">${icon(TYPES[e.type].icon, 'icon--sm')}</span>`}
            ${e.type === 'request' || e.type === 'project'
              ? html`<a class="crm-row__link" href="${hrefFor(e.type === 'request' ? 'requests' : 'projects', e.id)}">${main}</a>`
              : html`<button type="button" class="crm-row__link" data-action="open" data-type="${e.type}" data-id="${e.id}">${main}</button>`}
            <span class="crm-row__aside">${e.type === 'request' ? badge(REQUEST_STATUS, e.row.status) : html`<span class="badge">${status}</span>`}</span>
          </li>`;
      })}</ul>`;
    };

    /* ---------- azioni ---------- */
    const goMonth = (delta) => {
      month = new Date(month.getFullYear(), month.getMonth() + delta, 1);
      const now = new Date();
      selected = month.getMonth() === now.getMonth() && month.getFullYear() === now.getFullYear() ? today : dayKey(month);
      replaceSegments('calendar', monthSeg(month));
      byDay = null;
      draw();
      load();
    };
    const find = (type, id) => {
      for (const evs of byDay?.values() || []) { const e = evs.find((x) => x.type === type && x.id === id); if (e) return e.row; }
      return null;
    };
    const act = (fn) => async (...args) => { try { await fn(...args); } catch (err) { toast.error(err.message); } };
    const at9 = (key) => { const d = fromDateOnly(key); d.setHours(9, 0, 0, 0); return d.toISOString(); };

    const offs = [
      on(container, 'click', '[data-action="prev"]', () => goMonth(-1)),
      on(container, 'click', '[data-action="next"]', () => goMonth(1)),
      on(container, 'click', '[data-action="today"]', () => {
        const now = new Date();
        month = new Date(now.getFullYear(), now.getMonth(), 1);
        selected = today;
        replaceSegments('calendar', monthSeg(month));
        byDay = null; draw(); load();
      }),
      on(container, 'click', '[data-action="select"]', (_e, el) => {
        selected = el.dataset.day;
        const d = fromDateOnly(selected);
        if (d.getMonth() !== month.getMonth()) { month = new Date(d.getFullYear(), d.getMonth(), 1); replaceSegments('calendar', monthSeg(month)); byDay = null; draw(); load(); return; }
        draw();
        if (window.matchMedia('(max-width: 1100px)').matches) container.querySelector('.cal-agenda')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }),
      on(container, 'click', '[data-action="type"]', (_e, el) => {
        types = { ...types, [el.dataset.type]: !types[el.dataset.type] };
        saveTypes(types);
        draw();
      }),
      on(container, 'click', '[data-action="toggle"]', act((_e, el) => {
        const row = find(el.dataset.type, el.dataset.id);
        return el.dataset.type === 'task' ? toggleTask(row) : toggleReminder(row);
      })),
      on(container, 'click', '[data-action="open"]', act((_e, el) => {
        const row = find(el.dataset.type, el.dataset.id);
        return el.dataset.type === 'task' ? editTask(row) : editReminder(row);
      })),
      on(container, 'click', '[data-action="new-task"]', act(() => editTask(null, { due_date: selected }))),
      on(container, 'click', '[data-action="new-task-day"]', act(() => editTask(null, { due_date: selected }))),
      on(container, 'click', '[data-action="new-reminder"]', act(() => editReminder(null, { remind_at: at9(selected) }))),
      on(container, 'click', '[data-action="new-reminder-day"]', act(() => editReminder(null, { remind_at: at9(selected) }))),
      on(container, 'click', '[data-action="reload"]', load),
      onDataChange(() => load()),
    ];

    draw();
    load();
    return () => offs.forEach((off) => off());
  },
};
