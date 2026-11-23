-- Customer <-> Manager chat for Rahul Restaurant (hotel QR ordering).
-- One thread per table (T1-T4). Run once in the Supabase SQL editor.
-- RLS stays disabled, like the other tables in this project (orders,
-- menu_items, order_items, ratings) — the app uses the anon key.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  table_no text not null,
  sender text not null check (sender in ('customer', 'manager')),
  sender_name text,
  message text not null,
  read_by_manager boolean not null default false,
  read_by_customer boolean not null default false,
  created_at timestamptz not null default now()
);
