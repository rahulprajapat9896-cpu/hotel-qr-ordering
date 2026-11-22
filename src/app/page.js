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

function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [880, 1174].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
      o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.25);
    });
  } catch { /* audio not available — visual alert still shows */ }
}

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
  const [newDish, setNewDish] = useState({ name: '', category: 'Starters', price: '' });
  const prevReady = useRef(new Set());

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
      }
      const { data: r } = await supabase.from('ratings').select('*');
      if (r) setRatings(r.map((x) => ({ orderId: x.order_id, stars: x.stars, feedback: x.feedback })));
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

  // Waiter alert: chime when a new order becomes Ready
  useEffect(() => {
    const ready = new Set(orders.filter((o) => o.status === 'ready').map((o) => String(o.id)));
    const fresh = [...ready].filter((id) => !prevReady.current.has(id));
    if (fresh.length && prevReady.current.size) chime();
    prevReady.current = ready;
  }, [orders]);

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

  const myOrder = orders.find((o) => String(o.id) === String(myOrderId));
  const avgRating = ratings.length ? (ratings.reduce((s, r) => s + r.stars, 0) / ratings.length).toFixed(1) : '—';
  const revenue = orders.filter((o) => o.status !== 'rejected').reduce((s, o) => s + Number(o.total || 0), 0);
  const visibleMenu = menu.filter((d) => (cat === 'All' || d.category === cat) && d.available !== false);
  const slideDish = highlights[slide % Math.max(1, highlights.length)];
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://hotel-qr-ordering-alpha.vercel.app';

  return (
    <div>
      <header className="topbar">
        <h1>🍽️ Hotel <span>QR Ordering</span></h1>
        {!isLocked && (
          <nav className="switcher">
            {['customer', 'manager', 'chef', 'waiter'].map((v) => (
              <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
            ))}
          </nav>
        )}
      </header>
      {!isSupabaseConfigured && <div className="wrap"><div className="card" style={{ background: '#fff3cd' }}>Demo mode: Supabase is not configured yet — orders are kept in this browser only. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel to go live (see README).</div></div>}
      <div className="wrap">
        {notice && <div className="card" role="status">{notice} <button className="btn small ghost" onClick={() => setNotice('')}>Dismiss</button></div>}

        {view === 'customer' && (
          <div>
            {!table ? (
              <div className="card">
                <h2>Welcome! Scan complete — choose your table</h2>
                <p className="muted">Or open a table link directly: {siteUrl}/?table=T1 (T1–T4). Each table QR opens this page for that table.</p>
                <div className="tablepick">{TABLES.map((t) => <button key={t} className={table === t ? 'sel' : ''} onClick={() => setTable(t)}>{t}</button>)}</div>
              </div>
            ) : (
              <div className="card"><div className="row"><span className="chip green">Table {table}</span><span className="muted">You are ordering for table {table}.</span><button className="btn small ghost" onClick={() => setTable('')}>Change table</button></div></div>
            )}

            {slideDish && (
              <div className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}>
                <div className="progress">{highlights.map((d, i) => <button key={d.id} aria-label={d.name} onClick={() => setSlide(i)}><span style={{ width: i === slide ? '100%' : i < slide ? '100%' : '0%' }} /></button>)}</div>
                <img key={slideDish.id} className="kenburns" src={slideDish.img} alt={slideDish.name} />
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

            <div className="card">
              <h2>Menu</h2>
              <div className="row">{['All', ...CATEGORIES].map((c) => <button key={c} className={`btn small ${cat === c ? 'primary' : 'ghost'}`} onClick={() => setCat(c)}>{c}</button>)}</div>
              <div className="grid" style={{ marginTop: 14 }}>
                {visibleMenu.map((d) => (
                  <div key={d.id} className="dish card" style={{ margin: 0 }}>
                    <img className="dish-img" src={d.img} alt={d.name} loading="lazy" />
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

            <div className="card" id="bill">
              <h2>Your Bill {table ? `· Table ${table}` : ''}</h2>
              {cartItems.length === 0 ? <p className="muted">Cart is empty.</p> : cartItems.map((x) => (
                <div key={x.dish.id} className="row" style={{ justifyContent: 'space-between' }}><span>{x.dish.name} × {x.qty}</span><span>{fmt(x.dish.price * x.qty)}</span></div>
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
            </div>

            {myOrder && (
              <div className="card">
                <h2>Live Order Status</h2>
                <p><b>Order {String(myOrder.id).slice(0, 8)}</b> · Table {myOrder.table} · {fmt(myOrder.total)} · {myOrder.paymentMethod} ({myOrder.paymentStatus})</p>
                <div className="steps">{STEPS.map((s, i) => { const idx = STEPS.indexOf(myOrder.status); return <span key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''}>{STEP_LABELS[s]}</span>; })}</div>
                <p className="muted">Current status: <b>{STATUS_LABEL[myOrder.status] || myOrder.status}</b></p>
                {myOrder.status === 'served' && <ReceiptBox order={myOrder} />}
                {myOrder.status === 'served' && <RatingBox orderId={myOrder.id} onSubmit={submitRating} done={ratings.some((r) => String(r.orderId) === String(myOrder.id))} />}
              </div>
            )}
            {cartItems.length > 0 && (
              <button className="cart-fab" onClick={() => document.getElementById('bill')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                🛒 Cart · {cartItems.reduce((s, x) => s + x.qty, 0)} items · {fmt(total)}
              </button>
            )}
          </div>
        )}

        {view === 'manager' && (
          <div>
            <div className="row" style={{ marginBottom: 12 }}>
              <div className="stat"><span className="muted">Revenue (today)</span><b>{fmt(revenue)}</b></div>
              <div className="stat"><span className="muted">Orders</span><b>{orders.length}</b></div>
              <div className="stat"><span className="muted">Average rating</span><b>{avgRating} / 5</b></div>
              <div className="stat"><span className="muted">Needs action</span><b>{orders.filter((o) => o.status === 'placed').length}</b></div>
            </div>
            {TABLES.map((t) => {
              const list = orders.filter((o) => o.table === t);
              return (
                <div key={t} className="card"><h2>Table {t} {list.length ? `· ${list.length} order(s)` : '· No orders yet'}</h2>
                  {list.map((o) => (
                    <div key={o.id} className="ticket">
                      <div className="row"><b>{o.name}</b><span className="chip amber">{STATUS_LABEL[o.status] || o.status}</span><span className="chip">{o.paymentMethod} · {o.paymentStatus}</span><span className="price">{fmt(o.total)}</span></div>
                      <p className="muted">{o.items.map((it) => `${it.name} × ${it.qty}`).join(', ') || '—'}</p>
                      <p className="muted">{new Date(o.createdAt).toLocaleString('en-IN')} · {waitMins(o.createdAt)} min ago</p>
                      <div className="row">
                        {o.status === 'placed' && <><button className="btn green small" onClick={() => updateOrder(o.id, { status: 'verified' })}>Verify</button><button className="btn small ghost" onClick={() => updateOrder(o.id, { status: 'rejected' })}>Reject</button></>}
                        {o.status === 'verified' && <button className="btn primary small" onClick={() => updateOrder(o.id, { status: 'sent_to_chef' })}>Send to Chef</button>}
                        {o.paymentStatus !== 'paid' && <button className="btn gold small" onClick={() => updateOrder(o.id, { paymentStatus: 'paid' })}>Cash received ✓</button>}
                      </div>
                      {ratings.filter((r) => String(r.orderId) === String(o.id)).map((r, i) => <p key={i} className="muted">★ {r.stars}/5 — {r.feedback}</p>)}
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="card"><h2>Table QR Codes</h2><p className="muted">Print these from the <a href="/qr">printable QR page</a>. Each QR opens the customer page for that table.</p>
              <div className="qrgrid">{TABLES.map((t) => <div key={t}><img src={`/qr/table-${t.toLowerCase()}-qr.png`} alt={`QR for table ${t}`} /><p style={{ textAlign: 'center' }}><b>{t}</b><br /><span className="muted">{siteUrl}/?table={t}</span></p></div>)}</div>
            </div>
            <ManagerMenu menu={menu} setMenu={setMenu} newDish={newDish} setNewDish={setNewDish} fetchData={fetchData} />
          </div>
        )}

        {view === 'chef' && <ChefBoard orders={orders} updateOrder={updateOrder} />}
        {view === 'waiter' && <WaiterBoard orders={orders} updateOrder={updateOrder} />}
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
  async function addDish() {
    if (!newDish.name || !newDish.price) return;
    const dish = { name: newDish.name, category: newDish.category, price: Number(newDish.price), veg: true, img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80', desc: 'Added by manager.', available: true };
    if (supabase) { const { data } = await supabase.from('menu_items').insert({ name: dish.name, category: dish.category, price: dish.price, veg: true, image_url: dish.img, description: dish.desc, available: true }).select().single(); if (data) setMenu((m) => [...m, { ...dish, id: data.id }]); }
    else setMenu((m) => [...m, { ...dish, id: `m-${Date.now()}` }]);
    setNewDish({ name: '', category: 'Starters', price: '' }); fetchData();
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
      <div className="row">
        <input type="text" style={{ flex: 2 }} placeholder="Dish name" value={newDish.name} onChange={(e) => setNewDish({ ...newDish, name: e.target.value })} />
        <select style={{ flex: 1 }} value={newDish.category} onChange={(e) => setNewDish({ ...newDish, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <input type="number" style={{ flex: 1 }} placeholder="Price ₹" value={newDish.price} onChange={(e) => setNewDish({ ...newDish, price: e.target.value })} />
        <button className="btn primary" onClick={addDish}>Add Dish</button>
      </div>
      {menu.map((d) => (
        <div key={d.id} className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid #f0e6d8', padding: '6px 0' }}>
          <span>{d.name} <span className="muted">· {d.category} · {fmt(d.price)} {d.available === false ? '· OFF' : ''}</span></span>
          <span className="row"><button className="btn small ghost" onClick={() => editPrice(d)}>Edit price</button><button className="btn small ghost" onClick={() => toggleDish(d)}>{d.available === false ? 'Enable' : 'Disable'}</button><button className="btn small ghost" onClick={() => removeDish(d.id)}>Remove</button></span>
        </div>
      ))}
    </div>
  );
}

function ChefBoard({ orders, updateOrder }) {
  const lanes = [
    { key: 'new', title: 'New tickets', list: orders.filter((o) => o.status === 'sent_to_chef') },
    { key: 'fire', title: 'On the fire', list: orders.filter((o) => o.status === 'preparing') },
    { key: 'ready', title: 'Ready for pickup', list: orders.filter((o) => o.status === 'ready') }
  ];
  return (
    <div>
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

function WaiterBoard({ orders, updateOrder }) {
  const ready = orders.filter((o) => o.status === 'ready');
  const coming = orders.filter((o) => ['verified', 'sent_to_chef', 'preparing'].includes(o.status));
  const served = orders.filter((o) => o.status === 'served');
  return (
    <div>
      <h2>Waiter — pickup board</h2>
      {ready.map((o) => (
        <div key={o.id} className="alert">🔔 READY — Table {o.table}: {o.items.map((it) => `${it.name} × ${it.qty}`).join(', ')} — please serve now!
          <div style={{ marginTop: 10 }}><button className="btn gold" onClick={() => updateOrder(o.id, { status: 'served' })}>Received — Mark Served</button></div>
        </div>
      ))}
      {ready.length === 0 && <div className="card"><p className="muted">No ready orders right now. When the chef marks an order Ready, it will flash here with a chime.</p></div>}
      <div className="card"><h3>Coming up</h3>{coming.length === 0 ? <p className="muted">Nothing cooking.</p> : coming.map((o) => <p key={o.id}><b>{o.table}</b> — {o.items.map((it) => `${it.name} × ${it.qty}`).join(', ')} · {STATUS_LABEL[o.status]}</p>)}</div>
      <div className="card"><h3>Recently served</h3>{served.length === 0 ? <p className="muted">—</p> : served.slice(0, 10).map((o) => <p key={o.id}><b>{o.table}</b> — {o.items.map((it) => `${it.name} × ${it.qty}`).join(', ')} · {fmt(o.total)}</p>)}</div>
    </div>
  );
}

export default function Home() {
  return (<Suspense fallback={<div className="wrap"><div className="card">Loading…</div></div>}><HomeInner /></Suspense>);
}
