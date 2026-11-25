-- =====================================================================
--  ZEFIRO Studio Manager — schema CRM (Clienti, Richieste, Progetti,
--  Attività, Promemoria) per il progetto Supabase "zefiro-gestionale".
--
--  DA APPROVARE PRIMA DI ESEGUIRE.
--  Come si usa: Supabase → SQL Editor → New query → incolla tutto → Run.
--  È ripetibile: non cancella tabelle né dati esistenti (solo
--  "create ... if not exists" e policy ricreate con lo stesso nome).
--
--  Sicurezza:
--  - ogni riga ha owner_id = utente che l'ha creata (auth.uid())
--  - Row Level Security attiva su tutte le tabelle: ogni utente vede,
--    crea, modifica ed elimina SOLO le proprie righe
--  - il ruolo "anon" (chi non ha fatto login) non ha nessun permesso
--  - i collegamenti (cliente, progetto…) devono puntare a righe dello
--    stesso utente: controllato nelle policy
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funzione comune: aggiorna updated_at a ogni modifica
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- CLIENTI
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind          text not null default 'azienda' check (kind in ('azienda', 'privato')),
  name          text not null check (length(btrim(name)) between 1 and 160),   -- ragione sociale o nome e cognome
  contact_name  text not null default '' check (length(contact_name) <= 160), -- referente
  email         text not null default '' check (length(email) <= 200),
  phone         text not null default '' check (length(phone) <= 40),
  website       text not null default '' check (length(website) <= 300),
  vat_number    text not null default '' check (length(vat_number) <= 30),    -- partita IVA
  tax_code      text not null default '' check (length(tax_code) <= 30),      -- codice fiscale
  address       text not null default '' check (length(address) <= 300),
  city          text not null default '' check (length(city) <= 120),
  province      text not null default '' check (length(province) <= 10),
  zip           text not null default '' check (length(zip) <= 12),
  country       text not null default 'IT' check (length(country) <= 2),
  status        text not null default 'lead' check (status in ('lead', 'attivo', 'inattivo', 'archiviato')),
  source        text not null default '' check (length(source) <= 60),       -- da dove è arrivato (sito, Instagram…)
  notes         text not null default '' check (length(notes) <= 10000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists clients_owner_idx  on public.clients (owner_id);
create index if not exists clients_status_idx on public.clients (owner_id, status);
create index if not exists clients_name_idx   on public.clients (owner_id, lower(name));

-- ---------------------------------------------------------------------
-- PROGETTI  (creata prima delle richieste: una richiesta può diventare progetto)
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete restrict,       -- un cliente con progetti non si elimina: si archivia
  name          text not null check (length(btrim(name)) between 1 and 160),
  description   text not null default '' check (length(description) <= 10000),
  status        text not null default 'da_iniziare'
                check (status in ('da_iniziare', 'in_corso', 'in_revisione', 'in_pausa', 'completato', 'annullato')),
  start_date    date,
  due_date      date,
  amount        numeric(10,2) check (amount is null or amount >= 0),        -- importo pattuito (€)
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index if not exists projects_owner_idx  on public.projects (owner_id);
create index if not exists projects_client_idx on public.projects (client_id);
create index if not exists projects_status_idx on public.projects (owner_id, status);
create index if not exists projects_due_idx    on public.projects (owner_id, due_date);

-- ---------------------------------------------------------------------
-- RICHIESTE
-- ---------------------------------------------------------------------
create table if not exists public.requests (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete set null,
  project_id    uuid references public.projects(id) on delete set null,     -- progetto nato da questa richiesta
  title         text not null check (length(btrim(title)) between 1 and 200),
  description   text not null default '' check (length(description) <= 10000),
  -- chi ha scritto, se non è ancora un cliente
  contact_name  text not null default '' check (length(contact_name) <= 160),
  contact_email text not null default '' check (length(contact_email) <= 200),
  contact_phone text not null default '' check (length(contact_phone) <= 40),
  source        text not null default 'altro'
                check (source in ('sito', 'email', 'telefono', 'whatsapp', 'instagram', 'passaparola', 'altro')),
  status        text not null default 'nuova'
                check (status in ('nuova', 'in_valutazione', 'preventivo_inviato', 'accettata', 'rifiutata', 'archiviata')),
  priority      text not null default 'media' check (priority in ('bassa', 'media', 'alta')),
  budget        text not null default '' check (length(budget) <= 80),
  received_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists requests_owner_idx    on public.requests (owner_id);
create index if not exists requests_client_idx   on public.requests (client_id);
create index if not exists requests_project_idx  on public.requests (project_id);
create index if not exists requests_status_idx   on public.requests (owner_id, status);
create index if not exists requests_received_idx on public.requests (owner_id, received_at desc);

-- ---------------------------------------------------------------------
-- ATTIVITÀ
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete cascade,      -- se il progetto viene eliminato, spariscono le sue attività
  client_id     uuid references public.clients(id) on delete cascade,
  title         text not null check (length(btrim(title)) between 1 and 200),
  description   text not null default '' check (length(description) <= 10000),
  status        text not null default 'da_fare' check (status in ('da_fare', 'in_corso', 'fatto')),
  priority      text not null default 'media' check (priority in ('bassa', 'media', 'alta')),
  due_date      date,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists tasks_owner_idx   on public.tasks (owner_id);
create index if not exists tasks_project_idx on public.tasks (project_id);
create index if not exists tasks_client_idx  on public.tasks (client_id);
create index if not exists tasks_status_idx  on public.tasks (owner_id, status, due_date);

-- ---------------------------------------------------------------------
-- PROMEMORIA
-- ---------------------------------------------------------------------
create table if not exists public.reminders (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id     uuid references public.clients(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete cascade,
  task_id       uuid references public.tasks(id) on delete cascade,
  title         text not null check (length(btrim(title)) between 1 and 200),
  notes         text not null default '' check (length(notes) <= 5000),
  remind_at     timestamptz not null,
  done          boolean not null default false,
  done_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists reminders_owner_idx  on public.reminders (owner_id);
create index if not exists reminders_due_idx    on public.reminders (owner_id, done, remind_at);
create index if not exists reminders_client_idx on public.reminders (client_id);
create index if not exists reminders_project_idx on public.reminders (project_id);
create index if not exists reminders_task_idx   on public.reminders (task_id);

-- ---------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients', 'projects', 'requests', 'tasks', 'reminders'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', t, t);
    execute format('create trigger %I_set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Collegamenti consentiti solo verso righe dello stesso utente
-- (security definer: legge la riga collegata anche durante il controllo RLS)
-- ---------------------------------------------------------------------
create or replace function public.owns(tbl text, row_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare ok boolean;
begin
  if row_id is null then return true; end if;
  if tbl not in ('clients', 'projects', 'tasks') then return false; end if;
  execute format('select exists (select 1 from public.%I where id = $1 and owner_id = auth.uid())', tbl)
    into ok using row_id;
  return ok;
end;
$$;
revoke all on function public.owns(text, uuid) from public, anon;
grant execute on function public.owns(text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.clients   enable row level security;
alter table public.projects  enable row level security;
alter table public.requests  enable row level security;
alter table public.tasks     enable row level security;
alter table public.reminders enable row level security;

-- CLIENTI
drop policy if exists "clients_select" on public.clients;
drop policy if exists "clients_insert" on public.clients;
drop policy if exists "clients_update" on public.clients;
drop policy if exists "clients_delete" on public.clients;
create policy "clients_select" on public.clients for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "clients_insert" on public.clients for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "clients_update" on public.clients for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "clients_delete" on public.clients for delete to authenticated
  using (owner_id = (select auth.uid()));

-- PROGETTI
drop policy if exists "projects_select" on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;
create policy "projects_select" on public.projects for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "projects_insert" on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.owns('clients', client_id));
create policy "projects_update" on public.projects for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.owns('clients', client_id));
create policy "projects_delete" on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));

-- RICHIESTE
drop policy if exists "requests_select" on public.requests;
drop policy if exists "requests_insert" on public.requests;
drop policy if exists "requests_update" on public.requests;
drop policy if exists "requests_delete" on public.requests;
create policy "requests_select" on public.requests for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "requests_insert" on public.requests for insert to authenticated
  with check (owner_id = (select auth.uid())
              and public.owns('clients', client_id) and public.owns('projects', project_id));
create policy "requests_update" on public.requests for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and public.owns('clients', client_id) and public.owns('projects', project_id));
create policy "requests_delete" on public.requests for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ATTIVITÀ
drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_select" on public.tasks for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "tasks_insert" on public.tasks for insert to authenticated
  with check (owner_id = (select auth.uid())
              and public.owns('clients', client_id) and public.owns('projects', project_id));
create policy "tasks_update" on public.tasks for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and public.owns('clients', client_id) and public.owns('projects', project_id));
create policy "tasks_delete" on public.tasks for delete to authenticated
  using (owner_id = (select auth.uid()));

-- PROMEMORIA
drop policy if exists "reminders_select" on public.reminders;
drop policy if exists "reminders_insert" on public.reminders;
drop policy if exists "reminders_update" on public.reminders;
drop policy if exists "reminders_delete" on public.reminders;
create policy "reminders_select" on public.reminders for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "reminders_insert" on public.reminders for insert to authenticated
  with check (owner_id = (select auth.uid())
              and public.owns('clients', client_id) and public.owns('projects', project_id)
              and public.owns('tasks', task_id));
create policy "reminders_update" on public.reminders for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and public.owns('clients', client_id) and public.owns('projects', project_id)
              and public.owns('tasks', task_id));
create policy "reminders_delete" on public.reminders for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Permessi: solo utenti con login. "anon" non può fare nulla.
-- ---------------------------------------------------------------------
revoke all on public.clients, public.projects, public.requests, public.tasks, public.reminders from anon;
grant select, insert, update, delete
  on public.clients, public.projects, public.requests, public.tasks, public.reminders
  to authenticated;

-- Fine. Per verificare: Table Editor → le 5 tabelle hanno il lucchetto "RLS enabled".
