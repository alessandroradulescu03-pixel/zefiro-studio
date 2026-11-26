-- ============================================================
-- ZEFIRO Studio Manager — impostazioni sincronizzate
-- Profilo, dati dello studio e preferenze uguali su computer e telefono.
-- Una riga per utente. Si può eseguire più volte senza problemi.
-- ============================================================

create table if not exists public.user_settings (
  owner_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  profile     jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object' and length(profile::text) <= 10000),
  studio      jsonb not null default '{}'::jsonb check (jsonb_typeof(studio) = 'object' and length(studio::text) <= 10000),
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object' and length(preferences::text) <= 5000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists user_settings_updated_at on public.user_settings;
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists user_settings_select on public.user_settings;
drop policy if exists user_settings_insert on public.user_settings;
drop policy if exists user_settings_update on public.user_settings;
drop policy if exists user_settings_delete on public.user_settings;

create policy user_settings_select on public.user_settings for select to authenticated
  using (owner_id = auth.uid());
create policy user_settings_insert on public.user_settings for insert to authenticated
  with check (owner_id = auth.uid());
create policy user_settings_update on public.user_settings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy user_settings_delete on public.user_settings for delete to authenticated
  using (owner_id = auth.uid());

revoke all on public.user_settings from anon;
grant select, insert, update, delete on public.user_settings to authenticated;

notify pgrst, 'reload schema';
