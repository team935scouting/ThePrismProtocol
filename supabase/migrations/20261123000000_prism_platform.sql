-- Prism platform: teams, roles, devices, software, test programs, community, site settings.
--
-- The website is a static export that talks to Supabase straight from the browser, so
-- every rule that matters lives here: row-level security on every table, column-level
-- grants so clients can only touch the columns they're meant to, and SECURITY DEFINER
-- functions for the multi-step actions (joining a team, approving people, pairing devices).
--
-- Run this once in the Supabase SQL editor. Then make yourself the first owner of team
-- 935 (which is what grants access to /admin):
--
--   select public.prism_bootstrap_owner(935, 'the-email-you-signed-up-with');
--
-- That function can only be run from the SQL editor, never from the website.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.team_role as enum ('owner', 'admin', 'developer');
create type public.member_status as enum ('pending', 'active', 'rejected');
create type public.device_kind as enum ('phone', 'tablet', 'laptop', 'pi', 'other');
create type public.release_channel as enum ('stable', 'beta');
create type public.post_kind as enum ('suggestion', 'bug', 'question');
create type public.post_status as enum ('open', 'planned', 'in_progress', 'done', 'declined');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text not null default '' check (char_length(name) <= 80),
  beta_updates boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  number int not null unique check (number between 1 and 99999),
  name text check (name is null or char_length(name) <= 80),
  created_at timestamptz not null default now()
);

-- One team per account. The first verified account for a team number becomes its owner;
-- everyone after that waits as 'pending' until an owner or admin accepts them.
create table public.team_members (
  team_id uuid not null references public.teams on delete cascade,
  user_id uuid not null unique references public.profiles (user_id) on delete cascade,
  role public.team_role not null default 'developer',
  status public.member_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users on delete set null,
  primary key (team_id, user_id)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind public.device_kind not null default 'other',
  platform text check (platform is null or char_length(platform) <= 120),
  status text not null default 'active' check (status in ('active', 'revoked')),
  token_hash text not null unique, -- sha256 of the secret the device keeps; never readable by clients
  registered_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table public.device_pairings (
  code text primary key,
  team_id uuid not null references public.teams on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  device_id uuid references public.devices on delete set null,
  claimed_at timestamptz
);

create table public.software (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 400),
  created_at timestamptz not null default now()
);

create table public.releases (
  id uuid primary key default gen_random_uuid(),
  software_id uuid not null references public.software on delete cascade,
  version text not null check (char_length(version) between 1 and 40),
  channel public.release_channel not null default 'beta',
  notes text check (notes is null or char_length(notes) <= 4000),
  download_url text check (download_url is null or download_url ~ '^https://'),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users on delete set null,
  unique (software_id, version)
);

create table public.device_access (
  device_id uuid not null references public.devices on delete cascade,
  software_id uuid not null references public.software on delete cascade,
  channel public.release_channel not null default 'stable',
  granted_by uuid default auth.uid() references auth.users on delete set null,
  granted_at timestamptz not null default now(),
  primary key (device_id, software_id)
);

create table public.test_programs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  software_id uuid references public.software on delete set null,
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now()
);

create table public.program_enrollments (
  program_id uuid not null references public.test_programs on delete cascade,
  team_id uuid not null references public.teams on delete cascade,
  enrolled_by uuid default auth.uid() references auth.users on delete set null,
  enrolled_at timestamptz not null default now(),
  primary key (program_id, team_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  author_name text not null default '',
  team_id uuid references public.teams on delete set null,
  team_number int,
  kind public.post_kind not null default 'suggestion',
  title text not null check (char_length(title) between 3 and 120),
  body text not null default '' check (char_length(body) <= 4000),
  status public.post_status not null default 'open',
  pinned boolean not null default false,
  hidden boolean not null default false,
  admin_note text check (admin_note is null or char_length(admin_note) <= 2000),
  created_at timestamptz not null default now()
);

create table public.post_votes (
  post_id uuid not null references public.posts on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (post_id, user_id)
);

create table public.site_settings (
  id boolean primary key default true check (id),
  announcement text check (announcement is null or char_length(announcement) <= 140),
  announcement_url text check (announcement_url is null or announcement_url ~ '^(https://|/)'),
  signups_open boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (true);
insert into public.software (slug, name, description)
values ('prism-os', 'Prism OS', 'The Raspberry Pi image that runs the Prism hub.');

-- Team 935 runs Prism, so its members are platform staff. Creating the team here means
-- nobody can claim it by being the first to sign up with 935: everyone lands as pending
-- until an owner (set with prism_bootstrap_owner) accepts them.
insert into public.teams (number, name) values (935, 'Prism');

create index on public.devices (team_id);
create index on public.releases (software_id, created_at desc);
create index on public.posts (created_at desc);
create index on public.team_members (team_id, status);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can use them without recursing through RLS)
-- ---------------------------------------------------------------------------

create function public.prism_my_team() returns uuid
language sql stable security definer set search_path = '' as $$
  select team_id from public.team_members where user_id = auth.uid() and status = 'active';
$$;

create function public.prism_is_member(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members
    where team_id = t and user_id = auth.uid() and status = 'active'
  );
$$;

create function public.prism_is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members m join public.teams t on t.id = m.team_id
    where m.user_id = auth.uid() and m.status = 'active' and t.number = 935
  );
