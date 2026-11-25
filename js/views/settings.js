/**
 * Vista Impostazioni.
 * Schede: Profilo · Studio · Preferenze · Dati e backup
 * La scheda attiva è riflessa nell'URL (#/impostazioni/<scheda>).
 */

import { html, render, on, formValues } from '../utils/dom.js';
import { appState } from '../core/state.js';
import { replaceSegments } from '../core/router.js';
import {
  STORES, DB_NAME, DB_VERSION, countAll, exportAll, importAll, clearAll,
  getStorageInfo, requestPersistentStorage, onChange,
} from '../core/database.js';
import { saveSettingsGroup, updatePreferences, restoreDefaultPreferences, loadSettings } from '../services/settings-service.js';
import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import { initials, formatBytes, formatNumber } from '../utils/format.js';

const TABS = [
  { id: 'profilo', label: 'Profilo', icon: 'user' },
  { id: 'studio', label: 'Studio', icon: 'building' },
  { id: 'preferenze', label: 'Preferenze', icon: 'sliders' },
  { id: 'dati', label: 'Dati e backup', icon: 'database' },
];

const STORE_LABELS = {
  [STORES.CLIENTS]: 'Clienti',
  [STORES.REQUESTS]: 'Contatti in arrivo',
  [STORES.PROJECTS]: 'Progetti',
  [STORES.TASKS]: 'Da fare',
  [STORES.QUOTES]: 'Preventivi',
  [STORES.NOTES]: 'Note',
  [STORES.REMINDERS]: 'Promemoria',
  [STORES.TIMELINE]: 'Timeline',
  [STORES.ATTACHMENTS]: 'Allegati',
  [STORES.SETTINGS]: 'Impostazioni',
};

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export default {
  mount(container, { segments }) {
    let activeTab = TABS.some((t) => t.id === segments[0]) ? segments[0] : 'profilo';
    if (segments[0] !== activeTab) replaceSegments('settings', activeTab);

    render(container, html`
      <div class="view-enter">
        <header class="page-head">
          <div>
            <p class="page-head__eyebrow">System</p>
            <h2 class="page-head__title">Impostazioni</h2>
            <p class="page-head__text">Profilo, dati dello studio, preferenze dell'interfaccia e gestione dei dati salvati in questo browser.</p>
          </div>
        </header>

        <div class="settings">
          <div class="settings__nav" role="tablist" aria-label="Sezioni impostazioni" aria-orientation="vertical">
            ${TABS.map((t) => html`
              <button type="button" class="settings__tab" role="tab" id="tab-${t.id}"
                aria-controls="panel-${t.id}" data-tab="${t.id}">
                ${icon(t.icon)}<span>${t.label}</span>
              </button>`)}
          </div>
          <div class="settings__panels">
            ${TABS.map((t) => html`
              <section class="settings__panel" role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}" tabindex="-1" hidden></section>`)}
          </div>
        </div>
      </div>
    `);

    const panels = Object.fromEntries(TABS.map((t) => [t.id, container.querySelector(`#panel-${t.id}`)]));
    const disposers = [];

    /* ---------- Schede ---------- */
    const selectTab = (id, { focus = false, updateUrl = true } = {}) => {
      activeTab = id;
      container.querySelectorAll('[role="tab"]').forEach((tab) => {
        const selected = tab.dataset.tab === id;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focus) tab.focus();
      });
      Object.entries(panels).forEach(([key, panel]) => { panel.hidden = key !== id; });
      drawPanel(id);
      if (updateUrl) replaceSegments('settings', id);
    };

    disposers.push(on(container, 'click', '[role="tab"]', (_e, tab) => selectTab(tab.dataset.tab)));
    disposers.push(on(container, 'keydown', '[role="tab"]', (event, tab) => {
      const idx = TABS.findIndex((t) => t.id === tab.dataset.tab);
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (event.key in keys) {
        event.preventDefault();
        const next = TABS[(idx + keys[event.key] + TABS.length) % TABS.length];
        selectTab(next.id, { focus: true });
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        selectTab(TABS[event.key === 'Home' ? 0 : TABS.length - 1].id, { focus: true });
      }
    }));

    /* ---------- Rendering pannelli ---------- */
    const drawPanel = (id) => {
      const state = appState.get();
      if (id === 'profilo') render(panels.profilo, profilePanel(state));
      if (id === 'studio') render(panels.studio, studioPanel(state));
      if (id === 'preferenze') render(panels.preferenze, preferencesPanel(state));
      if (id === 'dati') {
        render(panels.dati, dataPanel(null));
        refreshDataPanel();
      }
    };

    let dataToken = 0;
    const refreshDataPanel = async () => {
      const token = ++dataToken;
      try {
        const [counts, storage] = await Promise.all([countAll(), getStorageInfo()]);
        if (token !== dataToken || activeTab !== 'dati') return;
        render(panels.dati, dataPanel({ counts, storage }));
      } catch (err) {
        console.error('[settings] lettura dati', err);
        toast.error(err.message || 'Impossibile leggere le informazioni del database.');
      }
    };

    // Aggiorna i conteggi se i dati cambiano mentre la scheda è aperta
    disposers.push(onChange(() => { if (activeTab === 'dati') refreshDataPanel(); }));

    /* ---------- Form: stato "modificato" ---------- */
    disposers.push(on(container, 'input', 'form[data-group]', (_e, form) => {
      const group = form.dataset.group;
      const current = appState.get()[group];
      const values = formValues(form);
      const dirty = Object.keys(values).some((k) => (values[k] || '').trim() !== (current[k] || ''));
      form.querySelector('[type="submit"]').disabled = !dirty;
      form.querySelector('[data-action="reset-form"]').disabled = !dirty;
      // Anteprima live del profilo
      if (group === 'profile') updateProfilePreview(form, values);
      form.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
        if (el.checkValidity()) {
          el.removeAttribute('aria-invalid');
          document.getElementById(`${el.id}-error`)?.remove();
        }
      });
    }));

    disposers.push(on(container, 'click', '[data-action="reset-form"]', (_e, btn) => {
      drawPanel(btn.closest('form').dataset.group === 'profile' ? 'profilo' : 'studio');
    }));

    disposers.push(on(container, 'submit', 'form[data-group]', async (event, form) => {
      event.preventDefault();
      if (!validate(form)) return;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        await saveSettingsGroup(form.dataset.group, formValues(form));
        toast.success('Modifiche salvate.');
        drawPanel(activeTab);
      } catch (err) {
        console.error('[settings] salvataggio', err);
        toast.error(err.message || 'Salvataggio non riuscito.');
        submit.disabled = false;
      }
    }));

    /* ---------- Preferenze ---------- */
    disposers.push(on(container, 'change', 'input[data-pref]', (_e, input) => {
      updatePreferences({ [input.dataset.pref]: input.checked });
      toast.success('Preferenza aggiornata.');
    }));
    disposers.push(on(container, 'click', '[data-action="reset-prefs"]', async () => {
      const ok = await confirmDialog({
        title: 'Ripristinare le preferenze?',
        message: 'Le preferenze dell\'interfaccia torneranno ai valori predefiniti. I tuoi dati non vengono toccati.',
        confirmLabel: 'Ripristina',
      });
      if (!ok) return;
      restoreDefaultPreferences();
      drawPanel('preferenze');
      toast.success('Preferenze ripristinate.');
    }));

    /* ---------- Dati e backup ---------- */
    disposers.push(on(container, 'click', '[data-action="persist"]', async (_e, btn) => {
      btn.disabled = true;
      const granted = await requestPersistentStorage();
      if (granted) toast.success('Il browser conserverà i dati in modo persistente.');
      else toast.info('Il browser non ha concesso la persistenza. Esegui backup periodici per sicurezza.');
      refreshDataPanel();
    }));

    disposers.push(on(container, 'click', '[data-action="export"]', async (_e, btn) => {
      btn.disabled = true;
      try {
        const backup = await exportAll();
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zefiro-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success('Backup esportato.');
      } catch (err) {
        console.error('[settings] export', err);
        toast.error(err.message || 'Esportazione non riuscita.');
      } finally {
        btn.disabled = false;
      }
    }));

    disposers.push(on(container, 'click', '[data-action="import"]', () => {
      container.querySelector('#import-file')?.click();
    }));

    disposers.push(on(container, 'change', '#import-file', async (_e, input) => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        toast.error('Il file è troppo grande per essere un backup valido.');
        return;
      }
      let backup;
      try {
        backup = JSON.parse(await file.text());
      } catch {
        toast.error('Il file non contiene JSON valido.');
        return;
      }
      const ok = await confirmDialog({
        title: 'Importare il backup?',
        message: html`Tutti i dati attuali verranno <strong>sostituiti</strong> con quelli di “${file.name}”. Ti consigliamo di esportare prima un backup dei dati correnti.`,
        confirmLabel: 'Importa e sostituisci',
        danger: true,
      });
      if (!ok) return;
      try {
        const total = await importAll(backup);
        await loadSettings();
        toast.success(`Backup importato: ${formatNumber(total)} elementi ripristinati.`);
        refreshDataPanel();
      } catch (err) {
        console.error('[settings] import', err);
        toast.error(err.message || 'Importazione non riuscita. Nessun dato è stato modificato.');
      }
    }));

    disposers.push(on(container, 'click', '[data-action="wipe"]', async () => {
      const ok = await confirmDialog({
        title: 'Eliminare tutti i dati?',
        message: 'Clienti, progetti, preventivi, note, impostazioni e ogni altro dato salvato in questo browser verranno eliminati definitivamente. L\'operazione non può essere annullata.',
        confirmLabel: 'Elimina tutto',
        danger: true,
        requireText: 'ELIMINA',
      });
      if (!ok) return;
      try {
        await clearAll();
        appState.set({
          profile: { name: '', role: '', email: '' },
          studio: { name: 'ZEFIRO Digital Studio', email: '', phone: '', website: '', vat: '', address: '' },
        });
        toast.success('Tutti i dati sono stati eliminati.');
        refreshDataPanel();
      } catch (err) {
        console.error('[settings] wipe', err);
        toast.error(err.message || 'Eliminazione non riuscita.');
      }
    }));

    // Se lo stato cambia altrove (es. preferenze dalla sidebar) aggiorna il pannello preferenze
    disposers.push(appState.subscribe((s, prev) => {
      if (activeTab === 'preferenze' && s.preferences !== prev.preferences) {
        container.querySelectorAll('input[data-pref]').forEach((input) => {
          input.checked = Boolean(s.preferences[input.dataset.pref]);
        });
      }
    }));

    selectTab(activeTab, { updateUrl: false });

    return () => disposers.forEach((off) => off());
  },
};

