// Seed menu — 59 dishes. Prices in INR. GST is 5% (computed at checkout).
// Photos are free Unsplash image URLs (no local binary assets).
// Top-rated dishes (from real guest ratings in the demo) are flagged
// so the customer slideshow can lead with them.
const U = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

export const GST_RATE = 0.05;
export const TABLES = ['T1', 'T2', 'T3', 'T4'];

export const MENU = [
  // ---- Starters (8) ----
  { id: 1, name: 'Paneer Tikka Angara', category: 'Starters', price: 249, veg: true, topRated: true, rating: 5.0, img: U('photo-1606491956689-2ea866880c84'), desc: 'Smoky char-grilled paneer, peppers and spicy angara masala.' },
  { id: 2, name: 'Veg Samosa (2 pc)', category: 'Starters', price: 79, veg: true, img: U('photo-1601050690597-df0568f70950'), desc: 'Crisp pastry, spiced potato-pea filling, mint chutney.' },
  { id: 3, name: 'Chicken Tikka', category: 'Starters', price: 279, veg: false, img: U('photo-1599487488170-d11ec9c172f0'), desc: 'Tandoor-roasted chicken tikka with onion rings and lemon.' },
  { id: 4, name: 'Hara Bhara Kebab', category: 'Starters', price: 199, veg: true, img: U('photo-1601050690597-df0568f70950'), desc: 'Spinach, peas and potato kebabs, pan-fried crisp.' },
  { id: 5, name: 'Fish Amritsari', category: 'Starters', price: 299, veg: false, img: U('photo-1555939594-58d7cb561ad1'), desc: 'Ajwain-batter fried fish, Amritsari style.' },
  { id: 6, name: 'Spring Rolls', category: 'Starters', price: 179, veg: true, img: U('photo-1546833999-b9f581a1996d'), desc: 'Crunchy veg spring rolls with sweet chilli dip.' },
  { id: 7, name: 'Chilli Paneer', category: 'Starters', price: 229, veg: true, img: U('photo-1565557623262-b51c2513a641'), desc: 'Indo-Chinese paneer tossed with peppers and soy.' },
  { id: 8, name: 'Chicken 65', category: 'Starters', price: 259, veg: false, img: U('photo-1569058242253-92a9c755a0ec'), desc: 'Fiery South Indian fried chicken with curry leaves.' },
  // ---- Veg Main Course (8) ----
  { id: 9, name: 'Dal Makhani', category: 'Veg Main Course', price: 219, veg: true, img: U('photo-1546833999-b9f581a1996d'), desc: 'Slow-cooked black dal, butter and cream.' },
  { id: 10, name: 'Paneer Butter Masala', category: 'Veg Main Course', price: 249, veg: true, img: U('photo-1565557623262-b51c2513a641'), desc: 'Paneer in rich tomato-butter gravy.' },
  { id: 11, name: 'Mix Veg', category: 'Veg Main Course', price: 199, veg: true, img: U('photo-1512058564366-18510be2db19'), desc: 'Seasonal vegetables in mild onion-tomato masala.' },
  { id: 12, name: 'Palak Paneer', category: 'Veg Main Course', price: 229, veg: true, img: U('photo-1585937421612-70a008356fbe'), desc: 'Paneer cubes in creamy spinach gravy.' },
  { id: 13, name: 'Veg Kolhapuri', category: 'Veg Main Course', price: 219, veg: true, img: U('photo-1565557623262-b51c2513a641'), desc: 'Spicy mixed veg, Kolhapuri masala.' },
  { id: 14, name: 'Malai Kofta', category: 'Veg Main Course', price: 259, veg: true, img: U('photo-1546833999-b9f581a1996d'), desc: 'Soft paneer kofta in creamy cashew gravy.' },
  { id: 15, name: 'Chana Masala', category: 'Veg Main Course', price: 189, veg: true, img: U('photo-1512058564366-18510be2db19'), desc: 'Chickpeas simmered in tangy masala.' },
  { id: 16, name: 'Bhindi Masala', category: 'Veg Main Course', price: 179, veg: true, img: U('photo-1585937421612-70a008356fbe'), desc: 'Okra tossed with onion, tomato and spices.' },
  // ---- Non-Veg Main Course (8) ----
  { id: 17, name: 'Butter Chicken', category: 'Non-Veg Main Course', price: 329, veg: false, topRated: true, rating: 5.0, img: U('photo-1585937421612-70a008356fbe'), desc: 'Tandoori chicken in silky tomato-butter gravy.' },
  { id: 18, name: 'Chicken Curry', category: 'Non-Veg Main Course', price: 299, veg: false, img: U('photo-1599487488170-d11ec9c172f0'), desc: 'Home-style chicken curry, onion-tomato base.' },
  { id: 19, name: 'Mutton Rogan Josh', category: 'Non-Veg Main Course', price: 399, veg: false, img: U('photo-1544025162-d76694265947'), desc: 'Slow-cooked mutton in Kashmiri chilli gravy.' },
  { id: 20, name: 'Egg Curry', category: 'Non-Veg Main Course', price: 199, veg: false, img: U('photo-1603360946369-dc9bb6258143'), desc: 'Boiled eggs in spicy onion-tomato masala.' },
  { id: 21, name: 'Fish Curry', category: 'Non-Veg Main Course', price: 349, veg: false, img: U('photo-1555939594-58d7cb561ad1'), desc: 'Fish simmered in tangy coastal curry.' },
  { id: 22, name: 'Chicken Korma', category: 'Non-Veg Main Course', price: 319, veg: false, img: U('photo-1599487488170-d11ec9c172f0'), desc: 'Mild, creamy chicken korma with cashew.' },
  { id: 23, name: 'Keema Matar', category: 'Non-Veg Main Course', price: 289, veg: false, img: U('photo-1544025162-d76694265947'), desc: 'Minced mutton with green peas.' },
  { id: 24, name: 'Tandoori Chicken (Half)', category: 'Non-Veg Main Course', price: 329, veg: false, img: U('photo-1603360946369-dc9bb6258143'), desc: 'Char-grilled half chicken, tandoor marinade.' },
  // ---- Breads (6) ----
  { id: 25, name: 'Butter Naan', category: 'Breads', price: 49, veg: true, img: U('photo-1630383249896-424e482df921'), desc: 'Soft tandoor naan brushed with butter.' },
  { id: 26, name: 'Garlic Naan', category: 'Breads', price: 59, veg: true, img: U('photo-1630383249896-424e482df921'), desc: 'Naan topped with garlic and coriander.' },
  { id: 27, name: 'Butter Roti', category: 'Breads', price: 29, veg: true, img: U('photo-1630383249896-424e482df921'), desc: 'Whole-wheat tandoor roti with butter.' },
  { id: 28, name: 'Cheese Naan', category: 'Breads', price: 79, veg: true, img: U('photo-1630383249896-424e482df921'), desc: 'Naan stuffed with melted cheese.' },
  { id: 29, name: 'Laccha Paratha', category: 'Breads', price: 59, veg: true, img: U('photo-1630383249896-424e482df921'), desc: 'Flaky multi-layer whole-wheat paratha.' },
  { id: 30, name: 'Missi Roti', category: 'Breads', price: 39, veg: true, img: U('photo-1630383249896-424e482df921'), desc: 'Gram-flour roti with spices.' },
  // ---- Rice & Biryani (6) ----
  { id: 31, name: 'Veg Biryani', category: 'Rice & Biryani', price: 219, veg: true, img: U('photo-1589302168068-964664d93dc0'), desc: 'Fragrant basmati, veg and biryani masala, raita.' },
  { id: 32, name: 'Chicken Biryani', category: 'Rice & Biryani', price: 279, veg: false, img: U('photo-1589302168068-964664d93dc0'), desc: 'Dum chicken biryani with raita and salad.' },
  { id: 33, name: 'Mutton Biryani', category: 'Rice & Biryani', price: 349, veg: false, img: U('photo-1589302168068-964664d93dc0'), desc: 'Dum mutton biryani, saffron and fried onion.' },
  { id: 34, name: 'Jeera Rice', category: 'Rice & Biryani', price: 149, veg: true, img: U('photo-1512058564366-18510be2db19'), desc: 'Basmati tempered with cumin.' },
  { id: 35, name: 'Veg Fried Rice', category: 'Rice & Biryani', price: 189, veg: true, img: U('photo-1563379091339-03b21ab4a4f8'), desc: 'Indo-Chinese fried rice with veg.' },
  { id: 36, name: 'Egg Biryani', category: 'Rice & Biryani', price: 229, veg: false, img: U('photo-1589302168068-964664d93dc0'), desc: 'Dum biryani layered with masala eggs.' },
  // ---- Desserts (6) ----
  { id: 37, name: 'Gulab Jamun (2 pc)', category: 'Desserts', price: 89, veg: true, topRated: true, rating: 5.0, img: U('photo-1551024506-0bccd828d307'), desc: 'Hot syrup-soaked gulab jamun.' },
  { id: 38, name: 'Rasgulla (2 pc)', category: 'Desserts', price: 79, veg: true, img: U('photo-1551024506-0bccd828d307'), desc: 'Soft spongy rasgulla in light syrup.' },
  { id: 39, name: 'Kulfi', category: 'Desserts', price: 99, veg: true, img: U('photo-1565958011703-44f9829ba187'), desc: 'Dense malai kulfi, pistachio.' },
  { id: 40, name: 'Ice Cream (Vanilla)', category: 'Desserts', price: 79, veg: true, img: U('photo-1567620905732-2d1ec7ab7445'), desc: 'Vanilla ice cream scoop.' },
  { id: 41, name: 'Rasmalai', category: 'Desserts', price: 119, veg: true, img: U('photo-1551024506-0bccd828d307'), desc: 'Chenna discs in saffron milk.' },
  { id: 42, name: 'Kheer', category: 'Desserts', price: 99, veg: true, img: U('photo-1565958011703-44f9829ba187'), desc: 'Rice pudding with cardamom.' },
  // ---- Beverages (6) ----
  { id: 43, name: 'Sweet Lassi', category: 'Beverages', price: 69, veg: true, img: U('photo-1626200419199-391ae4be7a41'), desc: 'Thick sweet curd lassi.' },
  { id: 44, name: 'Salted Lassi', category: 'Beverages', price: 59, veg: true, img: U('photo-1626200419199-391ae4be7a41'), desc: 'Light salted lassi with roasted jeera.' },
  { id: 45, name: 'Mango Lassi', category: 'Beverages', price: 89, veg: true, img: U('photo-1626200419199-391ae4be7a41'), desc: 'Mango pulp blended with curd.' },
  { id: 46, name: 'Fresh Lime Soda', category: 'Beverages', price: 59, veg: true, img: U('photo-1544148103-0773bf10d330'), desc: 'Lime, soda, salt or sweet.' },
  { id: 47, name: 'Masala Chaas', category: 'Beverages', price: 49, veg: true, img: U('photo-1626200419199-391ae4be7a41'), desc: 'Spiced buttermilk.' },
  { id: 48, name: 'Mineral Water (1L)', category: 'Beverages', price: 30, veg: true, img: U('photo-1544148103-0773bf10d330'), desc: 'Sealed 1-litre mineral water bottle.' },
  // ---- Cold Drinks (4) ----
  { id: 49, name: 'Cold Drink (200 ml)', category: 'Cold Drinks', price: 25, veg: true, img: U('photo-1554866585-cd94860890b7'), desc: 'Chilled soft drink, 200 ml bottle.' },
  { id: 50, name: 'Cold Drink (300 ml)', category: 'Cold Drinks', price: 40, veg: true, img: U('photo-1554866585-cd94860890b7'), desc: 'Chilled soft drink, 300 ml bottle.' },
  { id: 51, name: 'Cold Drink (750 ml)', category: 'Cold Drinks', price: 60, veg: true, img: U('photo-1554866585-cd94860890b7'), desc: 'Chilled soft drink, 750 ml bottle.' },
  { id: 52, name: 'Cold Drink (1 L)', category: 'Cold Drinks', price: 80, veg: true, img: U('photo-1554866585-cd94860890b7'), desc: 'Chilled soft drink, 1-litre bottle.' },
  // ---- Tea & Coffee (7) ----
  { id: 53, name: 'Kulhad Masala Chai', category: 'Tea & Coffee', price: 30, veg: true, img: U('photo-1571934811356-5cc061b6821f'), desc: 'Masala chai served in a kulhad.' },
  { id: 54, name: 'Green Tea', category: 'Tea & Coffee', price: 40, veg: true, img: U('photo-1572442388796-11668a67e53d'), desc: 'Light green tea.' },
  { id: 55, name: 'Lemon Tea', category: 'Tea & Coffee', price: 35, veg: true, img: U('photo-1572442388796-11668a67e53d'), desc: 'Tea with fresh lemon.' },
  { id: 56, name: 'Hot Coffee', category: 'Tea & Coffee', price: 60, veg: true, img: U('photo-1509042239860-f550ce710b93'), desc: 'Freshly brewed hot coffee.' },
  { id: 57, name: 'Cold Coffee', category: 'Tea & Coffee', price: 99, veg: true, img: U('photo-1541167760496-1628856ab772'), desc: 'Iced coffee blended with milk.' },
  { id: 58, name: 'Cappuccino', category: 'Tea & Coffee', price: 99, veg: true, img: U('photo-1541167760496-1628856ab772'), desc: 'Espresso with steamed milk foam.' },
  { id: 59, name: 'Espresso', category: 'Tea & Coffee', price: 79, veg: true, img: U('photo-1509042239860-f550ce710b93'), desc: 'Strong single-shot espresso.' }
];

export const CATEGORIES = [...new Set(MENU.map((m) => m.category))];
