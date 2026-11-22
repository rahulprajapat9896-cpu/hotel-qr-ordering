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

-- Seed menu (68 dishes)
insert into menu_items (id, name, category, price, veg, image_url, description, top_rated, rating) values
  (1, 'Paneer Tikka Angara', 'Starters', 249, true, 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=800&q=80', 'Smoky char-grilled paneer, peppers and spicy angara masala.', true, 5),
  (2, 'Veg Samosa (2 pc)', 'Starters', 79, true, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80', 'Crisp pastry, spiced potato-pea filling, mint chutney.', false, NULL),
  (3, 'Chicken Tikka', 'Starters', 279, false, 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80', 'Tandoor-roasted chicken tikka with onion rings and lemon.', false, NULL),
  (4, 'Hara Bhara Kebab', 'Starters', 199, true, 'https://cdn.mygingergarlickitchen.com/images/800px/800px-hara-bhara-kabab-2.jpg', 'Spinach, peas and potato kebabs, pan-fried crisp.', false, NULL),
  (5, 'Fish Amritsari', 'Starters', 299, false, 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80', 'Ajwain-batter fried fish, Amritsari style.', false, NULL),
  (6, 'Spring Rolls', 'Starters', 179, true, 'https://tb-static.uber.com/prod/image-proc/processed_images/0ba1c9930cdbc990ba00168a4899789d/d03e52b3c8af19d8fa8222e23efd9cfa.jpeg', 'Crunchy veg spring rolls with sweet chilli dip.', false, NULL),
  (7, 'Chilli Paneer', 'Starters', 229, true, 'https://b.zmtcdn.com/data/dish_photos/7ed/c8ec942f67c7975ef4b0cd76c18c37ed.jpg', 'Indo-Chinese paneer tossed with peppers and soy.', false, NULL),
  (8, 'Chicken 65', 'Starters', 259, false, 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=800&q=80', 'Fiery South Indian fried chicken with curry leaves.', false, NULL),
  (9, 'Dal Makhani', 'Veg Main Course', 219, true, 'https://tb-static.uber.com/prod/image-proc/processed_images/0dde94c943739e53eb69a885c4dc6224/c67fc65e9b4e16a553eb7574fba090f1.jpeg', 'Slow-cooked black dal, butter and cream.', false, NULL),
  (10, 'Paneer Butter Masala', 'Veg Main Course', 249, true, 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80', 'Paneer in rich tomato-butter gravy.', false, NULL),
  (11, 'Mix Veg', 'Veg Main Course', 199, true, 'https://mrfoods.ca/assets/menu/mix-veg.webp', 'Seasonal vegetables in mild onion-tomato masala.', false, NULL),
  (12, 'Palak Paneer', 'Veg Main Course', 229, true, 'https://b.zmtcdn.com/data/dish_photos/e9a/d84ad822987988e99c2ff4404501ae9a.jpg', 'Paneer cubes in creamy spinach gravy.', false, NULL),
  (13, 'Veg Kolhapuri', 'Veg Main Course', 219, true, 'https://www.cookingcarnival.com/wp-content/uploads/2015/05/Veg-Kolhapuri-4-768x768.webp', 'Spicy mixed veg, Kolhapuri masala.', false, NULL),
  (14, 'Malai Kofta', 'Veg Main Course', 259, true, 'https://www.cookwithmanali.com/wp-content/uploads/2020/03/Malai-Kofta.jpg', 'Soft paneer kofta in creamy cashew gravy.', false, NULL),
  (15, 'Chana Masala', 'Veg Main Course', 189, true, 'https://cloverstatic.com/menu-assets/items/0Y1RD4Y1ADP08.jpeg', 'Chickpeas simmered in tangy masala.', false, NULL),
  (16, 'Bhindi Masala', 'Veg Main Course', 179, true, 'https://cloverstatic.com/menu-assets/items/JR0T365ZNECZP.jpeg', 'Okra tossed with onion, tomato and spices.', false, NULL),
  (17, 'Butter Chicken', 'Non-Veg Main Course', 329, false, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80', 'Tandoori chicken in silky tomato-butter gravy.', true, 5),
  (18, 'Chicken Curry', 'Non-Veg Main Course', 299, false, 'https://www.theloveofspice.com/wp-content/uploads/2022/04/indian-chicken-curry.jpg', 'Home-style chicken curry, onion-tomato base.', false, NULL),
  (19, 'Mutton Rogan Josh', 'Non-Veg Main Course', 399, false, 'https://www.whiskaffair.com/wp-content/uploads/2019/02/Mutton-Rogan-Josh-2-1.jpg', 'Slow-cooked mutton in Kashmiri chilli gravy.', false, NULL),
  (20, 'Egg Curry', 'Non-Veg Main Course', 199, false, 'https://images.slurrp.com/webstories/wp-content/uploads/2024/02/egg-curry.jpg', 'Boiled eggs in spicy onion-tomato masala.', false, NULL),
  (21, 'Fish Curry', 'Non-Veg Main Course', 349, false, 'https://www.dhungrymug.com/_next/image?url=https%3A%2F%2Fcdn.dhungrymug.com%2Fdishes%2F019e9a48-4c51-7bc3-907d-5d78686b1c58.png&w=828&q=75', 'Fish simmered in tangy coastal curry.', false, NULL),
  (22, 'Chicken Korma', 'Non-Veg Main Course', 319, false, 'https://www.jewelofasia.com.au/cdn/shop/files/chicken-korma.jpg?v=1754608918&width=750', 'Mild, creamy chicken korma with cashew.', false, NULL),
  (23, 'Keema Matar', 'Non-Veg Main Course', 289, false, 'https://glebekitchen.com/wp-content/uploads/2017/12/keemamatartopbowl-759x1024.jpg', 'Minced mutton with green peas.', false, NULL),
  (24, 'Tandoori Chicken (Half)', 'Non-Veg Main Course', 329, false, 'https://ministryofcurry.com/wp-content/uploads/2016/07/final-5.jpg', 'Char-grilled half chicken, tandoor marinade.', false, NULL),
  (25, 'Butter Naan', 'Breads', 49, true, 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=800&q=80', 'Soft tandoor naan brushed with butter.', false, NULL),
  (26, 'Garlic Naan', 'Breads', 59, true, 'https://b.zmtcdn.com/data/dish_photos/c02/f48506490e41c642e85f7e0ef6929c02.jpeg', 'Naan topped with garlic and coriander.', false, NULL),
  (27, 'Butter Roti', 'Breads', 29, true, 'https://b.zmtcdn.com/data/dish_photos/f88/2bdd6bced071ed1f2e74dfe96d5b1f88.jpeg', 'Whole-wheat tandoor roti with butter.', false, NULL),
  (28, 'Cheese Naan', 'Breads', 79, true, 'https://tb-static.uber.com/prod/image-proc/processed_images/232fc91c94c3d6f51d5f7f63cb48b010/d03e52b3c8af19d8fa8222e23efd9cfa.jpeg', 'Naan stuffed with melted cheese.', false, NULL),
  (29, 'Laccha Paratha', 'Breads', 59, true, 'https://tikkaways.ca/wp-content/uploads/2024/02/Laccha-Paratha-.png', 'Flaky multi-layer whole-wheat paratha.', false, NULL),
  (30, 'Missi Roti', 'Breads', 39, true, 'https://www.cookwithmanali.com/wp-content/uploads/2018/08/Missi-Roti-Recipe.jpg', 'Gram-flour roti with spices.', false, NULL),
  (31, 'Veg Biryani', 'Rice & Biryani', 219, true, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80', 'Fragrant basmati, veg and biryani masala, raita.', false, NULL),
  (32, 'Chicken Biryani', 'Rice & Biryani', 279, false, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80', 'Dum chicken biryani with raita and salad.', false, NULL),
  (33, 'Mutton Biryani', 'Rice & Biryani', 349, false, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80', 'Dum mutton biryani, saffron and fried onion.', false, NULL),
  (34, 'Jeera Rice', 'Rice & Biryani', 149, true, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80', 'Basmati tempered with cumin.', false, NULL),
  (35, 'Veg Fried Rice', 'Rice & Biryani', 189, true, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80', 'Indo-Chinese fried rice with veg.', false, NULL),
  (36, 'Egg Biryani', 'Rice & Biryani', 229, false, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80', 'Dum biryani layered with masala eggs.', false, NULL),
  (37, 'Gulab Jamun (2 pc)', 'Desserts', 89, true, 'https://tb-static.uber.com/prod/image-proc/processed_images/4fb4e3d13ac4c82da7daae2a20167895/c67fc65e9b4e16a553eb7574fba090f1.jpeg', 'Hot syrup-soaked gulab jamun.', true, 5),
  (38, 'Rasgulla (2 pc)', 'Desserts', 79, true, 'https://www.yummytummyaarthi.com/wp-content/uploads/2022/01/rasgulla-39.jpeg', 'Soft spongy rasgulla in light syrup.', false, NULL),
  (39, 'Kulfi', 'Desserts', 99, true, 'https://aws.cricketmedia.com/media/20210413133329/kulfi-768x512.jpg', 'Dense malai kulfi, pistachio.', false, NULL),
  (40, 'Ice Cream (Vanilla)', 'Desserts', 79, true, 'https://www.eatthis.com/wp-content/uploads/sites/4/2019/11/vanilla-ice-cream-scoop.jpg?quality=82&strip=all&w=767&h=449&crop=1', 'Vanilla ice cream scoop.', false, NULL),
  (41, 'Rasmalai', 'Desserts', 119, true, 'https://www.cookclickndevour.com/wp-content/uploads/2017/08/rasmalai-recipe-b-683x1024.jpg', 'Chenna discs in saffron milk.', false, NULL),
  (42, 'Kheer', 'Desserts', 99, true, 'https://masalaandchai.com/wp-content/uploads/2021/08/Kheer.jpg', 'Rice pudding with cardamom.', false, NULL),
  (43, 'Sweet Lassi', 'Beverages', 69, true, 'https://cloverstatic.com/menu-assets/items/RSBNJH4GCPHY0.jpeg', 'Thick sweet curd lassi.', false, NULL),
  (44, 'Salted Lassi', 'Beverages', 59, true, 'https://b.zmtcdn.com/data/dish_photos/dea/9ce6052f2ce4125c21d3fd2db6044dea.jpeg', 'Light salted lassi with roasted jeera.', false, NULL),
  (45, 'Mango Lassi', 'Beverages', 89, true, 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?auto=format&fit=crop&w=800&q=80', 'Mango pulp blended with curd.', false, NULL),
  (46, 'Fresh Lime Soda', 'Beverages', 59, true, 'https://b.zmtcdn.com/data/dish_photos/628/1048730c25bb7efad772a01db3bed628.jpeg', 'Lime, soda, salt or sweet.', false, NULL),
  (47, 'Masala Chaas', 'Beverages', 49, true, 'https://www.cookwithmanali.com/wp-content/uploads/2017/06/Indian-Masala-Chaas.jpg', 'Spiced buttermilk.', false, NULL),
  (48, 'Mineral Water (1L)', 'Beverages', 30, true, 'https://moicuisine.com/wp-content/smush-webp/2025/02/5436_main-333x397.jpg.webp', 'Sealed 1-litre mineral water bottle.', false, NULL),
  (49, 'Cold Drink (200 ml)', 'Cold Drinks', 25, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80', 'Chilled soft drink, 200 ml bottle.', false, NULL),
  (50, 'Cold Drink (300 ml)', 'Cold Drinks', 40, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80', 'Chilled soft drink, 300 ml bottle.', false, NULL),
  (51, 'Cold Drink (750 ml)', 'Cold Drinks', 60, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80', 'Chilled soft drink, 750 ml bottle.', false, NULL),
  (52, 'Cold Drink (1 L)', 'Cold Drinks', 80, true, 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80', 'Chilled soft drink, 1-litre bottle.', false, NULL),
  (53, 'Kulhad Masala Chai', 'Tea & Coffee', 30, true, 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?auto=format&fit=crop&w=800&q=80', 'Masala chai served in a kulhad.', false, NULL),
  (54, 'Green Tea', 'Tea & Coffee', 40, true, 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=800&q=80', 'Light green tea.', false, NULL),
  (55, 'Lemon Tea', 'Tea & Coffee', 35, true, 'https://cdn2.stylecraze.com/wp-content/uploads/2015/03/Regular-Lemon-Tea.jpg.webp', 'Tea with fresh lemon.', false, NULL),
  (56, 'Hot Coffee', 'Tea & Coffee', 60, true, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80', 'Freshly brewed hot coffee.', false, NULL),
  (57, 'Cold Coffee', 'Tea & Coffee', 99, true, 'https://thefoodiebunch.sfo3.digitaloceanspaces.com/wp-content/uploads/2025/09/27065145/Classic-Iced-Coffee.png', 'Iced coffee blended with milk.', false, NULL),
  (58, 'Cappuccino', 'Tea & Coffee', 99, true, 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=800&q=80', 'Espresso with steamed milk foam.', false, NULL),
  (59, 'Espresso', 'Tea & Coffee', 79, true, 'https://carmelcoffeecatering.com/wp-content/uploads/2025/05/shot-of-espresso.png', 'Strong single-shot espresso.', false, NULL)
  (60, 'Sprite (750 ml)', 'Cold Drinks', 60, true, 'https://genuinebazaar.com/wp-content/uploads/2021/08/c46.-SPRITE-750-ML-PK24.jpg', 'Chilled Sprite, 750 ml bottle.', false, NULL),
  (61, 'Mountain Dew (750 ml)', 'Cold Drinks', 60, true, 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Mountain_Dew_Flasche_%28cropped%29.jpg/960px-Mountain_Dew_Flasche_%28cropped%29.jpg', 'Chilled Mountain Dew, 750 ml bottle.', false, NULL),
  (62, 'Limca (750 ml)', 'Cold Drinks', 60, true, 'https://www.mystore.in/s/62ea2c599d1398fa16dbae0a/g/680b572ad91f9b23ad9dcf88/8901764052309_f.jpg', 'Chilled Limca, 750 ml bottle.', false, NULL),
  (63, 'Coca-Cola (750 ml)', 'Cold Drinks', 60, true, 'https://useworkshop.com/wp-content/uploads/2026/07/large-coke-scaled.png', 'Chilled Coca-Cola, 750 ml bottle.', false, NULL),
  (64, 'Pepsi (750 ml)', 'Cold Drinks', 60, true, 'https://images.deliveryhero.io/image/hungerstation/product/image/1421909?width=1440&quality=75&webp=true', 'Chilled Pepsi, 750 ml bottle.', false, NULL),
  (65, 'Fanta (750 ml)', 'Cold Drinks', 60, true, 'https://img.postershop.me/29884/391b7e16-981a-4372-9264-f9ff0ada8df3_image.jpeg', 'Chilled Fanta, 750 ml bottle.', false, NULL),
  (66, 'Thums Up (750 ml)', 'Cold Drinks', 60, true, 'https://osmankiranastore.in/api/files/osman-kirana/products/b2d03589fe.png', 'Chilled Thums Up, 750 ml bottle.', false, NULL),
  (67, 'Red Bull (250 ml)', 'Cold Drinks', 125, true, 'https://pizzawaves.com.au/images/red-bull-can.png', 'Red Bull energy drink, 250 ml can.', false, NULL),
  (68, 'Maaza Mango (1 L)', 'Cold Drinks', 80, true, 'https://punjabigrocery.ca/wp-content/uploads/2026/07/maaza_1_2l-1.jpg', 'Maaza mango drink, 1-litre bottle.', false, NULL)
  on conflict (id) do nothing;

select pg_catalog.setval(pg_get_serial_sequence('menu_items','id'), (select max(id) from menu_items));