/* ---------------- Validazione ---------------- */

function validate(form) {
  let firstInvalid = null;
  form.querySelectorAll('input').forEach((input) => {
    document.getElementById(`${input.id}-error`)?.remove();
    input.removeAttribute('aria-invalid');
    if (!input.checkValidity()) {
      input.setAttribute('aria-invalid', 'true');
      const msg = document.createElement('p');
      msg.className = 'field__error';
      msg.id = `${input.id}-error`;
      msg.textContent = errorMessage(input);
      input.setAttribute('aria-describedby', msg.id);
      input.after(msg);
      firstInvalid ||= input;
    }
  });
  firstInvalid?.focus();
  return !firstInvalid;
}

function errorMessage(input) {
  const v = input.validity;
  if (v.valueMissing) return 'Questo campo è obbligatorio.';
  if (v.typeMismatch && input.type === 'email') return 'Inserisci un indirizzo email valido.';
  if (v.typeMismatch && input.type === 'url') return 'Inserisci un indirizzo web completo (es. https://…).';
  if (v.tooLong) return `Massimo ${input.maxLength} caratteri.`;
  if (v.patternMismatch) return input.dataset.patternMessage || 'Formato non valido.';
  return 'Valore non valido.';
}

/* ---------------- Template pannelli ---------------- */

