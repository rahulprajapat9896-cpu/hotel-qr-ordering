# Hotel QR Ordering — Vercel + Supabase version

Standalone deployable version of the Hotel QR Ordering app (the same app
Rahul approved as a Muse demo). One app, four views with a top switcher:
**Customer · Manager · Chef · Waiter**. Site language is English.
Tables are only **T1–T4**. GST is 5%.

## What it does

- **Customer** — Opens from a table QR code (`/?table=T1` … `/?table=T4`).
  Auto-playing slideshow of the highest-rated dishes (Ken Burns zoom-pan,
  progress bars, prev/next, ADD straight from a slide), full menu of
  59 dishes (Starters, Veg Main Course, Non-Veg Main Course, Breads,
  Rice & Biryani, Desserts, Beverages, Cold Drinks 200 ml ₹25 / 300 ml ₹40 /
  750 ml ₹60 / 1 L ₹80, Tea & Coffee), cart, GST bill, Cash/UPI payment,
  place order, 6-step live status tracker, star rating + feedback after
  the order is served.
- **Manager** — Table-wise orders (one panel per table showing items, bill,
  payment state), Verify / Reject, Send to Chef, Cash received ✓,
  revenue + average-rating stats, table QR tiles, full menu management
  (add dish, edit price, enable/disable, remove).
- **Chef** — 3-lane board: New tickets → On the fire → Ready for pickup.
  Only verified orders. Per-order buttons: Start Preparing → Mark Ready.
  Wait-time badge on every ticket.
- **Waiter** — Only which table ordered what. When the chef marks Ready,
  a pulsing red alert banner + chime names the table and items; the
  waiter taps **Received — Mark Served** to complete the order.
- **Live updates** — Supabase Realtime subscription on `orders`, with
  3-second polling as fallback, so all four views stay in sync.
- **Printable QR page** — `/qr` shows all 4 table QR codes for printing.
  The QR images are also in the repo at `public/qr/table-t1-qr.png` …
  `public/qr/table-t4-qr.png` (copies of `qr-codes/`).

## Tech

Next.js 14 (App Router) on Vercel. Supabase Postgres is the only
backend/database. No other server, no hardcoded localhost URLs.
If Supabase env vars are missing, the app runs in demo mode on the
built-in seed menu with browser-local orders (banner shown on the page).

## Deploy — exact steps

### 1. Supabase — create the database

Option A — **use the existing project** (already signed in):
org `nitkkr-library`, project **"rahulprajapat9896-cpu's Project"**,
API URL `https://vqbogkazpphmibgypyge.supabase.co`, region ap-south-1
(Mumbai). No new project needed.

Option B — **fresh hotel project** (cleaner): Supabase Dashboard →
New project → name `hotel-qr-ordering` → region **South Asia (Mumbai)**
→ set a database password and save it.

Then, in either project:
1. Open **SQL Editor → New query**.
2. Paste the whole contents of `supabase/schema.sql` and click **Run**.
   It creates `menu_items`, `orders`, `order_items`, `ratings` and seeds
   all 59 dishes. Re-running it is safe (IF NOT EXISTS / ON CONFLICT).
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (kept as a
     placeholder in `.env.example`; the app only needs the anon key at
     runtime — never commit a real key to the repo).

### 2. GitHub — push the code

```bash
cd hotel-qr-ordering-deploy
git init
git add .
git commit -m "Hotel QR Ordering — Vercel + Supabase"
git branch -M main
git remote add origin https://github.com/rahulprajapat9896-cpu/hotel-qr-ordering.git
git push -u origin main
```

Repo is currently empty, so the first push creates everything.
`.env.local` is git-ignored — never push real keys.

### 3. Vercel — import and deploy

1. Vercel Dashboard (team **rahul-6450**, Hobby) → **Add New → Project** →
   **Import** `rahulprajapat9896-cpu/hotel-qr-ordering`.
2. Framework preset: **Next.js** (auto-detected). Leave build command
   as `next build`.
3. **Environment Variables** — add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` = your service-role key (optional)
4. Click **Deploy**. The live URL will be
   `https://hotel-qr-ordering.vercel.app` (Vercel may add a suffix if
   that name is taken — use whatever URL Vercel shows; the QR codes
   below assume exactly this URL).

> Vercel Hobby is free for personal/non-commercial use. For a real
> commercial hotel, Vercel Pro ($20/seat/month) is the compliant plan.
> Supabase free tier: 500 MB database, project pauses after 1 week idle.

### 4. QR codes — print and stick

The QR codes encode exactly these URLs — **do not change them**:

- T1 → `https://hotel-qr-ordering.vercel.app/?table=T1`
- T2 → `https://hotel-qr-ordering.vercel.app/?table=T2`
- T3 → `https://hotel-qr-ordering.vercel.app/?table=T3`
- T4 → `https://hotel-qr-ordering.vercel.app/?table=T4`

Open `https://hotel-qr-ordering.vercel.app/qr` in a browser, click
**Print all QR codes**, print, cut out and stick one QR per table.
The same PNGs are in `public/qr/` in this repo.

## Test flow (do this once after deploy)

1. Open `https://hotel-qr-ordering.vercel.app/?table=T1` on a phone —
   Customer view for T1, slideshow + menu should show.
2. Add **Butter Chicken** (+ a Naan), choose **UPI**, place the order.
3. Switch to **Manager** → Table T1 panel → **Verify** → **Send to Chef**.
4. Switch to **Chef** → ticket is in New tickets → **Start Preparing** →
   **Mark Ready ✓**.
5. Switch to **Waiter** → red alert for T1 → **Received — Mark Served**.
6. Back on **Customer** → status tracker shows Served → give 5 stars +
   feedback. Manager stats should now show the revenue and rating.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev                  # http://localhost:3000
npm run build                # production build check
```

## Files

| Path | What it is |
| --- | --- |
| `src/app/page.js` | All 4 views (Customer / Manager / Chef / Waiter) |
| `src/app/qr/page.js` | Printable QR page (`/qr`) |
| `src/app/layout.js`, `src/app/globals.css` | Shell + styles (Ken Burns, pulse alert) |
| `src/lib/menu.js` | Seed menu — 59 dishes, prices, Unsplash photos |
| `src/lib/supabase.js` | Supabase client (null when env vars missing) |
| `supabase/schema.sql` | Tables + RLS note + 59-dish seed |
| `public/qr/*.png` | Printable table QR codes |
| `qr-codes/*.png` | Original QR PNGs (same files as `public/qr/`) |
| `package.json`, `next.config.js`, `vercel.json` | Next.js + Vercel config |
| `.env.example`, `.gitignore` | Env template, ignored files |
