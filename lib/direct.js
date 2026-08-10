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
 * Соответствие «кампания Директа → наши сайты». Кампании, которых тут нет,
 * ведут мимо наших сайтов (прямые реф-кампании на провайдера или другой продукт),
 * их конверсия provider_click структурно ноль и в связку по сайтам они не идут.
 * Правится тут одной строкой, если Антон переименует кампанию.
 */
export const CAMPAIGN_TO_SITES = {
  'Podborvps.ru': ['podborvps'],
  'Servercalc': ['servercalc-ru', 'servercalc-online'],
};

export function sitesForCampaign(name) {
  return CAMPAIGN_TO_SITES[name] || [];
}
