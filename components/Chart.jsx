import { shortDate } from '@/lib/format';

/**
 * График строится на сервере обычным SVG: не тянем библиотеку ради
 * двух линий, и панель открывается без ожидания клиентского JS
 */
export default function Chart({ rows, tz, keys = [['visits', 'Визиты', '#5b7a99'], ['clicks', 'Переходы', '#c6a15b']] }) {
  if (!rows || rows.length === 0) return <div className="empty">Нет данных за период</div>;

  const W = 1000, H = 220, PL = 44, PR = 12, PT = 14, PB = 26;
  const n = rows.length;
  const maxV = Math.max(1, ...rows.flatMap((r) => keys.map(([k]) => Number(r[k] || 0))));
  const step = n > 1 ? (W - PL - PR) / (n - 1) : 0;
  const x = (i) => PL + i * step;
  const y = (v) => PT + (H - PT - PB) * (1 - Number(v || 0) / maxV);

  const ticks = 4;
  const gridVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxV / ticks) * i));
  const labelEvery = Math.max(1, Math.ceil(n / 12));

  return (
    <div className="scroll">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="230" preserveAspectRatio="none" role="img">
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#26313d" strokeWidth="1" />
            <text x={PL - 8} y={y(v) + 4} textAnchor="end" fill="#6b7987" fontSize="11">{v}</text>
          </g>
        ))}
        {keys.map(([k, , color]) => {
          const pts = rows.map((r, i) => `${x(i)},${y(r[k])}`).join(' ');
          const area = `${PL},${y(0)} ${pts} ${x(n - 1)},${y(0)}`;
          return (
            <g key={k}>
              <polygon points={area} fill={color} opacity="0.10" />
              <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
                strokeLinejoin="round" strokeLinecap="round" />
              {n <= 60 ? rows.map((r, i) => (
                <circle key={i} cx={x(i)} cy={y(r[k])} r="2.5" fill={color} />
              )) : null}
            </g>
          );
        })}
        {rows.map((r, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fill="#6b7987" fontSize="11">
              {shortDate(new Date(r.d), 'UTC')}
            </text>
          ) : null
        )}
      </svg>
      <div className="chips" style={{ marginTop: 6 }}>
        {keys.map(([k, label, color]) => (
          <span key={k} className="tag" style={{ borderColor: color, color }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Bars({ rows, labelKey, valueKey, formatLabel }) {
  if (!rows || !rows.length) return <div className="empty">Нет данных</div>;
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey] || 0)));
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0' }}>
          <div style={{ width: 46, color: '#93a0ae', fontSize: 12, textAlign: 'right' }}>
            {formatLabel ? formatLabel(r[labelKey]) : r[labelKey]}
          </div>
          <div style={{ flex: 1, background: '#182029', borderRadius: 4, height: 16, overflow: 'hidden' }}>
            <div style={{ width: (Number(r[valueKey] || 0) / max) * 100 + '%', background: '#c6a15b', height: '100%' }} />
          </div>
          <div style={{ width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>
            {r[valueKey]}
          </div>
        </div>
      ))}
    </div>
  );
}
