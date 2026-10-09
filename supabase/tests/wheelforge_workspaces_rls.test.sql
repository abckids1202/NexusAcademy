begin;

create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'wheel-a@example.test', '', now(), now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'wheel-b@example.test', '', now(), now(), now())
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into public.wheelforge_workspaces (user_id, payload)
values ('10000000-0000-4000-8000-000000000001', '{"version":1,"wheels":[],"chains":[],"spinResults":[],"chainSessions":[],"settings":{}}');
select is((select count(*)::integer from public.wheelforge_workspaces), 1, 'owner can read their own workspace');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
insert into public.wheelforge_workspaces (user_id, payload)
values ('10000000-0000-4000-8000-000000000002', '{"version":1,"wheels":[],"chains":[],"spinResults":[],"chainSessions":[],"settings":{}}');
select is((select count(*)::integer from public.wheelforge_workspaces), 1, 'second user sees only their own row');
select throws_ok(
  $$insert into public.wheelforge_workspaces (user_id, payload) values ('10000000-0000-4000-8000-000000000003', '{"version":1}')$$,
  '42501',
  null,
  'second user cannot insert a workspace for another user'
);
select lives_ok(
  $$
  do $body$
  declare affected integer;
  begin
    update public.wheelforge_workspaces set payload = '{"version":1}'
    where user_id = '10000000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'cross-account update affected % rows', affected; end if;
  end;
  $body$;
  $$,
  'second user cannot update the first user row'
);
select lives_ok(
  $$
  do $body$
  declare affected integer;
  begin
    delete from public.wheelforge_workspaces where user_id = '10000000-0000-4000-8000-000000000001';
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'cross-account delete affected % rows', affected; end if;
  end;
  $body$;
  $$,
  'second user cannot delete the first user row'
);
select lives_ok(
  $$
  do $body$
  declare affected integer;
  begin
    update public.wheelforge_workspaces set payload = '{"version":1,"marker":"authorized"}'
    where user_id = '10000000-0000-4000-8000-000000000002';
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'owner update affected % rows', affected; end if;
  end;
  $body$;
  $$,
  'owner can update their own workspace'
);
select lives_ok(
  $$
  do $body$
  declare affected integer;
  begin
    delete from public.wheelforge_workspaces where user_id = '10000000-0000-4000-8000-000000000002';
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'owner delete affected % rows', affected; end if;
  end;
  $body$;
  $$,
  'owner can delete their own workspace'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select count(*) from public.wheelforge_workspaces$$,
  '42501',
  null,
  'anonymous users cannot read backups'
);
select throws_ok(
  $$insert into public.wheelforge_workspaces (user_id, payload) values ('10000000-0000-4000-8000-000000000001', '{"version":1}')$$,
  '42501',
  null,
  'anonymous users cannot write backups'
);

select * from finish();
rollback;
