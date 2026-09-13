import { num, pct } from '@/lib/format';
import Icon from '@/components/icons';

/**
 * ПРАВИЛО ЦВЕТА В ПАНЕЛИ: синий — хорошая новость, красный — плохая.
 * Стрелка при этом показывает фактическое направление. Поэтому растущий CPA
 * это «↑ красным», а падающий — «↓ синим»: цвет отвечает на вопрос «это хорошо?»,
 * стрелка на вопрос «куда двинулось».
 *
 * tone:
 *   grow-good — рост это хорошо (визиты, клики, доход). По умолчанию.
 *   grow-bad  — рост это плохо (расход, CPC, CPA, отказы).
 *   neutral   — это решение, а не результат: цвет не ставим.
 */
export function Spark({ values, kind = 'flat' }) {
  const v = (values || []).map((x) => Number(x) || 0);
  if (v.length < 2) return null;
  const W = 100, H = 30;
  const max = Math.max(...v), min = Math.min(...v);
  const span = max - min || 1;
  const x = (i) => (i / (v.length - 1)) * W;
  const y = (n) => H - 3 - ((n - min) / span) * (H - 9);
  const pts = v.map((n, i) => `${x(i).toFixed(2)},${y(n).toFixed(2)}`).join(' ');
  const color = kind === 'down' ? 'var(--bad)' : kind === 'up' ? 'var(--brass)' : 'var(--dim)';
  return (
    // preserveAspectRatio=none растягивает по ширине карточки: линия всегда
    // занимает всю подошву, а толщина держится за счёт non-scaling-stroke
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} height="44" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={color} opacity="0.13" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Kpi({ label, value, sub, delta, tone = 'grow-good', icon, spark }) {
  const has = typeof delta === 'number' && isFinite(delta);
  const moved = has && Math.abs(delta) > 0.5;
  let kind = 'flat';
  if (moved && tone !== 'neutral') kind = (delta > 0) === (tone === 'grow-good') ? 'up' : 'down';
  const pill = !has ? null
    : moved
      ? `${delta > 0 ? '↑' : '↓'} ${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(0)}%`
      : 'без изменений';

  return (
    <div className={'card kpi' + (kind === 'down' ? ' bad' : '')}>
      <div className="khead">
        {icon ? <span className="ico"><Icon name={icon} /></span> : null}
        {pill ? <span className={'pill ' + kind}>{pill}</span> : null}
      </div>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {sub ? <div className="d dim">{sub}</div> : null}
      {has && moved ? <div className="d dim">к прошлому периоду</div> : null}
      {spark && spark.length > 1 ? <Spark values={spark} kind={kind} /> : <div style={{ height: 14 }} />}
    </div>
  );
}

export function Card({ title, hint, children, wide }) {
  return (
    <div className="card" style={wide ? { gridColumn: '1 / -1' } : undefined}>
      {title ? (
        <h2>
          {title}
          {hint ? <span className="hint">{hint}</span> : null}
        </h2>
      ) : null}
      {children}
    </div>
  );
}

export function Empty({ text = 'Пока нет данных за этот период' }) {
  return <div className="empty">{text}</div>;
}

// Ячейка с числом и подложкой-полоской: доля от максимума в колонке
export function BarCell({ value, max, suffix = '' }) {
  const w = max > 0 ? Math.max(2, Math.round((Number(value || 0) / max) * 100)) : 0;
  return (
    <td className="n barcell">
      <span className="bg" style={{ width: w + '%' }} />
      <span className="fg">{num(value)}{suffix}</span>
    </td>
  );
}

export function Cr({ clicks, visits }) {
  return <td className="n muted">{pct(clicks, visits)}</td>;
}
