/**
 * Notifiche toast non bloccanti.
 * toast.success('Salvato'), toast.error('…'), toast.info('…')
 */

import { html } from '../utils/dom.js';
import { icon } from './icons.js';

const ICONS = { success: 'check', error: 'alert-triangle', info: 'info' };
const DURATION = 4200;

function show(type, message, { duration = DURATION } = {}) {
  const region = document.getElementById('toast-root');
  if (!region) return;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = String(html`
    <span class="toast__icon">${icon(ICONS[type], 'icon--sm')}</span>
    <div class="toast__msg">${message}</div>
    <button type="button" class="toast__close" aria-label="Chiudi notifica">${icon('x', 'icon--sm')}</button>
  `);

  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    // fallback se le animazioni sono disattivate
    setTimeout(() => el.remove(), 400);
  };

  el.querySelector('.toast__close').addEventListener('click', dismiss);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 1800); });

  region.appendChild(el);
  timer = setTimeout(dismiss, type === 'error' ? duration * 1.6 : duration);
}

export const toast = {
  success: (msg, opts) => show('success', msg, opts),
  error: (msg, opts) => show('error', msg, opts),
  info: (msg, opts) => show('info', msg, opts),
};
