-- Run in Supabase SQL Editor after 0002
alter table clinics add column if not exists specialty text;
alter table clinics add column if not exists location  text;
