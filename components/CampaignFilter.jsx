'use client';
import { useState } from 'react';
import { num } from '@/lib/format';

const rub = (n) => num(Math.round(n)) + ' ₽';
const cpcF = (n) => (n != null ? String(n).replace('.', ',') + ' ₽' : '—');
const baseName = (s) => String(s || '').replace(/\s*←\s*VPS\s*$/i, '').trim();
function ceilingFor(c) {
  if (!/TW Cloud/i.test(c.name) || c.kind === 'rsya') return null;
  return /Регионы/i.test(c.name) ? 28.5 : 33;
}

/**
 * Фильтр по кампаниям Директа + KPI и таблица расходов. Выбор кампаний
 * пересчитывает расход, CPC и таблицу на клиенте. Тренды показываем только
 * когда выбраны «Все» (они посчитаны по всему набору за прошлый период).
 */
export default function CampaignFilter({ campaigns = [], provClicks = 0, trends = {} }) {
  const ids = campaigns.map((c) => String(c.id));
  const [sel, setSel] = useState(() => new Set(ids));
  const allOn = sel.size === ids.length;
  const click = (id) => setSel((prev) => {
    if (prev.size === ids.length) return new Set([id]);
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id);
    return n.size === 0 ? new Set(ids) : n;
  });

  const chosen = campaigns.filter((c) => sel.has(String(c.id)));
  const vps = chosen.filter((c) => c.kind !== 'other');
  const vpsCost = vps.reduce((s, c) => s + c.cost, 0);
  const vpsClicks = vps.reduce((s, c) => s + c.clicks, 0);
  const avgCpc = vpsClicks ? vpsCost / vpsClicks : 0;
  const maxCost = Math.max(1, ...chosen.map((c) => c.cost));

  const kpis = [
    { v: rub(vpsCost), l: 'Расход Директа (VPS)', s: `${num(vpsClicks)} кликов`, t: allOn ? trends.spend : null, down: true },
    { v: cpcF(Number(avgCpc.toFixed(1))), l: 'Средний CPC', s: allOn ? 'по всем кампаниям' : 'по выбранным', t: allOn ? trends.cpc : null, down: true },
    { v: num(provClicks), l: 'Переходы к провайдеру', s: 'Метрика, все сайты' },
    { v: provClicks ? rub(vpsCost / provClicks) : '—', l: 'Цена перехода', s: 'расход / переходы' },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="dim" style={{ fontSize: 12, marginRight: 2 }}>кампании:</span>
        <button className={'chip' + (allOn ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setSel(new Set(ids))}>Все</button>
        {campaigns.map((c) => (
          <button key={c.id} className={'chip' + (!allOn && sel.has(String(c.id)) ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => click(String(c.id))}>{baseName(c.name)}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        {kpis.map((k, i) => {
          const good = k.t == null ? null : (k.down ? k.t <= 0 : k.t >= 0);
          return (
            <div key={i} className="card" style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.15 }}>{k.v}</div>
              <div style={{ fontSize: 12, marginTop: 3 }}>{k.l}</div>
              <div className="dim" style={{ fontSize: 11 }}>{k.s}</div>
              {k.t != null ? (
                <div style={{ fontSize: 11, marginTop: 3, color: good ? '#3fae7a' : '#e0736d' }}>
                  {k.t > 0 ? '▲ +' : '▼ '}{k.t}% к пред. 30 дн
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="card">
        <h2>Директ: расход по кампаниям<span className="hint">за 30 дней, красным CPC выше потолка</span></h2>
        {chosen.length === 0 ? <div className="empty">Кампании не выбраны</div> : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Кампания</th><th className="n">Расход</th><th className="n">Клики</th>
                  <th className="n">CTR</th><th className="n">CPC</th><th className="n">Доля расхода</th>
                </tr>
              </thead>
              <tbody>
                {chosen.map((c) => {
                  const cap = ceilingFor(c);
                  const over = cap != null && c.cpc > cap;
                  const w = Math.max(2, Math.round((c.cost / maxCost) * 100));
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className="n">{rub(c.cost)}</td>
                      <td className="n">{num(c.clicks)}</td>
                      <td className="n muted">{String(c.ctr).replace('.', ',')}%</td>
                      <td className="n" style={over ? { color: '#e0736d', fontWeight: 600 } : undefined}>{cpcF(c.cpc)}</td>
                      <td className="n barcell"><span className="bg" style={{ width: w + '%' }} /><span className="fg">{num(c.cost)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
