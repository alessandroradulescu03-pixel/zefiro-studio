/**
 * ZEFIRO Studio Manager — Livello di persistenza IndexedDB
 * ---------------------------------------------------------
 * - Apertura e cache della connessione
 * - Creazione degli object store tramite migrazioni versionate
 * - CRUD generico riutilizzabile da tutti i moduli
 * - ID univoci, timestamp createdAt / updatedAt
 * - Notifica delle modifiche (evento "change") per aggiornare la UI
 *
 * Per aggiungere uno store o un indice in futuro:
 *   1. aggiungi una nuova voce in MIGRATIONS con version = DB_VERSION + 1
 *   2. incrementa DB_VERSION
 * Le migrazioni precedenti non vanno mai modificate.
 */

export const DB_NAME = 'zefiro-studio-manager';
export const DB_VERSION = 1;

/** Nomi degli store, da usare al posto delle stringhe nei moduli. */
export const STORES = Object.freeze({
  CLIENTS: 'clients',
  REQUESTS: 'requests',
  PROJECTS: 'projects',
  TASKS: 'tasks',
  QUOTES: 'quotes',
  NOTES: 'notes',
  REMINDERS: 'reminders',
  TIMELINE: 'timeline',
  ATTACHMENTS: 'attachments',
  SETTINGS: 'settings',
});

/**
 * Migrazioni ordinate per versione.
 * Ogni funzione riceve il database e la transazione di upgrade.
 */
const MIGRATIONS = [
  {
    version: 1,
    description: 'Schema iniziale',
    migrate(db) {
      const create = (name, indexes = []) => {
        if (db.objectStoreNames.contains(name)) return;
        const store = db.createObjectStore(name, { keyPath: 'id' });
        indexes.forEach(([indexName, keyPath, options = {}]) => {
          store.createIndex(indexName, keyPath, options);
        });
      };

      const common = [
        ['createdAt', 'createdAt'],
        ['updatedAt', 'updatedAt'],
      ];

      create(STORES.CLIENTS, [...common, ['name', 'name'], ['email', 'email'], ['status', 'status']]);
      create(STORES.REQUESTS, [...common, ['status', 'status'], ['clientId', 'clientId']]);
      create(STORES.PROJECTS, [...common, ['status', 'status'], ['clientId', 'clientId'], ['dueDate', 'dueDate']]);
      create(STORES.TASKS, [...common, ['status', 'status'], ['projectId', 'projectId'], ['dueDate', 'dueDate']]);
      create(STORES.QUOTES, [...common, ['status', 'status'], ['clientId', 'clientId'], ['validUntil', 'validUntil']]);
      create(STORES.NOTES, [...common, ['entityId', 'entityId']]);
      create(STORES.REMINDERS, [...common, ['dueAt', 'dueAt'], ['done', 'done']]);
      create(STORES.TIMELINE, [...common, ['entityType', 'entityType'], ['entityId', 'entityId']]);
      create(STORES.ATTACHMENTS, [...common, ['entityId', 'entityId']]);
      create(STORES.SETTINGS, [['updatedAt', 'updatedAt']]);
    },
  },
];

/** Errore applicativo del database con messaggio leggibile in italiano. */
export class DatabaseError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DatabaseError';
    this.cause = cause;
  }
}

/* ---------------- Notifica modifiche ---------------- */

const bus = new EventTarget();

/**
 * Registra un listener chiamato a ogni scrittura.
 * @param {(detail: {store: string, type: string, id?: string}) => void} fn
 * @returns {() => void} funzione per rimuovere il listener
 */
export function onChange(fn) {
  const handler = (event) => fn(event.detail);
  bus.addEventListener('change', handler);
  return () => bus.removeEventListener('change', handler);
}

function emitChange(store, type, id) {
  bus.dispatchEvent(new CustomEvent('change', { detail: { store, type, id } }));
}

/* ---------------- Utilità ---------------- */

/** Genera un ID univoco (UUID v4 quando disponibile). */
export function generateId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const nowISO = () => new Date().toISOString();

/** Converte una IDBRequest in Promise. */
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function assertStore(name) {
  if (!Object.values(STORES).includes(name)) {
    throw new DatabaseError(`Archivio sconosciuto: "${name}"`);
  }
}

/* ---------------- Connessione ---------------- */

let dbPromise = null;

