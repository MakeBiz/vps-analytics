'use client';
import { useState } from 'react';
import { Card } from '@/components/ui';

const rub = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU') + ' ₽';
const MONTHS_RU = { '01': 'янв', '02': 'фев', '03': 'мар', '04': 'апр', '05': 'май', '06': 'июн', '07': 'июл', '08': 'авг', '09': 'сен', '10': 'окт', '11': 'ноя', '12': 'дек' };
const moLabel = (m) => { const mm = String(m).split('-')[1]; return MONTHS_RU[mm] || m; };
const GOOD = '#3fae7a';
const RED = '#e0736d';

// Столбцы расхода по месяцам с накоплением по провайдерам + подсказка при наведении.
function MonthlyStacked({ byMonthProv, providers }) {
  const [hi, setHi] = useState(null);
  const max = Math.max(1, ...byMonthProv.map((x) => x.total));
  const H = 200;
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHi(null)}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: H }}>
        {byMonthProv.map((x, i) => (
          <div key={x.m} onMouseEnter={() => setHi(i)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'pointer', opacity: hi == null || hi === i ? 1 : 0.55 }}>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', marginBottom: 3 }}>{x.total ? Math.round(x.total / 1000) + 'к' : ''}</div>
            <div style={{ width: '100%', maxWidth: 40, height: Math.round((x.total / max) * (H - 26)) + 'px', minHeight: x.total ? 2 : 0, display: 'flex', flexDirection: 'column-reverse', borderRadius: '3px 3px 0 0', overflow: 'hidden' }}>
              {providers.map((p) => {
                const c = x.prov[p.slug] || 0; if (!c) return null;
                return <div key={p.slug} style={{ height: (c / (x.total || 1)) * 100 + '%', background: p.color }} />;
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4 }}>{moLabel(x.m)}</div>
          </div>
        ))}
      </div>
      {hi != null && byMonthProv[hi] ? (
        <div style={{ position: 'absolute', top: 0, left: `${(hi + 0.5) / byMonthProv.length * 100}%`, transform: `translateX(${hi > byMonthProv.length * 0.6 ? '-100%' : '-10%'})`, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 11px', fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 4, boxShadow: '0 6px 20px rgba(0,0,0,.35)' }}>
          <div className="dim" style={{ fontSize: 11, marginBottom: 5 }}>{moLabel(byMonthProv[hi].m)} {byMonthProv[hi].m.split('-')[0]}</div>
          {providers.map((p) => {
            const c = byMonthProv[hi].prov[p.slug] || 0; if (!c) return null;
            return (
              <div key={p.slug} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', margin: '2px 0' }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: p.color, marginRight: 6 }} />{p.name}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{rub(c)}</span>
              </div>
            );
          })}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 5, paddingTop: 5, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span className="dim">Итого</span><span className="mono" style={{ fontWeight: 700 }}>{rub(byMonthProv[hi].total)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Рентабельность по провайдерам: доход (роялти) − расход (реклама) = net,
// «Рентаб.» = прибыль на ₽ рекламы (net / расход).
function ProfitTable({ providers, net, spendProv }) {
  const byNet = {}; for (const n of net || []) byNet[n.slug] = n;
  return (
    <div className="scroll">
      <table>
        <thead><tr><th>Провайдер</th><th className="n">Доход</th><th className="n">Расход</th><th className="n">Net</th><th className="n" title="прибыль на ₽ рекламы (net / расход)">Рентаб.</th></tr></thead>
        <tbody>
          {providers.map((p) => {
            const n = byNet[p.slug] || {};
            const revenue = n.revenue;
            const sp = n.spend != null ? n.spend : (spendProv[p.slug] || 0);
            const nt = revenue == null ? null : revenue - sp;
            const pct = (nt == null || !sp) ? null : (nt / sp) * 100;
            return (
              <tr key={p.slug}>
                <td><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: p.color, marginRight: 7 }} />{p.name}</td>
                <td className="n muted">{revenue == null ? '—' : rub(revenue)}</td>
                <td className="n">{rub(sp)}</td>
                <td className="n" style={{ fontWeight: 600, color: nt == null ? undefined : nt >= 0 ? GOOD : RED }}>{nt == null ? '—' : rub(nt)}</td>
                <td className="n" style={{ color: pct == null ? undefined : pct >= 0 ? GOOD : RED }}>{pct == null ? '—' : (Math.round(pct) + '%')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function RoyMarketingSpend({ spend }) {
  const [open, setOpen] = useState(false);
  const bmp = spend.byMonthProv || [];
  const providers = spend.providers || [];
  const camps = spend.byCampaign || [];
  const maxC = Math.max(1, ...camps.map((c) => c.cost));
  const totalNet = (spend.net || []).filter((n) => n.net != null).reduce((s, n) => s + n.net, 0);
  const totalRev = (spend.net || []).reduce((s, n) => s + (n.revenue || 0), 0);

  return (
    <Card title="Расход на рекламу (Директ)" hint={`с ${spend.since}; что учитывать — настраивается на «Проекты и кампании». Наведи на столбец — разбивка по провайдерам.`}>
      <div style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 12 }}>
        Всего: <b style={{ color: 'var(--text)' }}>{rub(spend.total)}</b> · Доход партнёрок: <b style={{ color: 'var(--text)' }}>{rub(totalRev)}</b> · Net: <b style={{ color: totalNet >= 0 ? GOOD : RED }}>{rub(totalNet)}</b>
      </div>

      <div className="grid cols2" style={{ gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>По месяцам (накопление по провайдерам)</div>
          {bmp.length ? <MonthlyStacked byMonthProv={bmp} providers={providers} /> : <div className="note" style={{ margin: 0 }}>нет данных</div>}
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>Рентабельность по провайдерам (доход − реклама)</div>
          {providers.length ? <ProfitTable providers={providers} net={spend.net} spendProv={spend.spendProv || {}} /> : <div className="note" style={{ margin: 0 }}>нет провайдеров</div>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12, fontSize: 12, color: 'var(--dim)' }}>
        {providers.map((p) => <span key={p.slug}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: p.color, marginRight: 6 }} />{p.name}</span>)}
      </div>

      <div style={{ marginTop: 14 }}>
        <div onClick={() => setOpen((v) => !v)} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Разбивка по кампаниям ({camps.length}) {open ? '▾' : '▸'}
        </div>
        {open ? (
          <div className="scroll" style={{ marginTop: 8 }}>
            <table>
              <thead><tr><th>Кампания</th><th className="n">Расход с {spend.since}</th><th /></tr></thead>
              <tbody>
                {camps.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}<div style={{ color: 'var(--muted)', fontSize: 11 }}>№ {c.id}</div></td>
                    <td className="n barcell"><span className="bg" style={{ width: Math.round((c.cost / maxC) * 100) + '%' }} /><span className="fg">{rub(c.cost)}</span></td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
