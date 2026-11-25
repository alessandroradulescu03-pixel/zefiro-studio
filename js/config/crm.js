/**
 * Valori ammessi dal database (supabase/crm-schema.sql) con etichette e colori.
 * Se cambi uno stato nel database, aggiornalo anche qui.
 */

const opts = (entries) => Object.freeze(entries.map(([value, label, tone = '']) => Object.freeze({ value, label, tone })));

export const CLIENT_KIND = opts([['azienda', 'Azienda'], ['privato', 'Privato']]);

export const CLIENT_STATUS = opts([
  ['lead', 'Lead', 'info'],
  ['attivo', 'Attivo', 'success'],
  ['inattivo', 'Inattivo', ''],
  ['archiviato', 'Archiviato', ''],
]);

export const REQUEST_STATUS = opts([
  ['nuova', 'Nuova', 'info'],
  ['in_valutazione', 'In valutazione', 'warning'],
  ['preventivo_inviato', 'Preventivo inviato', 'warning'],
  ['accettata', 'Accettata', 'success'],
  ['rifiutata', 'Rifiutata', 'danger'],
  ['archiviata', 'Archiviata', ''],
]);
export const OPEN_REQUESTS = ['nuova', 'in_valutazione', 'preventivo_inviato'];

export const REQUEST_SOURCE = opts([
  ['sito', 'Sito'], ['email', 'Email'], ['telefono', 'Telefono'], ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram'], ['passaparola', 'Passaparola'], ['altro', 'Altro'],
]);

export const PRIORITY = opts([['bassa', 'Bassa', ''], ['media', 'Media', 'info'], ['alta', 'Alta', 'danger']]);

export const PROJECT_STATUS = opts([
  ['da_iniziare', 'Da iniziare', 'info'],
  ['in_corso', 'In corso', 'success'],
  ['in_revisione', 'In revisione', 'warning'],
  ['in_pausa', 'In pausa', ''],
  ['completato', 'Completato', 'success'],
  ['annullato', 'Annullato', 'danger'],
]);
export const ACTIVE_PROJECTS = ['da_iniziare', 'in_corso', 'in_revisione'];

export const TASK_STATUS = opts([
  ['da_fare', 'Da fare', 'info'],
  ['in_corso', 'In corso', 'warning'],
  ['fatto', 'Fatto', 'success'],
]);

/** Etichetta e colore di un valore. */
export function labelOf(list, value) {
  return list.find((o) => o.value === value) || { value, label: value || '—', tone: '' };
}
