/**
 * Разбор фильтров из адресной строки. Все отчёты живут на одних и тех же
 * параметрах, поэтому переключение раздела не сбрасывает период и сайт
 */

export const TZ_LIST = [
  ['Asia/Dubai', 'Дубай (UTC+4)'],
  ['Europe/Moscow', 'Москва (UTC+3)'],
  ['UTC', 'UTC'],
];

export const RANGES = [
  ['today', 'Сегодня'],
  ['yesterday', 'Вчера'],
  ['7d', '7 дней'],
  ['30d', '30 дней'],
  ['month', 'Этот месяц'],
  ['prevmonth', 'Прошлый месяц'],
  ['90d', '90 дней'],
  ['all', 'Всё время'],
];

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

// «Сегодня» считаем в выбранной таймзоне, а не в зоне сервера
function todayIn(tz) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return p;
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}

export function parseFilters(sp = {}) {
  const g = (k) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const tz = TZ_LIST.some(([z]) => z === g('tz')) ? g('tz') : 'Asia/Dubai';
  const today = todayIn(tz);
  let range = g('d') || '7d';
  let from = g('from') || '';
  let to = g('to') || '';

  if (from && to) {
    range = 'custom';
  } else {
    switch (range) {
      case 'today': from = today; to = today; break;
      case 'yesterday': from = addDays(today, -1); to = from; break;
      case '30d': from = addDays(today, -29); to = today; break;
      case '90d': from = addDays(today, -89); to = today; break;
      case 'month': from = today.slice(0, 8) + '01'; to = today; break;
      case 'prevmonth': {
        const first = today.slice(0, 8) + '01';
        to = addDays(first, -1);
        from = to.slice(0, 8) + '01';
        break;
      }
      case 'all': from = '2020-01-01'; to = today; break;
      case '7d':
      default: range = '7d'; from = addDays(today, -6); to = today;
    }
  }

  const site = g('site') || '';
  const bots = g('bots') === '1';
  const provider = g('provider') || '';
  const q = g('q') || '';
  const days = Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;

  return {
    tz, range, from, to, site, bots, provider, q, days,
    toExclusive: addDays(to, 1),
    prevFrom: addDays(from, -days),
    prevTo: addDays(from, -1),
  };
}

export function qs(f, extra = {}) {
  const o = { tz: f.tz, site: f.site, bots: f.bots ? '1' : '', ...extra };
  if (f.range === 'custom') { o.from = f.from; o.to = f.to; } else { o.d = f.range; }
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? '?' + s : '';
}
