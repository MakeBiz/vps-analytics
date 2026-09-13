'use client';
import { useCallback, useMemo, useRef, useState } from 'react';
import { shortDate } from '@/lib/format';

/**
 * Общий график панели. Рисуем сами обычным SVG: библиотека ради двух рядов
 * избыточна, а так график приходит вместе со страницей.
 *
 * Что он обязан уметь по комплекту дизайна:
 *  - подсказка с датой, названием ряда, значением И ЕДИНИЦЕЙ;
 *  - несовместимые единицы (рубли и штуки) только на разных ПОДПИСАННЫХ осях;
 *  - null это отсутствие наблюдения, линия рвётся; 0 это подтверждённый ноль;
 *  - легенда доступна с клавиатуры, скрытие ряда не меняет данные;
 *  - значения читаются без мыши: стрелки влево/вправо, Escape закрывает.
 *
 * Совместимость: старый вызов <Chart rows={...} /> с парами keys продолжает
 * работать, поэтому вкладки, которые его используют, править не нужно.
 */
const PRIMARY = '#03c9ff';
const SECONDARY = '#ff526f';
const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

function fmtVal(v, unit) {
  if (v === null || v === undefined) return 'нет данных';
  return nf.format(v) + (unit ? ' ' + unit : '');
}
// Круглый потолок оси: 34 вместо 33,8 читается лучше и не пляшет при обновлении
function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const s = v / p;
  return (s <= 1 ? 1 : s <= 2 ? 2 : s <= 2.5 ? 2.5 : s <= 5 ? 5 : 10) * p;
}

