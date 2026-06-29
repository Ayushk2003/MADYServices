create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'MADY Member',
  email text not null unique,
  role text not null default 'member' check (role in ('member', 'admin', 'manager')),
  created_at timestamptz not null default now()
);

create table if not exists public.agency_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  role text not null check (role in ('admin', 'manager')),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists agency_invites_email_unique
  on public.agency_invites (lower(email));

create unique index if not exists agency_invites_email_exact_unique
  on public.agency_invites (email);

create or replace function public.bootstrap_profile_role(profile_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when lower(coalesce(profile_email, '')) in ('ayushkushwaha182003@gmail.com') then 'admin'
    else coalesce(
      (
        select role
        from public.agency_invites
        where lower(email) = lower(coalesce(profile_email, ''))
        limit 1
      ),
      'member'
    )
  end;
$$;

create or replace function public.invited_agency_role(profile_email text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.agency_invites
  where lower(email) = lower(coalesce(profile_email, ''))
  limit 1;
$$;

create or replace function public.testing_owner_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'ayushkushwaha182003@gmail.com';
$$;

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  mobile_number text,
  customer_type text not null default 'individual' check (customer_type in ('firm', 'individual')),
  project_type text not null,
  service_title text,
  service_info text,
  requirements text,
  message text not null,
  request_source text not null default 'service_request' check (request_source = 'service_request'),
  transcript_requested boolean not null default false,
  transcript text,
  transcript_emailed boolean not null default false,
  status text not null default 'new' check (status in ('new', 'in_process', 'accepted', 'rejected', 'delivered', 'closed')),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  decision_by uuid references public.profiles(id) on delete set null,
  decision_note text,
  decision_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.asked_services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text,
  mobile_number text,
  customer_type text not null default 'individual' check (customer_type in ('firm', 'individual')),
  project_type text not null,
  service_title text,
  service_info text,
  requirements text,
  message text not null,
  request_source text not null default 'asked_service' check (request_source = 'asked_service'),
  transcript_requested boolean not null default false,
  transcript text,
  transcript_emailed boolean not null default false,
  status text not null default 'new' check (status in ('new', 'in_process', 'accepted', 'rejected', 'delivered', 'closed')),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  decision_by uuid references public.profiles(id) on delete set null,
  decision_note text,
  decision_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists role text not null default 'member';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('member', 'admin', 'manager'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'agency_invites_role_check'
      and conrelid = 'public.agency_invites'::regclass
  ) then
    alter table public.agency_invites
      add constraint agency_invites_role_check check (role in ('admin', 'manager'));
  end if;
end;
$$;

alter table public.service_requests
  add column if not exists email text,
  add column if not exists mobile_number text,
  add column if not exists customer_type text not null default 'individual',
  add column if not exists service_title text,
  add column if not exists service_info text,
  add column if not exists requirements text,
  add column if not exists request_source text not null default 'service_request',
  add column if not exists transcript_requested boolean not null default false,
  add column if not exists transcript text,
  add column if not exists transcript_emailed boolean not null default false,
  add column if not exists status text not null default 'new',
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists decision_by uuid references public.profiles(id) on delete set null,
  add column if not exists decision_note text,
  add column if not exists decision_at timestamptz,
  add column if not exists delivered_at timestamptz;

alter table public.asked_services
  add column if not exists email text,
  add column if not exists mobile_number text,
  add column if not exists customer_type text not null default 'individual',
  add column if not exists service_title text,
  add column if not exists service_info text,
  add column if not exists requirements text,
  add column if not exists request_source text not null default 'asked_service',
  add column if not exists transcript_requested boolean not null default false,
  add column if not exists transcript text,
  add column if not exists transcript_emailed boolean not null default false,
  add column if not exists status text not null default 'new',
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claimed_at timestamptz,
  add column if not exists decision_by uuid references public.profiles(id) on delete set null,
  add column if not exists decision_note text,
  add column if not exists decision_at timestamptz,
  add column if not exists delivered_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_requests_customer_type_check'
      and conrelid = 'public.service_requests'::regclass
  ) then
    alter table public.service_requests
      add constraint service_requests_customer_type_check check (customer_type in ('firm', 'individual'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asked_services_customer_type_check'
      and conrelid = 'public.asked_services'::regclass
  ) then
    alter table public.asked_services
      add constraint asked_services_customer_type_check check (customer_type in ('firm', 'individual'));
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'service_requests_status_check'
      and conrelid = 'public.service_requests'::regclass
  ) then
    alter table public.service_requests
      drop constraint service_requests_status_check;
  end if;

  alter table public.service_requests
    add constraint service_requests_status_check check (status in ('new', 'in_process', 'accepted', 'rejected', 'delivered', 'closed'));
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'asked_services_status_check'
      and conrelid = 'public.asked_services'::regclass
  ) then
    alter table public.asked_services
      drop constraint asked_services_status_check;
  end if;

  alter table public.asked_services
    add constraint asked_services_status_check check (status in ('new', 'in_process', 'accepted', 'rejected', 'delivered', 'closed'));
