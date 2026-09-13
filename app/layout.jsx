import './globals.css';

export const metadata = {
  title: 'Сквозная аналитика',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <head>
        {/* Inter из комплекта дизайна. Если шрифт не подгрузился, панель
            откатывается на системный стек и вёрстка не едет */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