function field({ id, name, label, value = '', type = 'text', required = false, placeholder = '', hint = '', full = false, maxLength = 120, autocomplete = 'off', pattern = '', patternMessage = '' }) {
  return html`
    <div class="field ${full ? 'field--full' : ''}">
      <label class="field__label" for="${id}">${label}${required ? html` <span class="muted" aria-hidden="true">*</span>` : ''}</label>
      <input class="input" id="${id}" name="${name}" type="${type}" value="${value}"
        placeholder="${placeholder}" maxlength="${maxLength}" autocomplete="${autocomplete}"
        ${required ? html`required aria-required="true"` : ''}
        ${pattern ? html`pattern="${pattern}" data-pattern-message="${patternMessage}"` : ''}>
      ${hint ? html`<p class="field__hint">${hint}</p>` : ''}
    </div>
  `;
}

function formFooter() {
  return html`
    <div class="card__foot">
      <button type="button" class="btn btn--ghost" data-action="reset-form" disabled>Annulla modifiche</button>
      <button type="submit" class="btn btn--primary" disabled>${icon('check', 'icon--sm')}<span>Salva</span></button>
    </div>
  `;
}

function profilePanel({ profile }) {
  const ini = initials(profile.name);
  return html`
    <form class="card" data-group="profile" novalidate>
      <div class="card__head">
        <div>
          <h3 class="card__title">${icon('user')}Profilo</h3>
          <p class="card__subtitle">Il tuo nome viene usato per il saluto in dashboard e nella barra laterale.</p>
        </div>
      </div>
      <div class="card__body">
        <div class="profile-preview" data-slot="preview">
          <span class="avatar avatar--lg ${ini ? '' : 'avatar--empty'}" data-slot="preview-avatar">${ini || icon('user')}</span>
          <div style="min-width:0">
            <p class="profile-preview__name" data-slot="preview-name">${profile.name || 'Il tuo nome'}</p>
            <p class="profile-preview__role" data-slot="preview-role">${profile.role || 'Ruolo nello studio'}</p>
          </div>
        </div>
        <div class="form-grid">
          ${field({ id: 'profile-name', name: 'name', label: 'Nome e cognome', value: profile.name, required: true, placeholder: 'Es. Alessandro Rossi', autocomplete: 'name', maxLength: 80 })}
          ${field({ id: 'profile-role', name: 'role', label: 'Ruolo', value: profile.role, placeholder: 'Es. Founder & Web Developer', autocomplete: 'organization-title', maxLength: 80 })}
          ${field({ id: 'profile-email', name: 'email', label: 'Email personale', value: profile.email, type: 'email', placeholder: 'nome@zefiro.studio', autocomplete: 'email', full: true })}
        </div>
      </div>
      ${formFooter()}
    </form>
  `;
}

