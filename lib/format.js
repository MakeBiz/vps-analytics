export function num(n) {
  const v = Number(n || 0);
  return v.toLocaleString('ru-RU');
}

export function pct(part, whole, digits = 1) {
  const w = Number(whole || 0);
  if (!w) return '0%';
  return (Number(part || 0) / w * 100).toFixed(digits).replace('.', ',') + '%';
}

export function dur(sec) {
  const s = Math.round(Number(sec || 0));
  if (!s) return '0 с';
  const m = Math.floor(s / 60);
  if (m < 1) return s + ' с';
  if (m < 60) return m + ' мин ' + (s % 60) + ' с';
  return Math.floor(m / 60) + ' ч ' + (m % 60) + ' мин';
}

export function fmtDate(d, tz) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: tz,
  }).format(d);
}

export function fmtDateTime(d, tz) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: tz,
  }).format(d);
}

export function shortDate(d, tz) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short', timeZone: tz }).format(d);
}
