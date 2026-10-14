-- Access-rule tests for the accounts and sharing migration.
-- Run with supabase/tests/run.sh.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"full_name": "Alice A"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', '{}');

set role authenticated;

-- Alice (owner) uploads a project, a memory, a page and a photo.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.expect_value($$select display_name from profiles where id = auth.uid()$$, 'Alice A', 'profile is created from the sign-in name');
select tests.expect_rows($$insert into projects (id, data) values ('p1', '{"id":"p1","name":"Book"}')$$, 1, 'owner uploads a project');
select tests.expect_value($$select role from project_members where project_id = 'p1' and user_id = auth.uid()$$, 'owner', 'uploader becomes the owner member');
select tests.expect_rows($$insert into memories (project_id, id, data) values ('p1', 'm1', '{"id":"m1"}')$$, 1, 'owner adds a memory');
select tests.expect_value($$select controller_id::text from memories where id = 'm1'$$, null, 'owner memory has no separate controller');
select tests.expect_rows($$insert into page_sections (project_id, id, memory_id, data) values ('p1', 's1', 'm1', '{"id":"s1"}')$$, 1, 'owner adds a page');
select tests.expect_rows($$insert into photos (project_id, id, memory_id, data) values ('p1', 'ph1', 'm1', '{"id":"ph1"}')$$, 1, 'owner adds a photo');
select tests.expect_error($$insert into projects (id, owner_id, data) values ('p2', '00000000-0000-0000-0000-00000000000b', '{}')$$, 'cannot upload a project as someone else');

-- Invites.
create temporary table codes (role text, code text);
grant all on codes to authenticated;
insert into codes select 'contributor', create_invite('p1', 'contributor');
insert into codes select 'viewer', create_invite('p1', 'viewer', 7, 1);
select tests.expect_value($$select count(*)::text from invites where project_id = 'p1'$$, '2', 'owner sees its invites');
select tests.expect_value($$select count(*)::text from invites where code_hash in (select code from codes)$$, '0', 'codes are stored hashed');

-- Dave is not a member: sees nothing, changes nothing.
select tests.act_as('00000000-0000-0000-0000-00000000000d');
select tests.expect_value($$select count(*)::text from projects$$, '0', 'outsider sees no projects');
select tests.expect_value($$select count(*)::text from photos$$, '0', 'outsider sees no photos');
select tests.expect_rows($$update projects set data = '{}' where id = 'p1'$$, 0, 'outsider cannot edit a project');
select tests.expect_error($$insert into photos (project_id, id, data) values ('p1', 'x', '{}')$$, 'outsider cannot add photos');
select tests.expect_error($$select create_invite('p1', 'viewer')$$, 'outsider cannot create invites');
select tests.expect_error($$select accept_invite('WRONGCODE')$$, 'a wrong code is refused');

-- Bob joins as contributor, Carol as viewer.
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.expect_value($$select accept_invite((select lower(code) from codes where role = 'contributor'))$$, 'p1', 'contributor joins with the code (any case)');
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select tests.expect_value($$select accept_invite((select code from codes where role = 'viewer'))$$, 'p1', 'viewer joins with the code');
select tests.act_as('00000000-0000-0000-0000-00000000000d');
select tests.expect_error($$select accept_invite((select code from codes where role = 'viewer'))$$, 'a used-up code is refused');

