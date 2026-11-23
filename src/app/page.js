'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { MENU, CATEGORIES, GST_RATE, TABLES } from '../lib/menu';

const STEPS = ['placed', 'verified', 'sent_to_chef', 'preparing', 'ready', 'served'];
const STEP_LABELS = { placed: 'Order placed', verified: 'Verified', sent_to_chef: 'Sent to Chef', preparing: 'Preparing', ready: 'Ready', served: 'Served' };
const STATUS_LABEL = { placed: 'Placed', verified: 'Verified', rejected: 'Rejected', sent_to_chef: 'Sent to Chef', preparing: 'Preparing', ready: 'Ready', served: 'Served / Completed' };
const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const waitMins = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

// --- Order rings (Web Audio, no sound file needed). Browsers block audio until
// the user has tapped/clicked once, so the context is unlocked on first gesture. ---
let sharedCtx = null;
function getCtx() {
  try {
    if (!sharedCtx) { const Ctx = window.AudioContext || window.webkitAudioContext; sharedCtx = new Ctx(); }
    if (sharedCtx.state === 'suspended') sharedCtx.resume();
    return sharedCtx;
  } catch { return null; }
}
function tone(ctx, freq, start, dur, vol) {
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(ctx.currentTime + start); o.stop(ctx.currentTime + start + dur + 0.05);
}
// Waiter: order Ready — 2-tone chime
function chime() { const ctx = getCtx(); if (!ctx) return; [880, 1174].forEach((f, i) => tone(ctx, f, i * 0.18, 0.25, 0.15)); }
// Manager + Chef: new order arrived — 3-tone ring
function ringOrder() { const ctx = getCtx(); if (!ctx) return; [660, 880, 1100].forEach((f, i) => tone(ctx, f, i * 0.22, 0.22, 0.2)); }

