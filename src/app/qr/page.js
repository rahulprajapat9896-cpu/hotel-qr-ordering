'use client';

const TABLES = ['T1', 'T2', 'T3', 'T4'];
const BASE = 'https://hotel-qr-ordering-alpha.vercel.app';

export default function QrPrintPage() {
  return (
    <div>
      <header className="topbar noprint">
        <h1>🍽️ Hotel <span>QR Ordering</span> — Table QR Codes</h1>
        <button className="btn gold" onClick={() => window.print()}>Print all QR codes</button>
      </header>
      <div className="wrap">
        <div className="card noprint">
          <p>Print this page and stick one QR on each table. Scanning a QR opens the customer page for that table directly — e.g. <code>{BASE}/?table=T1</code>. Use your browser&apos;s Print (Ctrl/Cmd + P) for best results.</p>
          <p><a href="/">← Back to the app</a></p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
          {TABLES.map((t) => (
            <div key={t} style={{ border: '2px solid #1c0f0a', borderRadius: 16, padding: 20, textAlign: 'center', background: '#fff', breakInside: 'avoid' }}>
              <div style={{ fontSize: 40, fontWeight: 900 }}>Table {t}</div>
              <div style={{ fontSize: 14, marginBottom: 12 }}>Scan to view menu &amp; order</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/qr/table-${t.toLowerCase()}-qr.png`} alt={`QR code for table ${t}`} style={{ width: '100%', maxWidth: 320, margin: '0 auto', display: 'block' }} />
              <div style={{ fontSize: 13, marginTop: 12 }}>{BASE}/?table={t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
