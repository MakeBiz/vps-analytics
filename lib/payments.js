/**
 * Слой оплат партнёров — полный журнал комиссий из кабинетов.
 *
 * Источник: выгрузки из папки Royalties/Timeweb, собранные движком payments_reader.py
 * (Timeweb OLD+новый без задвоения; AdminVPS журнал «Доход»). Данные обновляются
 * ПО ЗАПРОСУ (вручную кладутся в папку и пересобираются), а не по расписанию —
 * поэтому это снимок с датой сборки, а не живой фид.
 *
 * Отличие от data/partners.json: там кабинетная выручка за ОКНО для P&L против
 * Директа, здесь — полная история комиссий по журналу оплат (правильный источник
 * денег: колонка «Всего начислений» в снимке клиентов занижена по когорте).
 */
import fs from 'node:fs';
import path from 'node:path';

let cache = null;
export function loadPayments() {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), 'data', 'payments.json');
    cache = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    cache = null;
  }
  return cache;
}
