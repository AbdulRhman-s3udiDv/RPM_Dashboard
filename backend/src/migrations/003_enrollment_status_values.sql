-- Migration 003: Add missing enrollment_status enum values
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
--
-- The sync tries to write Tenovi statuses (pending, inactive, disenrolled)
-- that didn't exist in the original enum definition. Missing values cause
-- the entire upsert chunk to fail silently, leaving patients un-synced.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enrollment_status')
  ) THEN
    ALTER TYPE enrollment_status ADD VALUE 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'inactive'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enrollment_status')
  ) THEN
    ALTER TYPE enrollment_status ADD VALUE 'inactive';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'disenrolled'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enrollment_status')
  ) THEN
    ALTER TYPE enrollment_status ADD VALUE 'disenrolled';
  END IF;
END $$;
