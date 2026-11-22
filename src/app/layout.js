import './globals.css';

export const metadata = {
  title: 'Hotel QR Ordering',
  description: 'Scan, order, track — Customer, Manager, Chef and Waiter in one app.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
