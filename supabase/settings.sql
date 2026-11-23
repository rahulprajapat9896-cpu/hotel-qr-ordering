-- Hotel QR Ordering — settings (key/value), e.g. hotel_location for the QR geofence
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Project: vqbogkazpphmibgypyge (org nitkkr-library, ap-south-1).
create table if not exists settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table settings disable row level security;
