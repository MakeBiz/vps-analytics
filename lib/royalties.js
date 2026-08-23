/**
 * Слой партнёрок (роялти): снимок data/royalties.json.
 *
 * Это тот же файл, что питает Royalties-дашборд MakeBiz (Timeweb, AdminVPS,
 * is*hosting через Affise). Собирается на Маке скриптами build_sources.py +
 * build_royalties.py по выгрузкам кабинетов и API Affise, затем кладётся сюда
 * и публикуется. Обновление ручное, вместе с обновлением роялти-дашборда.
 *
 * Панель в облаке к API кабинетов вживую не ходит, поэтому это СНИМОК с датой
 * сборки (meta.asof).
 */
import fs from 'node:fs';
import path from 'node:path';

let cache = null;
export function loadRoyalties() {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), 'data', 'royalties.json');
    cache = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    cache = null;
  }
  return cache;
}

export const MONTH_RU = {
  '01': 'янв', '02': 'фев', '03': 'мар', '04': 'апр', '05': 'май', '06': 'июн',
  '07': 'июл', '08': 'авг', '09': 'сен', '10': 'окт', '11': 'ноя', '12': 'дек',
};

// «2026-08» -> «Авг», «2027-01» -> «Янв 27»
export function monthLabel(m) {
  const [y, mm] = String(m).split('-');
  const lab = (MONTH_RU[mm] || mm);
  const cap = lab.charAt(0).toUpperCase() + lab.slice(1);
  return y === '2026' ? cap : `${cap} ${y.slice(2)}`;
}

const DIM = { '01': 31, '02': 28, '03': 31, '04': 30, '05': 31, '06': 30, '07': 31, '08': 31, '09': 30, '10': 31, '11': 30, '12': 31 };
export function daysInMonth(m) {
  const [, mm] = String(m).split('-');
  return DIM[mm] || 30;
}
