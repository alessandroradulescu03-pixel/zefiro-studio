/**
 * Formattazione in italiano: date, saluti, numeri, iniziali.
 */

const LOCALE = 'it-IT';

const dateLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dateShort = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTime = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const monthShort = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
const topbarDate = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'long' });
const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
const number = new Intl.NumberFormat(LOCALE);

const toDate = (value) => (value instanceof Date ? value : new Date(value));
const isValid = (d) => d instanceof Date && !Number.isNaN(d.getTime());

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
export const formatDateLong = (v = new Date()) => (isValid(toDate(v)) ? capitalize(dateLong.format(toDate(v))) : '');
export const formatDate = (v) => (isValid(toDate(v)) ? dateShort.format(toDate(v)) : '—');
export const formatDateTime = (v) => (isValid(toDate(v)) ? dateTime.format(toDate(v)) : '—');
export const formatTopbarDate = (v = new Date()) => topbarDate.format(toDate(v));
export const formatMonthShort = (v) => monthShort.format(toDate(v)).replace('.', '');
export const formatNumber = (n) => number.format(n ?? 0);

/** "3 giorni fa", "tra 2 ore", "ieri"… */
export function formatRelative(value, now = new Date()) {
  const d = toDate(value);
  if (!isValid(d)) return '';
  const diffSec = Math.round((d - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return 'adesso';
  const units = [
    ['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2629800], ['year', 31557600],
  ];
  let unit = 'minute';
  let size = 60;
  for (const [u, s] of units) {
    if (abs >= s) { unit = u; size = s; }
  }
  return relative.format(Math.round(diffSec / size), unit);
}

/** Saluto in base all'ora del giorno. */
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 13) return 'Buongiorno';
  if (h >= 13 && h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

/** Iniziali da un nome (max 2 lettere). */
export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

/** Byte in formato leggibile. */
export function formatBytes(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} ${units[i]}`;
}

/** Singolare/plurale. */
export const plural = (n, one, many) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/** Inizio della giornata locale. */
export function startOfDay(d = new Date()) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Differenza in giorni di calendario (positivo = futuro). */
export function daysFromToday(value, now = new Date()) {
  const d = toDate(value);
  if (!isValid(d)) return null;
  return Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
}
