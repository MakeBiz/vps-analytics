'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RANGE_PRESETS, SOURCES } from '@/lib/filters';

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

// Вкладки на снимке кабинетов/коннектора: фильтры периода/сайта/источника к ним не применяются.
const SNAPSHOT_TABS = new Set(['/marketing', '/seo', '/direct']);
const SNAPSHOT_NOTE = {
  '/marketing': 'снимок коннектора за последние 30 дней · фильтры тут не действуют',
  '/seo': 'снимок кабинетов: Яндекс.Вебмастер + Google Search Console · выбор сайта — внутри страницы',
  '/direct': 'снимок Яндекс.Директа за ~30 дней · фильтры периода/сайта тут не действуют',
};
// Страницы, где переключатель источника (Всё/Органика/Реклама) не нужен.
const NO_SOURCE_TABS = new Set(['/organic', '/projects']);

export default function TopBar({ sites }) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();

  const set = (patch) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === '' || v === null || v === undefined) p.delete(k);
      else p.set(k, v);
    }
    p.delete('page');
    router.push(path + (p.toString() ? '?' + p.toString() : ''));
  };

  if (SNAPSHOT_TABS.has(path)) {
    return (
      <div className="top">
        <h1>{TITLES[path] || 'Аналитика'}</h1>
        <span className="dim" style={{ fontSize: 12.5 }}>
          {SNAPSHOT_NOTE[path] || 'снимок коннектора · фильтры тут не действуют'}
        </span>
      </div>
    );
  }

  const range = sp.get('d') || '7d';
  const src = sp.get('src') || '';
  const site = sp.get('site') || '';
  const showSource = !NO_SOURCE_TABS.has(path);

  return (
    <div className="top">
      <h1>{TITLES[path] || 'Аналитика'}</h1>

      <div className="chips">
        {RANGE_PRESETS.map(([k, label]) => (
          <a
            key={k}
            className={'chip' + (range === k ? ' on' : '')}
            onClick={() => set({ d: k, from: '', to: '' })}
            style={{ cursor: 'pointer' }}
          >
            {label}
          </a>
        ))}
      </div>

      <div className="chips" title="Выбор сайта">
        <a
          className={'chip' + (!site ? ' on' : '')}
          onClick={() => set({ site: '' })}
          style={{ cursor: 'pointer' }}
        >
          Все сайты
        </a>
        {sites.map((s) => (
          <a
            key={s.key}
            className={'chip' + (site === s.key ? ' on' : '')}
            onClick={() => set({ site: s.key })}
            style={{ cursor: 'pointer' }}
          >
            {s.name}
          </a>
        ))}
      </div>

      {showSource && (
        <div className="chips" title="Органика включает прямые заходы; Реклама — платные клики">
          {SOURCES.map(([k, label]) => (
            <a
              key={k || 'all'}
              className={'chip' + (src === k ? ' on' : '')}
              onClick={() => set({ src: k })}
              style={{ cursor: 'pointer' }}
            >
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
