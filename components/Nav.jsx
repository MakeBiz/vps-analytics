'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const ITEMS = [
  ['/', 'Обзор'],
  ['/funnels', 'Воронки'],
  ['/economics', 'Экономика'],
  ['/marketing', 'Маркетинг'],
  ['/royalties', 'Партнёрки Директ'],
  ['/payments', 'Оплаты'],
  ['/sources', 'Источники и метки'],
  ['/providers', 'Провайдеры'],
  ['/partners', 'Партнёры и публикация'],
  ['/buttons', 'Кнопки и места'],
  ['/pages', 'Страницы'],
  ['/geo', 'Гео и устройства'],
  ['/log', 'Журнал событий'],
];

export default function Nav() {
  const path = usePathname();
  const sp = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ['d', 'from', 'to', 'site', 'tz', 'bots']) {
    const v = sp.get(k);
    if (v) keep.set(k, v);
  }
  const s = keep.toString() ? '?' + keep.toString() : '';
  return (
    <aside className="side">
      <div className="brand">
        <b>Сквозная</b>
        <span>аналитика</span>
      </div>
      <nav className="nav">
        {ITEMS.map(([href, label]) => (
          <Link key={href} href={href + s} className={path === href ? 'on' : ''}>
            {label}
          </Link>
        ))}
        <div className="sep" />
        <Link href={'/sites' + s} className={path === '/sites' ? 'on' : ''}>
          Сайты и подключение
        </Link>
        <Link href="/logout" prefetch={false}>
          Выйти
        </Link>
      </nav>
    </aside>
  );
}