-- Bob (contributor).
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.expect_value($$select count(*)::text from photos$$, '1', 'contributor sees the photos');
select tests.expect_value($$select count(*)::text from profiles$$, '3', 'contributor sees the other members'' profiles');
select tests.expect_value($$select count(*)::text from invites$$, '0', 'contributor cannot see invites');
select tests.expect_rows($$insert into photos (project_id, id, memory_id, data) values ('p1', 'ph2', 'm1', '{"id":"ph2"}')$$, 1, 'contributor adds a photo to an existing memory');
select tests.expect_error($$insert into photos (project_id, id, memory_id, added_by, data) values ('p1', 'ph3', 'm1', '00000000-0000-0000-0000-00000000000a', '{}')$$, 'contributor cannot add a photo as someone else');
select tests.expect_rows($$update photos set data = '{"id":"ph2","x":1}' where id = 'ph2'$$, 1, 'contributor edits its own photo');
select tests.expect_rows($$update photos set deleted_at = now() where id = 'ph1'$$, 0, 'contributor cannot remove the owner''s photo');
select tests.expect_rows($$update projects set data = '{}' where id = 'p1'$$, 0, 'contributor cannot edit the project');
select tests.expect_rows($$update memories set data = '{"id":"m1","title":"x"}' where id = 'm1'$$, 0, 'contributor cannot edit a memory it does not control');
select tests.expect_rows($$update page_sections set data = '{}' where id = 's1'$$, 0, 'contributor cannot edit pages of a memory it does not control');
select tests.expect_error($$insert into page_sections (project_id, id, memory_id, data) values ('p1', 's9', 'm1', '{}')$$, 'contributor cannot add pages to a memory it does not control');
select tests.expect_rows($$insert into memories (project_id, id, data) values ('p1', 'm2', '{"id":"m2"}')$$, 1, 'contributor creates a memory');
select tests.expect_value($$select controller_id::text from memories where id = 'm2'$$, '00000000-0000-0000-0000-00000000000b', 'contributor controls the memory it created');
select tests.expect_rows($$insert into page_sections (project_id, id, memory_id, data) values ('p1', 's2', 'm2', '{"id":"s2"}')$$, 1, 'contributor adds pages to its own memory');
select tests.expect_error($$update page_sections set memory_id = 'm1' where id = 's2'$$, 'contributor cannot move its page into a memory it does not control');
select tests.expect_error($$update memories set controller_id = null where id = 'm2'$$, 'control cannot change by a plain update');
select tests.expect_rows($$insert into control_requests (project_id, memory_id) values ('p1', 'm1')$$, 1, 'contributor asks for control');
select tests.expect_error($$select transfer_memory_control('p1', 'm1', auth.uid())$$, 'contributor cannot take control itself');
select tests.expect_rows($$update project_members set role = 'owner' where user_id = auth.uid()$$, 0, 'contributor cannot promote itself');
select tests.expect_rows($$delete from project_members where user_id = '00000000-0000-0000-0000-00000000000c'$$, 0, 'contributor cannot remove others');

-- Carol (viewer).
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select tests.expect_value($$select count(*)::text from page_sections$$, '2', 'viewer sees the pages');
select tests.expect_error($$insert into photos (project_id, id, data) values ('p1', 'ph9', '{}')$$, 'viewer cannot add photos');
select tests.expect_error($$insert into memories (project_id, id, data) values ('p1', 'm9', '{}')$$, 'viewer cannot create memories');
select tests.expect_error($$insert into storage.objects (bucket_id, name) values ('photos', 'p1/ph9.jpg')$$, 'viewer cannot upload photo files');
select tests.expect_error($$insert into control_requests (project_id, memory_id) values ('p1', 'm1')$$, 'viewer cannot ask for control');

