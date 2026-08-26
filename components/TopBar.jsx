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
  '/organic': 'Органика и SEO',
  '/partners': 'Партнёрки',
  '/royalties': 'Партнёрки Директ',
  '/funnels': 'Воронки',
  '/log': 'Журнал событий',
  '/sites': 'Сайты и подключение',
};

// Вкладки на снимке коннектора (30 дней): фильтры периода/сайта/источника к ним не применяются.
const SNAPSHOT_TABS = new Set(['/marketing']);
// Страницы, где переключатель источника не нужен (уже только органика).
const NO_SOURCE_TABS = new Set(['/organic']);

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
          снимок коннектора за последние 30 дней · фильтры тут не действуют
        </span>
      </div>
    );
  }

  const range = sp.get('d') || '7d';
  const src = sp.get('src') || '';
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

      <select value={sp.get('site') || ''} onChange={(e) => set({ site: e.target.value })}>
        <option value="">Все сайты</option>
        {sites.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </select>

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
