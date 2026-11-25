/**
 * Aggregazione dei dati per la dashboard.
 * Tutto proviene da IndexedDB: nessun valore inventato.
 */

import { STORES, getAll } from '../core/database.js';
import {
  ACTIVE_PROJECT_STATUSES, OPEN_REQUEST_STATUSES, TASK_STATUS, QUOTE_STATUS, isArchived,
} from '../config/domain.js';
import { getRecentActivity } from './activity-service.js';
import { daysFromToday } from '../utils/format.js';

const DEADLINE_WINDOW_DAYS = 30;
const DEADLINE_LIMIT = 6;

export async function getDashboardData() {
  const [clients, requests, projects, tasks, quotes, reminders, recent] = await Promise.all([
    getAll(STORES.CLIENTS),
    getAll(STORES.REQUESTS),
    getAll(STORES.PROJECTS),
    getAll(STORES.TASKS),
    getAll(STORES.QUOTES),
    getAll(STORES.REMINDERS),
    getRecentActivity(6),
  ]);

  const activeClients = clients.filter((c) => !isArchived(c));
  const activeProjects = projects.filter((p) => !isArchived(p) && ACTIVE_PROJECT_STATUSES.includes(p.status));
  const openRequests = requests.filter((r) => !isArchived(r) && OPEN_REQUEST_STATUSES.includes(r.status));
  const openTasks = tasks.filter((t) => !isArchived(t) && t.status !== TASK_STATUS.DONE);

  const deadlines = collectDeadlines({ activeProjects, openTasks, quotes, reminders });

  return {
    counts: {
      clients: activeClients.length,
      activeProjects: activeProjects.length,
      openRequests: openRequests.length,
      openTasks: openTasks.length,
      totalProjects: projects.length,
    },
    deadlines,
    overdue: deadlines.filter((d) => d.days < 0).length,
    recent,
  };
}

/** Riunisce le scadenze di più store in un'unica lista ordinata. */
function collectDeadlines({ activeProjects, openTasks, quotes, reminders }) {
  const items = [];
  const push = (date, entry) => {
    if (!date) return;
    const days = daysFromToday(date);
    if (days === null || days > DEADLINE_WINDOW_DAYS) return;
    items.push({ ...entry, date, days });
  };

  activeProjects.forEach((p) => push(p.dueDate, { type: 'project', id: p.id, title: p.name || p.title || 'Progetto' }));
  openTasks.forEach((t) => push(t.dueDate, { type: 'task', id: t.id, title: t.title || 'Attività' }));
  quotes
    .filter((q) => !isArchived(q) && q.status === QUOTE_STATUS.SENT)
    .forEach((q) => push(q.validUntil, { type: 'quote', id: q.id, title: q.title || q.number || 'Preventivo' }));
  reminders
    .filter((r) => !r.done)
    .forEach((r) => push(r.dueAt, { type: 'reminder', id: r.id, title: r.title || 'Promemoria' }));

  return items
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, DEADLINE_LIMIT);
}