$$;

-- Owners and admins manage their own team; Prism staff can manage any team.
create function public.prism_can_manage(t uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.prism_is_staff() or exists (
    select 1 from public.team_members
    where team_id = t and user_id = auth.uid() and status = 'active' and role in ('owner', 'admin')
  );
$$;

create function public.prism_shares_team(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members mine
    join public.team_members theirs on theirs.team_id = mine.team_id
    where mine.user_id = auth.uid() and mine.status = 'active' and theirs.user_id = u
  );
$$;

create function public.prism_device_team(d uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select team_id from public.devices where id = d;
$$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.devices enable row level security;
alter table public.device_pairings enable row level security;
alter table public.software enable row level security;
alter table public.releases enable row level security;
alter table public.device_access enable row level security;
alter table public.test_programs enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.posts enable row level security;
alter table public.post_votes enable row level security;
alter table public.site_settings enable row level security;

-- Start from nothing, then grant exactly what each role needs.
revoke all on public.profiles, public.teams, public.team_members, public.devices,
  public.device_pairings, public.software, public.releases, public.device_access,
  public.test_programs, public.program_enrollments, public.posts, public.post_votes,
  public.site_settings
from anon, authenticated;

-- profiles
grant select on public.profiles to authenticated;
grant update (name, beta_updates) on public.profiles to authenticated;
create policy "profiles: self, teammates, staff" on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.prism_shares_team(user_id) or public.prism_is_staff());
create policy "profiles: edit self" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- teams
grant select on public.teams to authenticated;
grant update (name) on public.teams to authenticated;
create policy "teams: own team and staff" on public.teams for select to authenticated
  using (
    exists (select 1 from public.team_members m where m.team_id = id and m.user_id = (select auth.uid()))
    or public.prism_is_staff()
  );
create policy "teams: managers rename" on public.teams for update to authenticated
  using (public.prism_can_manage(id)) with check (public.prism_can_manage(id));

-- team_members (all writes go through functions below)
grant select on public.team_members to authenticated;
create policy "members: self, teammates, staff" on public.team_members for select to authenticated
  using (user_id = (select auth.uid()) or public.prism_is_member(team_id) or public.prism_is_staff());

-- devices (token_hash is deliberately not granted)
grant select (id, team_id, name, kind, platform, status, registered_by, created_at, last_seen_at)
  on public.devices to authenticated;
grant update (name, status) on public.devices to authenticated;
grant delete on public.devices to authenticated;
create policy "devices: team and staff read" on public.devices for select to authenticated
  using (public.prism_is_member(team_id) or public.prism_is_staff());
create policy "devices: managers edit" on public.devices for update to authenticated
  using (public.prism_can_manage(team_id)) with check (public.prism_can_manage(team_id));
create policy "devices: managers delete" on public.devices for delete to authenticated
  using (public.prism_can_manage(team_id));

-- device_pairings
grant select on public.device_pairings to authenticated;
create policy "pairings: team reads" on public.device_pairings for select to authenticated
  using (public.prism_is_member(team_id));

-- software and releases: everyone signed in can read; staff write
grant select, insert, update, delete on public.software, public.releases to authenticated;
create policy "software: read" on public.software for select to authenticated using (true);
create policy "software: staff insert" on public.software for insert to authenticated with check (public.prism_is_staff());
create policy "software: staff update" on public.software for update to authenticated using (public.prism_is_staff()) with check (public.prism_is_staff());
create policy "software: staff delete" on public.software for delete to authenticated using (public.prism_is_staff());
create policy "releases: published or staff" on public.releases for select to authenticated using (published or public.prism_is_staff());
create policy "releases: staff insert" on public.releases for insert to authenticated with check (public.prism_is_staff());
create policy "releases: staff update" on public.releases for update to authenticated using (public.prism_is_staff()) with check (public.prism_is_staff());
create policy "releases: staff delete" on public.releases for delete to authenticated using (public.prism_is_staff());

-- device_access: which software each device may run
grant select, insert, update, delete on public.device_access to authenticated;
create policy "access: team and staff read" on public.device_access for select to authenticated
  using (public.prism_is_member(public.prism_device_team(device_id)) or public.prism_is_staff());
create policy "access: managers grant" on public.device_access for insert to authenticated
  with check (public.prism_can_manage(public.prism_device_team(device_id)));
create policy "access: managers change" on public.device_access for update to authenticated
  using (public.prism_can_manage(public.prism_device_team(device_id)))
  with check (public.prism_can_manage(public.prism_device_team(device_id)));
create policy "access: managers revoke" on public.device_access for delete to authenticated
  using (public.prism_can_manage(public.prism_device_team(device_id)));

-- test programs
grant select, insert, update, delete on public.test_programs to authenticated;
create policy "programs: visible unless draft" on public.test_programs for select to authenticated
  using (status <> 'draft' or public.prism_is_staff());
create policy "programs: staff insert" on public.test_programs for insert to authenticated with check (public.prism_is_staff());
create policy "programs: staff update" on public.test_programs for update to authenticated using (public.prism_is_staff()) with check (public.prism_is_staff());
create policy "programs: staff delete" on public.test_programs for delete to authenticated using (public.prism_is_staff());

grant select, delete on public.program_enrollments to authenticated;
grant insert (program_id, team_id) on public.program_enrollments to authenticated;
create policy "enrollments: team and staff read" on public.program_enrollments for select to authenticated
  using (public.prism_is_member(team_id) or public.prism_is_staff());
create policy "enrollments: managers join open programs" on public.program_enrollments for insert to authenticated
  with check (
    public.prism_can_manage(team_id)
    and exists (select 1 from public.test_programs p where p.id = program_id and p.status = 'open')
  );
create policy "enrollments: managers leave" on public.program_enrollments for delete to authenticated
  using (public.prism_can_manage(team_id));

-- community
grant select, delete on public.posts to authenticated;
grant insert (kind, title, body) on public.posts to authenticated;
grant update (status, pinned, hidden, admin_note) on public.posts to authenticated;
create policy "posts: visible" on public.posts for select to authenticated
  using (not hidden or author_id = (select auth.uid()) or public.prism_is_staff());
create policy "posts: team members post" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and public.prism_my_team() is not null);
create policy "posts: staff moderate" on public.posts for update to authenticated
  using (public.prism_is_staff()) with check (public.prism_is_staff());
