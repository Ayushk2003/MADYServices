create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'MADY Member',
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  project_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'MADY Member'),
    coalesce(new.email, '')
  )
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.service_requests enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

drop policy if exists "Authenticated users can create service requests" on public.service_requests;
create policy "Authenticated users can create service requests"
  on public.service_requests
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read their own service requests" on public.service_requests;
create policy "Users can read their own service requests"
  on public.service_requests
  for select
  using (auth.uid() = user_id);
