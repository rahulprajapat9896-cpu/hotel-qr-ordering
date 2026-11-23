-- Hotel QR Ordering — track when an order was served/rejected (drives the 2-minute chat refresh)
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Project: vqbogkazpphmibgypyge (org nitkkr-library, ap-south-1).
alter table public.orders add column if not exists served_at timestamptz;