function updateProfilePreview(form, values) {
  const avatar = form.querySelector('[data-slot="preview-avatar"]');
  const ini = initials(values.name || '');
  avatar.classList.toggle('avatar--empty', !ini);
  if (ini) avatar.textContent = ini;
  else avatar.innerHTML = String(icon('user'));
  form.querySelector('[data-slot="preview-name"]').textContent = values.name?.trim() || 'Il tuo nome';
  form.querySelector('[data-slot="preview-role"]').textContent = values.role?.trim() || 'Ruolo nello studio';
}

function studioPanel({ studio }) {
  return html`
    <form class="card" data-group="studio" novalidate>
      <div class="card__head">
        <div>
          <h3 class="card__title">${icon('building')}Dati dello studio</h3>
          <p class="card__subtitle">Informazioni che verranno usate nei preventivi e nei documenti.</p>
        </div>
      </div>
      <div class="card__body">
        <div class="form-grid">
          ${field({ id: 'studio-name', name: 'name', label: 'Nome dello studio', value: studio.name, required: true, autocomplete: 'organization', maxLength: 80 })}
          ${field({ id: 'studio-vat', name: 'vat', label: 'Partita IVA', value: studio.vat, placeholder: '11 cifre', maxLength: 13, pattern: '(IT)?[0-9]{11}', patternMessage: 'La Partita IVA è composta da 11 cifre (opzionalmente precedute da IT).' })}
          ${field({ id: 'studio-email', name: 'email', label: 'Email', value: studio.email, type: 'email', placeholder: 'info@zefiro.studio', autocomplete: 'email' })}
          ${field({ id: 'studio-phone', name: 'phone', label: 'Telefono', value: studio.phone, type: 'tel', placeholder: '+39 …', autocomplete: 'tel', maxLength: 24 })}
          ${field({ id: 'studio-website', name: 'website', label: 'Sito web', value: studio.website, type: 'url', placeholder: 'https://', autocomplete: 'url', full: true })}
          ${field({ id: 'studio-address', name: 'address', label: 'Indirizzo', value: studio.address, placeholder: 'Via, numero civico, CAP, città', autocomplete: 'street-address', full: true, maxLength: 200 })}
        </div>
      </div>
      ${formFooter()}
    </form>
  `;
}

