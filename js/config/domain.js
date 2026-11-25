/**
 * Convenzioni di dominio condivise tra i moduli.
 * Definite ora perché la dashboard deve sapere cosa significa
 * "progetto attivo" o "richiesta aperta"; i moduli futuri
 * useranno gli stessi valori.
 */

export const PROJECT_STATUS = Object.freeze({
  PLANNING: 'planning',
  ACTIVE: 'active',
  REVIEW: 'review',
  PAUSED: 'paused',
  COMPLETED: 'completed',
});
export const ACTIVE_PROJECT_STATUSES = [PROJECT_STATUS.PLANNING, PROJECT_STATUS.ACTIVE, PROJECT_STATUS.REVIEW];

export const REQUEST_STATUS = Object.freeze({
  NEW: 'new',
  IN_REVIEW: 'in_review',
  CONVERTED: 'converted',
  DECLINED: 'declined',
});
export const OPEN_REQUEST_STATUSES = [REQUEST_STATUS.NEW, REQUEST_STATUS.IN_REVIEW];

export const TASK_STATUS = Object.freeze({
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
});

export const QUOTE_STATUS = Object.freeze({
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
});

/** Tipi di entità usati nella timeline. */
export const ENTITY_TYPES = Object.freeze({
  client: { label: 'Cliente', icon: 'users', module: 'clients' },
  request: { label: 'Contatto', icon: 'inbox', module: 'requests' },
  project: { label: 'Progetto', icon: 'folder', module: 'projects' },
  task: { label: 'Da fare', icon: 'check-square', module: 'tasks' },
  quote: { label: 'Preventivo', icon: 'file-text', module: 'quotes' },
  note: { label: 'Nota', icon: 'note', module: 'notes' },
  reminder: { label: 'Promemoria', icon: 'bell', module: 'reminders' },
});

export const ACTIVITY_ACTIONS = Object.freeze({
  created: 'creato',
  updated: 'aggiornato',
  deleted: 'eliminato',
  completed: 'completato',
  archived: 'archiviato',
});

/** Un record archiviato non compare nei conteggi operativi. */
export const isArchived = (record) => Boolean(record?.archived);
