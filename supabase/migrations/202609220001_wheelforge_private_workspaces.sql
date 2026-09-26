create table if not exists public.wheelforge_workspaces (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint wheelforge_payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint wheelforge_payload_has_v1_version check (payload ->> 'version' = '1')
);

alter table public.wheelforge_workspaces enable row level security;

revoke all on table public.wheelforge_workspaces from public, anon, authenticated;
grant select, insert, update, delete on table public.wheelforge_workspaces to authenticated;

create policy "Users can read their own WheelForge backup"
  on public.wheelforge_workspaces for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own WheelForge backup"
  on public.wheelforge_workspaces for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own WheelForge backup"
  on public.wheelforge_workspaces for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own WheelForge backup"
  on public.wheelforge_workspaces for delete
  to authenticated
  using ((select auth.uid()) = user_id);