-- Alice hands m1 to Bob; Bob edits it and hands it back.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.expect_value($$select count(*)::text from control_requests where status = 'pending'$$, '1', 'owner sees the control request');
select transfer_memory_control('p1', 'm1', '00000000-0000-0000-0000-00000000000b');
select tests.expect_value($$select status from control_requests where memory_id = 'm1'$$, 'granted', 'the request is marked granted');
select tests.expect_error($$select transfer_memory_control('p1', 'm1', '00000000-0000-0000-0000-00000000000c')$$, 'control cannot go to a viewer');
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.expect_rows($$update page_sections set data = '{"id":"s1","edited":true}' where id = 's1'$$, 1, 'controller edits the memory''s pages');
select tests.expect_rows($$update photos set deleted_at = now() where id = 'ph1'$$, 1, 'controller can remove photos in its memory');
-- The app writes with upserts (insert ... on conflict do update).
select tests.expect_rows($$insert into memories (project_id, id, data) values ('p1', 'm1', '{"id":"m1","title":"by bob"}') on conflict (project_id, id) do update set data = excluded.data$$, 1, 'controller upserts the memory it controls');
select tests.expect_value($$select coalesce(controller_id::text, 'owner') || '/' || created_by::text from memories where id = 'm1'$$, '00000000-0000-0000-0000-00000000000b/00000000-0000-0000-0000-00000000000a', 'upsert keeps creator and controller');
select transfer_memory_control('p1', 'm1', null);
select tests.expect_rows($$update page_sections set data = '{}' where id = 's1'$$, 0, 'after handing back, no more edits');
select tests.expect_rows($$update memories set deleted_at = now() where id = 'm2'$$, 1, 'creator can delete its own memory');

-- Owner manages people.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.expect_rows($$insert into photos (project_id, id, memory_id, data) values ('p1', 'ph2', 'm1', '{"id":"ph2","placed":true}') on conflict (project_id, id) do update set data = excluded.data$$, 1, 'owner upserts a contributor''s photo');
select tests.expect_value($$select added_by::text from photos where id = 'ph2'$$, '00000000-0000-0000-0000-00000000000b', 'upsert keeps who added the photo');
select tests.expect_rows($$update project_members set role = 'contributor' where user_id = '00000000-0000-0000-0000-00000000000c'$$, 1, 'owner changes a role');
select tests.expect_error($$update project_members set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000c'$$, 'owner role cannot be handed out by update');
select tests.expect_rows($$update project_members set role = 'viewer' where user_id = auth.uid()$$, 0, 'owner cannot demote itself');
select tests.expect_rows($$delete from project_members where user_id = auth.uid()$$, 0, 'owner cannot leave its own project');
select transfer_memory_control('p1', 'm1', '00000000-0000-0000-0000-00000000000b');
select tests.expect_rows($$delete from project_members where user_id = '00000000-0000-0000-0000-00000000000b'$$, 1, 'owner removes a member');
select tests.expect_value($$select coalesce(controller_id::text, 'owner') from memories where id = 'm1'$$, 'owner', 'removed member loses control');
select tests.expect_rows($$update invites set revoked_at = now()$$, 2, 'owner revokes invites');

-- Removed Bob sees nothing now.
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.expect_value($$select count(*)::text from projects$$, '0', 'removed member sees no projects');
select tests.expect_error($$select accept_invite((select code from codes where role = 'contributor'))$$, 'a revoked code is refused');

-- Storage: folder per project.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.expect_rows($$insert into storage.objects (bucket_id, name) values ('photos', 'p1/ph1.jpg')$$, 1, 'owner uploads a photo file');
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select tests.expect_value($$select count(*)::text from storage.objects$$, '1', 'members can read the project''s photo files');
select tests.act_as('00000000-0000-0000-0000-00000000000d');
select tests.expect_value($$select count(*)::text from storage.objects$$, '0', 'outsiders cannot read photo files');
select tests.expect_error($$insert into storage.objects (bucket_id, name) values ('photos', 'p1/evil.jpg')$$, 'outsiders cannot upload photo files');

-- Server time decides updated_at.
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.expect_value($$with u as (update projects set data = '{"id":"p1"}', updated_at = '2000-01-01' where id = 'p1' returning updated_at) select (updated_at > '2020-01-01')::text from u$$, 'true', 'clients cannot set updated_at');

-- Account deletion.
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select delete_my_account();
reset role;
select tests.expect_value($$select count(*)::text from auth.users where id = '00000000-0000-0000-0000-00000000000c'$$, '0', 'deleting an account removes the user');
set role authenticated;
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select delete_my_account();
reset role;
select tests.expect_value($$select count(*)::text from projects$$, '0', 'deleting the owner removes its projects');

\echo 'All access-rule tests passed.'