export default function Chart({
  rows,
  tz,
  xKey = 'd',
  keys = [['visits', 'Визиты', PRIMARY], ['clicks', 'Переходы', SECONDARY]],
  series,
  yLabel = '',
  rightLabel = '',
  extraRows,
  title = 'Динамика',
  height = 240,
}) {
  const all = useMemo(() => (
    series && series.length
      ? series.map((s) => ({ type: 'line', axis: 'left', unit: '', ...s }))
      : keys.map(([key, name, color]) => ({ key, name, color, type: 'line', axis: 'left', unit: '' }))
  ), [series, keys]);

  const [hidden, setHidden] = useState(() => new Set());
  const [active, setActive] = useState(null);
  const box = useRef(null);

  const shown = all.filter((s) => !hidden.has(s.key));
  const toggle = useCallback((key) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size < all.length - 1) next.add(key);
      return next;
    });
  }, [all.length]);

  const n = rows ? rows.length : 0;
  const W = 1000, H = 220, PT = 26, PB = 30;
  const hasRight = all.some((s) => s.axis === 'right');
  const PL = 52, PR = hasRight ? 62 : 18;

  const val = (r, k) => {
    const v = r[k];
    return v === null || v === undefined || v === '' ? null : Number(v);
  };
  const maxOf = (axis) => niceMax(Math.max(
    0,
    ...rows.flatMap((r) => shown.filter((s) => s.axis === axis).map((s) => val(r, s.key) ?? 0))
  ));
  const maxL = Math.max(1, maxOf('left'));
  const maxR = hasRight ? Math.max(1, maxOf('right')) : 1;

  const step = n > 1 ? (W - PL - PR) / (n - 1) : 0;
  const X = (i) => PL + i * step;
  const Y = (v, axis) => PT + (H - PT - PB) * (1 - (v || 0) / (axis === 'right' ? maxR : maxL));

  const pick = (clientX) => {
    const el = box.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const frac = (((clientX - rect.left) / rect.width) * W - PL) / Math.max(1, W - PL - PR);
    setActive(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((i) => {
        const base = i == null ? 0 : i + (e.key === 'ArrowRight' ? 1 : -1);
        return Math.max(0, Math.min(n - 1, base));
      });
    } else if (e.key === 'Escape') setActive(null);
  };

  if (!rows || n === 0) return <div className="empty">Нет данных за период</div>;
  if (n < 2) return <div className="empty">Мало точек для динамики</div>;

  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => (maxL / ticks) * i);
  const labelEvery = Math.max(1, Math.ceil(n / 12));
  const gid = (k) => 'gr-' + String(k).replace(/[^a-z0-9]/gi, '');
  const bars = shown.filter((s) => s.type === 'bar');
  const bw = bars.length ? ((W - PL - PR) / n) * 0.62 / bars.length : 0;

  const lbl = (r) => {
    const raw = r[xKey];
    const d = raw instanceof Date ? raw : new Date(String(raw).slice(0, 10) + 'T00:00:00Z');
    return isNaN(d) ? String(raw) : shortDate(d, 'UTC');
  };
  const a = active != null ? rows[active] : null;
  const liveText = a
    ? lbl(a) + '. ' + shown.map((s) => `${s.name}: ${fmtVal(val(a, s.key), s.unit)}`).join('. ')
    : '';

  return (
    <div
      className="chart" ref={box} tabIndex={0} role="group" aria-label={title}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerLeave={() => setActive(null)}
      onKeyDown={onKey}
      onFocus={() => setActive((i) => (i == null ? 0 : i))}
      onBlur={() => setActive(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        <defs>
          {shown.filter((s) => s.type !== 'bar').map((s) => (
            <linearGradient key={s.key} id={gid(s.key)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.23" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.01" />
            </linearGradient>
          ))}
        </defs>

        {tickVals.map((v, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={Y(v, 'left')} y2={Y(v, 'left')} stroke="#397496" strokeOpacity="0.2" strokeWidth="1" />
            <text x={PL - 8} y={Y(v, 'left') + 4} textAnchor="end" fill="#9cc9e7" fontSize="11">{nf.format(v)}</text>
            {hasRight ? (
              <text x={W - PR + 8} y={Y(v, 'left') + 4} textAnchor="start" fill="#9cc9e7" fontSize="11">
                {nf.format((maxR / ticks) * i)}
              </text>
            ) : null}
          </g>
        ))}

        {/* Подписи осей: рубли и штуки не имеют права стоять на одной безымянной шкале */}
        {yLabel ? <text x={PL - 8} y={13} textAnchor="end" fill="#709bbd" fontSize="11">{yLabel}</text> : null}
        {hasRight && rightLabel ? <text x={W - PR + 8} y={13} textAnchor="start" fill="#709bbd" fontSize="11">{rightLabel}</text> : null}

        {active != null ? (
          <line x1={X(active)} x2={X(active)} y1={PT} y2={H - PB} stroke="#04d0ff" strokeOpacity="0.45" strokeWidth="1" />
        ) : null}

        {bars.map((s, bi) => (
          <g key={s.key}>
            {rows.map((r, i) => {
              const v = val(r, s.key);
              if (v === null || v <= 0) return null;   // ноль это ноль, столбца нет
              const y0 = Y(v, s.axis);
              const x0 = PL + (i - 0.5) * step + ((W - PL - PR) / n) * 0.19 + bi * bw;
              return (
                <rect key={i} x={n > 1 ? x0 : PL} y={y0} width={Math.max(1, bw)} height={Math.max(0, H - PB - y0)}
                  rx="2" fill={s.color} opacity={active == null || active === i ? 0.85 : 0.4} />
              );
            })}
          </g>
        ))}

        {shown.filter((s) => s.type !== 'bar').map((s) => {
          // null рвёт линию: соединять через пропуск значит придумывать наблюдение
          const segs = [];
          let cur = [];
          rows.forEach((r, i) => {
            const v = val(r, s.key);
            if (v === null) { if (cur.length) segs.push(cur); cur = []; }
            else cur.push([X(i), Y(v, s.axis), i]);
          });
          if (cur.length) segs.push(cur);
          const first = segs[0] && segs[0][0];
          const last = segs.length && segs[segs.length - 1].slice(-1)[0];
          const flat = segs.flat();
          return (
            <g key={s.key}>
              {segs.length === 1 && flat.length > 1 ? (
                <polygon
                  points={`${first[0]},${Y(0, s.axis)} ${flat.map((p) => `${p[0]},${p[1]}`).join(' ')} ${last[0]},${Y(0, s.axis)}`}
                  fill={`url(#${gid(s.key)})`}
                />
              ) : null}
              {segs.map((seg, si) => (
                <polyline key={si} points={seg.map((p) => `${p[0]},${p[1]}`).join(' ')} fill="none"
                  stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {flat.length <= 60 ? flat.map((p) => (
                <circle key={p[2]} cx={p[0]} cy={p[1]} r="2.5" fill={s.color} />
              )) : null}
            </g>
          );
        })}

        {rows.map((r, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={X(i)} y={H - 10} textAnchor="middle" fill="#9cc9e7" fontSize="11">{lbl(r)}</text>
          ) : null
        )}
      </svg>

      {a ? (
        <div className="chart-tip" style={{ left: `${Math.min(Math.max(4, (X(active) / W) * 100), 96)}%`, transform: `translateX(${(X(active) / W) * 100 > 62 ? '-100%' : '-8px'})` }}>
          <strong>{lbl(a)}</strong>
          {shown.map((s) => (
            <div className="tip-row" key={s.key}>
              <span style={{ color: s.color }}>{s.name}</span>
              <b>{fmtVal(val(a, s.key), s.unit)}</b>
            </div>
          ))}
          {extraRows ? extraRows(a).map(([k, v]) => (
            <div className="tip-row extra" key={k}><span className="dim">{k}</span><b>{v}</b></div>
          )) : null}
        </div>
      ) : null}

      <div className="legend" role="group" aria-label="Ряды графика">
        {all.map((s) => (
          <button key={s.key} type="button" aria-pressed={!hidden.has(s.key)} onClick={() => toggle(s.key)}
            title={hidden.has(s.key) ? 'Показать ряд' : 'Скрыть ряд'}>
            <i style={{ background: s.color }} />
            {s.name}{s.unit ? <span className="dim">, {s.unit}</span> : null}
          </button>
        ))}
      </div>
      <span className="sr" aria-live="polite">{liveText}</span>
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
