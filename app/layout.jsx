import './globals.css';

export const metadata = {
  title: 'Сквозная аналитика',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
