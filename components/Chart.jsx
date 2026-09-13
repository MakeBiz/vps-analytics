import { shortDate } from '@/lib/format';

/**
 * График строится на сервере обычным SVG: не тянем библиотеку ради
 * двух линий, и панель открывается без ожидания клиентского JS.
 * Цвета и геометрия по комплекту дизайна: линия 2 px, маркер 2,5 px,
 * тихая сетка, заливка затухает от 23% у верхнего края до 1% у базовой линии.
 */
const PRIMARY = '#03c9ff';
const SECONDARY = '#ff526f';

export default function Chart({ rows, tz, keys = [['visits', 'Визиты', PRIMARY], ['clicks', 'Переходы', SECONDARY]] }) {
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
  const gid = (k) => 'g-' + String(k).replace(/[^a-z0-9]/gi, '');

  return (
    <div className="scroll chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" preserveAspectRatio="none" role="img">
        <defs>
          {keys.map(([k, , color]) => (
            <linearGradient key={k} id={gid(k)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.23" />
              <stop offset="100%" stopColor={color} stopOpacity="0.01" />
            </linearGradient>
          ))}
        </defs>
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#397496" strokeOpacity="0.2" strokeWidth="1" />
            <text x={PL - 8} y={y(v) + 4} textAnchor="end" fill="#9cc9e7" fontSize="12">{v}</text>
          </g>
        ))}
        {keys.map(([k, , color]) => {
          const pts = rows.map((r, i) => `${x(i)},${y(r[k])}`).join(' ');
          const area = `${PL},${y(0)} ${pts} ${x(n - 1)},${y(0)}`;
          return (
            <g key={k}>
              <polygon points={area} fill={`url(#${gid(k)})`} />
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
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fill="#9cc9e7" fontSize="12">
              {shortDate(new Date(r.d), 'UTC')}
            </text>
          ) : null
        )}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 12 }}>
        {keys.map(([k, label, color]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--muted)' }}>
            <i style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Часовые полосы: дорожка и заливка те же, что в ячейках таблиц
export function Bars({ rows, labelKey, valueKey, formatLabel }) {
  if (!rows || !rows.length) return <div className="empty">Нет данных</div>;
  const max = Math.max(1, ...rows.map((r) => Number(r[valueKey] || 0)));
  return (
    <div>
      {rows.map((r, i) => {
        const v = Number(r[valueKey] || 0);
        return (
          <div key={i} className="hour-row">
            <div className="dim">{formatLabel ? formatLabel(r[labelKey]) : r[labelKey]}</div>
            <div className="track"><span className="fill" style={{ width: (v > 0 ? (v / max) * 100 : 0) + '%' }} /></div>
            <div className="n">{r[valueKey]}</div>
          </div>
        );
      })}
    </div>
  );
}
