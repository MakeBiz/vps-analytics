'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RANGE_PRESETS, SOURCES, LINES, GRANS, GRAN_RU, autoGran } from '@/lib/filters';

const TITLES = {
  '/': 'Обзор',
  '/sources': 'Источники и метки',
  '/providers': 'Провайдеры',
  '/buttons': 'Кнопки и места',
  '/pages': 'Страницы',
  '/geo': 'Гео и устройства',
  '/marketing': 'Маркетинг',
  '/direct': 'Реклама · Директ',
  '/projects': 'Проекты и кампании',
  '/organic': 'Органика и SEO',
  '/seo': 'SEO: позиции, индексация, гео',
  '/partners': 'Партнёрки',
  '/royalties': 'Партнёрки Директ',
  '/funnels': 'Воронки',
  '/log': 'Журнал событий',
  '/sites': 'Сайты и подключение',
};

// Единая шапка на всех страницах. Фильтр, который на странице не действует, не
// исчезает, а гаснет с подсказкой почему: так видно, что цифры не подрезаны.
// Страницы-снимки кабинетов: период, сайт, источник и направление к ним не применяются.
const SNAPSHOT_NOTE = {
  '/marketing': 'снимок коннектора за последние 30 дней',
  '/seo': 'снимок кабинетов: Яндекс.Вебмастер + Google Search Console, сайт выбирается внутри страницы',
  '/direct': 'снимок Яндекс.Директа за ~30 дней',
  '/royalties': 'снимок партнёрок на дату сборки',
  '/projects': 'накопительный расход по кампаниям с 01.02.2026',
};
// Где работает разрез времени (есть график по датам).
const GRAN_TABS = new Set(['/', '/organic']);
// Где переключатель источника не имеет смысла.
const NO_SOURCE_TABS = new Set(['/organic', '/projects', '/sites', '/log']);
const RANGE_DAYS = { today: 1, yesterday: 1, '7d': 7, '30d': 30, '90d': 90, year: 365 };

export default function TopBar({ sites }) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();

  const snapshot = Boolean(SNAPSHOT_NOTE[path]);
  const range = sp.get('d') || '7d';
  const src = sp.get('src') || '';
  const site = sp.get('site') || '';
  const line = sp.get('line') || '';
  const gran = sp.get('g') || '';

  const set = (patch) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' || v === null || v === undefined) p.delete(k);
      else p.set(k, v);
    }
    p.delete('page');
    router.push(path + (p.toString() ? '?' + p.toString() : ''));
  };

  // Список сайтов сужается выбранным направлением; если выбранный сайт из другого
  // направления, снимаем выбор, чтобы не открыть пустой отчёт.
  const visible = sites.filter((s) => !line || (s.line || 'vps') === line);
  const pickLine = (k) => {
    const stays = !site || sites.some((s) => s.key === site && (!k || (s.line || 'vps') === k));
    set({ line: k, site: stays ? site : '' });
  };

  const Chip = ({ on, dis, title, onClick, children }) => (
    <a
      className={'chip' + (on ? ' on' : '')}
      title={title}
      onClick={dis ? undefined : onClick}
      style={{ cursor: dis ? 'default' : 'pointer', opacity: dis ? 0.4 : 1 }}
    >
      {children}
    </a>
  );

  const granNow = gran ? GRAN_RU[gran] : `${GRAN_RU[autoGran(RANGE_DAYS[range] || 30)]} (авто)`;
  const noSrc = snapshot || NO_SOURCE_TABS.has(path);

  return (
    <div className="top">
      <h1>{TITLES[path] || 'Аналитика'}</h1>

      <div className="chips" title="Направление: VPS-каталоги и партнёрки или сайты компании">
        {LINES.map(([k, label]) => (
          <Chip
            key={k || 'all'}
            on={line === k}
            dis={snapshot}
            title={snapshot ? 'На снимке кабинета направление не применяется' : undefined}
            onClick={() => pickLine(k)}
          >
            {label}
          </Chip>
        ))}
      </div>

      <div className="chips" title="Сайт внутри направления">
        <Chip on={!site} dis={snapshot} title={snapshot ? 'На снимке сайт выбирается внутри страницы' : undefined} onClick={() => set({ site: '' })}>
          Все сайты
        </Chip>
        {visible.map((s) => (
          <Chip
            key={s.key}
            on={site === s.key}
            dis={snapshot}
            title={snapshot ? 'На снимке сайт выбирается внутри страницы' : undefined}
            onClick={() => set({ site: s.key })}
          >
            {s.name}
          </Chip>
        ))}
      </div>

      <div className="chips" title="Период">
        {RANGE_PRESETS.map(([k, label]) => (
          <Chip
            key={k}
            on={range === k}
            dis={snapshot}
            title={snapshot ? 'Снимок собран на своём окне, период тут не действует' : undefined}
            onClick={() => set({ d: k, from: '', to: '' })}
          >
            {label}
          </Chip>
        ))}
      </div>

      <div className="chips" title={`Разрез времени на графиках, сейчас ${granNow}`}>
        {GRANS.map(([k, label]) => (
          <Chip
            key={k}
            on={gran === k}
            dis={!GRAN_TABS.has(path)}
            title={GRAN_TABS.has(path) ? undefined : 'Разрез действует там, где есть график по датам'}
            onClick={() => set({ g: k })}
          >
            {label}
          </Chip>
        ))}
        {gran && GRAN_TABS.has(path) ? (
          <Chip on={false} onClick={() => set({ g: '' })} title="Вернуть автоподбор разреза по длине периода">
            авто
          </Chip>
        ) : null}
      </div>

      <div className="chips" title="Органика включает прямые заходы; Реклама — платные клики">
        {SOURCES.map(([k, label]) => (
          <Chip
            key={k || 'all'}
            on={src === k}
            dis={noSrc}
            title={noSrc ? 'На этой странице источник не разделяется' : undefined}
            onClick={() => set({ src: k })}
          >
            {label}
          </Chip>
        ))}
      </div>

      {snapshot ? <span className="dim" style={{ fontSize: 12.5 }}>{SNAPSHOT_NOTE[path]}</span> : null}
    </div>
  );
}