/**
 * Apre (una sola volta) il database ed esegue le migrazioni necessarie.
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new DatabaseError('Il browser non supporta IndexedDB: impossibile salvare i dati.'));
      return;
    }

    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(new DatabaseError('Accesso al database negato dal browser (navigazione privata?).', err));
      return;
    }

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction;
      const from = event.oldVersion;
      MIGRATIONS
        .filter((m) => m.version > from && m.version <= DB_VERSION)
        .sort((a, b) => a.version - b.version)
        .forEach((m) => m.migrate(db, tx));
    };

    request.onblocked = () => {
      reject(new DatabaseError('Il database è aperto in un\'altra scheda con una versione precedente. Chiudi le altre schede e ricarica.'));
    };

    request.onsuccess = () => {
      const db = request.result;
      // Se un'altra scheda aggiorna lo schema, chiudiamo per non bloccarla.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
        bus.dispatchEvent(new CustomEvent('versionchange'));
      };
      resolve(db);
    };

    request.onerror = () => {
      reject(new DatabaseError('Impossibile aprire il database locale.', request.error));
    };
  }).catch((err) => {
    dbPromise = null; // consente un nuovo tentativo
    throw err;
  });

  return dbPromise;
}

/** Chiude la connessione attiva (usato da reset e test). */
export async function closeDatabase() {
  if (!dbPromise) return;
  const db = await dbPromise.catch(() => null);
  db?.close();
  dbPromise = null;
}

/** Ascolta il caso in cui un'altra scheda aggiorni lo schema. */
export function onVersionChange(fn) {
  bus.addEventListener('versionchange', fn);
  return () => bus.removeEventListener('versionchange', fn);
}

/**
 * Esegue una funzione all'interno di una transazione e attende il commit.
 * @template T
 * @param {string|string[]} storeNames
 * @param {'readonly'|'readwrite'} mode
 * @param {(tx: IDBTransaction) => Promise<T>|T} work
 * @returns {Promise<T>}
 */
export async function withTransaction(storeNames, mode, work) {
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  names.forEach(assertStore);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(names, mode);
    } catch (err) {
      reject(new DatabaseError('Impossibile avviare la transazione.', err));
      return;
    }

    let result;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(new DatabaseError(describeError(tx.error), tx.error));
    tx.onerror = (event) => event.preventDefault(); // gestito da onabort

    Promise.resolve()
      .then(() => work(tx))
      .then((value) => { result = value; })
      .catch((err) => {
        try { tx.abort(); } catch { /* già conclusa */ }
        reject(err instanceof DatabaseError ? err : new DatabaseError(describeError(err), err));
      });
  });
}

function describeError(err) {
  switch (err?.name) {
    case 'QuotaExceededError': return 'Spazio di archiviazione esaurito nel browser.';
    case 'ConstraintError': return 'Esiste già un elemento con lo stesso identificativo.';
    case 'DataError': return 'I dati forniti non sono validi.';
    default: return err?.message || 'Errore del database.';
  }
}

/* ---------------- CRUD ---------------- */

/**
 * Crea un nuovo record. Aggiunge id, createdAt e updatedAt.
 * @param {string} store
 * @param {object} data
 */
