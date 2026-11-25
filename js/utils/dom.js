/**
 * Utilità DOM: template HTML con escape automatico e helper vari.
 */

class SafeHTML {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

/** Marca una stringa come HTML già sicuro (da usare solo con contenuti interni). */
export const raw = (value) => new SafeHTML(String(value ?? ''));

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

function renderValue(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (value instanceof SafeHTML) return value.value;
  if (Array.isArray(value)) return value.map(renderValue).join('');
  return escapeHtml(value);
}

/**
 * Tagged template: interpola i valori con escape automatico.
 * Array e altri `html`` ` vengono inseriti così come sono.
 */
export function html(strings, ...values) {
  let out = '';
  strings.forEach((str, i) => {
    out += str;
    if (i < values.length) out += renderValue(values[i]);
  });
  return new SafeHTML(out);
}

/** Sostituisce il contenuto di un elemento con un template. */
export function render(target, template) {
  target.innerHTML = String(template);
  return target;
}

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * Delega eventi: un solo listener sul contenitore.
 * @returns {() => void} funzione di rimozione
 */
export function on(root, type, selector, handler) {
  const listener = (event) => {
    const match = event.target.closest(selector);
    if (match && root.contains(match)) handler(event, match);
  };
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}

/** Legge i valori di un form come oggetto semplice. */
export function formValues(form) {
  const data = {};
  new FormData(form).forEach((value, key) => { data[key] = value; });
  return data;
}
