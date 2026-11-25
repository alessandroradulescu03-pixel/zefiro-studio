-- =====================================================================
--  ZEFIRO Studio Manager — Note (progetto Supabase "zefiro-gestionale")
--
--  DA APPROVARE PRIMA DI ESEGUIRE.
--  Supabase → SQL Editor → New query → incolla tutto → Run.
--  Richiede che crm-schema.sql sia già stato eseguito (usa clients,
--  projects e le funzioni set_updated_at e owns).
--  Ripetibile: non cancella tabelle né dati.
-- =====================================================================

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete cascade,     -- se elimini il cliente, spariscono le sue note
  project_id  uuid references public.projects(id) on delete cascade,    -- idem per il progetto
  title       text not null default '' check (length(title) <= 200),
  body        text not null default '' check (length(body) <= 20000),
  pinned      boolean not null default false,                           -- "in evidenza": sempre in cima
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (length(btrim(title)) > 0 or length(btrim(body)) > 0)           -- niente note vuote
);
create index if not exists notes_owner_idx   on public.notes (owner_id, pinned desc, updated_at desc);
create index if not exists notes_client_idx  on public.notes (client_id);
create index if not exists notes_project_idx on public.notes (project_id);

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

alter table public.notes enable row level security;

drop policy if exists "notes_select" on public.notes;
drop policy if exists "notes_insert" on public.notes;
drop policy if exists "notes_update" on public.notes;
drop policy if exists "notes_delete" on public.notes;
create policy "notes_select" on public.notes for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "notes_insert" on public.notes for insert to authenticated
  with check (owner_id = (select auth.uid())
              and public.owns('clients', client_id) and public.owns('projects', project_id));
create policy "notes_update" on public.notes for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid())
              and public.owns('clients', client_id) and public.owns('projects', project_id));
create policy "notes_delete" on public.notes for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke all on public.notes from anon;
grant select, insert, update, delete on public.notes to authenticated;

-- Fine. Verifica: Table Editor → "notes" con il lucchetto "RLS enabled".
