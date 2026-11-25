/**
 * Registro dei moduli dell'applicazione.
 * ---------------------------------------
 * È l'unico punto da modificare per aggiungere un modulo:
 * sidebar, router e titoli si costruiscono da qui.
 *
 * status:
 *   'ready'   → la vista viene caricata da `load()`
 *   'planned' → viene mostrata la pagina "modulo in arrivo"
 *
 * Quando un modulo viene sviluppato basta creare il file in js/views/
 * e sostituire status/load.
 */

export const SECTIONS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'management', label: 'Management' },
  { id: 'system', label: 'System' },
];

export const MODULES = [
  {
    id: 'dashboard',
    path: 'dashboard',
    label: 'Dashboard',
    section: 'workspace',
    icon: 'dashboard',
    status: 'ready',
    load: () => import('../views/dashboard.js'),
  },
  {
    id: 'clients',
    path: 'clienti',
    label: 'Clienti',
    section: 'workspace',
    icon: 'users',
    status: 'planned',
    description: 'Anagrafica completa dei clienti dello studio, con contatti, referenti e storico dei lavori.',
    features: ['Anagrafica e referenti', 'Ricerca e filtri', 'Collegamento a progetti e preventivi'],
  },
  {
    id: 'requests',
    path: 'richieste',
    label: 'Richieste',
    section: 'workspace',
    icon: 'inbox',
    status: 'planned',
    description: 'Raccolta delle richieste in arrivo dai clienti, da valutare e trasformare in preventivi o progetti.',
    features: ['Stato di lavorazione', 'Priorità', 'Conversione in progetto'],
  },
  {
    id: 'projects',
    path: 'progetti',
    label: 'Progetti',
    section: 'workspace',
    icon: 'folder',
    status: 'planned',
    description: 'Gestione dei progetti attivi dello studio, con stato, scadenze e cliente associato.',
    features: ['Stato e avanzamento', 'Scadenze', 'Attività collegate'],
  },
  {
    id: 'tasks',
    path: 'attivita',
    label: 'Attività',
    section: 'workspace',
    icon: 'check-square',
    status: 'planned',
    description: 'Elenco operativo delle attività da svolgere, organizzate per progetto e scadenza.',
    features: ['Da fare / completate', 'Scadenze', 'Collegamento ai progetti'],
  },
  {
    id: 'calendar',
    path: 'calendario',
    label: 'Calendario',
    section: 'workspace',
    icon: 'calendar',
    status: 'planned',
    description: 'Vista calendario di scadenze, consegne e promemoria.',
    features: ['Vista mensile e settimanale', 'Scadenze di progetti e attività', 'Promemoria'],
  },
  {
    id: 'quotes',
    path: 'preventivi',
    label: 'Preventivi',
    section: 'management',
    icon: 'file-text',
    status: 'planned',
    description: 'Creazione e monitoraggio dei preventivi inviati ai clienti.',
    features: ['Voci e importi', 'Stato di approvazione', 'Validità'],
  },
  {
    id: 'notes',
    path: 'note',
    label: 'Note',
    section: 'management',
    icon: 'note',
    status: 'planned',
    description: 'Appunti interni dello studio, liberi o collegati a clienti e progetti.',
    features: ['Note libere', 'Collegamento a clienti e progetti', 'Ricerca'],
  },
  {
    id: 'reminders',
    path: 'promemoria',
    label: 'Promemoria',
    section: 'management',
    icon: 'bell',
    status: 'planned',
    description: 'Promemoria con data e ora per non perdere richiami e consegne.',
    features: ['Data e ora', 'Completamento', 'Visibili in dashboard'],
  },
  {
    id: 'timeline',
    path: 'timeline',
    label: 'Timeline',
    section: 'management',
    icon: 'activity',
    status: 'planned',
    description: 'Cronologia di tutte le operazioni svolte nel gestionale.',
    features: ['Storico completo', 'Filtri per tipo', 'Collegamenti agli elementi'],
  },
  {
    id: 'archive',
    path: 'archivio',
    label: 'Archivio',
    section: 'management',
    icon: 'archive',
    status: 'planned',
    description: 'Clienti, progetti e preventivi conclusi, consultabili senza appesantire le liste operative.',
    features: ['Elementi archiviati', 'Ripristino', 'Ricerca'],
  },
  {
    id: 'settings',
    path: 'impostazioni',
    label: 'Impostazioni',
    section: 'system',
    icon: 'settings',
    status: 'ready',
    load: () => import('../views/settings.js'),
  },
];

export const DEFAULT_MODULE = 'dashboard';

export const getModuleById = (id) => MODULES.find((m) => m.id === id) || null;
export const getModuleByPath = (path) => MODULES.find((m) => m.path === path) || null;
export const getSection = (id) => SECTIONS.find((s) => s.id === id) || null;
export const hrefFor = (id, ...segments) => {
  const mod = getModuleById(id);
  return `#/${[mod?.path ?? id, ...segments].join('/')}`;
};
