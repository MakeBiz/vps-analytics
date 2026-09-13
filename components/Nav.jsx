'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Icon from '@/components/icons';

/**
 * Меню сгруппировано по смыслу работы, а не по таблицам данных. Группы:
 * сводка, трафик, поиск, реклама, партнёрки, служебное.
 * VPS-блоки (провайдеры, кнопки, партнёрки) скрываются, когда в шапке выбрано
 * направление MakeBiz: у сайта компании нет ни провайдеров, ни роялти.
 */
const GROUPS = [
  ['Сводка', [
    ['/', 'Обзор', 'grid'],
    ['/funnels', 'Воронки', 'funnel'],
  ]],
  ['Трафик', [
    ['/sources', 'Источники и метки', 'tag'],
    ['/pages', 'Страницы', 'file'],
    ['/geo', 'Гео и устройства', 'globe'],
  ]],
  ['Поиск', [
    ['/seo', 'Поиск: переходы и позиции', 'search'],
    ['/ai', 'AI-видимость', 'spark'],
  ]],
  ['Реклама', [
    ['/direct', 'Директ', 'ads'],
    ['/projects', 'Проекты и бюджет', 'wallet'],
  ]],
  ['Партнёрки', [
    ['/providers', 'Провайдеры', 'server'],
    ['/buttons', 'Кнопки и места', 'cursor'],
    ['/royalties', 'Доход партнёрок', 'coins'],
    ['/partners', 'Публикация у партнёров', 'link'],
  ], 'vps'],
  ['Служебное', [
    ['/log', 'Журнал событий', 'list'],
    ['/sites', 'Сайты и подключение', 'plug'],
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
              <div className="gtitle">{title}</div>
              {items.map(([href, label, icon]) => (
                <Link key={href} href={href + s} className={path === href ? 'on' : ''}>
                  <Icon name={icon} />
                  {label}
                </Link>
              ))}
            </div>
          );
        })}
        <div className="sep" />
        <Link href="/logout" prefetch={false}>
          <Icon name="logout" />
          Выйти
        </Link>
      </nav>
      <div className="side-foot">
        Больше<br />данных<br />больше<br />возможностей
        <Icon name="wave" size={34} />
      </div>
    </aside>
  );
}
