-- Run in Supabase SQL Editor after 0003_clinic_meta.sql
alter table patients add column if not exists profile_extras jsonb not null default '{}'::jsonb;
