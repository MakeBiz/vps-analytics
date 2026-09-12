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
  '/seo': 'Поиск',
  '/ai': 'AI-видимость',
  '/partners': 'Партнёрки',
  '/royalties': 'Партнёрки Директ',
  '/funnels': 'Воронки',
  '/log': 'Журнал событий',
  '/sites': 'Сайты и подключение',
};

/**
 * Единая шапка на всех страницах панели. Порядок фильтров всегда один:
 * Направление → Сайт → Период → Разрез → Источник.
 * Фильтр, который на странице не действует, не исчезает, а гаснет с подсказкой
 * почему: так видно, что цифры не подрезаны втихую.
 * CAPS описывает, что страница реально умеет; чего нет в CAPS — умеет всё.
 */
const FULL = { line: 1, site: 1, period: 1, gran: 0, src: 1 };
const CAPS = {
  '/': { line: 1, site: 1, period: 1, gran: 1, src: 1 },
  '/organic': { line: 1, site: 1, period: 1, gran: 1, src: 0 },
  '/seo': { line: 1, site: 1, period: 1, gran: 1, src: 0 },
  '/ai': { line: 0, site: 0, period: 0, gran: 0, src: 0 },
  '/direct': { line: 0, site: 0, period: 1, gran: 1, src: 0 },
  '/marketing': { line: 0, site: 0, period: 0, gran: 0, src: 0 },
  '/royalties': { line: 0, site: 0, period: 0, gran: 0, src: 0 },
  '/projects': { line: 0, site: 0, period: 0, gran: 0, src: 0 },
  '/sites': { line: 0, site: 0, period: 0, gran: 0, src: 0 },
  '/log': { line: 1, site: 1, period: 1, gran: 0, src: 0 },
};
// Подпись у страниц, которые живут на снимке кабинетов, а не на живых событиях.
const NOTE = {
  '/marketing': 'снимок коннектора за последние 30 дней',
  '/ai': 'снимок зонда нейросетей: Perplexity, OpenAI, GigaChat',
  '/direct': 'кампании и конверсии — снимок за 30 дней, график расхода слушается периода',
  '/royalties': 'снимок партнёрок на дату сборки',
  '/projects': 'накопительный расход по кампаниям с 01.02.2026',
  '/seo': 'позиции и индексация — снимок кабинетов, переходы — живые данные',
};
const RANGE_DAYS = { today: 1, yesterday: 1, '7d': 7, '30d': 30, '90d': 90, year: 365 };

export default function TopBar({ sites }) {
  const path = usePathname();
  const sp = useSearchParams();
  const router = useRouter();

  const caps = CAPS[path] || FULL;
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
  const why = 'На этой странице фильтр не действует';

  return (
    <div className="top">
      <h1>{TITLES[path] || 'Аналитика'}</h1>

      <div className="chips" title="Направление: VPS-каталоги и партнёрки или сайты компании">
        {LINES.map(([k, label]) => (
          <Chip key={k || 'all'} on={line === k} dis={!caps.line} title={caps.line ? undefined : why} onClick={() => pickLine(k)}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="chips" title="Сайт внутри направления">
        <Chip on={!site} dis={!caps.site} title={caps.site ? undefined : 'Сайт выбирается внутри страницы'} onClick={() => set({ site: '' })}>
          Все сайты
        </Chip>
        {visible.map((s) => (
          <Chip key={s.key} on={site === s.key} dis={!caps.site} title={caps.site ? undefined : 'Сайт выбирается внутри страницы'} onClick={() => set({ site: s.key })}>
            {s.name}
          </Chip>
        ))}
      </div>

      <div className="chips" title="Период">
        {RANGE_PRESETS.map(([k, label]) => (
          <Chip key={k} on={range === k} dis={!caps.period} title={caps.period ? undefined : 'Снимок собран на своём окне, период тут не действует'} onClick={() => set({ d: k, from: '', to: '' })}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="chips" title={`Разрез времени на графиках, сейчас ${granNow}`}>
        {GRANS.map(([k, label]) => (
          <Chip key={k} on={gran === k} dis={!caps.gran} title={caps.gran ? undefined : 'Разрез действует там, где есть график по датам'} onClick={() => set({ g: k })}>
            {label}
          </Chip>
        ))}
        {gran && caps.gran ? (
          <Chip on={false} onClick={() => set({ g: '' })} title="Вернуть автоподбор разреза по длине периода">
            авто
          </Chip>
        ) : null}
      </div>

      <div className="chips" title="Органика включает прямые заходы; Реклама — платные клики">
        {SOURCES.map(([k, label]) => (
          <Chip key={k || 'all'} on={src === k} dis={!caps.src} title={caps.src ? undefined : 'На этой странице источник не разделяется'} onClick={() => set({ src: k })}>
            {label}
          </Chip>
        ))}
      </div>

      {NOTE[path] ? <span className="dim" style={{ fontSize: 12.5 }}>{NOTE[path]}</span> : null}
    </div>
  );
}