create policy "posts: author or staff delete" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or public.prism_is_staff());

grant select, delete on public.post_votes to authenticated;
grant insert (post_id) on public.post_votes to authenticated;
create policy "votes: read" on public.post_votes for select to authenticated using (true);
create policy "votes: own" on public.post_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.prism_my_team() is not null);
create policy "votes: remove own" on public.post_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- site settings: public read (the homepage shows the announcement), staff edit
grant select on public.site_settings to anon, authenticated;
grant update (announcement, announcement_url, signups_open) on public.site_settings to authenticated;
create policy "settings: read" on public.site_settings for select to anon, authenticated using (true);
create policy "settings: staff edit" on public.site_settings for update to authenticated
  using (public.prism_is_staff()) with check (public.prism_is_staff());

-- Posts get their author's name and team stamped by the database, not the client.
create function public.prism_stamp_post() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.author_id := auth.uid();
  new.team_id := public.prism_my_team();
  new.team_number := (select number from public.teams where id = new.team_id);
  new.author_name := coalesce((select name from public.profiles where user_id = auth.uid()), '');
  new.status := 'open';
  new.pinned := false;
  new.hidden := false;
  new.admin_note := null;
  return new;
end $$;

create trigger prism_stamp_post before insert on public.posts
  for each row execute function public.prism_stamp_post();

