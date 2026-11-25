/**
 * Set di icone SVG coerente (griglia 24px, tratto 1.75, terminazioni arrotondate).
 * Uso: icon('users') oppure icon('users', 'icon--lg')
 */

import { raw } from '../utils/dom.js';

const PATHS = {
  dashboard: '<rect x="3.5" y="3.5" width="7" height="8" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/>',
  users: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.5"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35"/><path d="M15.5 4.65a3.5 3.5 0 0 1 0 6.7"/>',
  inbox: '<path d="M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5"/><path d="M5.6 5.6A2 2 0 0 1 7.4 4.5h9.2a2 2 0 0 1 1.8 1.1l2.1 7.4v4.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V13z"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.5h7.4a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  'check-square': '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  'file-text': '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M9 13h6M9 16.5h4"/>',
  note: '<path d="M5.5 3.5h13a2 2 0 0 1 2 2V15l-5.5 5.5H5.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z"/><path d="M20.5 15H17a2 2 0 0 0-2 2v3.5M8 8.5h8M8 12h5"/>',
  bell: '<path d="M6 9.5a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15.5 6 9.5"/><path d="M10.2 20.5a2 2 0 0 0 3.6 0"/>',
  activity: '<path d="M3.5 12h3.5l2.5-6.5 5 13 2.5-6.5h3.5"/>',
  archive: '<rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5M10 12.5h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.9 4.6 1.7 1.7 0 0 0 9.97 3.04V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8.9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  'chevrons-left': '<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>',
  'chevrons-right': '<path d="m13 17 5-5-5-5M6 17l5-5-5-5"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8 7h9v9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  'alert-triangle': '<path d="M10.3 4.3 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v6.5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V5.5M4.5 12v6.5c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V12"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 19.5h15"/>',
  upload: '<path d="M12 15.5V4.5M7 9l5-5 5 5M4.5 19.5h15"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l.9 12.1a2 2 0 0 0 2 1.9h6.2a2 2 0 0 0 2-1.9L18 7M10 11v6M14 11v6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  building: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M9 7.5h1.5M13.5 7.5H15M9 11.5h1.5M13.5 11.5H15M10 20.5v-4h4v4"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
  flag: '<path d="M5 21V4.5M5 4.5h11l-2 4 2 4H5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  rocket: '<path d="M14.5 4.5c3-1 5-1 5-1s0 2-1 5l-6.5 6.5-4-4z"/><path d="M8 10.5 5 10l-2 2 4 1M13.5 16l.5 3-2 2-1-4M15.5 8.5h.01"/>',
};

/**
 * @param {string} name
 * @param {string} [extraClass]
 */
export function icon(name, extraClass = '') {
  const body = PATHS[name] || PATHS.info;
  return raw(
    `<svg class="icon ${extraClass}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`,
  );
}

/* Percorsi dei loghi ufficiali ZEFIRO Digital Studio (assets/img/brand). */
export const BRAND = Object.freeze({
  logoDark: 'assets/img/brand/zefiro-logo-scuro.svg',     // logo completo per sfondi scuri
  logoLight: 'assets/img/brand/zefiro-logo-chiaro.svg',   // logo completo per sfondi chiari
  symbolDark: 'assets/img/brand/zefiro-simbolo-scuro.svg', // simbolo per sfondi scuri
  symbolLight: 'assets/img/brand/zefiro-simbolo.svg',     // simbolo per sfondi chiari
});

/** Immagine del brand. Decorativa per default (alt vuoto). */
export function brandImage(src, { className = '', alt = '', width, height } = {}) {
  const size = `${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}`;
  const safeAlt = String(alt).replace(/"/g, '&quot;');
  return raw(`<img class="${className}" src="${src}" alt="${safeAlt}"${size} decoding="async" draggable="false">`);
}
