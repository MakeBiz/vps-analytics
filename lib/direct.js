/**
 * Данные Яндекс.Директа из отдельного сервиса data.makebiztehnologies.com.
 * Публичный GET, без авторизации. Тянем на сервере (Vercel достаёт домен),
 * числа приходят строками — приводим к числу здесь же.
 *
 * Адрес можно переопределить переменной DIRECT_API (напр. для локального стенда),
 * по умолчанию боевой публичный адрес. Секрета в этом нет.
 */

import { loadMarketing } from './marketing';

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

// Кампании Директа из снимка коннектора Яндекса (data/marketing.json). Снимок за
// последние 30 дней, поэтому фильтр периода к нему не применяется. Показов в снимке
// нет — восстанавливаем из кликов и CTR. Если снимка нет, откатываемся на старый
// источник data.makebiztehnologies.com, чтобы вкладка не падала.
function campaignsFromSnapshot() {
  const m = loadMarketing();
  const list = m && m.direct && Array.isArray(m.direct.campaigns) ? m.direct.campaigns : null;
  if (!list || !list.length) return null;
  const campaigns = list.map((c) => {
    const ctr = n(c.ctr);
    const clicks = n(c.clicks);
    return {
      campaign_id: String(c.id),
      name: c.name,
      impressions: ctr > 0 ? Math.round((clicks * 100) / ctr) : 0,
      clicks,
      cost: n(c.cost),
      ctr,
      avg_cpc: n(c.cpc),
      conversions: 0,
    };
  });
  const summary = campaigns.reduce(
    (s, c) => ({ cost: s.cost + c.cost, clicks: s.clicks + c.clicks, impressions: s.impressions + c.impressions }),
    { cost: 0, clicks: 0, impressions: 0 }
  );
  return { summary, campaigns, daily: [], source: 'connector' };
}

export async function directCampaigns(from, to) {
  const snap = campaignsFromSnapshot();
  if (snap) return snap;
  const j = await get('/direct', from, to);
  return {
    summary: (j.summary && j.summary[0]) || {},
    campaigns: (j.campaigns || []).map(campRow),
    daily: (j.daily || []).map((d) => ({ date: d.date, cost: n(d.cost), clicks: n(d.clicks), conversions: n(d.conversions) })),
    source: 'takc',
  };
}

export async function directAds(from, to) {
  const m = loadMarketing();
  if (m && m.direct && Array.isArray(m.direct.ads) && m.direct.ads.length) {
    return { ads: m.direct.ads.map(adRow), source: 'connector' };
  }
  const j = await get('/direct/ads', from, to);
  return { ads: (j.ads || []).map(adRow), source: 'takc' };
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

/**
 * Единый список согласованных кампаний Директа (по номеру). Считаем и выводим
 * только их — и в «Маркетинге», и в демографии «Гео». Правится тут одной строкой.
 * Плавный переход: держим и старые, и новые Podborvps/Servercalc, пока новые не раскрутятся.
 */
export const VPS_CAMPAIGN_ALLOW = new Set([
  '708098448', '706715098', '706716163', '712849076', '713792287', // Timeweb (+ TW МСК new)
  '708902123',                                          // AdminVPS
  '713771451',                                          // Aeza
  '713775967',                                          // ishosting
  '713245534', '713793556',                            // Podborvps (старый + новый)
  '713332123', '713793989',                            // Servercalc (старый + новый)
]);

// имя кампании без хвоста « ←VPS» — так их зовут строки демографии/объявлений
export const baseCampaignName = (s) => String(s || '').replace(/\s*←\s*VPS\s*$/i, '').trim();

/**
 * Имена согласованных кампаний из снимка (для строк демографии, где нет campaign_id —
 * там есть только campaign_name). Берём кампании из ALLOW и приводим к базовому имени.
 */
export function approvedCampaignNames() {
  const m = loadMarketing();
  const list = (m && m.direct && Array.isArray(m.direct.campaigns)) ? m.direct.campaigns : [];
  return new Set(list.filter((c) => VPS_CAMPAIGN_ALLOW.has(String(c.id))).map((c) => baseCampaignName(c.name)));
}

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
  const m = loadMarketing();
  let rows;
  if (m && m.direct && Array.isArray(m.direct.demographics) && m.direct.demographics.length) {
    rows = m.direct.demographics;
  } else {
    const j = await get('/direct/demographics', from, to);
    rows = j.demographics || j.rows || [];
  }
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
