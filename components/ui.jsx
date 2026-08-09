import { num, pct } from '@/lib/format';

export function Kpi({ label, value, sub, delta }) {
  let cls = 'flat', sign = '';
  if (typeof delta === 'number' && isFinite(delta)) {
    if (delta > 0.5) { cls = 'up'; sign = '+'; }
    else if (delta < -0.5) { cls = 'down'; }
  }
  return (
    <div className="card kpi">
      <div className="v">{value}</div>
      <div className="l">{label}</div>
      {sub ? <div className="d dim">{sub}</div> : null}
      {typeof delta === 'number' && isFinite(delta) ? (
        <div className={'d ' + cls}>{sign + delta.toFixed(0).replace('-', '−')}% к прошлому периоду</div>
      ) : null}
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
