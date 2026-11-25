/**
 * Aggregazione dei dati per la dashboard.
 * Clienti, richieste, progetti, attività e promemoria arrivano da Supabase;
 * preventivi e attività recenti (timeline) restano nel database locale.
 * Nessun valore inventato.
 */

import { STORES, getAll } from '../core/database.js';
import { list, count } from '../core/api.js';
import { QUOTE_STATUS, isArchived } from '../config/domain.js';
import { ACTIVE_PROJECTS, OPEN_REQUESTS } from '../config/crm.js';
import { getRecentActivity } from './activity-service.js';
import { daysFromToday } from '../utils/format.js';

const DEADLINE_WINDOW_DAYS = 30;
const DEADLINE_LIMIT = 6;

export async function getDashboardData() {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() + DEADLINE_WINDOW_DAYS);
  const until = limitDate.toISOString().slice(0, 10);

  const [clients, openRequests, activeProjects, openTasks, totalProjects, projects, tasks, reminders, quotes, recent] = await Promise.all([
    count('clients', { status: 'neq.archiviato' }),
    count('requests', { status: `in.(${OPEN_REQUESTS.join(',')})` }),
    count('projects', { status: `in.(${ACTIVE_PROJECTS.join(',')})` }),
    count('tasks', { status: 'neq.fatto' }),
    count('projects'),
    list('projects', { select: 'id,name,due_date', status: `in.(${ACTIVE_PROJECTS.join(',')})`, due_date: `lte.${until}`, order: 'due_date.asc', limit: '20' }),
    list('tasks', { select: 'id,title,due_date', status: 'neq.fatto', due_date: `lte.${until}`, order: 'due_date.asc', limit: '20' }),
    list('reminders', { select: 'id,title,remind_at', done: 'eq.false', remind_at: `lte.${limitDate.toISOString()}`, order: 'remind_at.asc', limit: '20' }),
    getAll(STORES.QUOTES).catch(() => []),
    getRecentActivity(6).catch(() => []),
  ]);

  const deadlines = collectDeadlines({ projects, tasks, reminders, quotes });

  return {
    counts: { clients, activeProjects, openRequests, openTasks, totalProjects },
    deadlines,
    overdue: deadlines.filter((d) => d.days < 0).length,
    recent,
  };
}

/** Riunisce le scadenze in un'unica lista ordinata. */
function collectDeadlines({ projects, tasks, reminders, quotes }) {
  const items = [];
  const push = (date, entry) => {
    if (!date) return;
    const days = daysFromToday(date);
    if (days === null || days > DEADLINE_WINDOW_DAYS) return;
    items.push({ ...entry, date, days });
  };

  projects.forEach((p) => push(p.due_date, { type: 'project', id: p.id, title: p.name }));
  tasks.forEach((t) => push(t.due_date, { type: 'task', id: t.id, title: t.title }));
  reminders.forEach((r) => push(r.remind_at, { type: 'reminder', id: r.id, title: r.title }));
  quotes
    .filter((q) => !isArchived(q) && q.status === QUOTE_STATUS.SENT)
    .forEach((q) => push(q.validUntil, { type: 'quote', id: q.id, title: q.title || q.number || 'Preventivo' }));

  return items
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, DEADLINE_LIMIT);
}
