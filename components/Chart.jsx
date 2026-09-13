import { shortDate } from '@/lib/format';

/**
 * График строится на сервере обычным SVG: не тянем библиотеку ради
 * двух линий, и панель открывается без ожидания клиентского JS.
 * Цвета серий по умолчанию — синий и красный, как в макете панели.
 */
export default function Chart({ rows, tz, keys = [['visits', 'Визиты', '#3aa0ff'], ['clicks', 'Переходы', '#ff4d5e']] }) {
  if (!rows || rows.length === 0) return <div className="empty">Нет данных за период</div>;

  const W = 1000, H = 220, PL = 44, PR = 16, PT = 14, PB = 26;
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
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#16283f" strokeWidth="1" />
            <text x={PL - 8} y={y(v) + 4} textAnchor="end" fill="#5f7591" fontSize="11">{v}</text>
          </g>
        ))}
        {keys.map(([k, , color]) => {
          const pts = rows.map((r, i) => `${x(i)},${y(r[k])}`).join(' ');
          const area = `${PL},${y(0)} ${pts} ${x(n - 1)},${y(0)}`;
          return (
            <g key={k}>
              <polygon points={area} fill={color} opacity="0.12" />
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
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fill="#5f7591" fontSize="11">
              {shortDate(new Date(r.d), 'UTC')}
            </text>
          ) : null
        )}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {keys.map(([k, label, color]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--muted)' }}>
            <i style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
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
          <div style={{ width: 46, color: 'var(--muted)', fontSize: 12, textAlign: 'right' }}>
            {formatLabel ? formatLabel(r[labelKey]) : r[labelKey]}
          </div>
          <div style={{ flex: 1, background: 'var(--line-soft)', borderRadius: 5, height: 16, overflow: 'hidden' }}>
            <div style={{
              width: (Number(r[valueKey] || 0) / max) * 100 + '%', height: '100%', borderRadius: 5,
              background: 'linear-gradient(90deg, rgba(47,143,240,.55), rgba(74,176,255,.95))',
            }} />
          </div>
          <div style={{ width: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>
            {r[valueKey]}
          </div>
        </div>
      ))}
    </div>
  );
}
