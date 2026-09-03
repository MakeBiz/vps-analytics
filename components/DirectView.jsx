'use client';
import { useMemo, useState } from 'react';
import { num, shortDate } from '@/lib/format';
import { Card, Kpi, Empty } from '@/components/ui';

const BRASS = '#c6a15b', STEEL = '#5b7a99', GOOD = '#6cbf8b', WARN = '#d9a441', BAD = '#d1697a';
const rub = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU') + ' ₽';
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const median = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const KIND_RU = { brand: 'бренд', rsya: 'РСЯ', site: 'сайт', search: 'поиск' };

// Комбо-график: столбцы расхода + линия конверсий по дням, в подсказке CPA.
function DailyChart({ rows }) {
  const [hi, setHi] = useState(null);
  const n = rows.length;
  if (n < 2) return <div className="empty">мало точек для динамики</div>;
  const W = 1000, H = 210, PL = 46, PR = 46, PT = 12, PB = 26;
  const maxCost = Math.max(1, ...rows.map((r) => r.cost));
  const maxConv = Math.max(1, ...rows.map((r) => r.conversions || 0));
  const bw = (W - PL - PR) / n;
  const X = (i) => PL + i * bw + bw / 2;
  const yCost = (v) => H - PB - (H - PT - PB) * (v / maxCost);
  const yConv = (v) => H - PB - (H - PT - PB) * (v / maxConv);
  const line = rows.map((r, i) => `${X(i).toFixed(1)},${yConv(r.conversions || 0).toFixed(1)}`).join(' ');
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const i = Math.floor(((e.clientX - rect.left) / rect.width * W - PL) / bw);
    setHi(Math.max(0, Math.min(n - 1, i)));
  };
  const labelEvery = Math.max(1, Math.ceil(n / 12));
  return (
    <div className="scroll" style={{ position: 'relative' }} onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="220" preserveAspectRatio="none" style={{ display: 'block', cursor: 'crosshair' }} onMouseMove={onMove}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={i} x1={PL} x2={W - PR} y1={PT + (H - PT - PB) * f} y2={PT + (H - PT - PB) * f} stroke="#26313d" strokeWidth="1" />
        ))}
        {rows.map((r, i) => (
          <rect key={i} x={PL + i * bw + bw * 0.16} y={yCost(r.cost)} width={bw * 0.68} height={Math.max(0, H - PB - yCost(r.cost))}
            fill={BRASS} opacity={hi == null || hi === i ? 0.85 : 0.4} rx="1.5" />
        ))}
        <polyline points={line} fill="none" stroke={GOOD} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {rows.map((r, i) => <circle key={i} cx={X(i)} cy={yConv(r.conversions || 0)} r="2.4" fill={GOOD} />)}
        {rows.map((r, i) => i % labelEvery === 0 || i === n - 1 ? (
          <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fill="#6b7987" fontSize="11">{shortDate(new Date(r.date), 'UTC')}</text>
        ) : null)}
        {hi != null && <line x1={X(hi)} x2={X(hi)} y1={PT} y2={H - PB} stroke="var(--line)" strokeWidth="1" />}
      </svg>
      {hi != null && rows[hi] && (() => {
        const r = rows[hi]; const cpa = r.conversions ? Math.round(r.cost / r.conversions) : null;
        const leftPct = (X(hi) / W) * 100;
        return (
          <div style={{ position: 'absolute', top: -4, left: `${leftPct}%`, transform: `translateX(${leftPct > 70 ? '-100%' : '-50%'})`, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 3, boxShadow: '0 6px 20px rgba(0,0,0,.35)' }}>
            <div className="dim" style={{ fontSize: 11, marginBottom: 4 }}>{r.date}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><span style={{ color: BRASS }}>Расход</span><b className="mono">{rub(r.cost)}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}><span style={{ color: GOOD }}>Конверсии</span><b className="mono">{r.conversions || 0}</b></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, borderTop: '1px solid var(--line)', marginTop: 4, paddingTop: 4 }}><span className="dim">CPA</span><b className="mono">{cpa != null ? rub(cpa) : '—'}</b></div>
          </div>
        );
      })()}
      <div className="chips" style={{ marginTop: 6 }}>
        <span className="tag" style={{ borderColor: BRASS, color: BRASS }}>Расход</span>
        <span className="tag" style={{ borderColor: GOOD, color: GOOD }}>Конверсии</span>
      </div>
    </div>
  );
}

