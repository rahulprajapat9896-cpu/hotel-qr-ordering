-- Hotel QR Ordering — add customer mobile number to orders
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Project: vqbogkazpphmibgypyge (org nitkkr-library, ap-south-1).
alter table public.orders add column if not exists customer_phone text;
