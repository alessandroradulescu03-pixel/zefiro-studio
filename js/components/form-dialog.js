/**
 * Finestra con modulo (crea / modifica), nello stile delle modali esistenti.
 *
 * const saved = await formDialog({
 *   title: 'Nuovo cliente',
 *   fields: [{ name: 'name', label: 'Nome', required: true }, …],
 *   values: { name: '' },
 *   onSubmit: async (values) => insert('clients', values),   // se lancia un errore la finestra resta aperta
 * });
 * Restituisce il risultato di onSubmit, oppure null se annullato.
 *
 * Tipi di campo: text, email, tel, url, textarea, select, date, datetime, number, checkbox.
 */

import { html } from '../utils/dom.js';
import { icon } from './icons.js';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]';
let seq = 0;

/* ---- conversioni tra valori del database e campi del modulo ---- */
const pad = (n) => String(n).padStart(2, '0');
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fieldValue(f, v) {
  if (f.type === 'datetime') return toLocalInput(v);
  if (v === null || v === undefined) return '';
  return String(v);
}
function readValue(f, el) {
  if (f.type === 'checkbox') return el.checked;
  const raw = el.value.trim();
  if (f.type === 'number') return raw === '' ? null : Number(raw.replace(',', '.'));
  if (f.type === 'date') return raw || null;
  if (f.type === 'datetime') return raw ? new Date(raw).toISOString() : null;
  if (f.type === 'select' && f.nullable) return raw || null;
  return raw;
}

function control(f, id, value) {
  const common = { id, name: f.name };
  if (f.type === 'textarea') {
    return html`<textarea class="textarea" id="${common.id}" name="${common.name}" rows="${f.rows || 4}"
      maxlength="${f.maxLength || 10000}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}>${value}</textarea>`;
  }
  if (f.type === 'select') {
    return html`<select class="select" id="${common.id}" name="${common.name}" ${f.required ? 'required' : ''}>
      ${f.nullable ? html`<option value="">${f.emptyLabel || '— Nessuno —'}</option>` : ''}
      ${(f.options || []).map((o) => html`<option value="${o.value}" ${String(o.value) === value ? 'selected' : ''}>${o.label}</option>`)}
    </select>`;
  }
  if (f.type === 'checkbox') {
    return html`<label class="check"><input type="checkbox" id="${common.id}" name="${common.name}" ${value === 'true' ? 'checked' : ''}><span>${f.checkLabel || f.label}</span></label>`;
  }
  const type = { datetime: 'datetime-local', number: 'number' }[f.type] || f.type || 'text';
  return html`<input class="input" id="${common.id}" name="${common.name}" type="${type}" value="${value}"
    ${f.required ? 'required' : ''} maxlength="${type === 'number' || type.startsWith('date') ? '' : (f.maxLength || 200)}"
    ${f.min !== undefined ? html`min="${f.min}"` : ''} ${f.step ? html`step="${f.step}"` : ''}
    placeholder="${f.placeholder || ''}" autocomplete="${f.autocomplete || 'off'}" ${f.inputmode ? html`inputmode="${f.inputmode}"` : ''}>`;
}

export function formDialog({ title, subtitle = '', submitLabel = 'Salva', fields, values = {}, onSubmit }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const previouslyFocused = document.activeElement;
    const uid = `fd${++seq}`;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = String(html`
      <form class="modal modal--form" role="dialog" aria-modal="true" aria-labelledby="${uid}-title" novalidate>
        <div class="modal__head">
          <div>
            <h2 class="modal__title" id="${uid}-title">${title}</h2>
            ${subtitle ? html`<p class="modal__text">${subtitle}</p>` : ''}
          </div>
          <button type="button" class="icon-btn" data-action="cancel" aria-label="Chiudi">${icon('x', 'icon--sm')}</button>
        </div>
        <div class="modal__scroll">
          <div class="form-grid">
            ${fields.map((f) => {
              const id = `${uid}-${f.name}`;
              return html`
                <div class="field ${f.full || f.type === 'textarea' ? 'field--full' : ''}">
                  ${f.type === 'checkbox' ? '' : html`<label class="field__label" for="${id}">${f.label}${f.required ? html` <span class="req" aria-hidden="true">*</span>` : ''}</label>`}
                  ${control(f, id, f.type === 'checkbox' ? String(Boolean(values[f.name])) : fieldValue(f, values[f.name] ?? f.default))}
                  ${f.hint ? html`<p class="field__hint">${f.hint}</p>` : ''}
                </div>`;
            })}
          </div>
          <p class="form-error" role="alert" hidden></p>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="cancel">Annulla</button>
          <button type="submit" class="btn btn--primary">${icon('check', 'icon--sm')}<span>${submitLabel}</span></button>
        </div>
      </form>
    `);

    const form = backdrop.querySelector('form');
    const errorEl = form.querySelector('.form-error');
    const submitBtn = form.querySelector('[type="submit"]');
    let busy = false;

    const close = (result) => {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      document.body.style.overflow = '';
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      resolve(result);
    };

    function onKey(event) {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); close(null); return; }
      if (event.key === 'Tab') {
        const items = [...form.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }

    form.addEventListener('click', (event) => {
      if (event.target.closest('[data-action="cancel"]') && !busy) close(null);
    });
    backdrop.addEventListener('mousedown', (event) => { if (event.target === backdrop && !busy) close(null); });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (busy) return;
      errorEl.hidden = true;
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));

      // validazione del browser (campi obbligatori, email, numeri…)
      const invalid = [...form.elements].find((el) => el.willValidate && !el.checkValidity());
      if (invalid) {
        invalid.setAttribute('aria-invalid', 'true');
        const label = fields.find((f) => f.name === invalid.name)?.label || 'Un campo';
        errorEl.textContent = invalid.validity.valueMissing ? `${label}: campo obbligatorio.` : `${label}: valore non valido.`;
        errorEl.hidden = false;
        invalid.focus();
        return;
      }

      const out = {};
      fields.forEach((f) => { out[f.name] = readValue(f, form.elements[f.name]); });

      busy = true;
      submitBtn.disabled = true;
      try {
        const result = onSubmit ? await onSubmit(out) : out;
        busy = false;
        close(result ?? out);
      } catch (err) {
        busy = false;
        submitBtn.disabled = false;
        errorEl.textContent = err?.message || 'Salvataggio non riuscito.';
        errorEl.hidden = false;
      }
    });

    document.addEventListener('keydown', onKey, true);
    root.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    form.querySelector('input:not([type="checkbox"]), select, textarea')?.focus();
  });
}
