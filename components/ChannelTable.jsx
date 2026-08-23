'use client';
import { useState } from 'react';

const num = (n) => Number(n || 0).toLocaleString('ru-RU');
const fp = (x) => (Number(x) || 0).toFixed(1).replace('.', ',') + '%';

/**
 * Таблица каналов захода с сортировкой по клику на метрику сверху.
 * rows: [{channel, visits, clicks, ...}] ; totalVisits — сумма для доли.
 */
export default function ChannelTable({ rows = [], totalVisits = 0 }) {
  const [key, setKey] = useState('visits');
  const data = rows.map((r) => ({
    ...r,
    conv: r.visits ? (r.clicks / r.visits) * 100 : 0,
    share: totalVisits ? (r.visits / totalVisits) * 100 : 0,
  }));
  const metric = {
    visits: { label: 'Заходы', get: (r) => r.visits },
    clicks: { label: 'Переходы', get: (r) => r.clicks },
    conv: { label: 'Конверсия', get: (r) => r.conv },
  };
  const sorted = [...data].sort((a, b) => metric[key].get(b) - metric[key].get(a));
  const max = Math.max(1, ...sorted.map((r) => metric[key].get(r)));
  const hl = { color: 'var(--brass)' };

  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <span className="dim" style={{ fontSize: 12, alignSelf: 'center', marginRight: 2 }}>сортировать:</span>
        {Object.entries(metric).map(([k, m]) => (
          <button key={k} onClick={() => setKey(k)} className={'chip' + (key === k ? ' on' : '')} style={{ cursor: 'pointer' }}>{m.label}</button>
        ))}
      </div>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Канал</th>
              <th className="n" style={key === 'visits' ? hl : undefined}>Заходы</th>
              <th className="n">Доля</th>
              <th className="n" style={key === 'clicks' ? hl : undefined}>Переходы</th>
              <th className="n" style={key === 'conv' ? hl : undefined}>Конверсия</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const w = Math.max(2, Math.round((metric[key].get(r) / max) * 100));
              const bar = (active, content, primary) => (
                active
                  ? <td className="n barcell"><span className="bg" style={{ width: w + '%' }} /><span className="fg">{content}</span></td>
                  : <td className={'n' + (primary ? '' : ' muted')}>{content}</td>
              );
              return (
                <tr key={r.channel}>
                  <td>{r.channel}</td>
                  {bar(key === 'visits', num(r.visits), true)}
                  <td className="n muted">{fp(r.share)}</td>
                  {bar(key === 'clicks', num(r.clicks), false)}
                  {bar(key === 'conv', fp(r.conv), false)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