function HomeInner() {
  const params = useSearchParams();
  const [view, setView] = useState('customer');
  const [table, setTable] = useState('');
  const [menu, setMenu] = useState(MENU);
  const [orders, setOrders] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [cart, setCart] = useState({}); // dishId -> qty
  const [name, setName] = useState('');
  const [payment, setPayment] = useState('UPI');
  const [myOrderId, setMyOrderId] = useState(null);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cat, setCat] = useState('All');
  const [notice, setNotice] = useState('');
  const [mgrSearch, setMgrSearch] = useState('');
  const [histDate, setHistDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [custTab, setCustTab] = useState('menu');
  const [sideOpen, setSideOpen] = useState(false);
  const [newDish, setNewDish] = useState({ name: '', category: 'Starters', price: '', img: '' });
  const [soundOn, setSoundOn] = useState(true);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [mgrChatTable, setMgrChatTable] = useState('');
  const [mgrChatInput, setMgrChatInput] = useState('');
  const prevIds = useRef({ all: new Set(), chef: new Set(), ready: new Set(), init: false });
  const prevChatCount = useRef(0);
  const chatBoxRef = useRef(null);
  const firstLoadDone = useRef(false);

  // --- Separate links: ?table=T1..T4 locks to Customer, ?view=manager/chef/waiter/customer locks to that page ---
  // A customer who scanned a table QR must never see the staff switcher.
  // Each role has its own link: /?table=T1 (customer), /?view=manager, /?view=chef, /?view=waiter.
  // Plain / with no params still shows the switcher (for testing).
  const tableParam = (params.get('table') || '').toUpperCase();
  const isCustomerLocked = TABLES.includes(tableParam);
  // Separate links: ?view=manager / chef / waiter / customer also lock to that page only.
  const viewParam = (params.get('view') || '').toLowerCase();
  const isViewLocked = ['customer', 'manager', 'chef', 'waiter'].includes(viewParam);
  const isLocked = isCustomerLocked || isViewLocked;
  useEffect(() => {
    const t = tableParam;
    if (TABLES.includes(t)) setTable(t);
    if (TABLES.includes(t)) { setView('customer'); return; }
    const v = (params.get('view') || '').toLowerCase();
    if (['customer', 'manager', 'chef', 'waiter'].includes(v)) setView(v);
  }, [params, tableParam]);

  const fetchData = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: m } = await supabase.from('menu_items').select('*').order('id');
      if (m && m.length) setMenu(m.map((x) => ({ id: x.id, name: x.name, category: x.category, price: Number(x.price), veg: x.veg, img: x.image_url, desc: x.description || '', available: x.available !== false, topRated: x.top_rated, rating: x.rating || null })));
      const { data: o } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      const { data: oi } = await supabase.from('order_items').select('*');
      if (o) {
        const byOrder = {};
        (oi || []).forEach((it) => { (byOrder[it.order_id] = byOrder[it.order_id] || []).push({ id: it.menu_item_id, name: it.name, price: Number(it.price), qty: it.qty }); });
        setOrders(o.map((x) => ({ id: x.id, table: x.table_no, name: x.customer_name, paymentMethod: x.payment_method, paymentStatus: x.payment_status, status: x.status, total: Number(x.total), createdAt: x.created_at, items: byOrder[x.id] || [] })));
        firstLoadDone.current = true;
      }
      const { data: r } = await supabase.from('ratings').select('*');
      if (r) setRatings(r.map((x) => ({ orderId: x.order_id, stars: x.stars, feedback: x.feedback })));
      const { data: cm } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true });
      if (cm) {
        const mapped = cm.map((x) => ({ id: x.id, table: x.table_no, sender: x.sender, senderName: x.sender_name, text: x.message, readByManager: x.read_by_manager, readByCustomer: x.read_by_customer, createdAt: x.created_at }));
        // Delete-after-seen: once a table's visit is complete (it has orders
        // and none are active), drop the messages the reader has already
        // seen, so the chat box refreshes for the next guest. Unseen
        // messages stay until the manager/customer actually reads them.
        const doneTables = new Set();
        TABLES.forEach((t) => {
          const tOrders = (o || []).filter((x) => x.table_no === t);
          if (tOrders.length && tOrders.every((x) => ['served', 'rejected'].includes(x.status))) doneTables.add(t);
        });
        const isSeen = (m) => m.sender === 'customer' ? m.readByManager : m.readByCustomer;
        const seenIds = mapped.filter((m) => doneTables.has(m.table) && isSeen(m)).map((m) => m.id);
        setMessages(mapped.filter((m) => !(doneTables.has(m.table) && isSeen(m))));
        if (seenIds.length) supabase.from('chat_messages').delete().in('id', seenIds).then(() => {});
      }
    } catch { /* offline / not configured yet — local fallback stays */ }
  }, []);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 3000); return () => clearInterval(t); }, [fetchData]);

  // Supabase Realtime (polling above is the fallback)
  useEffect(() => {
    if (!supabase) return;
    let ch;
    try {
      ch = supabase.channel('orders-live').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData).subscribe();
    } catch { /* realtime unavailable — polling covers it */ }
    return () => { try { if (ch) supabase.removeChannel(ch); } catch {} };
  }, [fetchData]);

  // Unlock audio on first tap/click so order rings can play
  useEffect(() => {
    const unlock = () => getCtx();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  // Order rings: Manager rings on a new order, Chef rings when an order is
  // sent to the kitchen, Waiter chimes when an order becomes Ready.
  // First data load only sets the baseline — it never rings.
  useEffect(() => {
    if (!firstLoadDone.current) return;
    const all = new Set(orders.map((o) => String(o.id)));
    const chef = new Set(orders.filter((o) => o.status === 'sent_to_chef').map((o) => String(o.id)));
    const ready = new Set(orders.filter((o) => o.status === 'ready').map((o) => String(o.id)));
    if (!prevIds.current.init) { prevIds.current = { all, chef, ready, init: true }; return; }
    if (soundOn) {
      if (view === 'manager' && [...all].some((id) => !prevIds.current.all.has(id))) ringOrder();
      if (view === 'chef' && [...chef].some((id) => !prevIds.current.chef.has(id))) ringOrder();
      if (view === 'waiter' && [...ready].some((id) => !prevIds.current.ready.has(id))) chime();
    }
    prevIds.current = { all, chef, ready, init: true };
  }, [orders, view, soundOn]);

  // Chat: a new customer message rings for the manager, like a new order.
  useEffect(() => {
    const count = messages.filter((m) => m.sender === 'customer').length;
    if (!firstLoadDone.current) return;
    if (prevChatCount.current && count > prevChatCount.current && view === 'manager' && soundOn) ringOrder();
    prevChatCount.current = count;
  }, [messages, view, soundOn]);

  // Chat: keep the message list scrolled to the latest message.
  useEffect(() => {
    const el = chatBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, custTab, mgrChatTable]);

  // Chat: opening the chat marks the other side's messages as read.
  useEffect(() => {
    if (custTab !== 'chat' || !table) return;
    const unread = messages.filter((m) => m.table === table && m.sender === 'manager' && !m.readByCustomer);
    if (!unread.length) return;
    setMessages((ms) => ms.map((m) => (m.table === table && m.sender === 'manager' ? { ...m, readByCustomer: true } : m)));
    if (supabase) supabase.from('chat_messages').update({ read_by_customer: true }).eq('table_no', table).eq('sender', 'manager').eq('read_by_customer', false).then(() => {});
  }, [custTab, messages, table]);

  useEffect(() => {
    if (view !== 'manager' || !mgrChatTable) return;
    const unread = messages.filter((m) => m.table === mgrChatTable && m.sender === 'customer' && !m.readByManager);
    if (!unread.length) return;
    setMessages((ms) => ms.map((m) => (m.table === mgrChatTable && m.sender === 'customer' ? { ...m, readByManager: true } : m)));
    if (supabase) supabase.from('chat_messages').update({ read_by_manager: true }).eq('table_no', mgrChatTable).eq('sender', 'customer').eq('read_by_manager', false).then(() => {});
  }, [view, messages, mgrChatTable]);

  const highlights = useMemo(() => {
    const rated = [...menu].filter((d) => d.available !== false);
    const top = rated.filter((d) => d.topRated || (d.rating && d.rating >= 5));
    const rest = rated.filter((d) => !top.includes(d));
    return [...top, ...rest].slice(0, 6);
  }, [menu]);

  useEffect(() => {
    if (paused || !highlights.length) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % highlights.length), 5000);
    return () => clearInterval(t);
  }, [paused, highlights.length]);

  const cartItems = useMemo(() => Object.entries(cart).map(([id, qty]) => ({ dish: menu.find((d) => String(d.id) === String(id)), qty })).filter((x) => x.dish && x.qty > 0), [cart, menu]);
  const subtotal = cartItems.reduce((s, x) => s + x.dish.price * x.qty, 0);
  const gst = Math.round(subtotal * GST_RATE);
  const total = subtotal + gst;
  const addToCart = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const setQty = (id, q) => setCart((c) => { const n = { ...c }; if (q <= 0) delete n[id]; else n[id] = q; return n; });

  async function placeOrder() {
    if (!table) { setNotice('Please choose your table first (T1–T4).'); return; }
    if (!cartItems.length) { setNotice('Your cart is empty — add a dish first.'); return; }
    const items = cartItems.map((x) => ({ id: x.dish.id, name: x.dish.name, price: x.dish.price, qty: x.qty }));
    const base = { table, name: name || 'Guest', paymentMethod: payment, paymentStatus: payment === 'Cash' ? 'pending' : 'pending', status: 'placed', total, createdAt: new Date().toISOString(), items };
    if (supabase) {
      const { data, error } = await supabase.from('orders').insert({ table_no: table, customer_name: base.name, payment_method: payment, payment_status: 'pending', status: 'placed', total }).select().single();
      if (!error && data) {
        await supabase.from('order_items').insert(items.map((it) => ({ order_id: data.id, menu_item_id: it.id, name: it.name, price: it.price, qty: it.qty })));
        setMyOrderId(data.id); setOrders((o) => [{ ...base, id: data.id }, ...o]);
      } else { setMyOrderId(`local-${Date.now()}`); setOrders((o) => [{ ...base, id: `local-${Date.now()}` }, ...o]); }
    } else {
      const id = `local-${Date.now()}`;
      setMyOrderId(id); setOrders((o) => [{ ...base, id }, ...o]);
    }
    setCart({}); setNotice('Order placed! Track it live below.');
  }

  async function updateOrder(id, patch) {
    setOrders((os) => os.map((o) => String(o.id) === String(id) ? { ...o, ...patch } : o));
    if (supabase && !String(id).startsWith('local-')) {
      const db = {};
      if (patch.status) db.status = patch.status;
      if (patch.paymentStatus) db.payment_status = patch.paymentStatus;
      if (Object.keys(db).length) await supabase.from('orders').update(db).eq('id', id);
    }
  }

  async function submitRating(orderId, stars, feedback) {
    if (supabase) await supabase.from('ratings').insert({ order_id: String(orderId), stars, feedback });
    setRatings((r) => [...r, { orderId, stars, feedback }]);
  }

  // --- Customer <-> Manager chat (one thread per table) ---
  function appendChatMsg(row) {
    setMessages((ms) => ms.some((x) => String(x.id) === String(row.id)) ? ms : [...ms, row]);
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || !table) return;
    setChatInput('');
    if (supabase) {
      const { data } = await supabase.from('chat_messages').insert({ table_no: table, sender: 'customer', sender_name: name || 'Guest', message: text, read_by_customer: true }).select().single();
      if (data) { appendChatMsg({ id: data.id, table: data.table_no, sender: data.sender, senderName: data.sender_name, text: data.message, readByManager: data.read_by_manager, readByCustomer: data.read_by_customer, createdAt: data.created_at }); return; }
    }
    appendChatMsg({ id: `local-${Date.now()}`, table, sender: 'customer', senderName: name || 'Guest', text, readByManager: false, readByCustomer: true, createdAt: new Date().toISOString() });
  }

  async function sendManagerChat() {
    const text = mgrChatInput.trim();
    if (!text || !mgrChatTable) return;
    setMgrChatInput('');
    if (supabase) {
      const { data } = await supabase.from('chat_messages').insert({ table_no: mgrChatTable, sender: 'manager', sender_name: 'Manager', message: text, read_by_manager: true }).select().single();
      if (data) { appendChatMsg({ id: data.id, table: data.table_no, sender: data.sender, senderName: data.sender_name, text: data.message, readByManager: data.read_by_manager, readByCustomer: data.read_by_customer, createdAt: data.created_at }); return; }
    }
    appendChatMsg({ id: `local-${Date.now()}`, table: mgrChatTable, sender: 'manager', senderName: 'Manager', text, readByManager: true, readByCustomer: false, createdAt: new Date().toISOString() });
  }

  const myOrder = orders.find((o) => String(o.id) === String(myOrderId));
  const avgRating = ratings.length ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1) : '—';
  // --- Daily stats: only today's orders (local date), so the numbers reset
  // every morning instead of accumulating all orders ever placed. ---
  const todayKey = new Date().toLocaleDateString('en-CA');
  const todayOrders = orders.filter((o) => new Date(o.createdAt).toLocaleDateString('en-CA') === todayKey);
  const revenue = todayOrders.filter((o) => o.status !== 'rejected').reduce((s, o) => s + Number(o.total || 0), 0);
  // --- RAHUL manager dashboard (real data only, nothing invented) ---
  const mgrHour = new Date().getHours();
  const mgrGreet = mgrHour < 12 ? 'Good morning' : mgrHour < 17 ? 'Good afternoon' : 'Good evening';
  const mgrDate = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const pendingCount = orders.filter((o) => o.status === 'placed').length;
  // --- Customer <-> Manager chat: one thread per table ---
  const tableMessages = table ? messages.filter((m) => m.table === table) : [];
  const custUnread = tableMessages.filter((m) => m.sender === 'manager' && !m.readByCustomer).length;
  const mgrUnread = messages.filter((m) => m.sender === 'customer' && !m.readByManager).length;
  const mgrUnreadByTable = {};
  TABLES.forEach((t) => { mgrUnreadByTable[t] = messages.filter((m) => m.table === t && m.sender === 'customer' && !m.readByManager).length; });
  const mgrChatMessages = mgrChatTable ? messages.filter((m) => m.table === mgrChatTable) : [];
  const activeTables = new Set(orders.filter((o) => !['served', 'rejected'].includes(o.status)).map((o) => o.table)).size;
  const mgrOrders = orders.filter((o) => {
    if (!mgrSearch.trim()) return true;
    const hay = `${o.id} ${o.table} ${o.name} ${o.items.map((it) => it.name).join(' ')}`.toLowerCase();
    return hay.includes(mgrSearch.trim().toLowerCase());
  });
  const popular = useMemo(() => {
    const counts = {};
    todayOrders.forEach((o) => (o.items || []).forEach((it) => { counts[it.name] = (counts[it.name] || 0) + Number(it.qty || 0); }));
    return Object.entries(counts).map(([name, qty]) => ({ name, qty, img: (menu.find((d) => d.name === name) || {}).img || '' })).sort((a, b) => b.qty - a.qty).slice(0, 4);
  }, [todayOrders, menu]);
  const popMax = Math.max(1, ...popular.map((p) => p.qty));
  const last7 = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const rev = orders.filter((o) => o.status !== 'rejected' && new Date(o.createdAt) >= d && new Date(o.createdAt) < next).reduce((s, o) => s + Number(o.total || 0), 0);
      days.push({ label: d.toLocaleDateString('en-IN', { weekday: 'short' }), rev });
    }
    return days;
  }, [orders]);
  const maxDayRev = Math.max(1, ...last7.map((d) => d.rev));
  // --- Date-wise history: orders + earnings for the date the manager picks ---
  const histOrders = orders.filter((o) => new Date(o.createdAt).toLocaleDateString('en-CA') === histDate);
  const histRevenue = histOrders.filter((o) => o.status !== 'rejected').reduce((s, o) => s + Number(o.total || 0), 0);
  const histPaid = histOrders.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + Number(o.total || 0), 0);
  const histDateLabel = new Date(`${histDate}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // --- Separate pages per sidebar button (?tab=...) ---
  const tabParam = (params.get('tab') || '').toLowerCase();
  const mgrTab = ['dashboard', 'orders', 'chat', 'menu', 'qr', 'customers', 'history', 'reports', 'settings'].includes(tabParam) ? tabParam : 'dashboard';
  const chefTab = ['board', 'new', 'fire', 'ready'].includes(tabParam) ? tabParam : 'board';
  const waiterTab = ['board', 'ready', 'coming', 'served'].includes(tabParam) ? tabParam : 'board';
  // --- Visits: one guest sitting = one visit. A new visit starts on a table
  // when all of the previous sitting's orders are served/rejected, so the
  // next guest on the same table gets a separate history, never merged. ---
  const visits = useMemo(() => {
    const sorted = [...orders].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const byTable = {};
    const all = [];
    sorted.forEach((o) => {
      let v = byTable[o.table];
      const closed = v && v.orders.every((x) => ['served', 'rejected'].includes(x.status));
      if (!v || closed) {
        v = { key: `${o.table}-${all.filter((x) => x.table === o.table).length + 1}`, table: o.table, visitNo: all.filter((x) => x.table === o.table).length + 1, name: o.name || 'Guest', orders: [], first: o.createdAt, last: o.createdAt };
        all.push(v); byTable[o.table] = v;
      }
      if (o.name && o.name !== 'Guest') v.name = o.name;
      v.orders.push(o);
      v.last = o.createdAt;
    });
    return all.sort((a, b) => new Date(b.first) - new Date(a.first));
  }, [orders]);
  const visibleMenu = menu.filter((d) => (cat === 'All' || d.category === cat) && d.available !== false);
  const slideDish = highlights[slide % Math.max(1, highlights.length)];
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://hotel-qr-ordering-alpha.vercel.app';

  // Staff pages (manager / chef / waiter) have their own RAHUL sidebar header —
  // the global top header is only for the customer page, so it never doubles up.
  const hideTopHeader = view !== 'customer' || ['manager', 'chef', 'waiter'].includes(viewParam);
  return (
    <div>
      {!hideTopHeader && (
      <header className="topbar">
        <h1>👨‍🍳 RAHUL <span>Restaurant</span></h1>
        {view === 'customer' && (
          <nav className="cust-tabs">
            <button className={custTab === 'menu' ? 'active' : ''} onClick={() => setCustTab('menu')}>🍴 Menu</button>
            <button className={custTab === 'orders' ? 'active' : ''} onClick={() => setCustTab('orders')}>🕐 My Orders</button>
            <button className={custTab === 'info' ? 'active' : ''} onClick={() => setCustTab('info')}>🪑 Table Info</button>
            <button className={custTab === 'chat' ? 'active' : ''} onClick={() => setCustTab('chat')}>💬 Chat {custUnread > 0 && <span className="savor-badge">{custUnread}</span>}</button>
            <button className={custTab === 'games' ? 'active' : ''} onClick={() => setCustTab('games')}>🎮 Games</button>
          </nav>
        )}
      </header>
      )}
      {!isSupabaseConfigured && <div className="wrap"><div className="card" style={{ background: '#fff3cd' }}>Demo mode: Supabase is not configured yet — orders are kept in this browser only. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel to go live (see README).</div></div>}
      <div className="wrap">
        {notice && <div className="card" role="status">{notice} <button className="btn small ghost" onClick={() => setNotice('')}>Dismiss</button></div>}

        {view === 'customer' && (
          <div className="savor">

            <div className="savor-main">

            {table && (
              <div className="row" style={{ marginBottom: 12 }}>
                <span className="chip green">🍽️ Table {table} &nbsp;● Online</span>
              </div>
            )}
            {custTab === 'menu' && (<>
            {!table ? (
              <div className="card">
                <h2>Welcome! Scan complete — choose your table</h2>
                <p className="muted">Or open a table link directly: {siteUrl}/?table=T1 (T1–T4). Each table QR opens this page for that table.</p>
                <div className="tablepick">{TABLES.map((t) => <button key={t} className={table === t ? 'sel' : ''} onClick={() => setTable(t)}>{t}</button>)}</div>
              </div>
            ) : (
              <div className="card"><div className="row"><span className="chip green">Table {table}</span><span className="muted">You are ordering for table {table}.</span><button className="btn small ghost" onClick={() => setTable('')}>Change table</button></div></div>
            )}

            <div className="savor-hero-text"><h2>Delicious Food,<br /><span>Just a Scan Away!</span></h2><p className="muted">Order your favourite dishes easily</p></div>
            {slideDish && (
              <div className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}>
                <div className="progress">{highlights.map((d, i) => <button key={d.id} aria-label={d.name} onClick={() => setSlide(i)}><span style={{ width: i === slide ? '100%' : i < slide ? '100%' : '0%' }} /></button>)}</div>
                <img key={slideDish.id} className="kenburns" src={slideDish.img} alt={slideDish.name} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=800&q=80'; }} />
                <button className="hero-nav prev" onClick={() => setSlide((slide - 1 + highlights.length) % highlights.length)}>‹</button>
                <button className="hero-nav next" onClick={() => setSlide((slide + 1) % highlights.length)}>›</button>
                <div className="hero-content">
                  <span className="chip" style={{ background: '#ffb703', color: '#1c0f0a' }}>{slideDish.rating ? `★ ${slideDish.rating.toFixed(1)} · Guest favourite` : 'Most ordered'}</span>
                  <h2>{slideDish.name}</h2>
                  <p>{slideDish.desc}</p>
                  <div className="row"><span className="price" style={{ color: '#fff' }}>{fmt(slideDish.price)}</span><button className="btn gold" onClick={() => { addToCart(slideDish.id); setNotice(`${slideDish.name} added to cart.`); }}>ADD +</button></div>
                </div>
              </div>
            )}

            <div className="savor-custgrid"><div className="card" id="savor-menu-list">
              <h2>Menu</h2>
              <div className="row">{['All', ...CATEGORIES].map((c) => <button key={c} className={`btn small ${cat === c ? 'primary' : 'ghost'}`} onClick={() => setCat(c)}>{c}</button>)}</div>
              <div className="grid" style={{ marginTop: 14 }}>
                {visibleMenu.map((d) => (
                  <div key={d.id} className="dish card" style={{ margin: 0 }}>
                    <img className="dish-img" src={d.img} alt={d.name} loading="lazy" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=800&q=80'; }} />
                    <h3>{d.veg ? '🟢' : '🔴'} {d.name} {d.rating ? <span>★ {d.rating.toFixed(1)}</span> : null}</h3>
                    <p>{d.desc}</p>
                    <div className="row"><span className="price">{fmt(d.price)}</span><span className="chip">{d.category}</span>
                      {cart[d.id] ? <span className="row"><button className="btn small ghost" onClick={() => setQty(d.id, (cart[d.id] || 0) - 1)}>−</button><b>{cart[d.id]}</b><button className="btn small ghost" onClick={() => setQty(d.id, (cart[d.id] || 0) + 1)}>+</button></span>
                        : <button className="btn primary small" onClick={() => addToCart(d.id)}>ADD +</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card savor-cart" id="bill">
              <h2>🛒 Your Cart {cartItems.length > 0 ? `· ${cartItems.reduce((s, x) => s + x.qty, 0)} items` : ''}</h2>
              {cartItems.length === 0 ? <div style={{ textAlign: 'center', padding: '24px 0' }}><div style={{ fontSize: 48 }}>🛒</div><p><b>Your cart is empty</b></p><p className="muted">Add some delicious items!</p><button className="btn primary" onClick={() => document.getElementById('savor-menu-list')?.scrollIntoView({ behavior: 'smooth' })}>Browse Menu →</button></div> : cartItems.map((x) => (
                <div key={x.dish.id} className="row" style={{ justifyContent: 'space-between' }}><span>{x.dish.name} × {x.qty}</span><span className="row"><button className="btn small ghost" onClick={() => setQty(x.dish.id, x.qty - 1)}>−</button><button className="btn small ghost" onClick={() => setQty(x.dish.id, x.qty + 1)}>+</button><span>{fmt(x.dish.price * x.qty)}</span><button className="btn small ghost" onClick={() => setQty(x.dish.id, 0)}>Remove</button></span></div>
              ))}
              <hr />
              <div className="row" style={{ justifyContent: 'space-between' }}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><span>GST (5%)</span><span>{fmt(gst)}</span></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><b>Total</b><b>{fmt(total)}</b></div>
              <label>Your name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guest name" />
              <label>Payment</label>
              <div className="row">
                {['UPI', 'Cash'].map((p) => <button key={p} className={`btn small ${payment === p ? 'primary' : 'ghost'}`} onClick={() => setPayment(p)}>{p}</button>)}
              </div>
              <p className="muted">{payment === 'UPI' ? 'Pay at the table on the hotel UPI ID shown by the waiter, then place the order. The manager confirms receipt.' : 'Pay cash at the counter. The manager confirms receipt.'}</p>
              <button className="btn primary" onClick={placeOrder} disabled={!cartItems.length}>Place Order · {fmt(total)}</button>
            </div></div>
            </>)}
            {custTab === 'orders' && myOrder && (
              <div className="card">
                <h2>Live Order Status</h2>
                <p><b>Order {String(myOrder.id).slice(0, 8)}</b> · Table {myOrder.table} · {fmt(myOrder.total)} · {myOrder.paymentMethod} ({myOrder.paymentStatus})</p>
                <div className="steps">{STEPS.map((s, i) => { const idx = STEPS.indexOf(myOrder.status); return <span key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''}>{STEP_LABELS[s]}</span>; })}</div>
                <p className="muted">Current status: <b>{STATUS_LABEL[myOrder.status] || myOrder.status}</b></p>
                {myOrder.status !== 'served' && <div className="row" style={{ marginTop: 10 }}><span>⏳ Order ready hone tak time hai?</span><button className="btn gold small" onClick={() => setCustTab('games')}>🎮 Game khelo</button></div>}
                {myOrder.status === 'served' && <ReceiptBox order={myOrder} />}
                {myOrder.status === 'served' && <RatingBox orderId={myOrder.id} onSubmit={submitRating} done={ratings.some((r) => String(r.orderId) === String(myOrder.id))} />}
              </div>
            )}
            {custTab === 'orders' && !myOrder && (<div className="card"><h2>My Orders</h2><p className="muted">Abhi tak koi order nahi hai — menu se dish add karo aur order place karo.</p></div>)}
            {custTab === 'info' && (<div className="card"><h2>🪑 Table Info</h2><p><b>Table:</b> {table || 'Not selected'}</p><p><b>Status:</b> {table ? 'Online' : '—'}</p><p className="muted">Is table ka QR scan karke ye page khula hai. Order karne ke liye Menu tab pe jao.</p>{table && <button className="btn small ghost" onClick={() => setTable('')}>Change table</button>}</div>)}
            {custTab === 'chat' && (<div className="card">
              <h2>💬 Chat with Manager</h2>
              {!table ? (<p className="muted">Pehle apni table choose karo (Menu tab se), phir yahan manager se baat kar sakte ho.</p>) : (<>
                <p className="muted">Table {table} · Manager yahin reply karega, live.</p>
                <div className="chat-box" ref={chatBoxRef}>
                  {tableMessages.length === 0 ? <p className="muted">Abhi tak koi message nahi — kuch poochna ho to neeche likho. 👇</p> : tableMessages.map((m) => (
                    <div key={m.id} className={`chat-msg ${m.sender === 'customer' ? 'mine' : 'theirs'}`}>
                      <div className="chat-bubble">
                        {m.sender === 'manager' && <span className="chat-who">Manager</span>}
                        {m.text}
                        <span className="chat-time">{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="row">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Manager ko message likho..." onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }} style={{ flex: 1, margin: 0 }} />
                  <button className="btn primary" onClick={sendChat} disabled={!chatInput.trim()}>Send</button>
                </div>
              </>)}
            </div>)}
            {custTab === 'games' && <GameBox />}
            {cartItems.length > 0 && (
              <button className="cart-fab" onClick={() => document.getElementById('bill')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                🛒 Cart · {cartItems.reduce((s, x) => s + x.qty, 0)} items · {fmt(total)}
              </button>
            )}
            </div>
          </div>
        )}

        {view === 'manager' && (
          <div className="savor">
            <aside className={"savor-side" + (sideOpen ? " open" : "")}>
              <div className="savor-logo"><span className="savor-hat">👨‍🍳</span><div><b>RAHUL</b><span>RESTAURANT</span></div></div>
              <nav className="savor-nav">
                <a className={mgrTab === 'dashboard' ? 'active' : ''} href="/?view=manager&tab=dashboard">▦ Dashboard</a>
                <a className={mgrTab === 'orders' ? 'active' : ''} href="/?view=manager&tab=orders">⚡ Live Orders {pendingCount > 0 && <span className="savor-badge">{pendingCount}</span>}</a>
                <a className={mgrTab === 'chat' ? 'active' : ''} href="/?view=manager&tab=chat">💬 Customer Chat {mgrUnread > 0 && <span className="savor-badge">{mgrUnread}</span>}</a>
                <a className={mgrTab === 'menu' ? 'active' : ''} href="/?view=manager&tab=menu">🍴 Menu</a>
                <a className={mgrTab === 'qr' ? 'active' : ''} href="/?view=manager&tab=qr">⊞ Tables &amp; QR</a>
                <a className={mgrTab === 'customers' ? 'active' : ''} href="/?view=manager&tab=customers">👥 Customers</a>
                <a className={mgrTab === 'history' ? 'active' : ''} href="/?view=manager&tab=history">📅 History</a>
                <a className={mgrTab === 'reports' ? 'active' : ''} href="/?view=manager&tab=reports">📊 Reports</a>
                <a className={mgrTab === 'settings' ? 'active' : ''} href="/?view=manager&tab=settings">⚙️ Settings</a>
              </nav>
              <button className="savor-sound" onClick={() => setSoundOn((s) => !s)}>{soundOn ? '🔔 Sound On' : '🔕 Sound Off'}</button>
              <div className="savor-mood">Good Food<br />Good Mood</div>
            </aside>
            {sideOpen && <div className="savor-overlay" onClick={() => setSideOpen(false)} />}
            <div className="savor-main" id="savor-top">
              <button className="savor-burger" onClick={() => setSideOpen((o) => !o)}>☰ Menu</button>
              {['dashboard', 'orders'].includes(mgrTab) && (
              <div className="savor-topbar">
                <input type="text" placeholder="Search orders, tables..." value={mgrSearch} onChange={(e) => setMgrSearch(e.target.value)} />
                <span className="savor-bell">🔔{pendingCount > 0 && <i />}</span>
                <span className="savor-avatar">M</span><b>Manager</b>
              </div>
              )}
              {mgrTab === 'dashboard' && (<>
              <div className="savor-greet">
                <div><h2>{mgrGreet}, Manager 👋</h2><p className="muted">Here&apos;s what&apos;s happening at your restaurant today.</p><p className="muted">📅 {mgrDate}</p></div>
                <div className="savor-tagline">Eat · Enjoy · Repeat</div>
              </div>
              <div className="savor-stats">
                <div className="savor-stat"><span className="savor-ic green">🛍️</span><div><b>{todayOrders.length}</b><span>Today&apos;s Orders</span></div></div>
                <div className="savor-stat"><span className="savor-ic gold">₹</span><div><b>{fmt(revenue)}</b><span>Revenue Today</span></div></div>
                <div className="savor-stat"><span className="savor-ic green">🪑</span><div><b>{activeTables}</b><span>Active Tables</span></div></div>
                <div className="savor-stat pink"><span className="savor-ic red">🕐</span><div><b>{pendingCount}</b><span>Pending Orders</span></div></div>
              </div></>)}
              {['dashboard', 'orders'].includes(mgrTab) && (<div className="savor-grid" style={mgrTab === 'orders' ? { gridTemplateColumns: '1fr' } : undefined}>
                <div className="card savor-card" id="savor-orders">
                  <div className="row" style={{ justifyContent: 'space-between' }}><h2>⚡ Live Orders</h2><span className="muted">Avg rating {avgRating} / 5</span></div>
                  {mgrOrders.length === 0 ? <p className="muted">No orders yet.</p> : (
                    <div className="savor-tablewrap"><table className="savor-table">
                      <thead><tr><th>Order ID</th><th>Table</th><th>Items</th><th>Total</th><th>Status</th><th>Time</th><th>Action</th></tr></thead>
                      <tbody>{mgrOrders.map((o) => (
                        <tr key={o.id}>
                          <td><b>#{String(o.id).slice(0, 4)}</b></td>
                          <td>{o.table}</td>
                          <td>{o.items.map((it) => `${it.name} × ${it.qty}`).join(', ') || '—'}</td>
                          <td><b>{fmt(o.total)}</b></td>
                          <td><span className={`savor-pill ${o.status}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
                          <td>{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</td>
                          <td>{o.status === 'placed' && <><button className="btn green small" onClick={() => updateOrder(o.id, { status: 'verified' })}>Verify</button>{' '}<button className="btn small ghost" onClick={() => updateOrder(o.id, { status: 'rejected' })}>Reject</button></>}
                            {o.status === 'verified' && <button className="btn primary small" onClick={() => updateOrder(o.id, { status: 'sent_to_chef' })}>Send to Chef</button>}
                            {o.paymentStatus !== 'paid' && <button className="btn gold small" onClick={() => updateOrder(o.id, { paymentStatus: 'paid' })}>Cash received ✓</button>}
                            {ratings.filter((r) => String(r.orderId) === String(o.id)).map((r, i) => <div key={i} className="muted">★ {r.stars}/5 — {r.feedback}</div>)}
                          </td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                  )}
                </div>
                {mgrTab === 'dashboard' && (<div className="card savor-card">
                  <h2>⭐ Popular Items</h2>
                  {popular.length === 0 ? <p className="muted">No orders yet — popular dishes yahan aayenge.</p> : popular.map((p) => (
                    <div key={p.name} className="savor-pop">
                      {p.img && <img src={p.img} alt={p.name} />}
                      <div><b>{p.name}</b><span className="muted">{p.qty} order{p.qty === 1 ? '' : 's'}</span><span className="savor-bar"><i style={{ width: `${Math.round((p.qty / popMax) * 100)}%` }} /></span></div>
                    </div>
                  ))}
                </div>)}
              </div>)}
              {['dashboard', 'reports'].includes(mgrTab) && (<div className="savor-grid" style={mgrTab === 'reports' ? { gridTemplateColumns: '1fr' } : undefined}>
                <div className="card savor-card" id="savor-revenue">
                  <h2>📊 Revenue — Last 7 Days</h2>
                  <div className="savor-bars">{last7.map((d) => (
                    <div key={d.label} className="savor-barcol"><span>{d.rev ? fmt(d.rev) : ''}</span><i style={{ height: `${Math.max(4, Math.round((d.rev / maxDayRev) * 100))}%` }} /><b>{d.label}</b></div>
                  ))}</div>
                  <p className="muted">Total this week: {fmt(last7.reduce((s, d) => s + d.rev, 0))} · Only real orders counted.</p>
                </div>
                {mgrTab === 'dashboard' && (<div className="savor-promo">
                  <div className="savor-promo-ic">🍽️</div>
                  <h3>Smooth Service,<br />Happier Customers</h3>
                  <a className="btn gold" href="/?view=manager&tab=menu">Manage Menu →</a>
                </div>)}
              </div>)}
              {mgrTab === 'history' && (<div className="card savor-card" id="savor-history">
                <div className="row" style={{ justifyContent: 'space-between' }}><h2>📅 History</h2><input type="date" value={histDate} onChange={(e) => setHistDate(e.target.value)} style={{ width: 'auto', margin: 0 }} /></div>
                <p className="muted">{histDateLabel}</p>
                <div className="savor-stats">
                  <div className="savor-stat"><span className="savor-ic green">🛍️</span><div><b>{histOrders.length}</b><span>Orders</span></div></div>
                  <div className="savor-stat"><span className="savor-ic gold">₹</span><div><b>{fmt(histRevenue)}</b><span>Total kamai</span></div></div>
                  <div className="savor-stat"><span className="savor-ic green">✅</span><div><b>{fmt(histPaid)}</b><span>Paid (received)</span></div></div>
                  <div className="savor-stat pink"><span className="savor-ic red">⏳</span><div><b>{fmt(histRevenue - histPaid)}</b><span>Pending payment</span></div></div>
                </div>
                {histOrders.length === 0 ? <p className="muted">Is date ko koi order nahi hai.</p> : (
                  <div className="savor-tablewrap"><table className="savor-table">
                    <thead><tr><th>Order ID</th><th>Table</th><th>Items</th><th>Total</th><th>Status</th><th>Time</th><th>Payment</th></tr></thead>
                    <tbody>{histOrders.map((o) => (
                      <tr key={o.id}>
                        <td><b>#{String(o.id).slice(0, 4)}</b></td>
                        <td>{o.table}</td>
                        <td>{o.items.map((it) => `${it.name} × ${it.qty}`).join(', ') || '—'}</td>
                        <td><b>{fmt(o.total)}</b></td>
                        <td><span className={`savor-pill ${o.status}`}>{STATUS_LABEL[o.status] || o.status}</span></td>
                        <td>{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</td>
                        <td>{o.paymentMethod} · {o.paymentStatus}</td>
                      </tr>
                    ))}</tbody>
                  </table></div>
                )}
              </div>)}
              {mgrTab === 'chat' && (<div className="card savor-card">
                <h2>💬 Customer Chat</h2>
                <p className="muted">Har table ki alag chat hai. Customer ka message aate hi yahan bajega (ring) aur badge dikhega. Table choose karo, phir reply karo.</p>
                <div className="row" style={{ marginBottom: 12 }}>{TABLES.map((t) => (
                  <button key={t} className={`btn small ${mgrChatTable === t ? 'primary' : 'ghost'}`} onClick={() => setMgrChatTable(t)}>
                    Table {t} {mgrUnreadByTable[t] > 0 && <span className="savor-badge">{mgrUnreadByTable[t]}</span>}
                  </button>
                ))}</div>
                {!mgrChatTable ? (<p className="muted">Upar se ek table choose karo.</p>) : (<>
                  <div className="chat-box" ref={chatBoxRef}>
                    {mgrChatMessages.length === 0 ? <p className="muted">Is table se abhi tak koi message nahi aaya.</p> : mgrChatMessages.map((m) => (
                      <div key={m.id} className={`chat-msg ${m.sender === 'manager' ? 'mine' : 'theirs'}`}>
                        <div className="chat-bubble">
                          {m.sender === 'customer' && <span className="chat-who">{m.senderName || 'Guest'} · Table {m.table}</span>}
                          {m.text}
                          <span className="chat-time">{new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="row">
                    <input type="text" value={mgrChatInput} onChange={(e) => setMgrChatInput(e.target.value)} placeholder={`Table ${mgrChatTable} ko reply likho...`} onKeyDown={(e) => { if (e.key === 'Enter') sendManagerChat(); }} style={{ flex: 1, margin: 0 }} />
                    <button className="btn primary" onClick={sendManagerChat} disabled={!mgrChatInput.trim()}>Send</button>
                  </div>
                </>)}
              </div>)}
              {mgrTab === 'qr' && (<div className="card savor-card" id="savor-qr"><h2>Table QR Codes</h2><p className="muted">Print these from the <a href="/qr">printable QR page</a>. Each QR opens the customer page for that table.</p>
                <div className="qrgrid">{TABLES.map((t) => <div key={t}><img src={`/qr/table-${t.toLowerCase()}-qr.png`} alt={`QR for table ${t}`} /><p style={{ textAlign: 'center' }}><b>{t}</b><br /><span className="muted">{siteUrl}/?table={t}</span></p></div>)}</div>
              </div>)}
              {mgrTab === 'menu' && (<div id="savor-menu"><ManagerMenu menu={menu} setMenu={setMenu} newDish={newDish} setNewDish={setNewDish} fetchData={fetchData} /></div>)}
              {mgrTab === 'customers' && (
              <div className="card savor-card">
                <h2>👥 Customers — har guest ki alag visit</h2>
                <p className="muted">Ek guest kha ke gaya, phir dusra usi table pe baitha — dono ki history alag dikhegi. Jab table ke saare order serve ho jayenge, uske baad ka naya order nayi visit ban jayega.</p>
                {visits.length === 0 ? <p className="muted">Abhi tak koi order nahi hai.</p> : (
                  <div className="savor-tablewrap"><table className="savor-table">
                    <thead><tr><th>Guest</th><th>Table</th><th>Visit</th><th>Orders</th><th>Items</th><th>Total Spent</th><th>Time</th><th>Status</th></tr></thead>
                    <tbody>{visits.map((v) => {
                      const active = v.orders.some((x) => !['served', 'rejected'].includes(x.status));
                      return (
                      <tr key={v.key}>
                        <td><b>{v.name}</b></td>
                        <td>{v.table}</td>
                        <td>Visit {v.visitNo}</td>
                        <td>{v.orders.length}</td>
                        <td>{v.orders.flatMap((o) => o.items || []).map((it) => `${it.name} × ${it.qty}`).join(', ') || '—'}</td>
                        <td><b>{fmt(v.orders.reduce((s, o) => s + Number(o.total || 0), 0))}</b></td>
                        <td>{new Date(v.first).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                        <td><span className={`savor-pill ${active ? 'preparing' : 'served'}`}>{active ? 'Sitting Now' : 'Left'}</span></td>
                      </tr>);
                    })}</tbody>
                  </table></div>
                )}
              </div>
              )}
              {mgrTab === 'settings' && (
              <div className="card savor-card">
                <h2>⚙️ Settings</h2>
                <p><b>Restaurant:</b> RAHUL</p>
                <p><b>Tables:</b> T1, T2, T3, T4</p>
                <p><b>Payment:</b> UPI (pay at table) and Cash (at counter) — manager confirms receipt.</p>
                <p><b>GST:</b> 5% on every bill.</p>
                <p><a href="/qr">Print Table QR Codes →</a></p>
                <p className="muted">Menu aur QR apne alag pages se manage hote hain.</p>
              </div>
              )}
            </div>
          </div>
        )}

        {view === 'chef' && (
          <div className="savor">
            <aside className={"savor-side" + (sideOpen ? " open" : "")}>
              <div className="savor-logo"><span className="savor-hat">👨‍🍳</span><div><b>RAHUL</b><span>RESTAURANT</span></div></div>
              <nav className="savor-nav">
                <a className={chefTab === 'board' ? 'active' : ''} href="/?view=chef&tab=board">🍳 Kitchen Board</a>
                <a className={chefTab === 'new' ? 'active' : ''} href="/?view=chef&tab=new">🆕 New Tickets ({orders.filter((o) => o.status === 'sent_to_chef').length})</a>
                <a className={chefTab === 'fire' ? 'active' : ''} href="/?view=chef&tab=fire">🔥 On the Fire ({orders.filter((o) => o.status === 'preparing').length})</a>
                <a className={chefTab === 'ready' ? 'active' : ''} href="/?view=chef&tab=ready">✅ Ready for Pickup ({orders.filter((o) => o.status === 'ready').length})</a>
              </nav>
              <button className="savor-sound" onClick={() => setSoundOn((s) => !s)}>{soundOn ? '🔔 Sound On' : '🔕 Sound Off'}</button>
              <div className="savor-mood">Good Food<br />Good Mood</div>
            </aside>
            {sideOpen && <div className="savor-overlay" onClick={() => setSideOpen(false)} />}
            <div className="savor-main">
              <button className="savor-burger" onClick={() => setSideOpen((o) => !o)}>☰ Menu</button>
              <div className="savor-greet">
                <div><h2>{mgrGreet}, Chef 👨‍🍳</h2><p className="muted">Verified orders only — cook them in order, mark Ready when done.</p><p className="muted">📅 {mgrDate}</p></div>
                <div className="savor-tagline">Eat · Enjoy · Repeat</div>
              </div>
              <div className="savor-stats">
                <div className="savor-stat"><span className="savor-ic gold">🆕</span><div><b>{orders.filter((o) => o.status === 'sent_to_chef').length}</b><span>New Tickets</span></div></div>
                <div className="savor-stat"><span className="savor-ic red">🔥</span><div><b>{orders.filter((o) => o.status === 'preparing').length}</b><span>On the Fire</span></div></div>
                <div className="savor-stat"><span className="savor-ic green">✅</span><div><b>{orders.filter((o) => o.status === 'ready').length}</b><span>Ready for Pickup</span></div></div>
              </div>
              <ChefBoard orders={orders} updateOrder={updateOrder} lane={chefTab} />
            </div>
          </div>
        )}
        {view === 'waiter' && (
          <div className="savor">
            <aside className={"savor-side" + (sideOpen ? " open" : "")}>
              <div className="savor-logo"><span className="savor-hat">👨‍🍳</span><div><b>RAHUL</b><span>RESTAURANT</span></div></div>
              <nav className="savor-nav">
                <a className={waiterTab === 'board' ? 'active' : ''} href="/?view=waiter&tab=board">🛎️ Pickup Board</a>
                <a className={waiterTab === 'ready' ? 'active' : ''} href="/?view=waiter&tab=ready">🔔 Ready ({orders.filter((o) => o.status === 'ready').length})</a>
                <a className={waiterTab === 'coming' ? 'active' : ''} href="/?view=waiter&tab=coming">🍳 Coming Up ({orders.filter((o) => ['verified', 'sent_to_chef', 'preparing'].includes(o.status)).length})</a>
                <a className={waiterTab === 'served' ? 'active' : ''} href="/?view=waiter&tab=served">✅ Served ({orders.filter((o) => o.status === 'served').length})</a>
              </nav>
              <button className="savor-sound" onClick={() => setSoundOn((s) => !s)}>{soundOn ? '🔔 Sound On' : '🔕 Sound Off'}</button>
              <div className="savor-mood">Good Food<br />Good Mood</div>
            </aside>
            {sideOpen && <div className="savor-overlay" onClick={() => setSideOpen(false)} />}
            <div className="savor-main">
              <button className="savor-burger" onClick={() => setSideOpen((o) => !o)}>☰ Menu</button>
              <div className="savor-greet">
                <div><h2>{mgrGreet}, Waiter 🛎️</h2><p className="muted">When the chef marks an order Ready, it flashes here — serve it fast.</p><p className="muted">📅 {mgrDate}</p></div>
                <div className="savor-tagline">Eat · Enjoy · Repeat</div>
              </div>
              <div className="savor-stats">
                <div className="savor-stat pink"><span className="savor-ic red">🔔</span><div><b>{orders.filter((o) => o.status === 'ready').length}</b><span>Ready to Serve</span></div></div>
                <div className="savor-stat"><span className="savor-ic gold">🍳</span><div><b>{orders.filter((o) => ['verified', 'sent_to_chef', 'preparing'].includes(o.status)).length}</b><span>Coming Up</span></div></div>
                <div className="savor-stat"><span className="savor-ic green">✅</span><div><b>{orders.filter((o) => o.status === 'served').length}</b><span>Served</span></div></div>
              </div>
              <WaiterBoard orders={orders} updateOrder={updateOrder} tab={waiterTab} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptBox({ order }) {
  const sub = (order.items || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 0), 0);
  const gst = Math.round(sub * GST_RATE);
  const tot = sub + gst;
  return (
    <div className="receipt">
      <h3>🧾 Receipt — Order {String(order.id).slice(0, 8)}</h3>
      <p className="muted">Table {order.table} · {order.name} · {new Date(order.createdAt).toLocaleString('en-IN')}</p>
      {(order.items || []).map((it, i) => (
        <div key={i} className="row" style={{ justifyContent: 'space-between' }}><span>{it.name} × {it.qty}</span><span>{fmt(Number(it.price) * Number(it.qty))}</span></div>
      ))}
      <hr />
      <div className="row" style={{ justifyContent: 'space-between' }}><span>Subtotal</span><span>{fmt(sub)}</span></div>
      <div className="row" style={{ justifyContent: 'space-between' }}><span>GST (5%)</span><span>{fmt(gst)}</span></div>
      <div className="row" style={{ justifyContent: 'space-between' }}><b>Total</b><b>{fmt(tot)}</b></div>
      <p className="muted">Payment: {order.paymentMethod} ({order.paymentStatus}) · Status: Served / Completed</p>
      <p><b>Thank you! Visit again.</b></p>
      <button className="btn small ghost" onClick={() => window.print()}>Print Receipt</button>
    </div>
  );
}

function RatingBox({ orderId, onSubmit, done }) {
  const [stars, setStars] = useState(5);
  const [fb, setFb] = useState('');
  if (done) return <p><b>Thank you for your rating!</b></p>;
  return (
    <div><h3>How was your food?</h3>
      <div className="row">{[1, 2, 3, 4, 5].map((s) => <button key={s} className={`btn small ${stars >= s ? 'gold' : 'ghost'}`} onClick={() => setStars(s)}>★ {s}</button>)}</div>
      <textarea value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Feedback (optional)" rows={2} />
      <button className="btn primary" onClick={() => onSubmit(orderId, stars, fb)}>Submit Rating</button>
    </div>
  );
}

function ManagerMenu({ menu, setMenu, newDish, setNewDish, fetchData }) {
  function handlePhoto(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 800;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        setNewDish((d) => ({ ...d, img: c.toDataURL('image/jpeg', 0.8) }));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  }
  async function addDish() {
    if (!newDish.name || !newDish.price) return;
    const dish = { name: newDish.name, category: newDish.category, price: Number(newDish.price), veg: true, img: newDish.img || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80', desc: 'Added by manager.', available: true };
    if (supabase) { const { data } = await supabase.from('menu_items').insert({ name: dish.name, category: dish.category, price: dish.price, veg: true, image_url: dish.img, description: dish.desc, available: true }).select().single(); if (data) setMenu((m) => [...m, { ...dish, id: data.id }]); }
    else setMenu((m) => [...m, { ...dish, id: `m-${Date.now()}` }]);
    setNewDish({ name: '', category: 'Starters', price: '', img: '' }); fetchData();
  }
  async function removeDish(id) {
    setMenu((m) => m.filter((d) => String(d.id) !== String(id)));
    if (supabase && !String(id).startsWith('m-')) await supabase.from('menu_items').delete().eq('id', id);
  }
  async function toggleDish(d) {
    const next = d.available === false ? true : false;
    setMenu((m) => m.map((x) => String(x.id) === String(d.id) ? { ...x, available: next } : x));
    if (supabase && !String(d.id).startsWith('m-')) await supabase.from('menu_items').update({ available: next }).eq('id', d.id);
  }
  async function editPrice(d) {
    const v = window.prompt(`New price for ${d.name} (₹):`, String(d.price));
    if (v === null) return; const p = Number(v); if (!p) return;
    setMenu((m) => m.map((x) => String(x.id) === String(d.id) ? { ...x, price: p } : x));
    if (supabase && !String(d.id).startsWith('m-')) await supabase.from('menu_items').update({ price: p }).eq('id', d.id);
  }
  return (
    <div className="card"><h2>Menu Management</h2>
      <label>Dish name</label>
      <input type="text" placeholder="Dish name" value={newDish.name} onChange={(e) => setNewDish({ ...newDish, name: e.target.value })} />
      <label>Category</label>
      <select value={newDish.category} onChange={(e) => setNewDish({ ...newDish, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      <label>Price (₹)</label>
      <input type="number" placeholder="Price ₹" value={newDish.price} onChange={(e) => setNewDish({ ...newDish, price: e.target.value })} />
      <label>Dish photo (optional)</label>
      <input type="file" accept="image/*" onChange={handlePhoto} />
      {newDish.img && <img src={newDish.img} alt="Dish preview" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />}
      <button className="btn primary" onClick={addDish} style={{ width: '100%' }}>Add Dish</button>
      {menu.map((d) => (
        <div key={d.id} className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid #f0e6d8', padding: '6px 0' }}>
          <span>{d.name} <span className="muted">· {d.category} · {fmt(d.price)} {d.available === false ? '· OFF' : ''}</span></span>
          <span className="row"><button className="btn small ghost" onClick={() => editPrice(d)}>Edit price</button><button className="btn small ghost" onClick={() => toggleDish(d)}>{d.available === false ? 'Enable' : 'Disable'}</button><button className="btn small ghost" onClick={() => removeDish(d.id)}>Remove</button></span>
        </div>
      ))}
    </div>
  );
}

function ChefBoard({ orders, updateOrder, lane }) {
  const lanes = [
    { key: 'new', title: 'New tickets', list: orders.filter((o) => o.status === 'sent_to_chef') },
    { key: 'fire', title: 'On the fire', list: orders.filter((o) => o.status === 'preparing') },
    { key: 'ready', title: 'Ready for pickup', list: orders.filter((o) => o.status === 'ready') }
  ].filter((l) => !lane || lane === 'board' || l.key === lane);
  return (
    <div id="chef-board">
      <h2>Kitchen Board — verified orders only</h2>
      <p className="muted">Orders appear here only after the manager verifies and sends them to the chef.</p>
      <div className="lanes">{lanes.map((lane) => (
        <div key={lane.key} className="lane"><h3>{lane.title} ({lane.list.length})</h3>
          {lane.list.length === 0 && <p className="muted">No orders here.</p>}
          {lane.list.map((o) => (
            <div key={o.id} className="ticket">
              <div className="row"><b style={{ fontSize: 22 }}>{o.table}</b><span className="chip amber">{waitMins(o.createdAt)} min ago</span></div>
              <p>{o.items.map((it) => `${it.name} × ${it.qty}`).join(', ')}</p>
              <p className="muted">{o.name} · {fmt(o.total)}</p>
              {o.status === 'sent_to_chef' && <button className="btn primary" onClick={() => updateOrder(o.id, { status: 'preparing' })}>Start Preparing</button>}
              {o.status === 'preparing' && <button className="btn gold" onClick={() => updateOrder(o.id, { status: 'ready' })}>Mark Ready ✓</button>}
              {o.status === 'ready' && <p className="muted">Waiter has been alerted — waiting for pickup.</p>}
            </div>
          ))}
        </div>
      ))}</div>
    </div>
  );
}

function WaiterBoard({ orders, updateOrder, tab }) {
  const ready = orders.filter((o) => o.status === 'ready');
  const coming = orders.filter((o) => ['verified', 'sent_to_chef', 'preparing'].includes(o.status));
  const served = orders.filter((o) => o.status === 'served');
  const show = (k) => !tab || tab === 'board' || tab === k;
  return (
    <div id="waiter-board">
      <h2>Waiter — pickup board</h2>
      {show('ready') && (<>
      {ready.map((o) => (
        <div key={o.id} className="alert">🔔 READY — Table {o.table}: {o.items.map((it) => `${it.name} × ${it.qty}`).join(', ')} — please serve now!
          <div style={{ marginTop: 10 }}><button className="btn gold" onClick={() => updateOrder(o.id, { status: 'served' })}>Received — Mark Served</button></div>
        </div>
      ))}
      {ready.length === 0 && <div className="card"><p className="muted">No ready orders right now. When the chef marks an order Ready, it will flash here with a chime.</p></div>}
      </>)}
      {show('coming') && (<div className="card"><h3>Coming up</h3>{coming.length === 0 ? <p className="muted">Nothing cooking.</p> : coming.map((o) => <p key={o.id}><b>{o.table}</b> — {o.items.map((it) => `${it.name} × ${it.qty}`).join(', ')} · {STATUS_LABEL[o.status]}</p>)}</div>)}
      {show('served') && (<div className="card"><h3>Recently served</h3>{served.length === 0 ? <p className="muted">—</p> : served.slice(0, 10).map((o) => <p key={o.id}><b>{o.table}</b> — {o.items.map((it) => `${it.name} × ${it.qty}`).join(', ')} · {fmt(o.total)}</p>)}</div>)}
    </div>
  );
}

// --- Catch the Dish: a quick waiting game for customers. Food falls from the
// top, catch it in the plate. 45 seconds, best score saved on this phone. ---
const GAME_FOODS = ['🍕', '🍔', '🍟', '🌮', '🍩', '🍪', '🍦', '🍿', '🥪', '🌯'];
const GAME_TIME = 45;

function GameBox() {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const st = useRef({ x: 0.5, items: [], time: GAME_TIME, spawnIn: 0, shown: GAME_TIME, score: 0, over: false });

  useEffect(() => {
    try { setBest(Number(window.localStorage.getItem('rahul-game-best') || 0)); } catch {}
  }, []);

  function startGame() {
    st.current = { x: 0.5, items: [], time: GAME_TIME, spawnIn: 0, shown: GAME_TIME, score: 0, over: false };
    setScore(0); setTimeLeft(GAME_TIME); setOver(false); setRunning(true);
  }

  function endGame() {
    const sc = st.current.score;
    setRunning(false); setOver(true);
    if (sc > best) {
      setBest(sc);
      try { window.localStorage.setItem('rahul-game-best', String(sc)); } catch {}
    }
  }

  // Idle scene: plate + a few dishes before the game starts.
  useEffect(() => {
    if (running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.font = '30px serif';
    ctx.fillText('🍕', canvas.width * 0.3, 90);
    ctx.fillText('🍔', canvas.width * 0.7, 150);
    ctx.fillText('🌶️', canvas.width * 0.5, 210);
    ctx.font = '44px serif';
    ctx.fillText('🍽️', canvas.width / 2, canvas.height - 16);
  }, [running]);

  // Keyboard controls.
  useEffect(() => {
    if (!running) return;
    const h = (e) => {
      if (e.key === 'ArrowLeft') st.current.x = Math.max(0.05, st.current.x - 0.07);
      if (e.key === 'ArrowRight') st.current.x = Math.min(0.95, st.current.x + 0.07);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [running]);

  // Main game loop.
  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    let raf; let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const g = st.current;
      if (g.over) return;
      g.time -= dt;
      const shown = Math.max(0, Math.ceil(g.time));
      if (shown !== g.shown) { g.shown = shown; setTimeLeft(shown); }
      if (g.time <= 0) { g.over = true; endGame(); return; }
      g.spawnIn -= dt;
      const elapsed = GAME_TIME - g.time;
      if (g.spawnIn <= 0 && g.items.length < 9) {
        const r = Math.random();
        const kind = r < 0.12 ? 'chilli' : r < 0.24 ? 'rotten' : 'food';
        g.items.push({
          x: 0.06 + Math.random() * 0.88,
          y: -20,
          vy: 130 + Math.random() * 90 + elapsed * 3,
          kind,
          emoji: kind === 'chilli' ? '🌶️' : kind === 'rotten' ? '🤢' : GAME_FOODS[Math.floor(Math.random() * GAME_FOODS.length)],
          pts: kind === 'chilli' ? 25 : kind === 'rotten' ? -10 : 10,
        });
        g.spawnIn = Math.max(0.35, 0.85 - elapsed * 0.008);
      }
      const basketY = H - 46;
      g.items = g.items.filter((it) => {
        it.y += it.vy * dt;
        if (it.y >= basketY - 10 && it.y <= basketY + 26 && Math.abs(it.x - g.x) < 0.1) {
          g.score += it.pts;
          setScore(g.score);
          return false;
        }
        return it.y < H + 20;
      });
      ctx.clearRect(0, 0, W, H);
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      g.items.forEach((it) => ctx.fillText(it.emoji, it.x * W, it.y));
      ctx.font = '44px serif';
      ctx.fillText('🍽️', g.x * W, basketY + 30);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  function onPointer(e) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    st.current.x = Math.max(0.05, Math.min(0.95, px));
  }

  return (
    <div className="card">
      <h2>🎮 Catch the Dish!</h2>
      <p className="muted">Order ready hone tak khelo — girta hua khana plate me pakdo. 🍕 +10 · 🌶️ +25 · 🤢 -10 · 45 seconds</p>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span><b>Score: {score}</b></span>
        <span className="muted">Best: {best}</span>
        <span><b>⏱ {timeLeft}s</b></span>
      </div>
      <canvas ref={canvasRef} className="game-canvas" width={360} height={440} onPointerDown={onPointer} onPointerMove={(e) => { if (running) onPointer(e); }} />
      {!running && !over && <button className="btn primary" onClick={startGame} style={{ width: '100%', marginTop: 12 }}>▶ Start Game</button>}
      {over && (<div style={{ marginTop: 12 }}><p><b>Time up!</b> Tumhara score: {score}{score >= best && score > 0 ? ' — New best! 🎉' : ''}</p><button className="btn primary" onClick={startGame} style={{ width: '100%' }}>↻ Play Again</button></div>)}
      <p className="muted">Plate hilane ke liye screen par ungli ghumao, mouse drag karo, ya ← → keys dabao.</p>
    </div>
  );
}

export default function Home() {
  return (<Suspense fallback={<div className="wrap"><div className="card">Loading…</div></div>}><HomeInner /></Suspense>);
}