create function public.prism_touch_settings() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger prism_touch_settings before update on public.site_settings
  for each row execute function public.prism_touch_settings();

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

-- Called after every sign-in. Creates the profile, and on first use either founds the
-- team (first verified account for that number = owner) or files a join request.
create function public.prism_ensure_membership()
returns table (team_id uuid, team_number int, role public.team_role, status public.member_status)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  u record;
  n int;
  tid uuid;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  select id, email, email_confirmed_at, raw_user_meta_data into u from auth.users where id = uid;
  if u.email_confirmed_at is null then
    raise exception 'Confirm your email first. The link is in your inbox.';
  end if;

  insert into public.profiles (user_id, email, name, beta_updates)
  values (
    uid,
    u.email,
    left(coalesce(u.raw_user_meta_data ->> 'name', ''), 80),
    coalesce((u.raw_user_meta_data ->> 'beta_updates')::boolean, false)
  )
  on conflict (user_id) do update set email = excluded.email;

  if not exists (select 1 from public.team_members m where m.user_id = uid) then
    begin
      n := (u.raw_user_meta_data ->> 'team')::int;
    exception when others then
      n := null;
    end;
    if n is null or n < 1 or n > 99999 then
      raise exception 'Add your team number to finish setting up.';
    end if;
    if not (select s.signups_open from public.site_settings s where s.id) then
      raise exception 'New beta sign-ups are closed right now.';
    end if;

    insert into public.teams (number) values (n) on conflict (number) do nothing returning id into tid;
    if tid is not null then
      insert into public.team_members (team_id, user_id, role, status, decided_at)
      values (tid, uid, 'owner', 'active', now());
    else
      select t.id into tid from public.teams t where t.number = n;
      insert into public.team_members (team_id, user_id, role, status)
      values (tid, uid, 'developer', 'pending');
    end if;
  end if;

  return query
    select m.team_id, t.number, m.role, m.status
    from public.team_members m join public.teams t on t.id = m.team_id
    where m.user_id = uid;
end $$;

