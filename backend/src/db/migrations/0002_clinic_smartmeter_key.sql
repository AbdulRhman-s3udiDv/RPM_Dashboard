-- Run in Supabase SQL Editor after 0001_init.sql
alter table clinics add column if not exists smartmeter_api_key text;
