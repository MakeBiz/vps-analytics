'use client';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { num, pct } from '@/lib/format';

/**
 * Провайдеры по сайтам с фильтром сверху и сортировкой.
 * - кнопки сайтов сверху (Все / по отдельности, мультивыбор) фильтруют колонки и итоги;
 * - таблица сортируется по клику: Переходы, Визиты (дошедшие до перехода), Конверсия, Доля.
 * rows: [{ provider, name, site_key, clicks, sessions }] (serverselection уже исключён на сервере)
 * directions: [{ key, name }] — доступные направления (сайты)
 * visits: { site_key: число визитов } — всего визитов на сайт (знаменатель конверсии)
 */
export default function ProvidersView({ rows = [], directions = [], visits = {}, selectedProvider = '' }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();

  const dirKeys = directions.map((d) => d.key);
  const [sel, setSel] = useState(() => new Set(dirKeys));
  const [sort, setSort] = useState({ key: 'clicks', dir: -1 });

  const allOn = sel.size === dirKeys.length;
  const clickDir = (k) => setSel((prev) => {
    if (prev.size === dirKeys.length) return new Set([k]);
    const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k);
    return n.size === 0 ? new Set(dirKeys) : n;
  });
  const selDirs = directions.filter((d) => sel.has(d.key));

  // агрегируем провайдеров по выбранным направлениям
  const totals = new Map();
  for (const r of rows) {
    if (!sel.has(r.site_key)) continue;
    if (!totals.has(r.provider)) totals.set(r.provider, { provider: r.provider, name: r.name, clicks: 0, sessions: 0, by: {} });
    const t = totals.get(r.provider);
    t.clicks += r.clicks;
    t.sessions += r.sessions;
    t.by[r.site_key] = (t.by[r.site_key] || 0) + r.clicks;
  }
  const totalVisits = selDirs.reduce((s, d) => s + (visits[d.key] || 0), 0);
  const grandClicks = [...totals.values()].reduce((s, t) => s + t.clicks, 0);
  const grandSessions = [...totals.values()].reduce((s, t) => s + t.sessions, 0);

  let list = [...totals.values()].map((t) => ({
    ...t,
    share: grandClicks ? t.clicks / grandClicks : 0,
    conv: totalVisits ? t.sessions / totalVisits : 0,
  }));
  const cmp = { clicks: (a, b) => a.clicks - b.clicks, sessions: (a, b) => a.sessions - b.sessions, conv: (a, b) => a.conv - b.conv, share: (a, b) => a.share - b.share };
  list.sort((a, b) => (cmp[sort.key] ? cmp[sort.key](a, b) * sort.dir : 0));
  const maxClicks = Math.max(1, ...list.map((t) => t.clicks));

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: -1 }));
  const arrow = (key) => (sort.key === key ? (sort.dir < 0 ? ' ▾' : ' ▴') : '');
  const Sortable = ({ k, children }) => (
    <th className="n" style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: sort.key === k ? 'var(--brass)' : undefined }} onClick={() => toggleSort(k)}>
      {children}{arrow(k)}
    </th>
  );

  const goProvider = (slug) => {
    const p = new URLSearchParams(sp.toString());
    if (slug === selectedProvider || !slug) p.delete('provider');
    else p.set('provider', slug);
    router.push(path + (p.toString() ? '?' + p.toString() : ''));
  };

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <span className="dim" style={{ fontSize: 12, marginRight: 2 }}>сайты:</span>
        <button className={'chip' + (allOn ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setSel(new Set(dirKeys))}>Все</button>
        {directions.map((d) => (
          <button key={d.key} className={'chip' + (!allOn && sel.has(d.key) ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => clickDir(d.key)}>{d.name}</button>
        ))}
      </div>

      {list.length === 0 ? <div className="empty">За период переходов к провайдерам не было</div> : (
        <div className="scroll tall">
          <table>
            <thead>
              <tr>
                <th>Провайдер</th>
                {selDirs.map((d) => <th key={d.key} className="n">{d.name}</th>)}
                <Sortable k="clicks">Переходы</Sortable>
                <Sortable k="share">Доля</Sortable>
                <Sortable k="sessions">Визиты с переходом</Sortable>
                <Sortable k="conv">Конверсия</Sortable>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const w = Math.max(2, Math.round((t.clicks / maxClicks) * 100));
                return (
                  <tr key={t.provider} style={t.provider === selectedProvider ? { background: 'rgba(198,161,91,.10)' } : undefined}>
                    <td>
                      <a style={{ cursor: 'pointer' }} onClick={() => goProvider(t.provider)}>{t.name || t.provider}</a>
                      <span className="dim mono" style={{ marginLeft: 6 }}>{t.provider}</span>
                    </td>
                    {selDirs.map((d) => (
                      <td key={d.key} className="n muted">{t.by[d.key] ? num(t.by[d.key]) : '·'}</td>
                    ))}
                    <td className="n barcell"><span className="bg" style={{ width: w + '%' }} /><span className="fg">{num(t.clicks)}</span></td>
                    <td className="n muted">{pct(t.clicks, grandClicks)}</td>
                    <td className="n dim">{num(t.sessions)}</td>
                    <td className="n muted">{pct(t.sessions, totalVisits)}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="muted"><b>Итого</b></td>
                {selDirs.map((d) => (
                  <td key={d.key} className="n muted">{num(list.reduce((acc, t) => acc + (t.by[d.key] || 0), 0))}</td>
                ))}
                <td className="n"><b>{num(grandClicks)}</b></td>
                <td className="n muted">100%</td>
                <td className="n dim">{num(grandSessions)}</td>
                <td className="n muted">{pct(grandSessions, totalVisits)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="dim" style={{ fontSize: 11.5, marginTop: 6 }}>
        Конверсия — доля визитов на выбранные сайты, дошедших до перехода к провайдеру. Всего визитов за период: {num(totalVisits)}.
      </div>
    </>
  );
}
