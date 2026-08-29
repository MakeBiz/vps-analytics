'use client';
import { useState } from 'react';
import { Card, Kpi } from '@/components/ui';

const rub = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU') + ' ₽';
const MONTHS_RU = { '01': 'янв', '02': 'фев', '03': 'мар', '04': 'апр', '05': 'май', '06': 'июн', '07': 'июл', '08': 'авг', '09': 'сен', '10': 'окт', '11': 'ноя', '12': 'дек' };
const moLabel = (m) => { const mm = String(m).split('-')[1]; return MONTHS_RU[mm] || m; };
const GOOD = '#3fae7a';
const RED = '#e0736d';

// Блок расхода на рекламу для страницы «Партнёрки Директ»: итоги, помесячный график
// и разбивка по кампаниям. Данные — из «Проекты и кампании» (только «в бюджете»).
export default function RoyMarketingSpend({ spend }) {
  const [open, setOpen] = useState(false);
  const bm = spend.byMonth || [];
  const maxMo = Math.max(1, ...bm.map((x) => x.cost));
  const camps = spend.byCampaign || [];
  const totalRev = (spend.net || []).reduce((s, n) => s + (n.revenue || 0), 0);
  const totalNet = (spend.net || []).filter((n) => n.net != null).reduce((s, n) => s + n.net, 0);
  const maxC = Math.max(1, ...camps.map((c) => c.cost));

  return (
    <Card title="Расход на рекламу (Директ)" hint={`всего «в бюджете» с ${spend.since}; что учитывать — настраивается на «Проекты и кампании»`}>
      <div className="grid kpis" style={{ marginBottom: 12 }}>
        <Kpi label="Всего на рекламу" value={rub(spend.total)} sub={`с ${spend.since}`} />
        <Kpi label="Доход партнёрок" value={rub(totalRev)} sub="по провайдерам с доходом" />
        <Kpi label="Net: доход − реклама" value={rub(totalNet)} sub={totalNet >= 0 ? 'в плюсе' : 'в минусе'} />
      </div>

      {bm.length ? (
        <>
          <div style={{ fontSize: 12, color: 'var(--dim)', margin: '4px 0 8px' }}>Расход по месяцам</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 130 }}>
            {bm.map((x) => (
              <div key={x.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, justifyContent: 'flex-end', height: '100%' }} title={`${x.m}: ${rub(x.cost)}`}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{Math.round(x.cost / 1000)}к</div>
                <div style={{ width: '100%', maxWidth: 38, height: Math.round((x.cost / maxMo) * 84) + '%', minHeight: 2, background: 'var(--brass)', borderRadius: '3px 3px 0 0' }} />
                <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>{moLabel(x.m)}</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

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
        ) : <div className="note" style={{ margin: '8px 0 0' }}>Свёрнуто. Нажми, чтобы увидеть расход по каждой кампании.</div>}
      </div>
    </Card>
  );
}
