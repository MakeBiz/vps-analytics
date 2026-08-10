/**
 * Данные Яндекс.Директа из отдельного сервиса data.makebiztehnologies.com.
 * Публичный GET, без авторизации. Тянем на сервере (Vercel достаёт домен),
 * числа приходят строками — приводим к числу здесь же.
 *
 * Адрес можно переопределить переменной DIRECT_API (напр. для локального стенда),
 * по умолчанию боевой публичный адрес. Секрета в этом нет.
 */

const BASE = (process.env.DIRECT_API || 'https://data.makebiztehnologies.com').replace(/\/$/, '');

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function get(path, from, to) {
  const url = `${BASE}${path}?from=${from}&to=${to}`;
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Директ ${path} ответил ${r.status}`);
  return r.json();
}

function campRow(r) {
  return {
    campaign_id: r.campaign_id,
    name: r.campaign_name,
    impressions: n(r.impressions),
    clicks: n(r.clicks),
    cost: n(r.cost),
    ctr: n(r.ctr),
    avg_cpc: n(r.avg_cpc),
    conversions: n(r.conversions),
  };
}

function adRow(r) {
  return {
    ad_id: r.ad_id,
    campaign: r.campaign_name,
    group: r.group_name,
    title: r.title,
    status: r.ad_status,
    cost: n(r.cost),
    clicks: n(r.clicks),
    conversions: n(r.conversions),
    cost_per_conv: n(r.cost_per_conv),
  };
}

export async function directCampaigns(from, to) {
  const j = await get('/direct', from, to);
  return {
    summary: (j.summary && j.summary[0]) || {},
    campaigns: (j.campaigns || []).map(campRow),
    daily: (j.daily || []).map((d) => ({ date: d.date, cost: n(d.cost), clicks: n(d.clicks), conversions: n(d.conversions) })),
  };
}

export async function directAds(from, to) {
  const j = await get('/direct/ads', from, to);
  return { ads: (j.ads || []).map(adRow) };
}

/**
 * Соответствие «кампания Директа → наши сайты» ПО НОМЕРУ кампании (надёжнее,
 * чем по названию: номер не меняется при переименовании). Берём ТОЛЬКО эти
 * кампании — остальные (реф на провайдера, другой продукт) в раздел не идут.
 * Правится тут одной строкой, если добавится ещё российский сайт с кампанией.
 */
export const CAMPAIGNS = {
  '713245534': { name: 'ПодборVPS', sites: ['podborvps'] },
  '713332123': { name: 'ServerCalc', sites: ['servercalc-ru', 'servercalc-online'] },
};

export function campaignMap(id) {
  return CAMPAIGNS[String(id)] || null;
}

export function isOurCampaign(c) {
  return Boolean(CAMPAIGNS[String(c && c.campaign_id)]);
}

/**
 * Демография Директа (пол/возраст) — сам сайт этого не знает, данные только
 * из рекламного кабинета. Эндпоинт /direct/demographics того же сервиса, той же
 * формы. Значения пола/возраста приводим к единому виду, что бы ни прислал Директ
 * (male/GENDER_MALE/мужской, AGE_25_34/25-34 и т.п.).
 */
export const GENDER_ORDER = ['Мужчины', 'Женщины', 'Не определён'];
export const AGE_ORDER = ['0-17', '18-24', '25-34', '35-44', '45-54', '55+', 'Не определён'];

function gender(g) {
  const s = String(g || '').toLowerCase();
  if (/female|жен|^f$/.test(s)) return 'Женщины';
  if (/male|муж|^m$/.test(s)) return 'Мужчины';
  return 'Не определён';
}

function age(a) {
  const s = String(a || '').toLowerCase().replace(/[_\s]/g, '');
  if (/0.?17|under18/.test(s)) return '0-17';
  if (/18.?24/.test(s)) return '18-24';
  if (/25.?34/.test(s)) return '25-34';
  if (/35.?44/.test(s)) return '35-44';
  if (/45.?54/.test(s)) return '45-54';
  if (/(^|[^0-9])55|older|65/.test(s)) return '55+';
  return 'Не определён';
}

export async function directDemographics(from, to) {
  const j = await get('/direct/demographics', from, to);
  const rows = j.demographics || j.rows || [];
  return rows.map((r) => ({
    campaign_id: r.campaign_id,
    campaign_name: r.campaign_name,
    gender: gender(r.gender),
    age: age(r.age ?? r.age_group ?? r.ageGroup),
    impressions: n(r.impressions),
    clicks: n(r.clicks),
    cost: n(r.cost),
    conversions: n(r.conversions),
  }));
}
