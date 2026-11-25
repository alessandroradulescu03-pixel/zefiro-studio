/**
 * Operazioni del CRM condivise tra le viste: moduli di creazione/modifica,
 * eliminazione con conferma, conversione delle richieste.
 * Ogni operazione importante viene anche registrata nella timeline locale.
 */

import { list, insert, update, remove } from '../core/api.js';
import { formDialog } from '../components/form-dialog.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { logActivity } from './activity-service.js';
import {
  CLIENT_KIND, CLIENT_STATUS, REQUEST_STATUS, REQUEST_SOURCE, PRIORITY, PROJECT_STATUS, TASK_STATUS,
} from '../config/crm.js';

/* ---------------- Opzioni per le tendine ---------------- */

export async function clientOptions() {
  const rows = await list('clients', { select: 'id,name,status', order: 'name.asc', limit: '1000' });
  return rows.map((c) => ({ value: c.id, label: c.status === 'archiviato' ? `${c.name} (archiviato)` : c.name }));
}

export async function projectOptions() {
  const rows = await list('projects', { select: 'id,name,client:clients(name)', order: 'created_at.desc', limit: '1000' });
  return rows.map((p) => ({ value: p.id, label: p.client?.name ? `${p.name} — ${p.client.name}` : p.name }));
}

const log = (entityType, entityId, action, title) =>
  logActivity({ entityType, entityId, action, title }).catch((err) => console.warn('[timeline]', err));

/* ---------------- Campi dei moduli ---------------- */

const clientFields = () => [
  { name: 'name', label: 'Ragione sociale o nome', required: true, maxLength: 160, full: true, placeholder: 'Es. Rossi Srl' },
  { name: 'kind', label: 'Tipo', type: 'select', options: CLIENT_KIND, default: 'azienda' },
  { name: 'status', label: 'Stato', type: 'select', options: CLIENT_STATUS, default: 'lead' },
  { name: 'contact_name', label: 'Referente', maxLength: 160 },
  { name: 'email', label: 'Email', type: 'email', maxLength: 200 },
  { name: 'phone', label: 'Telefono', type: 'tel', maxLength: 40, inputmode: 'tel' },
  { name: 'website', label: 'Sito web', type: 'url', maxLength: 300, placeholder: 'https://…' },
  { name: 'vat_number', label: 'Partita IVA', maxLength: 30 },
  { name: 'tax_code', label: 'Codice fiscale', maxLength: 30 },
  { name: 'address', label: 'Indirizzo', maxLength: 300, full: true },
  { name: 'city', label: 'Città', maxLength: 120 },
  { name: 'province', label: 'Provincia', maxLength: 10, placeholder: 'BG' },
  { name: 'zip', label: 'CAP', maxLength: 12 },
  { name: 'source', label: 'Provenienza', maxLength: 60, placeholder: 'Sito, Instagram, passaparola…' },
  { name: 'notes', label: 'Note', type: 'textarea', maxLength: 10000 },
];

const requestFields = (clients, projects) => [
  { name: 'title', label: 'Oggetto', required: true, maxLength: 200, full: true, placeholder: 'Es. Nuovo sito vetrina' },
  { name: 'client_id', label: 'Cliente', type: 'select', options: clients, nullable: true, emptyLabel: '— Non ancora cliente —' },
  { name: 'source', label: 'Provenienza', type: 'select', options: REQUEST_SOURCE, default: 'altro' },
  { name: 'contact_name', label: 'Nome contatto', maxLength: 160, hint: 'Se chi scrive non è ancora un cliente' },
  { name: 'contact_email', label: 'Email contatto', type: 'email', maxLength: 200 },
  { name: 'contact_phone', label: 'Telefono contatto', type: 'tel', maxLength: 40 },
  { name: 'budget', label: 'Budget indicato', maxLength: 80, placeholder: 'Es. 1.500 – 3.000 €' },
  { name: 'status', label: 'Stato', type: 'select', options: REQUEST_STATUS, default: 'nuova' },
  { name: 'priority', label: 'Priorità', type: 'select', options: PRIORITY, default: 'media' },
  { name: 'received_at', label: 'Ricevuta il', type: 'datetime' },
  { name: 'project_id', label: 'Progetto collegato', type: 'select', options: projects, nullable: true },
  { name: 'description', label: 'Descrizione', type: 'textarea', maxLength: 10000 },
];