-- Accept or decline a pending join request.
create function public.prism_decide_member(p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t uuid;
begin
  select m.team_id into t from public.team_members m where m.user_id = p_user and m.status = 'pending';
  if t is null then
    raise exception 'That request has already been handled.';
  end if;
  if not public.prism_can_manage(t) then
    raise exception 'Only team owners and admins can do that.' using errcode = '42501';
  end if;
  update public.team_members
  set status = case when p_accept then 'active' else 'rejected' end::public.member_status,
      decided_at = now(),
      decided_by = auth.uid()
  where user_id = p_user;
end $$;

-- Move an active member between developer and admin. Owners can't be changed here.
create function public.prism_set_role(p_user uuid, p_role public.team_role) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  if p_role = 'owner' then
    raise exception 'Ownership can''t be assigned from here.';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t change your own role.';
  end if;
  select * into r from public.team_members where user_id = p_user and status = 'active';
  if not found then
    raise exception 'That person isn''t an active member.';
  end if;
  if r.role = 'owner' then
    raise exception 'Owners keep their role.';
  end if;
  if not public.prism_can_manage(r.team_id) then
    raise exception 'Only team owners and admins can do that.' using errcode = '42501';
  end if;
  update public.team_members set role = p_role where user_id = p_user;
end $$;

create function public.prism_remove_member(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  select * into r from public.team_members where user_id = p_user;
  if not found then
    return;
  end if;
  if r.role = 'owner' and r.status = 'active' then
    raise exception 'Owners can''t be removed.';
  end if;
  if not public.prism_can_manage(r.team_id) then
    raise exception 'Only team owners and admins can do that.' using errcode = '42501';
  end if;
  delete from public.team_members where user_id = p_user;
end $$;

create function public.prism_leave_team() returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  select * into r from public.team_members where user_id = auth.uid();
  if not found then
    return;
  end if;
  if r.role = 'owner' and r.status = 'active' then
    raise exception 'Owners can''t leave their own team.';
  end if;
  delete from public.team_members where user_id = auth.uid();
end $$;

-- A short-lived code a phone or tablet scans to join the team's devices.
create function public.prism_create_pairing()
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  t uuid := public.prism_my_team();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
  exp timestamptz := now() + interval '15 minutes';
begin
  if t is null then
    raise exception 'Join a team before adding devices.' using errcode = '42501';
  end if;
  delete from public.device_pairings p where p.team_id = t and p.device_id is null and p.expires_at < now();
  loop
    b := extensions.gen_random_bytes(8);
    c := '';
    for i in 0..7 loop
      c := c || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    begin
      insert into public.device_pairings (code, team_id, created_by, expires_at)
      values (c, t, auth.uid(), exp);
      exit;
    exception when unique_violation then
      -- try another code
    end;
  end loop;
  return query select c, exp;
end $$;

-- Run by the device itself (it may not be signed in). Returns a secret the device keeps;
-- only its hash is stored.
create function public.prism_claim_pairing(p_code text, p_name text, p_kind public.device_kind, p_platform text)
returns table (device_id uuid, team_number int, device_token text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  p record;
  tok text;
  did uuid;
begin
  select * into p from public.device_pairings where code = upper(trim(p_code)) for update;
  if not found or p.device_id is not null or p.expires_at < now() then
    raise exception 'That code has expired or was already used. Make a new one from the dashboard.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Give this device a name.';
  end if;
  tok := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.devices (team_id, name, kind, platform, token_hash, registered_by)
  values (
    p.team_id,
    left(trim(p_name), 60),
    coalesce(p_kind, 'other'),
    left(p_platform, 120),
    encode(extensions.digest(tok, 'sha256'), 'hex'),
    p.created_by
  )
  returning id into did;
  update public.device_pairings set device_id = did, claimed_at = now() where code = p.code;
  return query select did, (select t.number from public.teams t where t.id = p.team_id), tok;
end $$;

-- '1.10.2-beta.1' -> {1,10,2}, so releases sort by version number rather than upload time.
create function public.prism_version_key(v text) returns int[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(nullif(p, '')::int order by ord), '{}')
  from unnest(string_to_array(regexp_replace(split_part(v, '-', 1), '[^0-9.]', '', 'g'), '.'))
    with ordinality as t(p, ord);
$$;

-- What a registered device is allowed to run, looked up by its secret.
create function public.prism_device_status(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d record;
begin
  select * into d from public.devices where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then
    return null;
  end if;
  update public.devices set last_seen_at = now() where id = d.id;
  return jsonb_build_object(
    'id', d.id,
    'name', d.name,
    'kind', d.kind,
    'status', d.status,
    'team_number', (select t.number from public.teams t where t.id = d.team_id),
    'software', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name,
        'slug', s.slug,
        'channel', a.channel,
        'release', (
          select jsonb_build_object('version', r.version, 'download_url', r.download_url, 'notes', r.notes)
          from public.releases r
          where r.software_id = s.id and r.published and (a.channel = 'beta' or r.channel = 'stable')
          order by public.prism_version_key(r.version) desc, r.created_at desc
          limit 1
        )
      ) order by s.name)
      from public.device_access a join public.software s on s.id = a.software_id
      where a.device_id = d.id and d.status = 'active'
    ), '[]'::jsonb)
  );
end $$;

-- SQL-editor only: make an existing account the owner of a team.
create function public.prism_bootstrap_owner(p_team int, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
  tid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'No account uses that email. Sign up on the website first.';
  end if;
  insert into public.teams (number) values (p_team) on conflict (number) do nothing;
  select id into tid from public.teams where number = p_team;
  insert into public.profiles (user_id, email) values (uid, trim(p_email)) on conflict (user_id) do nothing;
  delete from public.team_members where user_id = uid and team_id <> tid;
  insert into public.team_members (team_id, user_id, role, status, decided_at)
  values (tid, uid, 'owner', 'active', now())
  on conflict (team_id, user_id) do update set role = 'owner', status = 'active', decided_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- Function permissions: nothing is callable unless granted here.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.prism_my_team(),
  public.prism_is_member(uuid),
  public.prism_is_staff(),
  public.prism_can_manage(uuid),
  public.prism_shares_team(uuid),
  public.prism_device_team(uuid),
  public.prism_ensure_membership(),
  public.prism_decide_member(uuid, boolean),
  public.prism_set_role(uuid, public.team_role),
  public.prism_remove_member(uuid),
  public.prism_leave_team(),
  public.prism_create_pairing()
to authenticated;

grant execute on function
  public.prism_claim_pairing(text, text, public.device_kind, text),
  public.prism_device_status(text)
to anon, authenticated;

-- prism_bootstrap_owner, prism_stamp_post and prism_touch_settings stay ungranted.