function preferencesPanel({ preferences }) {
  const row = (key, title, desc) => html`
    <div class="switch-row">
      <div class="switch-row__text">
        <p class="switch-row__title" id="pref-${key}-label">${title}</p>
        <p class="switch-row__desc" id="pref-${key}-desc">${desc}</p>
      </div>
      <span class="switch">
        <input type="checkbox" role="switch" data-pref="${key}" ${preferences[key] ? 'checked' : ''}
          aria-labelledby="pref-${key}-label" aria-describedby="pref-${key}-desc">
        <span class="switch__track" aria-hidden="true"></span>
      </span>
    </div>`;

  return html`
    <div class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">${icon('sliders')}Interfaccia</h3>
          <p class="card__subtitle">Preferenze salvate solo su questo dispositivo.</p>
        </div>
      </div>
      <div class="card__body" style="padding-top:var(--sp-2)">
        ${row('sidebarCompact', 'Barra laterale compatta', 'Mostra solo le icone nella barra laterale su schermi desktop.')}
        ${row('reducedMotion', 'Riduci animazioni', 'Disattiva transizioni e microanimazioni dell\'interfaccia.')}
        ${row('showMotto', 'Frase motivazionale', 'Mostra una frase motivazionale e il simbolo ZEFIRO in sottofondo nelle pagine.')}
      </div>
      <div class="card__foot">
        <button type="button" class="btn btn--ghost" data-action="reset-prefs">Ripristina predefinite</button>
      </div>
    </div>
  `;
}

function dataPanel(info) {
  const kv = (label, value) => html`<div class="kv__item"><p class="kv__label">${label}</p><p class="kv__value">${value}</p></div>`;
  const loading = html`<span class="skeleton" style="display:block;width:40px;height:20px;margin-top:4px"></span>`;
  const persisted = info?.storage.persisted;

  return html`
    <div class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">${icon('database')}Database locale</h3>
          <p class="card__subtitle">I dati sono salvati in IndexedDB in questo browser e restano disponibili dopo il riavvio.</p>
        </div>
        ${info ? html`<span class="badge ${persisted ? 'badge--success' : 'badge--warning'}">
          <span class="dot ${persisted ? 'dot--success' : 'dot--warning'}"></span>${persisted ? 'Archiviazione persistente' : 'Archiviazione standard'}
        </span>` : ''}
      </div>
      <div class="card__body">
        <div class="kv">
          ${Object.entries(STORE_LABELS).map(([store, label]) => kv(label, info ? formatNumber(info.counts[store] ?? 0) : loading))}
          ${kv('Spazio usato', info ? formatBytes(info.storage.usage) : loading)}
          ${kv('Versione schema', html`v${DB_VERSION}`)}
        </div>
        <p class="field__hint" style="margin-top:var(--sp-4)">Nome database: <code>${DB_NAME}</code></p>
        ${info && persisted === false ? html`
          <div class="data-action" style="margin-top:var(--sp-2);border-top:1px solid var(--border)">
            <div>
              <p class="data-action__title">Proteggi i dati dalla pulizia automatica</p>
              <p class="data-action__desc">Chiedi al browser di non eliminare i dati quando lo spazio su disco è scarso.</p>
            </div>
            <button type="button" class="btn" data-action="persist">${icon('shield', 'icon--sm')}<span>Richiedi persistenza</span></button>
          </div>` : ''}
      </div>
    </div>

    <div class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">${icon('download')}Backup</h3>
          <p class="card__subtitle">Salva una copia dei dati o ripristinala su un altro browser o computer.</p>
        </div>
      </div>
      <div class="card__body" style="padding-top:var(--sp-2)">
        <div class="data-action">
          <div>
            <p class="data-action__title">Esporta backup</p>
            <p class="data-action__desc">Scarica un file JSON con tutti i dati del gestionale.</p>
          </div>
          <button type="button" class="btn" data-action="export">${icon('download', 'icon--sm')}<span>Esporta</span></button>
        </div>
        <div class="data-action">
          <div>
            <p class="data-action__title">Importa backup</p>
            <p class="data-action__desc">Sostituisce i dati attuali con quelli di un file di backup.</p>
          </div>
          <button type="button" class="btn" data-action="import">${icon('upload', 'icon--sm')}<span>Importa</span></button>
          <input type="file" id="import-file" accept="application/json,.json" hidden>
        </div>
      </div>
    </div>

    <div class="card card--danger">
      <div class="card__head">
        <div>
          <h3 class="card__title">${icon('alert-triangle')}Zona pericolosa</h3>
          <p class="card__subtitle">Operazioni irreversibili.</p>
        </div>
      </div>
      <div class="card__body" style="padding-top:var(--sp-2)">
        <div class="data-action">
          <div>
            <p class="data-action__title">Elimina tutti i dati</p>
            <p class="data-action__desc">Cancella definitivamente ogni dato salvato in questo browser.</p>
          </div>
          <button type="button" class="btn btn--danger" data-action="wipe">${icon('trash', 'icon--sm')}<span>Elimina tutto</span></button>
        </div>
      </div>
    </div>
  `;
}
