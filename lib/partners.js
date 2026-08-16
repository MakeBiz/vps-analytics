/**
 * Реф-реклама партнёров (Timeweb, AdminVPS) в Яндекс.Директе.
 *
 * Директ (расход, клики, CPC, CTR) тянется живым из того же сервиса, что и
 * остальная панель (lib/direct.js) — фильтруем кампании по номеру.
 *
 * Регистрации и выплаты партнёров живого источника пока НЕ имеют: они лежат в
 * кабинетах партнёров и выгружаются вручную. Поэтому кабинетная часть читается
 * из снимка data/partners.json, который пересобирается раз в неделю. Когда
 * инженер поднимет слой /partners (кабинеты в API), сюда подставится живой fetch,
 * а страница не изменится.
 */
import fs from 'node:fs';
import path from 'node:path';

// Кампании реф-рекламы по номеру: номер не меняется при переименовании.
export const PARTNER_CAMPAIGNS = {
  '706715098': { partner: 'Timeweb', label: 'МСК', order: 1 },
  '708098448': { partner: 'Timeweb', label: 'VIP', order: 2 },
  '712849076': { partner: 'Timeweb', label: 'Регионы', order: 3 },
  '712729173': { partner: 'Timeweb', label: 'Super', order: 4 },
  '707669797': { partner: 'Timeweb', label: 'ОАЭ', order: 5 },
  '708902123': { partner: 'AdminVPS', label: 'МСК', order: 6 },
  '712849242': { partner: 'AdminVPS', label: 'Регионы', order: 7 },
};

export function partnerCampaign(id) {
  return PARTNER_CAMPAIGNS[String(id)] || null;
}

// Целевой потолок цены клика Timeweb от LTV (зрелая регистрация ~400-420₽)
export const CPC_CEILING = 33;

let cache = null;
export function loadSnapshot() {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), 'data', 'partners.json');
    cache = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    cache = null;
  }
  return cache;
}
