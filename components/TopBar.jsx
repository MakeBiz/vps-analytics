'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { RANGES, TZ_LIST } from '@/lib/filters';

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

// Вкладки на снимке коннектора (30 дней): фильтры периода/сайта к ним не применяются.
const SNAPSHOT_TABS = new Set(['/marketing']);

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

  const range = sp.get('from') && sp.get('to') ? 'custom' : sp.get('d') || '7d';

  if (SNAPSHOT_TABS.has(path)) {
    return (
      <div className="top">
        <h1>{TITLES[path] || 'Аналитика'}</h1>
        <span className="dim" style={{ fontSize: 12.5 }}>
          снимок коннектора за последние 30 дней · фильтры периода и сайта тут не действуют
        </span>
      </div>
    );
  }

  return (
    <div className="top">
      <h1>{TITLES[path] || 'Аналитика'}</h1>

      <div className="chips">
        {RANGES.map(([k, label]) => (
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

      <input
        type="date"
        value={sp.get('from') || ''}
        onChange={(e) => set({ from: e.target.value, d: '' })}
        title="Начало периода"
      />
      <input
        type="date"
        value={sp.get('to') || ''}
        onChange={(e) => set({ to: e.target.value, d: '' })}
        title="Конец периода"
      />

      <select value={sp.get('site') || ''} onChange={(e) => set({ site: e.target.value })}>
        <option value="">Все сайты</option>
        {sites.map((s) => (
          <option key={s.key} value={s.key}>
            {s.name}
          </option>
        ))}
      </select>

      <select value={sp.get('tz') || 'Asia/Dubai'} onChange={(e) => set({ tz: e.target.value })}>
        {TZ_LIST.map(([z, l]) => (
          <option key={z} value={z}>
            {l}
          </option>
        ))}
      </select>

      <label className="muted" style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12.5 }}>
        <input
          type="checkbox"
          checked={sp.get('bots') === '1'}
          onChange={(e) => set({ bots: e.target.checked ? '1' : '' })}
        />
        роботы
      </label>
    </div>
  );
}
