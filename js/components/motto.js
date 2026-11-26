/**
 * Frase motivazionale in sottofondo, con il simbolo ZEFIRO in filigrana.
 * Cambia ogni giorno e per ogni sezione; si spegne da Impostazioni → Preferenze.
 */

import { appState } from '../core/state.js';
import { BRAND } from './icons.js';

const PHRASES = [
  'Perché te lo meriti.',
  'Un passo alla volta, ma sempre avanti.',
  'Oggi costruisci il tuo domani.',
  'Fatto è meglio di perfetto.',
  'Hai iniziato. Adesso continua.',
  'Piccoli progressi, grandi risultati.',
  'Credi in quello che stai creando.',
  'Il vento giusto arriva a chi si muove.',
  'Ogni cliente è una storia da scrivere bene.',
  'La costanza batte il talento che non lavora.',
  'Le idee valgono quando diventano realtà.',
  'Sei più vicino di quanto pensi.',
  'Lavora in silenzio, lascia parlare i risultati.',
  'Quello che fai oggi conta.',
  'Punta in alto. Sempre.',
  'Il tuo studio, le tue regole.',
];

/** Indice stabile per giorno + sezione: la frase non cambia a ogni clic. */
function pick(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return PHRASES[Math.abs(h) % PHRASES.length];
}

export function mountMotto() {
  const el = document.createElement('div');
  el.className = 'motto';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<img class="motto__mark" src="${BRAND.symbolDark}" alt="" draggable="false">`;
  document.body.prepend(el);

  // La frase sta nella barra in alto: sempre leggibile, mai coperta dai contenuti.
  const text = document.createElement('p');
  text.className = 'motto__text';
  const topbar = document.getElementById('topbar');
  const actions = topbar?.querySelector('.topbar__actions');
  if (actions) topbar.insertBefore(text, actions); else (topbar || el).append(text);

  const update = (state, prev = {}) => {
    el.hidden = text.hidden = state.preferences?.showMotto === false;
    if (state.route?.id === prev.route?.id && text.textContent) return;
    const today = new Date().toISOString().slice(0, 10);
    const next = pick(`${today}|${state.route?.id || 'home'}`);
    if (next === text.textContent) return;
    text.classList.remove('is-in');
    text.textContent = next;
    requestAnimationFrame(() => text.classList.add('is-in'));
  };
  update(appState.get());
  appState.subscribe(update);
}
