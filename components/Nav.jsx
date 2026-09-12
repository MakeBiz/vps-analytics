'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Меню сгруппировано по смыслу работы, а не по таблицам данных. Группы:
 * сводка, трафик, поиск, реклама, партнёрки, служебное.
 * VPS-блоки (провайдеры, кнопки, партнёрки) скрываются, когда в шапке выбрано
 * направление MakeBiz: у сайта компании нет ни провайдеров, ни роялти.
 */
const GROUPS = [
  ['Сводка', [
    ['/', 'Обзор'],
    ['/funnels', 'Воронки'],
  ]],
  ['Трафик', [
    ['/sources', 'Источники и метки'],
    ['/pages', 'Страницы'],
    ['/geo', 'Гео и устройства'],
  ]],
  ['Поиск', [
    ['/seo', 'Поиск: переходы и позиции'],
    ['/ai', 'AI-видимость'],
  ]],
  ['Реклама', [
    ['/direct', 'Директ'],
    ['/projects', 'Проекты и бюджет'],
  ]],
  ['Партнёрки', [
    ['/providers', 'Провайдеры'],
    ['/buttons', 'Кнопки и места'],
    ['/royalties', 'Доход партнёрок'],
    ['/partners', 'Публикация у партнёров'],
  ], 'vps'],
  ['Служебное', [
    ['/log', 'Журнал событий'],
    ['/sites', 'Сайты и подключение'],
  ]],
];

export default function Nav() {
  const path = usePathname();
  const sp = useSearchParams();
  const line = sp.get('line') || '';
  const keep = new URLSearchParams();
  for (const k of ['d', 'from', 'to', 'site', 'tz', 'bots', 'line', 'g', 'src']) {
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
        {GROUPS.map(([title, items, only]) => {
          if (only && line && line !== only) return null;
          return (
            <div key={title}>
              <div className="dim" style={{ fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', margin: '12px 10px 4px' }}>
                {title}
              </div>
              {items.map(([href, label]) => (
                <Link key={href} href={href + s} className={path === href ? 'on' : ''}>
                  {label}
                </Link>
              ))}
            </div>
          );
        })}
        <div className="sep" />
        <Link href="/logout" prefetch={false}>Выйти</Link>
      </nav>
    </aside>
  );
}
