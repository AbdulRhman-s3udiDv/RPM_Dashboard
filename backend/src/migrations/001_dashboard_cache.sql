-- Background-sync cache table: one row (id=1) upserted by the sync job every 30 min.
-- Run this once in the Supabase dashboard -> SQL Editor before starting the server.

CREATE TABLE IF NOT EXISTS public.dashboard_cache (
  id         int PRIMARY KEY DEFAULT 1,
  synced_at  timestamptz NOT NULL DEFAULT now(),
  tenovi     jsonb NOT NULL DEFAULT '{}',
  smartmeter jsonb NOT NULL DEFAULT '{}'
);

-- Only the service-role key (used by the backend) can read/write.
-- The anon key and authenticated users have no direct access.
ALTER TABLE public.dashboard_cache ENABLE ROW LEVEL SECURITY;
