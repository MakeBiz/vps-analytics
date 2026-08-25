'use client';
import { useState } from 'react';
import { num } from '@/lib/format';

const rub = (n) => num(Math.round(n)) + ' ₽';
const cpcF = (n) => (n != null ? String(Number(n).toFixed(1)).replace('.', ',') + ' ₽' : '—');
const pctF = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// Оценка кампании: у VPS-кампаний с потолком — по CPC к потолку; у остальных нейтрально.
function verdict(c) {
  if (c.ceiling) {
    const r = c.cpc / c.ceiling;
    if (r <= 0.85) return { t: 'дёшево', c: 'good' };
    if (r <= 1.0) return { t: 'в норме', c: 'ok' };
    if (r <= 1.15) return { t: 'дороговато', c: 'warn' };
    return { t: 'дорого', c: 'bad' };
  }
  return { t: '—', c: 'muted' };
}
const VC = { good: '#3fae7a', ok: '#6f97bf', warn: '#d9a441', bad: '#e0736d', muted: 'var(--dim)' };

/**
 * Два слоя оценки рекламы в стандартном оформлении панели:
 *  A — рейтинг кампаний (сортировка, фильтр по типу, раскрытие групп);
 *  B — экономика воронки по типам (агрегаторы / провайдеры).
 */
