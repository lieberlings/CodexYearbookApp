-- Accounts, cloud backup and sharing for the yearbook app.
--
-- Records are stored the way the app keeps them: one row per record with the
-- record itself as JSON in `data`. The few columns the access rules need
-- (project, memory, who added or controls it) are lifted out next to it.
--
-- Roles per project:
--   owner        everything
--   contributor  views everything, adds photos, creates memories, and edits
--                the memories it controls
--   viewer       views everything
--
-- Every row gets a server-set updated_at (devices pull by it) and a soft
-- deleted_at, so a deletion syncs like any other change.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id text primary key check (length(id) between 1 and 128),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.project_members (
  project_id text not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'contributor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_id on public.project_members (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  role text not null check (role in ('contributor', 'viewer')),
  code_hash text not null unique,
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  max_uses integer not null default 20 check (max_uses > 0),
  use_count integer not null default 0,
  revoked_at timestamptz
);
create index invites_project_id on public.invites (project_id);

create table public.memories (
  project_id text not null references public.projects (id) on delete cascade,
  id text not null check (length(id) between 1 and 128),
  data jsonb not null,
  -- Plain ids, not foreign keys: removing a member or an account releases
  -- control through triggers instead of rewriting these rows.
  created_by uuid not null default auth.uid(),
  -- Who may edit this memory's pages. Null means the project owner.
  controller_id uuid,
  -- Shared so contributors' suggestions can match their own photos to it.
  -- The area is rounded to about 1 km; exact photo locations never upload.
  date_from timestamptz,
  date_to timestamptz,
  area_lat numeric(6, 2),
  area_lng numeric(6, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (project_id, id)
);

create table public.page_sections (
  project_id text not null references public.projects (id) on delete cascade,
  id text not null check (length(id) between 1 and 128),
  memory_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (project_id, id)
);

create table public.photos (
  project_id text not null references public.projects (id) on delete cascade,
  id text not null check (length(id) between 1 and 128),
  memory_id text,
  added_by uuid not null default auth.uid(),
  -- Path of the print-quality copy in the "photos" bucket, once uploaded.
  storage_path text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (project_id, id)
);

create table public.control_requests (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  memory_id text not null,
  requested_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'granted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, memory_id) references public.memories (project_id, id) on delete cascade
);
create unique index control_requests_one_pending
  on public.control_requests (project_id, memory_id, requested_by) where status = 'pending';

-- Pulls ask for "changed since"; these keep that cheap per project.
create index projects_updated_at on public.projects (updated_at);
create index memories_project_updated on public.memories (project_id, updated_at);
create index page_sections_project_updated on public.page_sections (project_id, updated_at);
create index photos_project_updated on public.photos (project_id, updated_at);
create index project_members_project_updated on public.project_members (project_id, updated_at);
create index control_requests_project_updated on public.control_requests (project_id, updated_at);

-- ---------------------------------------------------------------------------
-- Access helpers. Security definer so policies can read membership without
-- recursing into project_members' own policies.
-- ---------------------------------------------------------------------------

create function public.project_role(p_project_id text)
returns text
language sql stable security definer set search_path = ''
as $$
  select m.role from public.project_members m
  where m.project_id = p_project_id and m.user_id = auth.uid()
$$;

create function public.is_project_member(p_project_id text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = auth.uid()
  )
$$;

-- Owner always; a contributor only while it controls the memory.
create function public.can_edit_memory(p_project_id text, p_memory_id text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case public.project_role(p_project_id)
    when 'owner' then true
    when 'contributor' then exists (
      select 1 from public.memories mem
      where mem.project_id = p_project_id and mem.id = p_memory_id and mem.controller_id = auth.uid()
    )
    else false
  end
$$;

create function public.shares_project_with(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.project_members mine
    join public.project_members theirs on theirs.project_id = mine.project_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  )
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- The server clock decides updated_at, so devices can pull by it.
create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger projects_touch before insert or update on public.projects
  for each row execute function public.touch_updated_at();
create trigger project_members_touch before insert or update on public.project_members
  for each row execute function public.touch_updated_at();
create trigger memories_touch before insert or update on public.memories
  for each row execute function public.touch_updated_at();
create trigger page_sections_touch before insert or update on public.page_sections
  for each row execute function public.touch_updated_at();
create trigger photos_touch before insert or update on public.photos
  for each row execute function public.touch_updated_at();
create trigger control_requests_touch before insert or update on public.control_requests
  for each row execute function public.touch_updated_at();

-- A profile for every account, named from the sign-in provider or the email.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Whoever uploads a project becomes its owner member.
create function public.add_project_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (project_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger projects_add_owner after insert on public.projects
  for each row execute function public.add_project_owner();

-- Columns that tie a row to a person or a project never change after insert.
create function public.guard_projects()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id then
    raise exception 'A project''s id and owner cannot change.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger projects_guard before update on public.projects
  for each row execute function public.guard_projects();

create function public.guard_memories()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_role text := public.project_role(old.project_id);
begin
  if new.project_id is distinct from old.project_id or new.id is distinct from old.id
     or new.created_by is distinct from old.created_by then
    raise exception 'A memory''s project, id and creator cannot change.' using errcode = '42501';
  end if;
  if new.controller_id is distinct from old.controller_id
     and coalesce(current_setting('yearbook.control_change', true), '') <> 'on' then
    raise exception 'Use transfer_memory_control to change who controls a memory.' using errcode = '42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at and v_role is distinct from 'owner'
     and old.created_by is distinct from auth.uid() then
    raise exception 'Only the owner or the memory''s creator can delete it.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger memories_guard before update on public.memories
  for each row execute function public.guard_memories();

create function public.guard_memory_insert()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  -- A contributor's new memory is under its own control; the owner's is the owner's.
  if public.project_role(new.project_id) = 'contributor' then
    new.controller_id := auth.uid();
  else
    new.controller_id := null;
  end if;
  return new;
end;
$$;
create trigger memories_guard_insert before insert on public.memories
  for each row execute function public.guard_memory_insert();

create function public.guard_page_sections()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id or new.id is distinct from old.id then
    raise exception 'A page''s project and id cannot change.' using errcode = '42501';
  end if;
  -- Moving a page to another memory needs edit rights on both.
  if new.memory_id is distinct from old.memory_id
     and not public.can_edit_memory(new.project_id, new.memory_id) then
    raise exception 'No edit rights on the target memory.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger page_sections_guard before update on public.page_sections
  for each row execute function public.guard_page_sections();

create function public.guard_photos()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id or new.id is distinct from old.id
     or new.added_by is distinct from old.added_by then
    raise exception 'A photo''s project, id and uploader cannot change.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger photos_guard before update on public.photos
  for each row execute function public.guard_photos();

create function public.guard_project_members()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id or new.user_id is distinct from old.user_id then
    raise exception 'Membership keys cannot change.' using errcode = '42501';
  end if;
  if (old.role = 'owner') <> (new.role = 'owner') then
    raise exception 'The owner role cannot be given or taken here.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger project_members_guard before update on public.project_members
  for each row execute function public.guard_project_members();

-- A member who leaves or is removed gives up control of their memories.
create function public.release_memory_control()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('yearbook.control_change', 'on', true);
  update public.memories set controller_id = null
  where project_id = old.project_id and controller_id = old.user_id;
  perform set_config('yearbook.control_change', '', true);
  return old;
end;
$$;
create trigger project_members_release_control after delete on public.project_members
  for each row execute function public.release_memory_control();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.invites enable row level security;
alter table public.memories enable row level security;
alter table public.page_sections enable row level security;
alter table public.photos enable row level security;
alter table public.control_requests enable row level security;

-- profiles: see yourself and the people you share a project with.
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_project_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- projects
create policy projects_select on public.projects for select to authenticated
  using (public.is_project_member(id));
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy projects_update on public.projects for update to authenticated
  using (public.project_role(id) = 'owner') with check (public.project_role(id) = 'owner');
create policy projects_delete on public.projects for delete to authenticated
  using (owner_id = auth.uid());

-- project_members: members see each other; the owner changes roles and
-- removes people; anyone but the owner can leave. Joining goes through
-- accept_invite().
create policy project_members_select on public.project_members for select to authenticated
  using (public.is_project_member(project_id));
create policy project_members_update on public.project_members for update to authenticated
  using (public.project_role(project_id) = 'owner' and user_id <> auth.uid())
  with check (public.project_role(project_id) = 'owner' and role in ('contributor', 'viewer'));
create policy project_members_delete on public.project_members for delete to authenticated
  using (
    role <> 'owner'
    and (user_id = auth.uid() or public.project_role(project_id) = 'owner')
  );

-- invites: owner only. Codes are stored hashed; create_invite() returns the
-- plain code once.
create policy invites_select on public.invites for select to authenticated
  using (public.project_role(project_id) = 'owner');
create policy invites_update on public.invites for update to authenticated
  using (public.project_role(project_id) = 'owner')
  with check (public.project_role(project_id) = 'owner');
create policy invites_delete on public.invites for delete to authenticated
  using (public.project_role(project_id) = 'owner');

-- memories
create policy memories_select on public.memories for select to authenticated
  using (public.is_project_member(project_id));
create policy memories_insert on public.memories for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.project_role(project_id) in ('owner', 'contributor')
  );
create policy memories_update on public.memories for update to authenticated
  using (public.can_edit_memory(project_id, id))
  with check (public.can_edit_memory(project_id, id));

-- page_sections: whoever can edit the memory.
create policy page_sections_select on public.page_sections for select to authenticated
  using (public.is_project_member(project_id));
create policy page_sections_insert on public.page_sections for insert to authenticated
  with check (public.can_edit_memory(project_id, memory_id));
create policy page_sections_update on public.page_sections for update to authenticated
  using (public.can_edit_memory(project_id, memory_id))
  with check (public.is_project_member(project_id));

-- photos: contributors add their own; the uploader, the owner and whoever
-- controls the memory can change or remove them.
create policy photos_select on public.photos for select to authenticated
  using (public.is_project_member(project_id));
create policy photos_insert on public.photos for insert to authenticated
  with check (
    added_by = auth.uid()
    and public.project_role(project_id) in ('owner', 'contributor')
  );
create policy photos_update on public.photos for update to authenticated
  using (
    public.project_role(project_id) = 'owner'
    or (public.project_role(project_id) = 'contributor'
        and (added_by = auth.uid() or public.can_edit_memory(project_id, memory_id)))
  )
  with check (
    public.project_role(project_id) = 'owner'
    or (public.project_role(project_id) = 'contributor'
        and (added_by = auth.uid()
             or memory_id is null
             or public.can_edit_memory(project_id, memory_id)))
  );

-- control_requests: contributors ask; the requester, the owner and the
-- current controller see them. Answering goes through transfer_memory_control()
-- or a status update by the controller or owner.
create policy control_requests_select on public.control_requests for select to authenticated
  using (
    requested_by = auth.uid()
    or public.project_role(project_id) = 'owner'
    or public.can_edit_memory(project_id, memory_id)
  );
create policy control_requests_insert on public.control_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and public.project_role(project_id) = 'contributor'
  );
create policy control_requests_update on public.control_requests for update to authenticated
  using (
    requested_by = auth.uid()
    or public.project_role(project_id) = 'owner'
    or public.can_edit_memory(project_id, memory_id)
  )
  with check (
    (requested_by = auth.uid() and status in ('pending', 'cancelled'))
    or public.project_role(project_id) = 'owner'
    or public.can_edit_memory(project_id, memory_id)
  );

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- Returns an 8-character invite code (shown once) for a project you own.
create function public.create_invite(
  p_project_id text,
  p_role text,
  p_expires_in_days integer default 7,
  p_max_uses integer default 20
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_code text := '';
  i integer;
begin
  if auth.uid() is null or public.project_role(p_project_id) is distinct from 'owner' then
    raise exception 'Only the project owner can invite people.' using errcode = '42501';
  end if;
  if p_role not in ('contributor', 'viewer') then
    raise exception 'Unknown role %.', p_role using errcode = '22023';
  end if;
  if p_expires_in_days not between 1 and 90 or p_max_uses not between 1 and 500 then
    raise exception 'Invite limits are out of range.' using errcode = '22023';
  end if;
  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  insert into public.invites (project_id, role, code_hash, created_by, expires_at, max_uses)
  values (
    p_project_id, p_role,
    encode(extensions.digest(v_code, 'sha256'), 'hex'),
    auth.uid(), now() + make_interval(days => p_expires_in_days), p_max_uses
  );
  return v_code;
end;
$$;

-- Joins the project an invite code belongs to and returns its id. Someone
-- already in the project keeps their current role.
create function public.accept_invite(p_code text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.invites%rowtype;
  v_inserted integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join a project.' using errcode = '42501';
  end if;
  select * into v_invite from public.invites
  where code_hash = encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
  for update;
  if not found or v_invite.revoked_at is not null or v_invite.expires_at < now()
     or v_invite.use_count >= v_invite.max_uses then
    raise exception 'This invite code is not valid any more.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.projects p where p.id = v_invite.project_id and p.deleted_at is not null) then
    raise exception 'This project was deleted.' using errcode = 'P0002';
  end if;
  insert into public.project_members (project_id, user_id, role)
  values (v_invite.project_id, auth.uid(), v_invite.role)
  on conflict (project_id, user_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.invites set use_count = use_count + 1 where id = v_invite.id;
  end if;
  return v_invite.project_id;
end;
$$;

-- Hands a memory to another owner or contributor (or takes it, for the
-- owner). Allowed for the owner and the memory's current controller.
-- Pass null to give control back to the owner.
create function public.transfer_memory_control(p_project_id text, p_memory_id text, p_to uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_controller uuid;
  v_target_role text;
begin
  select controller_id into v_controller from public.memories
  where project_id = p_project_id and id = p_memory_id and deleted_at is null
  for update;
  if not found then
    raise exception 'Memory not found.' using errcode = 'P0002';
  end if;
  if public.project_role(p_project_id) is distinct from 'owner' and v_controller is distinct from auth.uid() then
    raise exception 'Only the owner or whoever controls this memory can hand it over.' using errcode = '42501';
  end if;
  if p_to is not null then
    select role into v_target_role from public.project_members
    where project_id = p_project_id and user_id = p_to;
    if v_target_role is null or v_target_role = 'viewer' then
      raise exception 'Control can only go to the owner or a contributor.' using errcode = '22023';
    end if;
    if v_target_role = 'owner' then
      p_to := null;
    end if;
  end if;
  perform set_config('yearbook.control_change', 'on', true);
  update public.memories set controller_id = p_to
  where project_id = p_project_id and id = p_memory_id;
  perform set_config('yearbook.control_change', '', true);
  update public.control_requests
  set status = case when requested_by is not distinct from p_to then 'granted' else status end
  where project_id = p_project_id and memory_id = p_memory_id and status = 'pending'
    and requested_by is not distinct from p_to;
end;
$$;

-- Deletes the signed-in account, its projects and its memberships. The app
-- removes the account's files from storage first.
create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  -- Photos this account added to other people's projects are blanked and
  -- marked deleted, so every member's device drops them on its next sync.
  update public.photos
  set deleted_at = now(), storage_path = null, data = jsonb_build_object('id', id)
  where added_by = v_user and deleted_at is null;
  delete from public.projects where owner_id = v_user;
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.create_invite(text, text, integer, integer) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
revoke all on function public.transfer_memory_control(text, text, uuid) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.create_invite(text, text, integer, integer) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.transfer_memory_control(text, text, uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

grant select, insert, update, delete on
  public.profiles, public.projects, public.project_members, public.invites,
  public.memories, public.page_sections, public.photos, public.control_requests
  to authenticated;

-- ---------------------------------------------------------------------------
-- Photo storage: private bucket, one folder per project:
--   photos/<project id>/<photo id>.jpg
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 20971520, array['image/jpeg'])
on conflict (id) do nothing;

create policy photos_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_project_member((storage.foldername(name))[1]));
create policy photos_bucket_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and public.project_role((storage.foldername(name))[1]) in ('owner', 'contributor')
  );
create policy photos_bucket_update on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and (owner_id = auth.uid()::text or public.project_role((storage.foldername(name))[1]) = 'owner')
  );
create policy photos_bucket_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (owner_id = auth.uid()::text or public.project_role((storage.foldername(name))[1]) = 'owner')
  );
