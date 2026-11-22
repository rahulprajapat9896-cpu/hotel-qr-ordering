-- Hotel QR Ordering — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor → New query → Run.
-- Works on a fresh project OR on the existing project
-- vqbogkazpphmibgypyge.supabase.co (org nitkkr-library, ap-south-1).
-- Tables are created IF NOT EXISTS; seed INSERTs use ON CONFLICT DO NOTHING,
-- so re-running this file is safe.

create extension if not exists pgcrypto;

create table if not exists menu_items (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null,
  price numeric(10,2) not null,
  veg boolean not null default true,
  image_url text,
  description text,
  available boolean not null default true,
  top_rated boolean not null default false,
  rating numeric(3,1)
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  table_no text not null check (table_no in ('T1','T2','T3','T4')),
  customer_name text not null default 'Guest',
  payment_method text not null default 'UPI' check (payment_method in ('UPI','Cash')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  status text not null default 'placed'
    check (status in ('placed','verified','rejected','sent_to_chef','preparing','ready','served')),
  total numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id bigint,
  name text not null,
  price numeric(10,2) not null,
  qty int not null default 1
);

create table if not exists ratings (
  id bigint generated always as identity primary key,
  order_id text not null,
  stars int not null check (stars between 1 and 5),
  feedback text,
  created_at timestamptz not null default now()
);

-- Demo RLS: Row Level Security is DISABLED for these tables so the
-- public anon key can read/write orders from the Vercel app without auth.
-- This is a demo/hotel-counter setup, not a multi-tenant production setup.
-- For production, enable RLS and add policies (e.g. anon SELECT on
-- menu_items only, and move order writes behind an API route / service key).
alter table menu_items disable row level security;
alter table orders disable row level security;
alter table order_items disable row level security;
alter table ratings disable row level security;

-- Realtime: lets Manager/Chef/Waiter/Customer stay in sync without polling.
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table menu_items;

-- Seed menu (59 dishes)
insert into menu_items (id, name, category, price, veg, image_url, description, top_rated, rating) values
  (1, 'Paneer Tikka Angara', 'Starters', 249, true, 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=800&q=80', 'Smoky char-grilled paneer, peppers and spicy angara masala.', true, 5),
  (2, 'Veg Samosa (2 pc)', 'Starters', 79, true, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80', 'Crisp pastry, spiced potato-pea filling, mint chutney.', false, NULL),
  (3, 'Chicken Tikka', 'Starters', 279, false, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80', 'Tandoor-roasted chicken tikka with onion rings and lemon.', false, NULL),
  (4, 'Hara Bhara Kebab', 'Starters', 199, true, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80', 'Spinach, peas and potato kebabs, pan-fried crisp.', false, NULL),
  (5, 'Fish Amritsari', 'Starters', 299, false, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80', 'Ajwain-batter fried fish, Amritsari style.', false, NULL),
  (6, 'Spring Rolls', 'Starters', 179, true, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80', 'Crunchy veg spring rolls with sweet chilli dip.', false, NULL),
  (7, 'Chilli Paneer', 'Starters', 229, true, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80', 'Indo-Chinese paneer tossed with peppers and soy.', false, NULL),
  (8, 'Chicken 65', 'Starters', 259, false, 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=800&q=80', 'Fiery South Indian fried chicken with curry leaves.', false, NULL),
  (9, 'Dal Makhani', 'Veg Main Course', 219, true, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80', 'Slow-cooked black dal, butter and cream.', false, NULL),
  (10, 'Paneer Butter Masala', 'Veg Main Course', 249, true, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80', 'Paneer in rich tomato-butter gravy.', false, NULL),
  (11, 'Mix Veg', 'Veg Main Course', 199, true, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80', 'Seasonal vegetables in mild onion-tomato masala.', false, NULL),
  (12, 'Palak Paneer', 'Veg Main Course', 229, true, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80', 'Paneer cubes in creamy spinach gravy.', false, NULL),
  (13, 'Veg Kolhapuri', 'Veg Main Course', 219, true, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80', 'Spicy mixed veg, Kolhapuri masala.', false, NULL),
  (14, 'Malai Kofta', 'Veg Main Course', 259, true, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80', 'Soft paneer kofta in creamy cashew gravy.', false, NULL),
  (15, 'Chana Masala', 'Veg Main Course', 189, true, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80', 'Chickpeas simmered in tangy masala.', false, NULL),
  (16, 'Bhindi Masala', 'Veg Main Course', 179, true, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80', 'Okra tossed with onion, tomato and spices.', false, NULL),
  (17, 'Butter Chicken', 'Non-Veg Main Course', 329, false, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80', 'Tandoori chicken in silky tomato-butter gravy.', true, 5),
  (18, 'Chicken Curry', 'Non-Veg Main Course', 299, false, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80', 'Home-style chicken curry, onion-tomato base.', false, NULL),
  (19, 'Mutton Rogan Josh', 'Non-Veg Main Course', 399, false, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'Slow-cooked mutton in Kashmiri chilli gravy.', false, NULL),
  (20, 'Egg Curry', 'Non-Veg Main Course', 199, false, 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=800&q=80', 'Boiled eggs in spicy onion-tomato masala.', false, NULL),
  (21, 'Fish Curry', 'Non-Veg Main Course', 349, false, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80', 'Fish simmered in tangy coastal curry.', false, NULL),
  (22, 'Chicken Korma', 'Non-Veg Main Course', 319, false, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80', 'Mild, creamy chicken korma with cashew.', false, NULL),
  (23, 'Keema Matar', 'Non-Veg Main Course', 289, false, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'Minced mutton with green peas.', false, NULL),
  (24, 'Tandoori Chicken (Half)', 'Non-Veg Main Course', 329, false, 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=800&q=80', 'Char-grilled half chicken, tandoor marinade.', false, NULL),
  (25, 'Butter Naan', 'Breads', 49, true, 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=800&q=80', 'Soft tandoor naan brushed with butter.', false, NULL),
  (26, 'Garlic Naan', 'Breads', 59, true, 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=800&q=80', 'Naan topped with garlic and coriander.', false, NULL),
  (27, 'Butter Roti', 'Breads', 29, true, 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=800&q=80', 'Whole-wheat tandoor roti with butter.', false, NULL),
  (28, 'Cheese Naan', 'Breads', 79, true, 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=800&q=80', 'Naan stuffed with melted cheese.', false, NULL),
  (29, 'Laccha Paratha', 'Breads', 59, true, 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=800&q=80', 'Flaky multi-layer whole-wheat paratha.', false, NULL),
  (30, 'Missi Roti', 'Breads', 39, true, 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=800&q=80', 'Gram-flour roti with spices.', false, NULL),
  (31, 'Veg Biryani', 'Rice & Biryani', 219, true, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80', 'Fragrant basmati, veg and biryani masala, raita.', false, NULL),
  (32, 'Chicken Biryani', 'Rice & Biryani', 279, false, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80', 'Dum chicken biryani with raita and salad.', false, NULL),
  (33, 'Mutton Biryani', 'Rice & Biryani', 349, false, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80', 'Dum mutton biryani, saffron and fried onion.', false, NULL),
  (34, 'Jeera Rice', 'Rice & Biryani', 149, true, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80', 'Basmati tempered with cumin.', false, NULL),
  (35, 'Veg Fried Rice', 'Rice & Biryani', 189, true, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80', 'Indo-Chinese fried rice with veg.', false, NULL),
  (36, 'Egg Biryani', 'Rice & Biryani', 229, false, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80', 'Dum biryani layered with masala eggs.', false, NULL),
  (37, 'Gulab Jamun (2 pc)', 'Desserts', 89, true, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80', 'Hot syrup-soaked gulab jamun.', true, 5),
  (38, 'Rasgulla (2 pc)', 'Desserts', 79, true, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80', 'Soft spongy rasgulla in light syrup.', false, NULL),
  (39, 'Kulfi', 'Desserts', 99, true, 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80', 'Dense malai kulfi, pistachio.', false, NULL),
  (40, 'Ice Cream (Vanilla)', 'Desserts', 79, true, 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80', 'Vanilla ice cream scoop.', false, NULL),
  (41, 'Rasmalai', 'Desserts', 119, true, 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=800&q=80', 'Chenna discs in saffron milk.', false, NULL),
  (42, 'Kheer', 'Desserts', 99, true, 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=800&q=80', 'Rice pudding with cardamom.', false, NULL),
  (43, 'Sweet Lassi', 'Beverages', 69, true, 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?auto=format&fit=crop&w=800&q=80', 'Thick sweet curd lassi.', false, NULL),
  (44, 'Salted Lassi', 'Beverages', 59, true, 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?auto=format&fit=crop&w=800&q=80', 'Light salted lassi with roasted jeera.', false, NULL),
  (45, 'Mango Lassi', 'Beverages', 89, true, 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?auto=format&fit=crop&w=800&q=80', 'Mango pulp blended with curd.', false, NULL),
  (46, 'Fresh Lime Soda', 'Beverages', 59, true, 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=800&q=80', 'Lime, soda, salt or sweet.', false, NULL),
  (47, 'Masala Chaas', 'Beverages', 49, true, 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?auto=format&fit=crop&w=800&q=80', 'Spiced buttermilk.', false, NULL),
  (48, 'Mineral Water (1L)', 'Beverages', 30, true, 'https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=800&q=80', 'Sealed 1-litre mineral water bottle.', false, NULL),
  (49, 'Cold Drink (200 ml)', 'Cold Drinks', 25, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80', 'Chilled soft drink, 200 ml bottle.', false, NULL),
  (50, 'Cold Drink (300 ml)', 'Cold Drinks', 40, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80', 'Chilled soft drink, 300 ml bottle.', false, NULL),
  (51, 'Cold Drink (750 ml)', 'Cold Drinks', 60, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80', 'Chilled soft drink, 750 ml bottle.', false, NULL),
  (52, 'Cold Drink (1 L)', 'Cold Drinks', 80, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80', 'Chilled soft drink, 1-litre bottle.', false, NULL),
  (53, 'Kulhad Masala Chai', 'Tea & Coffee', 30, true, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=800&q=80', 'Masala chai served in a kulhad.', false, NULL),
  (54, 'Green Tea', 'Tea & Coffee', 40, true, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=800&q=80', 'Light green tea.', false, NULL),
  (55, 'Lemon Tea', 'Tea & Coffee', 35, true, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=800&q=80', 'Tea with fresh lemon.', false, NULL),
  (56, 'Hot Coffee', 'Tea & Coffee', 60, true, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80', 'Freshly brewed hot coffee.', false, NULL),
  (57, 'Cold Coffee', 'Tea & Coffee', 99, true, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80', 'Iced coffee blended with milk.', false, NULL),
  (58, 'Cappuccino', 'Tea & Coffee', 99, true, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80', 'Espresso with steamed milk foam.', false, NULL),
  (59, 'Espresso', 'Tea & Coffee', 79, true, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80', 'Strong single-shot espresso.', false, NULL)
  on conflict (id) do nothing;

select pg_catalog.setval(pg_get_serial_sequence('menu_items','id'), (select max(id) from menu_items));