end;
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'service_requests_source_check'
      and conrelid = 'public.service_requests'::regclass
  ) then
    alter table public.service_requests
      drop constraint service_requests_source_check;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'service_requests_request_source_check'
      and conrelid = 'public.service_requests'::regclass
  ) then
    alter table public.service_requests
      drop constraint service_requests_request_source_check;
  end if;

  alter table public.service_requests
    add constraint service_requests_source_check check (request_source = 'service_request');
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'asked_services_source_check'
      and conrelid = 'public.asked_services'::regclass
  ) then
    alter table public.asked_services
      add constraint asked_services_source_check check (request_source = 'asked_service');
  end if;
end;
$$;

insert into public.asked_services (
  id,
  user_id,
  name,
  email,
  mobile_number,
  customer_type,
  project_type,
  service_title,
  service_info,
  requirements,
  message,
  request_source,
  transcript_requested,
  transcript,
  transcript_emailed,
  status,
  claimed_by,
  claimed_at,
  decision_by,
  decision_note,
  decision_at,
  delivered_at,
  created_at
)
select
  id,
  user_id,
  name,
  lower(email),
  mobile_number,
  customer_type,
  project_type,
  service_title,
  service_info,
  requirements,
  message,
  'asked_service',
  transcript_requested,
  transcript,
  transcript_emailed,
  status,
  claimed_by,
  claimed_at,
  decision_by,
  decision_note,
  decision_at,
  delivered_at,
  created_at
from public.service_requests
where request_source = 'asked_service'
on conflict (id) do nothing;

delete from public.service_requests
where request_source = 'asked_service';

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'member'
  );
$$;

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(
    (select email from public.profiles where id = auth.uid()),
    auth.jwt() ->> 'email',
    ''
  ));
$$;

create or replace function public.is_agency_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'manager');
$$;

