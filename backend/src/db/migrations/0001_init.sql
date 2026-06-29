-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query -> Run).
--
-- If you already created the old standalone "users" table from an earlier
-- version of this project, drop it first — it's no longer used now that
-- accounts live in Supabase Auth (auth.users) instead:
--   drop table if exists users;

do $$ begin
  create type user_role as enum ('super_admin', 'clinic_admin', 'staff');
exception
  when duplicate_object then null;
end $$;

create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- One row per Supabase Auth user, holding the app-specific identity fields.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role user_role not null,
  name text not null,
  clinic_id uuid references clinics(id),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_profiles_clinic on profiles(clinic_id);