const projectFields = (clients) => [
  { name: 'name', label: 'Nome progetto', required: true, maxLength: 160, full: true, placeholder: 'Es. Sito Rossi Srl' },
  { name: 'client_id', label: 'Cliente', type: 'select', options: clients, nullable: true },
  { name: 'status', label: 'Stato', type: 'select', options: PROJECT_STATUS, default: 'da_iniziare' },
  { name: 'start_date', label: 'Inizio', type: 'date' },
  { name: 'due_date', label: 'Scadenza', type: 'date' },
  { name: 'amount', label: 'Importo (€)', type: 'number', min: 0, step: '0.01', inputmode: 'decimal' },
  { name: 'description', label: 'Descrizione', type: 'textarea', maxLength: 10000 },
];

const taskFields = (projects, clients) => [
  { name: 'title', label: 'Attività', required: true, maxLength: 200, full: true, placeholder: 'Es. Inviare bozza home page' },
  { name: 'project_id', label: 'Progetto', type: 'select', options: projects, nullable: true },
  { name: 'client_id', label: 'Cliente', type: 'select', options: clients, nullable: true },
  { name: 'status', label: 'Stato', type: 'select', options: TASK_STATUS, default: 'da_fare' },
  { name: 'priority', label: 'Priorità', type: 'select', options: PRIORITY, default: 'media' },
  { name: 'due_date', label: 'Scadenza', type: 'date' },
  { name: 'description', label: 'Dettagli', type: 'textarea', maxLength: 10000, rows: 3 },
];

const reminderFields = (projects, clients) => [
  { name: 'title', label: 'Promemoria', required: true, maxLength: 200, full: true, placeholder: 'Es. Richiamare per il preventivo' },
  { name: 'remind_at', label: 'Data e ora', type: 'datetime', required: true },
  { name: 'client_id', label: 'Cliente', type: 'select', options: clients, nullable: true },
  { name: 'project_id', label: 'Progetto', type: 'select', options: projects, nullable: true, full: true },
  { name: 'notes', label: 'Note', type: 'textarea', maxLength: 5000, rows: 3 },
];

/* ---------------- Salvataggio generico ---------------- */

async function saveDialog({ table, entityType, titleNew, titleEdit, fields, existing, defaults = {}, labelOf, fix }) {
  const isEdit = Boolean(existing?.id);
  const saved = await formDialog({
    title: isEdit ? titleEdit : titleNew,
    submitLabel: isEdit ? 'Salva modifiche' : 'Crea',
    fields,
    values: { ...defaults, ...(existing || {}) },
    onSubmit: async (values) => {
      const row = fix ? fix(values, existing) : values;
      return isEdit ? update(table, existing.id, row) : insert(table, row);
    },
  });
  if (saved) {
    toast.success(isEdit ? 'Modifiche salvate.' : `Salvato: ${labelOf(saved)}.`);
    log(entityType, saved.id, isEdit ? 'updated' : 'created', labelOf(saved));
  }
  return saved;
}

/** Imposta/azzera la data di completamento in base allo stato. */
const stamp = (done, existingAt) => (done ? existingAt || new Date().toISOString() : null);

/* ---------------- Clienti ---------------- */

export function editClient(existing = null, defaults = {}) {
  return saveDialog({
    table: 'clients', entityType: 'client', titleNew: 'Nuovo cliente', titleEdit: 'Modifica cliente',
    fields: clientFields(), existing, defaults, labelOf: (c) => c.name,
  });
}

/* ---------------- Richieste ---------------- */

export async function editRequest(existing = null, defaults = {}) {
  const [clients, projects] = await Promise.all([clientOptions(), projectOptions()]);
  return saveDialog({
    table: 'requests', entityType: 'request', titleNew: 'Nuova richiesta', titleEdit: 'Modifica richiesta',
    fields: requestFields(clients, projects), existing,
    defaults: { received_at: new Date().toISOString(), ...defaults },
    labelOf: (r) => r.title,
    fix: (v) => ({ ...v, received_at: v.received_at || new Date().toISOString() }),
  });
}

/** Crea un cliente dai dati di contatto della richiesta e lo collega. */
export async function convertRequestToClient(req) {
  const client = await editClient(null, {
    name: req.contact_name || req.title,
    contact_name: req.contact_name,
    email: req.contact_email,
    phone: req.contact_phone,
    status: 'lead',
    source: labelSource(req.source),
  });
  if (!client) return null;
  await update('requests', req.id, { client_id: client.id });
  return client;
}

