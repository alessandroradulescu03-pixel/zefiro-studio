/**
 * Dialog di conferma accessibile (focus trap, Esc, click fuori).
 * Usato per tutte le operazioni distruttive.
 *
 * const ok = await confirmDialog({ title, message, confirmLabel, danger: true, requireText: 'ELIMINA' });
 */

import { html } from '../utils/dom.js';
import { icon } from './icons.js';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function confirmDialog({
  title,
  message,
  confirmLabel = 'Conferma',
  cancelLabel = 'Annulla',
  danger = false,
  requireText = '',
} = {}) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const previouslyFocused = document.activeElement;
    const titleId = `modal-title-${Date.now()}`;
    const descId = `${titleId}-desc`;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = String(html`
      <div class="modal ${danger ? 'modal--danger' : ''}" role="alertdialog" aria-modal="true"
           aria-labelledby="${titleId}" aria-describedby="${descId}">
        <div class="modal__body">
          <div class="modal__icon">${icon(danger ? 'alert-triangle' : 'info')}</div>
          <div>
            <h2 class="modal__title" id="${titleId}">${title}</h2>
            <p class="modal__text" id="${descId}">${message}</p>
            ${requireText ? html`
              <div class="field modal__confirm">
                <label class="field__label" for="${titleId}-input">Digita <strong>${requireText}</strong> per confermare</label>
                <input class="input" id="${titleId}-input" type="text" autocomplete="off" spellcheck="false">
              </div>` : ''}
          </div>
        </div>
        <div class="modal__foot">
          <button type="button" class="btn btn--ghost" data-action="cancel">${cancelLabel}</button>
          <button type="button" class="btn ${danger ? 'btn--danger-solid' : 'btn--primary'}" data-action="confirm"
            ${requireText ? 'disabled' : ''}>${confirmLabel}</button>
        </div>
      </div>
    `);

    const modal = backdrop.querySelector('.modal');
    const confirmBtn = backdrop.querySelector('[data-action="confirm"]');
    const input = backdrop.querySelector('input');

    const close = (result) => {
      document.removeEventListener('keydown', onKey, true);
      backdrop.remove();
      document.body.style.overflow = '';
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
      resolve(result);
    };

    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
      } else if (event.key === 'Tab') {
        const items = [...modal.querySelectorAll(FOCUSABLE)];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      } else if (event.key === 'Enter' && event.target === input && !confirmBtn.disabled) {
        event.preventDefault();
        close(true);
      }
    }

    input?.addEventListener('input', () => {
      confirmBtn.disabled = input.value.trim() !== requireText;
    });
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close(false);
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'cancel') close(false);
      if (action === 'confirm') close(true);
    });
    document.addEventListener('keydown', onKey, true);

    root.appendChild(backdrop);
    document.body.style.overflow = 'hidden';
    (input || backdrop.querySelector('[data-action="cancel"]')).focus();
  });
}
