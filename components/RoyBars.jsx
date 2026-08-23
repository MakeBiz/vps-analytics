'use client';
import { useState } from 'react';

const rus = (v) => Math.round(Number(v) || 0).toLocaleString('ru-RU');
const kk = (v) => Math.round((Number(v) || 0) / 1000) + 'к';

/**
 * Интерактивный столбчатый график: подписи над столбцами + всплывающая
 * подсказка при наведении с разбивкой. Рендерится на клиенте.
 * series: [{ label, parts: [{ name, value, color }] }]
 * mode: 'stack' (сегменты друг на друге) | 'group' (рядом)
 * kilo: показывать значения в тысячах (12к); unit: подпись единицы в подсказке
 */
export default function RoyBars({ series = [], height = 180, mode = 'stack', kilo = false, unit = '' }) {
  const [h, setH] = useState(null);
  if (!series.length) return <div className="empty">Нет данных</div>;
  const totalOf = (s) => s.parts.reduce((a, p) => a + (Number(p.value) || 0), 0);
  const max = Math.max(1, ...series.map((s) => (mode === 'group'
    ? Math.max(0, ...s.parts.map((p) => Number(p.value) || 0))
    : totalOf(s))));
  const barH = height - 36;
  const fmt = (v) => (kilo ? kk(v) : rus(v));

  return (
    <div style={{ position: 'relative' }}>
      <div className="scroll">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, minWidth: Math.max(280, series.length * 30) }}>
          {series.map((s, i) => {
            const total = totalOf(s);
            const active = h == null || h === i;
            return (
              <div key={i} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}
                   onMouseEnter={() => setH(i)} onMouseLeave={() => setH((x) => (x === i ? null : x))}>
                {mode === 'stack' ? (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', height: 15 }}>{total ? fmt(total) : ''}</div>
                    <div style={{ height: barH, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      {s.parts.map((p, j) => (Number(p.value) > 0 ? (
                        <div key={j} style={{ height: Math.max(1, Math.round((p.value / max) * barH)) + 'px', background: p.color, opacity: active ? 1 : 0.4, transition: 'opacity .12s' }} />
                      ) : null))}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: height - 18 }}>
                    {s.parts.map((p, j) => (
                      <div key={j} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)', height: 14 }}>{Number(p.value) ? fmt(p.value) : ''}</div>
                        <div style={{ width: 15, height: Math.max(1, Math.round(((Number(p.value) || 0) / max) * (barH - 14))) + 'px', background: p.color, borderRadius: '2px 2px 0 0', opacity: active ? 1 : 0.4, transition: 'opacity .12s' }} />
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 4, whiteSpace: 'nowrap' }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      {h != null && series[h] ? (
        <div style={{ position: 'absolute', top: -4, left: `${((h + 0.5) / series.length) * 100}%`, transform: 'translate(-50%,-100%)', background: 'var(--raise)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 11px', fontSize: 12, whiteSpace: 'nowrap', zIndex: 5, boxShadow: '0 8px 24px rgba(0,0,0,.45)', pointerEvents: 'none' }}>
          <div style={{ fontWeight: 600, marginBottom: 5 }}>{series[h].label}</div>
          {series[h].parts.filter((p) => Number(p.value)).map((p, j) => (
            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, margin: '2px 0' }}>
              <span style={{ color: 'var(--muted)' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, background: p.color, borderRadius: 2, marginRight: 6 }} />{p.name}
              </span>
              <b>{rus(p.value)}{unit ? ' ' + unit : ''}</b>
            </div>
          ))}
          {series[h].parts.filter((p) => Number(p.value)).length > 1 ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, borderTop: '1px solid var(--line)', marginTop: 5, paddingTop: 5 }}>
              <span style={{ color: 'var(--muted)' }}>Итого</span>
              <b>{rus(totalOf(series[h]))}{unit ? ' ' + unit : ''}</b>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
