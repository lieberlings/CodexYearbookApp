-- Phase 2: sharing a project with contributors.
--
-- The owner keeps full control. A contributor can see the project and add
-- photos to its memories, and change or remove only the photos they added.
-- People join through an invite link (or its code) that the owner creates.

-- Invites -------------------------------------------------------------------
-- An invite is a reusable link for one project, valid until it expires or the
-- owner revokes it. Anyone signed in who has it joins as a contributor.

create table public.project_invites (
  token text primary key default encode(gen_random_bytes(12), 'hex'),
  project_id text not null references public.projects (id) on delete cascade,
  role public.project_role not null default 'contributor' check (role <> 'owner'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  revoked_at timestamptz
);

alter table public.project_invites enable row level security;

create policy "owner reads invites" on public.project_invites
  for select using (public.is_project_owner(project_id));
create policy "owner creates invites" on public.project_invites
  for insert with check (public.is_project_owner(project_id) and created_by = auth.uid());
create policy "owner revokes invites" on public.project_invites
  for update using (public.is_project_owner(project_id));

-- Joins the project an invite belongs to. Returns the project id. Joining a
-- project you're already in is fine and changes nothing.
create function public.accept_invite(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.project_invites;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join a shared project';
  end if;
  select * into invite from public.project_invites where token = lower(trim(p_token));
  if invite.token is null or invite.revoked_at is not null or invite.expires_at < now() then
    raise exception 'This invite is no longer valid. Ask for a new one.';
  end if;
  insert into public.project_members (project_id, user_id, role)
  values (invite.project_id, auth.uid(), invite.role)
  on conflict (project_id, user_id) do nothing;
  return invite.project_id;
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- Members -------------------------------------------------------------------

-- Names and roles of everyone in a project, for its members only.
create function public.project_member_list(p_project_id text)
returns table (user_id uuid, role public.project_role, display_name text, added_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id, m.role, p.display_name, m.added_at
  from public.project_members m
  left join public.profiles p on p.id = m.user_id
  where m.project_id = p_project_id and public.is_project_member(p_project_id)
  order by m.role, m.added_at;
$$;

revoke all on function public.project_member_list(text) from public, anon;
grant execute on function public.project_member_list(text) to authenticated;

-- The owner removes contributors; anyone can leave. The owner's own row stays
-- (a project always has its owner).
create policy "owner removes members, members leave" on public.project_members
  for delete using (
    role <> 'owner'
    and (public.is_project_owner(project_id) or user_id = auth.uid())
  );

-- People in a shared project can see each other's names.
create policy "co-members read profiles" on public.profiles
  for select using (
    exists (
      select 1
      from public.project_members mine
      join public.project_members theirs on theirs.project_id = mine.project_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

-- Contributor photos --------------------------------------------------------

-- A contributor adds photos to a memory of the project, as themselves.
create policy "contributors add photos" on public.photos
  for insert with check (
    public.project_role_of(project_id) = 'contributor'
    and added_by = auth.uid()
    and memory_id is not null
    and exists (select 1 from public.memories m where m.id = memory_id and m.project_id = photos.project_id)
  );

-- ...and can change or remove (tombstone) only the photos they added.
create policy "contributors update own photos" on public.photos
  for update using (public.project_role_of(project_id) = 'contributor' and added_by = auth.uid())
  with check (public.project_role_of(project_id) = 'contributor' and added_by = auth.uid());

-- Photo files ----------------------------------------------------------------
-- Phase 1 let only the owner write files. Members may now upload the file of a
-- photo they added; nobody can overwrite someone else's file.

drop policy "owner uploads photo files" on storage.objects;

create function public.can_write_photo_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.photos ph
    where ph.project_id = (storage.foldername(object_name))[1]
      and ph.id = split_part(storage.filename(object_name), '.', 1)
      and (ph.added_by = auth.uid() or public.is_project_owner(ph.project_id))
  );
$$;

create policy "members upload own photo files" on storage.objects
  for insert with check (bucket_id = 'photos' and public.can_write_photo_file(name));
create policy "members replace own photo files" on storage.objects
  for update using (bucket_id = 'photos' and public.can_write_photo_file(name));
create policy "members delete own photo files" on storage.objects
  for delete using (bucket_id = 'photos' and public.can_write_photo_file(name));
