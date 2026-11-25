# ZEFIRO Studio Manager

Gestionale interno di **ZEFIRO Digital Studio**.
Applicazione web statica: HTML5, CSS3 e JavaScript ES Modules vanilla, con i dati salvati in **IndexedDB** nel browser.

Nessun framework, nessun Node.js, nessun backend.

---

## Avvio in locale (VS Code)

Gli ES Modules **non funzionano aprendo `index.html` con doppio clic** (`file://`): serve un piccolo server locale.

### Opzione 1 — Live Server (consigliata)
1. Apri la cartella `Zefiro-Studio` in VS Code.
2. Installa l'estensione **Live Server** (Ritwick Dey).
3. Clic destro su `index.html` → **Open with Live Server**.
4. Si apre `http://127.0.0.1:5500/` — fatto.

### Opzione 2 — Python (già presente su macOS)
```bash
cd ~/Desktop/Zefiro-Studio
python3 -m http.server 8000
```
Poi apri `http://localhost:8000`.

> I dati sono legati all'indirizzo da cui apri l'app: `127.0.0.1:5500`, `localhost:8000` e GitHub Pages hanno database separati. Usa **Impostazioni → Dati e backup** per spostare i dati da uno all'altro.

---

## Pubblicazione su GitHub Pages

1. Carica il contenuto della cartella in un repository (con `index.html` nella radice).
2. Su GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, cartella `/ (root)`.
3. Dopo qualche minuto l'app è online su `https://<utente>.github.io/<repository>/`.

Tutti i percorsi sono relativi e la navigazione usa l'hash (`#/dashboard`), quindi funziona anche in una sottocartella senza configurazioni. Il file `.nojekyll` evita che GitHub elabori i file.

---

## Struttura del progetto

```
Zefiro-Studio/
├── index.html                  Shell dell'applicazione
├── .nojekyll
├── README.md
├── assets/
│   ├── css/
│   │   ├── tokens.css          Palette, tipografia, spaziature, ombre
│   │   ├── base.css            Reset, accessibilità, elementi base
│   │   ├── layout.css          Sidebar, topbar, responsive della shell
│   │   ├── components.css      Pulsanti, card, form, modali, toast…
│   │   └── views.css           Stili di dashboard, impostazioni, moduli
│   └── img/
│       ├── favicon.svg, favicon-32.png, apple-touch-icon.png
│       └── brand/              Loghi ufficiali ZEFIRO
│           ├── zefiro-logo-scuro.svg      logo completo, sfondi scuri
│           ├── zefiro-logo-chiaro.svg     logo completo, sfondi chiari
│           ├── zefiro-simbolo-scuro.svg   simbolo, sfondi scuri
│           └── zefiro-simbolo.svg         simbolo, sfondi chiari
└── js/
    ├── app.js                  Avvio: layout, database, router
    ├── config/
    │   ├── modules.js          Registro moduli (sidebar + rotte)
    │   └── domain.js           Stati e tipi condivisi (progetto attivo, richiesta aperta…)
    ├── core/
    │   ├── database.js         IndexedDB: migrazioni, CRUD, backup
    │   ├── state.js            Stato globale con sottoscrizioni
    │   ├── router.js           Router hash
    │   ├── view-manager.js     Montaggio/pulizia delle viste
    │   └── preferences.js      Preferenze UI (localStorage)
    ├── services/
    │   ├── settings-service.js Impostazioni su IndexedDB
    │   ├── dashboard-service.js Aggregazione dati dashboard
    │   └── activity-service.js Registro attività (timeline)
    ├── components/
    │   ├── icons.js            Icone SVG e marchio
    │   ├── sidebar.js
    │   ├── topbar.js
    │   ├── modal.js            Dialog di conferma
    │   ├── toast.js            Notifiche
    │   └── empty-state.js
    ├── utils/
    │   ├── dom.js              Template HTML con escape automatico
    │   └── format.js           Date e numeri in italiano
    └── views/
        ├── dashboard.js
        ├── settings.js
        └── upcoming.js         Pagina dei moduli in arrivo
```

---

## Dati

| Dove | Cosa |
|---|---|
| **IndexedDB** `zefiro-studio-manager` | Tutti i dati: clienti, richieste, progetti, attività, preventivi, note, promemoria, timeline, allegati, impostazioni |
| **localStorage** `zefiro.preferences.v1` | Solo preferenze di interfaccia (sidebar compatta, animazioni ridotte) |

Ogni record ha `id` (UUID), `createdAt` e `updatedAt` gestiti automaticamente.

**Backup:** Impostazioni → Dati e backup → *Esporta* scarica un file JSON; *Importa* lo ripristina (sostituisce i dati attuali, in modo atomico).

### API del database (`js/core/database.js`)

```js
import { STORES, create, get, getAll, update, upsert, remove, count } from './core/database.js';

const cliente = await create(STORES.CLIENTS, { name: 'Rossi Srl', status: 'active' });
await update(STORES.CLIENTS, cliente.id, { email: 'info@rossi.it' });
const attivi = await getAll(STORES.CLIENTS, { index: 'status', value: 'active', sortBy: 'name' });
await remove(STORES.CLIENTS, cliente.id);
```

`onChange(fn)` notifica ogni scrittura: la dashboard la usa per aggiornarsi da sola.

### Modificare lo schema
1. Aggiungi una voce in `MIGRATIONS` con `version: 2`.
2. Imposta `DB_VERSION = 2`.
3. Non modificare mai le migrazioni già esistenti.

---

## Aggiungere un modulo (fasi successive)

1. Crea la vista in `js/views/clients.js`:
   ```js
   export default {
     mount(container, { module, segments }) {
       // disegna la vista…
       return () => { /* cleanup opzionale */ };
     },
   };
   ```
2. In `js/config/modules.js` sul modulo corrispondente imposta:
   ```js
   status: 'ready',
   load: () => import('../views/clients.js'),
   ```
3. Dopo le operazioni importanti registra l'attività:
   ```js
   import { logActivity } from '../services/activity-service.js';
   await logActivity({ entityType: 'client', entityId: id, action: 'created', title: 'Rossi Srl' });
   ```

Sidebar, rotte, titoli e dashboard si aggiornano senza altre modifiche.

---

## Browser supportati

Ultime versioni di Chrome, Edge, Safari e Firefox (desktop e mobile).
In navigazione privata alcuni browser limitano o cancellano IndexedDB alla chiusura.
