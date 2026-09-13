'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/icons';
import { parseFilters } from '@/lib/filters';

/**
 * Инструменты шапки: поиск, уведомления, меню пользователя и выбор дат.
 * Все четыре рабочие — мёртвых кнопок в панели не держим.
 */

const PAGES = [
  ['/', 'Обзор'], ['/funnels', 'Воронки'], ['/sources', 'Источники и метки'],
  ['/pages', 'Страницы'], ['/geo', 'Гео и устройства'], ['/seo', 'Поиск: переходы и позиции'],
  ['/ai', 'AI-видимость'], ['/direct', 'Директ'], ['/projects', 'Проекты и бюджет'],
  ['/providers', 'Провайдеры'], ['/buttons', 'Кнопки и места'], ['/royalties', 'Доход партнёрок'],
  ['/partners', 'Публикация у партнёров'], ['/log', 'Журнал событий'], ['/sites', 'Сайты и подключение'],
];

const MON = ['янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
const dd = (s) => Number(String(s).slice(8, 10));
const mm = (s) => Number(String(s).slice(5, 7)) - 1;
const yy = (s) => String(s).slice(0, 4);

export function fmtRange(from, to) {
  if (!from || !to) return 'период';
  if (from === to) return `${dd(from)} ${MON[mm(from)]} ${yy(from)}`;
  if (yy(from) === yy(to) && mm(from) === mm(to)) return `${dd(from)} – ${dd(to)} ${MON[mm(to)]} ${yy(to)}`;
  if (yy(from) === yy(to)) return `${dd(from)} ${MON[mm(from)]} – ${dd(to)} ${MON[mm(to)]} ${yy(to)}`;
  return `${dd(from)} ${MON[mm(from)]} ${yy(from)} – ${dd(to)} ${MON[mm(to)]} ${yy(to)}`;
}

// Закрытие по клику мимо и по Esc. Один хук на все три всплывашки.
function useOutside(open, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

/* ---------------- поиск ---------------- */
export function SearchBox({ sites = [], providers = [] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cur, setCur] = useState(0);
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const input = useRef(null);

  // ⌘K и Ctrl+K. На русской раскладке та же клавиша даёт «л», ловим и её.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && ['k', 'л'].includes(String(e.key).toLowerCase())) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 10); else { setQ(''); setCur(0); } }, [open]);

  const go = useCallback((href) => { setOpen(false); router.push(href); }, [router]);
  const keep = () => new URLSearchParams(sp.toString());

  const items = useMemo(() => {
    const all = [
      ...PAGES.map(([href, name]) => ({
        kind: 'Раздел', name, icon: 'grid',
        run: () => { const p = keep(); p.delete('page'); go(href + (p.toString() ? '?' + p.toString() : '')); },
      })),
      ...sites.map((s) => ({
        kind: 'Сайт', name: s.name, sub: s.domain || '', icon: 'globe',
        run: () => { const p = keep(); p.set('site', s.key); p.delete('page'); go(path + '?' + p.toString()); },
      })),
      ...providers.map((p0) => ({
        kind: 'Провайдер', name: p0.name, sub: 'открыть карточку', icon: 'server',
        run: () => { const p = keep(); p.set('provider', p0.slug); p.delete('page'); go('/providers?' + p.toString()); },
      })),
    ];
    const t = q.trim().toLowerCase();
    if (!t) return all.slice(0, 10);
    return all.filter((it) => (it.name + ' ' + (it.sub || '')).toLowerCase().includes(t)).slice(0, 40);
  }, [q, sites, providers, path, sp, go]);

  useEffect(() => { setCur(0); }, [q]);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCur((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCur((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); items[cur]?.run(); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <>
      <button type="button" className="search" onClick={() => setOpen(true)}>
        <Icon name="search" size={15} />
        Поиск по панели
        <kbd>⌘K</kbd>
      </button>
      {open ? (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="palette">
            <input
              ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
              placeholder="Начните вводить: ServerCalc, RackNerd, воронки…"
            />
            <div className="list">
              {items.length === 0 ? (
                <div className="row" style={{ cursor: 'default' }}><span className="s">Ничего не нашлось</span></div>
              ) : items.map((it, i) => (
                <button
                  type="button" key={it.kind + it.name} className={'row' + (i === cur ? ' sel' : '')}
                  onMouseEnter={() => setCur(i)} onClick={() => it.run()}
                >
                  <span style={{ color: 'var(--brass)', marginTop: 1 }}><Icon name={it.icon} size={15} /></span>
                  <span style={{ flex: 1 }}>
                    <span className="t">{it.name}</span>
                    {it.sub ? <><br /><span className="s">{it.sub}</span></> : null}
                  </span>
                  <span className="s">{it.kind}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ---------------- уведомления ---------------- */
export function Bell({ alerts = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, useCallback(() => setOpen(false), []));
  return (
    <div className="tool" ref={ref}>
      <button type="button" className="iconbtn" aria-label="Что требует внимания"
        title="Что требует внимания" onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" />
        {alerts.length ? <span className="dot" /> : null}
      </button>
      {open ? (
        <div className="pop" style={{ minWidth: 340 }}>
          <div className="ttl">Требует внимания</div>
          {alerts.length === 0 ? (
            <div className="row" style={{ cursor: 'default' }}>
              <span className="s">Всё спокойно: площадки шлют события, снимок свежий</span>
            </div>
          ) : alerts.map((a, i) => (
            <a className="row" key={i} href={a.href || '#'}>
              <span style={{ color: a.level === 'bad' ? 'var(--bad)' : 'var(--warn)', marginTop: 1 }}>
                <Icon name="warn" size={15} />
              </span>
              <span style={{ flex: 1 }}>
                <span className="t">{a.title}</span><br />
                <span className="s">{a.text}</span>
              </span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- меню пользователя ---------------- */
export function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, useCallback(() => setOpen(false), []));
  return (
    <div className="tool" ref={ref}>
      <button type="button" className="avatar" aria-label="Меню" onClick={() => setOpen((v) => !v)}>А</button>
      {open ? (
        <div className="pop" style={{ minWidth: 210 }}>
          <div className="ttl">Панель</div>
          <a className="row" href="/sites"><span className="t">Сайты и подключение</span></a>
          <a className="row" href="/log"><span className="t">Журнал событий</span></a>
          <div className="sep" />
          <a className="row" href="/logout"><span className="t" style={{ color: 'var(--bad)' }}>Выйти</span></a>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- выбор дат ---------------- */
export function DateRange({ disabled }) {
  const sp = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, useCallback(() => setOpen(false), []));

  const f = parseFilters(Object.fromEntries(sp.entries()));
  const [from, setFrom] = useState(f.from);
  const [to, setTo] = useState(f.to);
  useEffect(() => { setFrom(f.from); setTo(f.to); }, [f.from, f.to]);

  const apply = () => {
    if (!from || !to || from > to) return;
    const p = new URLSearchParams(sp.toString());
    p.set('from', from); p.set('to', to); p.delete('d'); p.delete('page');
    setOpen(false);
    router.push(path + '?' + p.toString());
  };
  const reset = () => {
    const p = new URLSearchParams(sp.toString());
    p.delete('from'); p.delete('to'); p.set('d', '7d'); p.delete('page');
    setOpen(false);
    router.push(path + '?' + p.toString());
  };

  return (
    <div className="tool" ref={ref} style={{ marginLeft: 'auto' }}>
      <button type="button" className="daterange" onClick={() => !disabled && setOpen((v) => !v)}
        title={disabled ? 'На этой странице период не действует' : 'Произвольный диапазон дат'}
        style={disabled ? { opacity: 0.45, cursor: 'default' } : undefined}>
        <Icon name="calendar" size={15} />
        {fmtRange(f.from, f.to)}
        <Icon name="chevron" size={15} />
      </button>
      {open && !disabled ? (
        <div className="pop" style={{ minWidth: 280 }}>
          <div className="ttl">Произвольный диапазон</div>
          <div style={{ display: 'flex', gap: 8, padding: '4px 9px 10px' }}>
            <label style={{ flex: 1 }}>
              <div className="s" style={{ color: 'var(--dim)', fontSize: 11.5, marginBottom: 4 }}>с</div>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: '100%' }} />
            </label>
            <label style={{ flex: 1 }}>
              <div className="s" style={{ color: 'var(--dim)', fontSize: 11.5, marginBottom: 4 }}>по</div>
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={{ width: '100%' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '0 9px 6px' }}>
            <button type="button" onClick={apply} style={{ flex: 1 }}>Применить</button>
            <button type="button" className="ghost" onClick={reset}>Сбросить</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