export async function create(store, data = {}) {
  const timestamp = nowISO();
  const record = {
    ...data,
    id: data.id || generateId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await withTransaction(store, 'readwrite', (tx) => promisify(tx.objectStore(store).add(record)));
  emitChange(store, 'create', record.id);
  return record;
}

/** Restituisce un record per ID, oppure null. */
export async function get(store, id) {
  return withTransaction(store, 'readonly', async (tx) => {
    const value = await promisify(tx.objectStore(store).get(id));
    return value ?? null;
  });
}

/**
 * Restituisce tutti i record, con filtro e ordinamento opzionali.
 * @param {string} store
 * @param {{ index?: string, value?: IDBValidKey|IDBKeyRange, filter?: (r: object) => boolean,
 *           sortBy?: string, direction?: 'asc'|'desc', limit?: number }} [options]
 */
export async function getAll(store, options = {}) {
  const { index, value, filter, sortBy, direction = 'asc', limit } = options;

  let rows = await withTransaction(store, 'readonly', (tx) => {
    const source = index ? tx.objectStore(store).index(index) : tx.objectStore(store);
    return promisify(source.getAll(value));
  });

  if (filter) rows = rows.filter(filter);
  if (sortBy) {
    const dir = direction === 'desc' ? -1 : 1;
    rows.sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }
  if (typeof limit === 'number') rows = rows.slice(0, limit);
  return rows;
}

/**
 * Aggiorna parzialmente un record esistente.
 * @returns {Promise<object>} il record aggiornato
 */
export async function update(store, id, patch = {}) {
  const updated = await withTransaction(store, 'readwrite', async (tx) => {
    const os = tx.objectStore(store);
    const current = await promisify(os.get(id));
    if (!current) throw new DatabaseError('Elemento non trovato: potrebbe essere stato eliminato.');
    const next = { ...current, ...patch, id: current.id, createdAt: current.createdAt, updatedAt: nowISO() };
    await promisify(os.put(next));
    return next;
  });
  emitChange(store, 'update', id);
  return updated;
}

/**
 * Inserisce o sostituisce un record (utile per chiavi fisse come le impostazioni).
 * Mantiene createdAt se il record esiste già.
 */
export async function upsert(store, data) {
  if (!data?.id) throw new DatabaseError('upsert richiede un id.');
  const saved = await withTransaction(store, 'readwrite', async (tx) => {
    const os = tx.objectStore(store);
    const current = await promisify(os.get(data.id));
    const timestamp = nowISO();
    const next = {
      ...(current || {}),
      ...data,
      createdAt: current?.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await promisify(os.put(next));
    return next;
  });
  emitChange(store, 'upsert', data.id);
  return saved;
}

/** Elimina un record per ID. */
export async function remove(store, id) {
  await withTransaction(store, 'readwrite', (tx) => promisify(tx.objectStore(store).delete(id)));
  emitChange(store, 'delete', id);
}

/** Conta i record, opzionalmente su un indice. */
export async function count(store, index, value) {
  return withTransaction(store, 'readonly', (tx) => {
    const source = index ? tx.objectStore(store).index(index) : tx.objectStore(store);
    return promisify(source.count(value));
  });
}

/** Svuota un singolo store. */
export async function clear(store) {
  await withTransaction(store, 'readwrite', (tx) => promisify(tx.objectStore(store).clear()));
  emitChange(store, 'clear');
}

/* ---------------- Operazioni globali ---------------- */

/** Conteggio di tutti gli store. */
export async function countAll() {
  const names = Object.values(STORES);
  return withTransaction(names, 'readonly', async (tx) => {
    const entries = await Promise.all(
      names.map(async (name) => [name, await promisify(tx.objectStore(name).count())]),
    );
    return Object.fromEntries(entries);
  });
}

/** Esporta tutti i dati in un oggetto serializzabile (backup). */
export async function exportAll() {
  const names = Object.values(STORES);
  const data = await withTransaction(names, 'readonly', async (tx) => {
    const entries = await Promise.all(
      names.map(async (name) => [name, await promisify(tx.objectStore(name).getAll())]),
    );
    return Object.fromEntries(entries);
  });
  return {
    app: 'zefiro-studio-manager',
    schemaVersion: DB_VERSION,
    exportedAt: nowISO(),
    data,
  };
}

/**
 * Importa un backup sostituendo i dati esistenti.
 * L'operazione è atomica: in caso di errore non viene modificato nulla.
 */
export async function importAll(backup) {
  if (!backup || backup.app !== 'zefiro-studio-manager' || typeof backup.data !== 'object') {
    throw new DatabaseError('Il file selezionato non è un backup valido di Studio Manager.');
  }
  if (backup.schemaVersion > DB_VERSION) {
    throw new DatabaseError('Il backup proviene da una versione più recente dell\'applicazione.');
  }

  const names = Object.values(STORES);
  let total = 0;
  await withTransaction(names, 'readwrite', async (tx) => {
    for (const name of names) {
      const os = tx.objectStore(name);
      await promisify(os.clear());
      const rows = Array.isArray(backup.data[name]) ? backup.data[name] : [];
      for (const row of rows) {
        if (!row || typeof row !== 'object' || !row.id) {
          throw new DatabaseError(`Record non valido nell'archivio "${name}".`);
        }
        await promisify(os.put(row));
        total += 1;
      }
    }
  });
  emitChange('*', 'import');
  return total;
}

/** Cancella tutti i dati di tutti gli store (lo schema resta). */
export async function clearAll() {
  const names = Object.values(STORES);
  await withTransaction(names, 'readwrite', (tx) =>
    Promise.all(names.map((name) => promisify(tx.objectStore(name).clear()))),
  );
  emitChange('*', 'clear');
}

/** Informazioni sullo spazio occupato e sulla persistenza dello storage. */
export async function getStorageInfo() {
  const info = { usage: null, quota: null, persisted: null };
  try {
    if (navigator.storage?.estimate) {
      const { usage, quota } = await navigator.storage.estimate();
      info.usage = usage ?? null;
      info.quota = quota ?? null;
    }
    if (navigator.storage?.persisted) info.persisted = await navigator.storage.persisted();
  } catch { /* API non disponibile */ }
  return info;
}

/** Chiede al browser di non eliminare automaticamente i dati. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* API non disponibile */ }
  return false;
}