create or replace function public.can_create_service_request(request_user_id uuid, request_email text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = request_user_id
    and (
      public.current_user_role() in ('member', 'admin')
      or public.current_user_email() = public.testing_owner_email()
    )
    and (
      select count(*)
      from public.service_requests
      where lower(email) = lower(coalesce(nullif(trim(request_email), ''), public.current_user_email()))
    ) < 2;
$$;

create or replace function public.can_create_asked_service(request_user_id uuid, request_email text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = request_user_id
    and (
      public.current_user_role() in ('member', 'admin')
      or public.current_user_email() = public.testing_owner_email()
    )
    and (
      select count(*)
      from public.asked_services
      where lower(email) = lower(coalesce(nullif(trim(request_email), ''), public.current_user_email()))
    ) < 2;
$$;

create or replace function public.sync_profile(profile_id uuid, profile_name text, profile_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() <> profile_id then
    raise exception 'Profile sync is only allowed for the logged-in user.';
  end if;

  insert into public.profiles (id, name, email, role)
  values (
    profile_id,
    coalesce(nullif(profile_name, ''), 'MADY Member'),
    coalesce(profile_email, ''),
    public.bootstrap_profile_role(profile_email)
  )
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        role = case
          when lower(excluded.email) in ('ayushkushwaha182003@gmail.com') then 'admin'
          when public.invited_agency_role(excluded.email) is not null then public.invited_agency_role(excluded.email)
          when public.profiles.role = 'member' then public.bootstrap_profile_role(excluded.email)
          else public.profiles.role
        end;

  update public.agency_invites
  set accepted_by = profile_id,
      accepted_at = coalesce(accepted_at, now())
  where lower(email) = lower(coalesce(profile_email, ''));
end;
$$;

create unique index if not exists profiles_email_unique
  on public.profiles (lower(email))
  where email <> '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'MADY Member'),
    coalesce(new.email, ''),
    public.bootstrap_profile_role(new.email)
  )
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        role = case
          when lower(excluded.email) in ('ayushkushwaha182003@gmail.com') then 'admin'
          when public.invited_agency_role(excluded.email) is not null then public.invited_agency_role(excluded.email)
          when public.profiles.role = 'member' then public.bootstrap_profile_role(excluded.email)
          else public.profiles.role
        end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, name, email, role)
select
  id,
  coalesce(raw_user_meta_data ->> 'name', 'MADY Member'),
  coalesce(email, ''),
  public.bootstrap_profile_role(email)
from auth.users
on conflict (id) do update
  set name = excluded.name,
      email = excluded.email,
      role = case
        when lower(excluded.email) in ('ayushkushwaha182003@gmail.com') then 'admin'
        when public.invited_agency_role(excluded.email) is not null then public.invited_agency_role(excluded.email)
        when public.profiles.role = 'member' then public.bootstrap_profile_role(excluded.email)
        else public.profiles.role
      end;

update public.profiles
set role = 'admin'
where lower(email) in ('ayushkushwaha182003@gmail.com');

update public.profiles
set role = public.invited_agency_role(email)
where lower(email) <> public.testing_owner_email()
  and public.invited_agency_role(email) is not null;

create or replace function public.update_profile_role(target_profile_id uuid, next_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can change agency roles.';
  end if;

  if next_role not in ('member', 'admin', 'manager') then
    raise exception 'Invalid profile role.';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = target_profile_id
      and lower(email) = public.testing_owner_email()
  ) then
    raise exception 'Testing owner ID is protected.';
  end if;

  update public.profiles
  set role = next_role
  where id = target_profile_id;
end;
$$;

create or replace function public.create_agency_invite(invite_email text, invite_name text, invite_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() <> 'admin' then
    raise exception 'Only admins can invite agency members.';
  end if;

  if invite_role not in ('admin', 'manager') then
    raise exception 'Invites can only be created for admin or manager roles.';
  end if;

  insert into public.agency_invites (email, name, role, invited_by)
  values (lower(trim(invite_email)), nullif(trim(invite_name), ''), invite_role, auth.uid())
  on conflict (email) do update
    set name = excluded.name,
        role = excluded.role,
        invited_by = excluded.invited_by;

  update public.profiles
  set role = invite_role,
      name = coalesce(nullif(trim(invite_name), ''), name)
  where lower(email) = lower(trim(invite_email));
end;
$$;

alter table public.profiles enable row level security;
alter table public.agency_invites enable row level security;
alter table public.service_requests enable row level security;
alter table public.asked_services enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_agency_manager());

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (
    auth.uid() = id
    or (
      public.current_user_role() = 'admin'
      and lower(email) <> public.testing_owner_email()
    )
  )
  with check (
    auth.uid() = id
    or (
      public.current_user_role() = 'admin'
      and lower(email) <> public.testing_owner_email()
    )
  );

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Admins can read agency invites" on public.agency_invites;
create policy "Admins can read agency invites"
  on public.agency_invites
  for select
  using (public.current_user_role() = 'admin');

drop policy if exists "Admins can insert agency invites" on public.agency_invites;
create policy "Admins can insert agency invites"
  on public.agency_invites
  for insert
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admins can update agency invites" on public.agency_invites;
create policy "Admins can update agency invites"
  on public.agency_invites
  for update
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

drop policy if exists "Admins can delete agency invites" on public.agency_invites;
create policy "Admins can delete agency invites"
  on public.agency_invites
  for delete
  using (public.current_user_role() = 'admin');

drop policy if exists "Authenticated users can create service requests" on public.service_requests;
create policy "Authenticated users can create service requests"
  on public.service_requests
  for insert
  with check (public.can_create_service_request(user_id, email));

drop policy if exists "Authenticated users can create asked services" on public.asked_services;
create policy "Authenticated users can create asked services"
  on public.asked_services
  for insert
  with check (public.can_create_asked_service(user_id, email));

drop policy if exists "Users can read their own service requests" on public.service_requests;
create policy "Users can read their own service requests"
  on public.service_requests
  for select
  using (auth.uid() = user_id or public.is_agency_manager());

drop policy if exists "Users can read their own asked services" on public.asked_services;
create policy "Users can read their own asked services"
  on public.asked_services
  for select
  using (auth.uid() = user_id or public.is_agency_manager());

drop policy if exists "Agency managers can update service requests" on public.service_requests;
create policy "Agency managers can update service requests"
  on public.service_requests
  for update
  using (public.is_agency_manager())
  with check (public.is_agency_manager());

drop policy if exists "Agency managers can update asked services" on public.asked_services;
create policy "Agency managers can update asked services"
  on public.asked_services
  for update
  using (public.is_agency_manager())
  with check (public.is_agency_manager());

drop policy if exists "Agency managers can delete service requests" on public.service_requests;
create policy "Agency managers can delete service requests"
  on public.service_requests
  for delete
  using (public.is_agency_manager());

drop policy if exists "Agency managers can delete asked services" on public.asked_services;
create policy "Agency managers can delete asked services"
  on public.asked_services
  for delete
  using (public.is_agency_manager());

revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, name, email) on public.profiles to authenticated;
grant update (name, email, role) on public.profiles to authenticated;
grant select, insert, update, delete on public.agency_invites to authenticated;
grant select, insert, update, delete on public.service_requests to authenticated;
grant select, insert, update, delete on public.asked_services to authenticated;
grant execute on function public.sync_profile(uuid, text, text) to authenticated;
grant execute on function public.update_profile_role(uuid, text) to authenticated;
grant execute on function public.create_agency_invite(text, text, text) to authenticated;
grant execute on function public.can_create_service_request(uuid, text) to authenticated;
grant execute on function public.can_create_asked_service(uuid, text) to authenticated;

