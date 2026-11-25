/**
 * Empty state riutilizzabile.
 * Le azioni sono sempre link reali (href) o pulsanti con data-action gestito dalla vista.
 */

import { html } from '../utils/dom.js';
import { icon } from './icons.js';

/**
 * @param {{ icon?: string, title: string, text?: string, compact?: boolean,
 *           actions?: Array<{ label: string, href?: string, action?: string, primary?: boolean, icon?: string }> }} opts
 */
export function emptyState({ icon: iconName = 'info', title, text = '', compact = false, actions = [] }) {
  return html`
    <div class="empty ${compact ? 'empty--compact' : ''}">
      <div class="empty__icon">${icon(iconName)}</div>
      <p class="empty__title">${title}</p>
      ${text ? html`<p class="empty__text">${text}</p>` : ''}
      ${actions.length ? html`
        <div class="empty__actions">
          ${actions.map((a) => {
            const cls = `btn btn--sm ${a.primary ? 'btn--primary' : ''}`;
            const inner = html`${a.icon ? icon(a.icon, 'icon--sm') : ''}<span>${a.label}</span>`;
            return a.href
              ? html`<a class="${cls}" href="${a.href}">${inner}</a>`
              : html`<button type="button" class="${cls}" data-action="${a.action}">${inner}</button>`;
          })}
        </div>` : ''}
    </div>
  `;
}