function CampTable({ camps, medCPA }) {
  const [sort, setSort] = useState({ k: 'cost', d: -1 });
  const rows = useMemo(() => {
    const withM = camps.map((c) => {
      const cpa = c.conversions ? c.cost / c.conversions : null;
      const cr = c.clicks ? (c.conversions / c.clicks) * 100 : 0;
      return { ...c, cpa, cr };
    });
    const cmp = {
      cost: (a, b) => a.cost - b.cost, clicks: (a, b) => a.clicks - b.clicks,
      conversions: (a, b) => a.conversions - b.conversions, ctr: (a, b) => a.ctr - b.ctr,
      cpc: (a, b) => a.cpc - b.cpc, cpa: (a, b) => (a.cpa ?? 1e12) - (b.cpa ?? 1e12), cr: (a, b) => a.cr - b.cr,
    };
    return [...withM].sort((a, b) => (cmp[sort.k] ? cmp[sort.k](a, b) * sort.d : 0));
  }, [camps, sort]);
  const th = (k, label, title) => (
    <th className="n" title={title} style={{ cursor: 'pointer', color: sort.k === k ? 'var(--brass)' : undefined, whiteSpace: 'nowrap' }}
      onClick={() => setSort((s) => (s.k === k ? { k, d: -s.d } : { k, d: -1 }))}>{label}</th>
  );
  const cpaColor = (cpa) => (cpa == null ? BAD : cpa <= medCPA ? GOOD : cpa <= medCPA * 2 ? WARN : BAD);
  return (
    <div className="scroll">
      <table>
        <thead><tr>
          <th>Кампания</th><th>Тип</th>{th('impressions', 'Показы')}{th('clicks', 'Клики')}
          {th('ctr', 'CTR', 'клики / показы')}{th('cpc', 'CPC', 'расход / клики')}{th('cost', 'Расход')}
          {th('conversions', 'Конв.', 'цели Директа')}{th('cpa', 'CPA', 'расход / конверсии')}{th('cr', 'CR', 'конверсии / клики')}
        </tr></thead>
        <tbody>
          {rows.map((c) => {
            const flag = c.conversions === 0 && c.cost >= 1000 ? { t: 'нет конв.', c: BAD }
              : (c.cpa != null && c.cpa > medCPA * 2 && c.cost >= 1000) ? { t: 'дорого', c: WARN } : null;
            return (
              <tr key={c.id}>
                <td>{c.name}{flag ? <span style={{ marginLeft: 6, fontSize: 10.5, color: flag.c, border: `1px solid ${flag.c}`, borderRadius: 4, padding: '0 5px' }}>{flag.t}</span> : null}<div style={{ color: 'var(--muted)', fontSize: 10.5 }}>№ {c.id}</div></td>
                <td className="dim" style={{ fontSize: 12 }}>{KIND_RU[c.kind] || c.kind}</td>
                <td className="n muted">{num(c.impressions || 0)}</td>
                <td className="n">{num(c.clicks)}</td>
                <td className="n" style={{ color: c.ctr >= 10 ? GOOD : c.ctr < 5 && c.kind !== 'rsya' ? WARN : undefined }}>{c.ctr}%</td>
                <td className="n muted">{rub(c.cpc)}</td>
                <td className="n">{rub(c.cost)}</td>
                <td className="n">{c.conversions}</td>
                <td className="n" style={{ fontWeight: 600, color: cpaColor(c.cpa) }}>{c.cpa == null ? '—' : rub(Math.round(c.cpa))}</td>
                <td className="n" style={{ color: c.cr >= 8 ? GOOD : c.cr < 2 ? WARN : undefined }}>{c.cr.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Грубая привязка кампании к провайдеру/сайту по названию — для разреза воронки.
const GROUPS = [
  ['timeweb', 'Timeweb', /(?:^|[^a-zа-я])(tw|timeweb)(?:[^a-zа-я]|$)/i, '#c6a15b'],
  ['adminvps', 'AdminVPS', /adminvps/i, '#5b7a99'],
  ['aeza', 'Aeza', /aeza/i, '#b98cc4'],
  ['ishosting', 'is*hosting', /ishosting|is\*hosting|ish\b/i, '#6cbf8b'],
  ['podborvps', 'ПодборVPS', /podborvps|подбор/i, '#7f9dbb'],
  ['servercalc', 'ServerCalc', /servercalc/i, '#d9a441'],
];
function groupOf(name) {
  for (const [slug, label, re, color] of GROUPS) if (re.test(name || '')) return { slug, label, color };
  if (/провайдер/i.test(name || '')) return { slug: 'providers', label: 'Провайдеры (общее)', color: '#8a97a4' };
  return { slug: 'other', label: 'Прочее', color: '#6b7987' };
}

// Воронка канала: Показы → Клики → Конверсии (с CTR/CR), общая и по провайдерам.
function ChannelFunnel({ campaigns }) {
  const a = campaigns.reduce((t, c) => { t.imp += c.impressions || 0; t.clk += c.clicks || 0; t.conv += c.conversions || 0; t.cost += c.cost || 0; return t; }, { imp: 0, clk: 0, conv: 0, cost: 0 });
  const ctr = pct(a.clk, a.imp), cr = pct(a.conv, a.clk), cpa = a.conv ? Math.round(a.cost / a.conv) : null;
  const byProv = useMemo(() => {
    const g = {};
    for (const c of campaigns) {
      const gr = groupOf(c.name); const e = g[gr.slug] || (g[gr.slug] = { ...gr, imp: 0, clk: 0, conv: 0, cost: 0 });
      e.imp += c.impressions || 0; e.clk += c.clicks || 0; e.conv += c.conversions || 0; e.cost += c.cost || 0;
    }
    return Object.values(g).sort((x, y) => y.cost - x.cost);
  }, [campaigns]);
  const Stage = ({ label, value, sub, color }) => (
    <div style={{ flex: 1, textAlign: 'center', padding: '12px 6px', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
      <div style={{ fontSize: 23, fontWeight: 700, color: color || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div className="dim" style={{ fontSize: 12 }}>{label}</div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
  const Arrow = ({ v }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 8px', minWidth: 62 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brass)' }}>{v}</div>
      <div style={{ color: 'var(--dim)', fontSize: 18, lineHeight: 1 }}>→</div>
    </div>
  );
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <Stage label="Показы" value={num(a.imp)} />
        <Arrow v={`CTR ${ctr}%`} />
        <Stage label="Клики" value={num(a.clk)} />
        <Arrow v={`CR ${cr}%`} />
        <Stage label="Конверсии" value={num(Math.round(a.conv))} sub={cpa != null ? `CPA ${rub(cpa)}` : null} color={GOOD} />
      </div>
      <div className="scroll" style={{ marginTop: 14 }}>
        <table>
          <thead><tr><th>Провайдер / сайт</th><th className="n">Показы</th><th className="n">Клики</th><th className="n">CTR</th><th className="n">Конв.</th><th className="n">CR</th><th className="n">Расход</th><th className="n">CPA</th></tr></thead>
          <tbody>
            {byProv.map((p) => {
              const pctr = pct(p.clk, p.imp), pcr = pct(p.conv, p.clk), pcpa = p.conv ? Math.round(p.cost / p.conv) : null;
              return (
                <tr key={p.slug}>
                  <td><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: p.color, marginRight: 7 }} />{p.label}</td>
                  <td className="n muted">{num(p.imp)}</td>
                  <td className="n">{num(p.clk)}</td>
                  <td className="n" style={{ color: pctr >= 10 ? GOOD : pctr < 5 ? WARN : undefined }}>{pctr}%</td>
                  <td className="n">{Math.round(p.conv)}</td>
                  <td className="n" style={{ color: pcr >= 8 ? GOOD : pcr < 2 ? WARN : undefined }}>{pcr}%</td>
                  <td className="n">{rub(p.cost)}</td>
                  <td className="n" style={{ fontWeight: 600 }}>{pcpa != null ? rub(pcpa) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
        Окупаемость (доход роялти − расход, ROMI) — на «Партнёрки Директ» и «Проекты и кампании» (накопительно с 1 февраля). Здесь — эффективность самого канала за ~30 дней.
      </div>
    </div>
  );
}

export default function DirectView({ campaigns = [], daily = [], queries = {}, generated, win }) {
  const agg = useMemo(() => {
    const t = { cost: 0, impressions: 0, clicks: 0, conversions: 0 };
    for (const c of campaigns) { t.cost += c.cost || 0; t.impressions += c.impressions || 0; t.clicks += c.clicks || 0; t.conversions += c.conversions || 0; }
    return t;
  }, [campaigns]);
  const medCPA = useMemo(() => median(campaigns.filter((c) => c.conversions > 0).map((c) => c.cost / c.conversions)), [campaigns]);

  const recs = useMemo(() => {
    const out = [];
    for (const c of [...campaigns].sort((a, b) => b.cost - a.cost)) {
      const cpa = c.conversions ? c.cost / c.conversions : null;
      if (c.conversions === 0 && c.cost >= 1000) out.push({ sev: BAD, t: `Расход без конверсий: ${c.name}`, x: `${rub(c.cost)}, ${num(c.clicks)} кликов, 0 конверсий — проверить цель/ссылки, добавить минус-слова или снизить ставки` });
      else if (cpa != null && cpa > medCPA * 2 && c.cost >= 1500) out.push({ sev: WARN, t: `Дорогая конверсия: ${c.name}`, x: `CPA ${rub(Math.round(cpa))} при медиане ${rub(Math.round(medCPA))} — уточнить ключи, минус-слова, ставки` });
    }
    for (const c of campaigns) {
      if (c.impressions >= 200 && c.ctr < 4 && c.kind !== 'rsya') out.push({ sev: WARN, t: `Низкий CTR: ${c.name}`, x: `CTR ${c.ctr}% при ${num(c.impressions)} показах — переписать заголовки/тексты, уточнить таргет` });
      if (out.length >= 9) break;
    }
    // мусорные запросы под минус-слова (если коннектор их отдал)
    const mc = Array.isArray(queries.minusCandidates) ? queries.minusCandidates : [];
    for (const q of mc.slice(0, 3)) {
      const term = Array.isArray(q) ? q[0] : (q.q || q.query || q.term);
      const cost = Array.isArray(q) ? q[1] : (q.cost || 0);
      if (term) out.push({ sev: STEEL, t: `В минус-слова: «${term}»`, x: cost ? `тратит ${rub(cost)} без пользы — добавить в минус-слова кампании` : 'кандидат в минус-слова' });
    }
    return out.slice(0, 10);
  }, [campaigns, medCPA, queries]);

  const ctr = pct(agg.clicks, agg.impressions);
  const cpc = agg.clicks ? Math.round(agg.cost / agg.clicks) : 0;
  const cpa = agg.conversions ? Math.round(agg.cost / agg.conversions) : 0;
  const cr = pct(agg.conversions, agg.clicks);

  if (!campaigns.length) return <div className="grid" style={{ gap: 14 }}><Card><Empty text="Кампаний Директа в снимке нет. Обнови маркетинг и проверь список VPS-кампаний." /></Card></div>;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title="Обзор рекламы (Директ)" hint={`снимок за ~30 дней${win ? ` (${win.from || ''}…${win.to || ''})` : ''}${generated ? ` · ${generated}` : ''}. «Конверсии» — цели Директа (для VPS — переход к провайдеру)`}>
        <div className="grid kpis">
          <Kpi label="Расход" value={rub(agg.cost)} sub={`${campaigns.length} кампаний`} />
          <Kpi label="Показы" value={num(agg.impressions)} sub={`CTR ${ctr}%`} />
          <Kpi label="Клики" value={num(agg.clicks)} sub={`CPC ${rub(cpc)}`} />
          <Kpi label="Конверсии" value={num(Math.round(agg.conversions))} sub={`CR ${cr}%`} />
        </div>
        <div className="grid kpis" style={{ marginTop: 12 }}>
          <Kpi label="CPA (цена конверсии)" value={rub(cpa)} sub="расход / конверсии" />
          <Kpi label="CTR" value={ctr + '%'} sub="клики / показы" />
          <Kpi label="CPC" value={rub(cpc)} sub="расход / клики" />
          <Kpi label="CR (конверсия)" value={cr + '%'} sub="конверсии / клики" />
        </div>
      </Card>

      <Card title="Динамика по дням" hint="столбцы — расход, линия — конверсии; наведи — расход/конверсии/CPA за день">
        <DailyChart rows={daily} />
      </Card>

      <Card title="Кампании" hint="сортировка по клику на заголовок. CPA цветом: зелёный ≤ медианы, жёлтый до ×2, красный дороже или без конверсий">
        <CampTable camps={campaigns} medCPA={medCPA || 1} />
      </Card>

      <Card title="Воронка канала" hint="показы → клики → конверсии и где проседает, с разбивкой по провайдерам/сайтам">
        <ChannelFunnel campaigns={campaigns} />
      </Card>

      <Card title="Рекомендации" hint="что подкрутить в Директе по текущим данным">
        {recs.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>Явных проблем не видно — кампании в пределах нормы. Следи за CPA по дням.</div>
        ) : (
          <div>
            {recs.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < recs.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.sev, marginTop: 5, flex: 'none' }} />
                <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.t}</div><div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{r.x}</div></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
