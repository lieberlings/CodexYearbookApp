-- Phase 1: accounts and cloud backup of your own projects.
--
-- Each synced record stores the app's own TypeScript record in `data` (jsonb).
-- The app's types change often, so the server only keeps the columns that are
-- needed for access rules and sync; everything else travels inside `data`.
--
-- Sharing (phase 2) adds the contributor role. Membership already exists here
-- so the access rules don't need to be rewritten later: in phase 1 every project
-- has exactly one member, its owner.
--
-- Suggestions are not synced: their candidate photos point at one device's
-- MediaLibrary and mean nothing on another device.

create extension if not exists "pgcrypto";

-- Profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects and membership ---------------------------------------------------

create type public.project_role as enum ('owner', 'contributor');

create table public.projects (
  id text primary key,                       -- the app's local project id
  owner_id uuid not null references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                     -- tombstone, so deletes sync too
);

create table public.project_members (
  project_id text not null references public.projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.project_role not null,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_project_created
  after insert on public.projects
  for each row execute function public.add_owner_membership();

-- Helpers used by the access rules. `security definer` avoids recursive policy
-- checks on project_members.
create function public.project_role_of(p_project_id text)
returns public.project_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.project_members
  where project_id = p_project_id and user_id = auth.uid();
$$;

create function public.is_project_member(p_project_id text)
returns boolean
language sql
stable
as $$ select public.project_role_of(p_project_id) is not null $$;

create function public.is_project_owner(p_project_id text)
returns boolean
language sql
stable
as $$ select public.project_role_of(p_project_id) = 'owner' $$;

-- Project content -----------------------------------------------------------

create table public.memories (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.page_sections (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  memory_id text not null references public.memories (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.photos (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  memory_id text references public.memories (id) on delete set null,
  added_by uuid not null references auth.users (id),
  storage_path text,                         -- set once the file is uploaded
  data jsonb not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index memories_project_updated on public.memories (project_id, updated_at);
create index page_sections_project_updated on public.page_sections (project_id, updated_at);
create index photos_project_updated on public.photos (project_id, updated_at);
create index projects_owner_updated on public.projects (owner_id, updated_at);

-- Every write bumps updated_at, which the app uses to pull only what changed.
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_projects before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger touch_memories before update on public.memories
  for each row execute function public.touch_updated_at();
create trigger touch_page_sections before update on public.page_sections
  for each row execute function public.touch_updated_at();
create trigger touch_photos before update on public.photos
  for each row execute function public.touch_updated_at();

-- Access rules --------------------------------------------------------------
-- Phase 1: members can read, only the owner can write. Phase 2 adds a policy
-- that lets contributors insert (and remove their own) photos.

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.memories enable row level security;
alter table public.page_sections enable row level security;
alter table public.photos enable row level security;

create policy "read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

create policy "members read projects" on public.projects
  for select using (public.is_project_member(id));
create policy "users create own projects" on public.projects
  for insert with check (owner_id = auth.uid());
create policy "owner updates project" on public.projects
  for update using (public.is_project_owner(id)) with check (owner_id = auth.uid());

create policy "members read membership" on public.project_members
  for select using (public.is_project_member(project_id));

create policy "members read memories" on public.memories
  for select using (public.is_project_member(project_id));
create policy "owner writes memories" on public.memories
  for all using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy "members read page sections" on public.page_sections
  for select using (public.is_project_member(project_id));
create policy "owner writes page sections" on public.page_sections
  for all using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

create policy "members read photos" on public.photos
  for select using (public.is_project_member(project_id));
create policy "owner adds photos" on public.photos
  for insert with check (public.is_project_owner(project_id) and added_by = auth.uid());
-- The owner may also update or delete photos someone else added (phase 2),
-- for example to move a contributor's photo to another memory.
create policy "owner updates photos" on public.photos
  for update using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));
create policy "owner deletes photos" on public.photos
  for delete using (public.is_project_owner(project_id));

-- Photo files ---------------------------------------------------------------
-- Private bucket. Files live at <project_id>/<photo_id>.<ext>, so the first
-- path segment decides who may read or write.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy "members read photo files" on storage.objects
  for select using (
    bucket_id = 'photos' and public.is_project_member((storage.foldername(name))[1])
  );
create policy "owner uploads photo files" on storage.objects
  for insert with check (
    bucket_id = 'photos' and public.is_project_owner((storage.foldername(name))[1])
  );
create policy "owner deletes photo files" on storage.objects
  for delete using (
    bucket_id = 'photos' and public.is_project_owner((storage.foldername(name))[1])
  );