export default function MarketingBoard({ camps = [], groups = {}, funnel = { aggregators: [], providers: [] } }) {
  const [type, setType] = useState('all'); // all | agg | prov
  const [sort, setSort] = useState({ k: 'cost', d: -1 });
  const [open, setOpen] = useState(null);

  const totalCost = camps.reduce((s, c) => s + c.cost, 0);
  const filtered = camps.filter((c) => type === 'all' || c.type === type);
  const cmp = {
    cost: (a, b) => a.cost - b.cost, clicks: (a, b) => a.clicks - b.clicks,
    ctr: (a, b) => a.ctr - b.ctr, cpc: (a, b) => a.cpc - b.cpc,
    ceil: (a, b) => (a.ceiling ? a.cpc / a.ceiling : 0) - (b.ceiling ? b.cpc / b.ceiling : 0),
  };
  const rows = [...filtered].sort((a, b) => (cmp[sort.k] ? cmp[sort.k](a, b) * sort.d : 0));
  const maxCost = Math.max(1, ...rows.map((c) => c.cost));
  const toggle = (k) => setSort((s) => (s.k === k ? { k, d: -s.d } : { k, d: -1 }));
  const arr = (k) => (sort.k === k ? (sort.d < 0 ? ' ▾' : ' ▴') : '');
  const SortTh = ({ k, children }) => (
    <th className="n" style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', color: sort.k === k ? 'var(--brass)' : undefined }} onClick={() => toggle(k)}>{children}{arr(k)}</th>
  );

  const TYPE_RU = { agg: 'агрегатор', prov: 'провайдер', rsya: 'РСЯ' };

  return (
    <>
      {/* ---------- Слой A: рейтинг кампаний ---------- */}
      <div className="card">
        <h2>Рейтинг кампаний<span className="hint">оценка по цене клика к потолку, клик по строке — группы внутри</span></h2>
        <div className="chips" style={{ margin: '2px 0 12px' }}>
          <span className="dim" style={{ fontSize: 12, marginRight: 2, alignSelf: 'center' }}>тип:</span>
          {[['all', 'Все'], ['agg', 'Агрегаторы (наши сайты)'], ['prov', 'Провайдеры']].map(([k, l]) => (
            <button key={k} className={'chip' + (type === k ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Кампания</th><th>Тип</th>
                <SortTh k="cost">Расход</SortTh><th className="n">Доля</th>
                <SortTh k="clicks">Клики</SortTh><SortTh k="ctr">CTR</SortTh>
                <SortTh k="cpc">CPC</SortTh><SortTh k="ceil">К потолку</SortTh>
                <th className="n">Оценка</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const v = verdict(c);
                const w = Math.max(2, Math.round((c.cost / maxCost) * 100));
                const grp = groups[c.base] || [];
                const isOpen = open === c.id;
                return (
                  <>
                    <tr key={c.id} style={{ cursor: grp.length ? 'pointer' : 'default' }} onClick={() => grp.length && setOpen(isOpen ? null : c.id)}>
                      <td>{grp.length ? <span className="dim" style={{ marginRight: 6 }}>{isOpen ? '▾' : '▸'}</span> : null}{c.base}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{TYPE_RU[c.type] || c.type}</td>
                      <td className="n barcell"><span className="bg" style={{ width: w + '%' }} /><span className="fg">{rub(c.cost)}</span></td>
                      <td className="n muted">{pctF(c.cost, totalCost)}%</td>
                      <td className="n">{num(c.clicks)}</td>
                      <td className="n muted">{String(c.ctr).replace('.', ',')}%</td>
                      <td className="n">{cpcF(c.cpc)}</td>
                      <td className="n" style={{ color: c.ceiling ? VC[v.c] : 'var(--dim)', fontWeight: c.ceiling ? 600 : 400 }}>{c.ceiling ? '×' + (c.cpc / c.ceiling).toFixed(2).replace('.', ',') : '—'}</td>
                      <td className="n" style={{ color: VC[v.c], fontWeight: 600, fontSize: 12.5 }}>{v.t}</td>
                    </tr>
                    {isOpen && grp.map((g, i) => (
                      <tr key={c.id + '-' + i} style={{ background: 'var(--panel-2)' }}>
                        <td style={{ paddingLeft: 26 }} className="muted">↳ {g.group || 'без группы'}</td>
                        <td className="dim" style={{ fontSize: 11 }}>группа</td>
                        <td className="n muted">{rub(g.cost)}</td><td className="n" />
                        <td className="n muted">{num(g.clicks)}</td><td className="n" />
                        <td className="n muted">{cpcF(g.cpc)}</td><td className="n" /><td className="n" />
                      </tr>
                    ))}
                  </>
                );
              })}
              {rows.length === 0 ? <tr><td colSpan={9}><div className="empty">Нет кампаний этого типа с расходом за период</div></td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Слой B: экономика воронки ---------- */}
      <div className="card">
        <h2>Экономика воронки<span className="hint">по типам кампаний</span></h2>

        <div style={{ fontSize: 12.5, color: 'var(--brass)', fontWeight: 600, margin: '4px 0 6px' }}>Агрегаторы — вся воронка клик → визит сайта → переход к провайдеру</div>
        {funnel.aggregators.length === 0 ? <div className="empty">Нет данных</div> : (
          <div className="grid cols2" style={{ gap: 14 }}>
            {funnel.aggregators.map((a) => {
              const steps = [
                { l: 'Клики Директа', v: a.clicks, c: '#5b7a99' },
                { l: 'Визиты сайта', v: a.visits, c: '#6f97bf' },
                { l: 'Переходы к провайдеру', v: a.providerClicks, c: '#c6a15b' },
              ];
              const top = steps[0].v || 1;
              const cpa = a.providerClicks ? a.cost / a.providerClicks : null;
              const dear = cpa && cpa > 60;
              return (
                <div key={a.site} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <b>{a.name}</b>
                    <span className="dim" style={{ fontSize: 12 }}>расход {rub(a.cost)}</span>
                  </div>
                  {steps.map((s, i) => {
                    const w = Math.max(3, Math.round((s.v / top) * 100));
                    const prev = i > 0 ? steps[i - 1].v : null;
                    const drop = prev != null && prev > 0 ? Math.round((1 - s.v / prev) * 100) : null;
                    return (
                      <div key={i} style={{ marginBottom: 7 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 2 }}>
                          <span>{s.l}</span><b>{num(s.v)}</b>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 16, background: 'var(--panel-2)', borderRadius: 5, overflow: 'hidden', border: '1px solid var(--line)' }}>
                            <div style={{ width: w + '%', height: '100%', background: s.c, opacity: .9 }} />
                          </div>
                          <span className="dim" style={{ width: 78, textAlign: 'right', fontSize: 11 }}>{drop != null ? (drop > 0 ? `−${drop}%` : 'без потерь') : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', flexWrap: 'wrap', fontSize: 12.5 }}>
                    <span>Стоимость перехода <b style={{ color: dear ? VC.bad : 'var(--brass)' }}>{cpa ? rub(cpa) : '—'}</b></span>
                    <span className="dim">конверсия визит→переход {pctF(a.providerClicks, a.visits)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>
          Визиты и переходы — из Метрики по всему сайту (не только Директ), поэтому воронка оценочная сверху. Точная привязка к кампании появится с разметкой yclid.
        </div>

        <div style={{ fontSize: 12.5, color: '#6f97bf', fontWeight: 600, margin: '14px 0 6px' }}>Провайдеры — верх воронки, дальше кабинет партнёра</div>
        {funnel.providers.length === 0 ? <div className="empty">Нет данных</div> : (
          <div className="scroll">
            <table>
              <thead><tr><th>Кампания</th><th className="n">Показы</th><th className="n">Клики</th><th className="n">CPC</th><th className="n">Расход</th></tr></thead>
              <tbody>
                {funnel.providers.map((p) => (
                  <tr key={p.name}><td>{p.name}</td><td className="n muted">{num(p.impr)}</td><td className="n">{num(p.clicks)}</td><td className="n">{cpcF(p.cpc)}</td><td className="n">{rub(p.cost)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="dim" style={{ fontSize: 11, marginTop: 8 }}>Конверсии и выплаты по провайдер-кампаниям живут в кабинете партнёра, в Директе их нет.</div>
      </div>
    </>
  );
}