/** Crea un progetto dalla richiesta, la collega e la segna come accettata. */
export async function convertRequestToProject(req) {
  const project = await editProject(null, {
    name: req.title,
    client_id: req.client_id,
    description: req.description,
  });
  if (!project) return null;
  await update('requests', req.id, { project_id: project.id, status: 'accettata' });
  return project;
}

const labelSource = (v) => ({ sito: 'Sito', email: 'Email', telefono: 'Telefono', whatsapp: 'WhatsApp', instagram: 'Instagram', passaparola: 'Passaparola' }[v] || '');

/* ---------------- Progetti ---------------- */

export async function editProject(existing = null, defaults = {}) {
  const clients = await clientOptions();
  return saveDialog({
    table: 'projects', entityType: 'project', titleNew: 'Nuovo progetto', titleEdit: 'Modifica progetto',
    fields: projectFields(clients), existing, defaults, labelOf: (p) => p.name,
    fix: (v, ex) => {
      if (v.start_date && v.due_date && v.due_date < v.start_date) throw new Error('La scadenza non può essere prima della data di inizio.');
      return { ...v, completed_at: stamp(v.status === 'completato', ex?.completed_at) };
    },
  });
}

/* ---------------- Attività ---------------- */

export async function editTask(existing = null, defaults = {}) {
  const [projects, clients] = await Promise.all([projectOptions(), clientOptions()]);
  return saveDialog({
    table: 'tasks', entityType: 'task', titleNew: 'Nuova attività', titleEdit: 'Modifica attività',
    fields: taskFields(projects, clients), existing, defaults, labelOf: (t) => t.title,
    fix: (v, ex) => ({ ...v, completed_at: stamp(v.status === 'fatto', ex?.completed_at) }),
  });
}

export async function toggleTask(task) {
  const done = task.status !== 'fatto';
  const saved = await update('tasks', task.id, { status: done ? 'fatto' : 'da_fare', completed_at: done ? new Date().toISOString() : null });
  if (done) log('task', task.id, 'completed', task.title);
  return saved;
}

/* ---------------- Promemoria ---------------- */

export async function editReminder(existing = null, defaults = {}) {
  const [projects, clients] = await Promise.all([projectOptions(), clientOptions()]);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return saveDialog({
    table: 'reminders', entityType: 'reminder', titleNew: 'Nuovo promemoria', titleEdit: 'Modifica promemoria',
    fields: reminderFields(projects, clients), existing,
    defaults: { remind_at: tomorrow.toISOString(), ...defaults },
    labelOf: (r) => r.title,
  });
}

export async function toggleReminder(rem) {
  const done = !rem.done;
  const saved = await update('reminders', rem.id, { done, done_at: done ? new Date().toISOString() : null });
  if (done) log('reminder', rem.id, 'completed', rem.title);
  return saved;
}

/* ---------------- Eliminazione ---------------- */

const DELETE_TEXT = {
  clients: (n) => [`Eliminare il cliente "${n}"?`, 'Verranno eliminate anche le sue attività e i suoi promemoria. Le richieste restano, senza cliente collegato. Se ha progetti non si può eliminare: archivialo.'],
  requests: (n) => [`Eliminare la richiesta "${n}"?`, 'L\'operazione non si può annullare.'],
  projects: (n) => [`Eliminare il progetto "${n}"?`, 'Verranno eliminate anche le sue attività e i suoi promemoria. L\'operazione non si può annullare.'],
  tasks: (n) => [`Eliminare l'attività "${n}"?`, 'L\'operazione non si può annullare.'],
  reminders: (n) => [`Eliminare il promemoria "${n}"?`, 'L\'operazione non si può annullare.'],
};
const ENTITY = { clients: 'client', requests: 'request', projects: 'project', tasks: 'task', reminders: 'reminder' };

/** Chiede conferma ed elimina. Restituisce true se eliminato. */
export async function deleteRow(table, row, name) {
  const [title, message] = DELETE_TEXT[table](name);
  const ok = await confirmDialog({ title, message, confirmLabel: 'Elimina', danger: true });
  if (!ok) return false;
  try {
    await remove(table, row.id);
    toast.success('Eliminato.');
    log(ENTITY[table], row.id, 'deleted', name);
    return true;
  } catch (err) {
    toast.error(err.message);
    return false;
  }
}
