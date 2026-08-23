'use client';
import { useState } from 'react';
import RoyBars from './RoyBars';

/**
 * Обёртка над RoyBars с переключателями (например Месяц/Неделя и ₽/Штуки).
 * toggles: [{ key, options:[{label,val}] }]
 * datasets: { "<val1>|<val2>": { series, kilo, unit } } — ключ по выбранным val через |
 */
export default function RoyToggle({ toggles = [], datasets = {}, height = 180, mode = 'stack' }) {
  const [sel, setSel] = useState(() => Object.fromEntries(toggles.map((t) => [t.key, t.options[0].val])));
  const key = toggles.map((t) => sel[t.key]).join('|');
  const ds = datasets[key] || { series: [] };
  return (
    <>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
        {toggles.map((t) => (
          <div key={t.key} style={{ display: 'inline-flex', gap: 4 }}>
            {t.options.map((o) => (
              <button key={o.val} onClick={() => setSel((s) => ({ ...s, [t.key]: o.val }))}
                      className={'chip' + (sel[t.key] === o.val ? ' on' : '')} style={{ cursor: 'pointer' }}>
                {o.label}
              </button>
            ))}
          </div>
        ))}
      </div>
      <RoyBars series={ds.series} kilo={ds.kilo} unit={ds.unit} height={height} mode={mode} />
    </>
  );
}
