begin;

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
select is((with changed as (
  update public.wheelforge_workspaces set payload = '{"version":1}'
  where user_id = '10000000-0000-4000-8000-000000000001' returning 1
) select count(*)::integer from changed), 0, 'second user cannot update the first user row');
select is((with removed as (
  delete from public.wheelforge_workspaces where user_id = '10000000-0000-4000-8000-000000000001' returning 1
) select count(*)::integer from removed), 0, 'second user cannot delete the first user row');
select is((with changed as (
  update public.wheelforge_workspaces set payload = '{"version":1,"marker":"authorized"}'
  where user_id = '10000000-0000-4000-8000-000000000002' returning 1
) select count(*)::integer from changed), 1, 'owner can update their own workspace');
select is((with removed as (
  delete from public.wheelforge_workspaces where user_id = '10000000-0000-4000-8000-000000000002' returning 1
) select count(*)::integer from removed), 1, 'owner can delete their own workspace');

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
