/**
 * Слой «Проекты и кампании»: чтение/сохранение конфигурации разнесения
 * рекламного расхода Директа по проектам (два уровня — провайдер и сайт) и
 * расчёт расхода по проектам + net-роялти (доход из royalties.json − расход).
 *
 * Кампании тянутся из снимка (data/marketing.json, секция direct.campaigns) —
 * их собирает коннектор автоматически. Настройки (статус/бюджет/привязка) живут
 * в БД и правятся из кабинета. Для новой кампании строки настроек ещё нет —
 * создаём её со смысловыми значениями по умолчанию (guessDefaults), чтобы кампания
 * появлялась сама и сразу разумно распределялась.
 */
import { q } from './db';
import { loadMarketing } from './marketing';
import { loadRoyalties } from './royalties';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// Агрегаторы: у них известен сайт, а провайдер — общий (делится на всех).
const SITE_CAMP = {
  '713245534': 'podborvps', '713793556': 'podborvps',
  '713332123': 'servercalc-ru', '713793989': 'servercalc-ru',
};

// Текущие согласованные VPS-кампании (как в lib/direct.js и коннекторе).
const VPS_ALLOW = new Set([
  '708098448', '706715098', '706716163', '712849076', '713792287', '713636116', '713885050',
  '708902123', '713897708', '713771451', '713886032', '713886156', '713775967',
  '713245534', '713793556', '713332123', '713793989',
]);

// Значения по умолчанию для новой/исторической кампании (пока пользователь не задал).
// Правило: известные VPS-кампании — активные и в бюджете; явные не-VPS (Solara, CRM,
// Битрикс) — исключены; всё прочее историческое — паркуем в архив и НЕ в бюджет,
// чтобы ничего не считалось, пока Антон сам не отметит галку.
export function guessDefaults(c) {
  const id = String(c.id);
  const name = String(c.name || '').toLowerCase();
  if (id === '713238736' || /solara|\bcrm\b|support|битрикс|bitrix/.test(name)) {
    return { status: 'excluded', in_budget: false, alloc: 'split' };
  }
  let alloc = 'split';
  let known = VPS_ALLOW.has(id);
  if (SITE_CAMP[id]) { alloc = SITE_CAMP[id]; known = true; }               // агрегатор → сайт
  else if (/adminvps/.test(name)) { alloc = 'adminvps'; known = true; }
  else if (/aeza/.test(name)) { alloc = 'aeza'; known = true; }
  else if (/ishosting|is\*hosting/.test(name)) { alloc = 'ishosting'; known = true; }
  else if (/timeweb|tw cloud|tw мск|tw спб/.test(name)) { alloc = 'timeweb'; known = true; }
  if (known) return { status: 'active', in_budget: true, alloc };
  return { status: 'archived', in_budget: false, alloc: 'split' };
}

// Миграция старой двухуровневой привязки в единую: провайдер важнее, потом сайт.
function resolveAlloc(providerAlloc, siteAlloc, provSet, siteSet) {
  if (provSet.has(providerAlloc)) return providerAlloc;
  if (siteSet.has(siteAlloc)) return siteAlloc;
  if (siteSet.has(providerAlloc)) return providerAlloc;
  if (provSet.has(siteAlloc)) return siteAlloc;
  return 'split';
}

export async function getProjects() {
  return q('select id, slug, name, kind, roy_key, archived, sort from ad_projects order by kind desc, sort, id');
}

// Разнесение расхода. Единая привязка (alloc): конкретный провайдер → весь расход
// ему; конкретный сайт → весь расход этому сайту; 'split' → поровну. В разрезе
// ПРОВАЙДЕРОВ расход сайтовых и общих кампаний делится поровну на провайдеров; в
// разрезе САЙТОВ расход провайдерских и общих делится поровну на сайты.
export function attribute(campaigns, settingsMap, projects) {
  const provs = projects.filter((p) => p.kind === 'provider' && !p.archived);
  const sites = projects.filter((p) => p.kind === 'site' && !p.archived);
  const provSet = new Set(provs.map((p) => p.slug));
  const siteSet = new Set(sites.map((p) => p.slug));
  const spendProv = {}; provs.forEach((p) => { spendProv[p.slug] = 0; });
  const spendSite = {}; sites.forEach((p) => { spendSite[p.slug] = 0; });
  let sharedProv = 0; let sharedSite = 0; let counted = 0; let excluded = 0;
  for (const c of campaigns) {
    const s = settingsMap[String(c.id)];
    const cost = num(c.cost);
    if (!s || s.status === 'excluded' || !s.in_budget) { if (s && s.status === 'excluded') excluded += cost; continue; }
    counted += cost;
    const a = s.alloc;
    if (provSet.has(a)) spendProv[a] += cost; else sharedProv += cost; // сайт/split → на провайдеров поровну
    if (siteSet.has(a)) spendSite[a] += cost; else sharedSite += cost; // провайдер/split → на сайты поровну
  }
  const perProv = provs.length ? sharedProv / provs.length : 0;
  provs.forEach((p) => { spendProv[p.slug] += perProv; });
  const perSite = sites.length ? sharedSite / sites.length : 0;
  sites.forEach((p) => { spendSite[p.slug] += perSite; });
  return { spendProv, spendSite, sharedProv, sharedSite, perProv, perSite, counted, excluded };
}

// Доход по провайдеру из royalties.json (tw/avps/ish/aeza → .total).
function revenueFor(royKey) {
  if (!royKey) return null;
  const R = loadRoyalties();
  const node = R && R[royKey];
  if (!node) return null;
  return num(node.total);
}

export async function loadProjectBoard() {
  const m = loadMarketing();
  const snapCamps = (m && m.direct && Array.isArray(m.direct.campaigns)) ? m.direct.campaigns : [];
  const spendDaily = (m && m.spendDaily && typeof m.spendDaily === 'object') ? m.spendDaily : {};
  const since = (m && m.spendSince) || '2026-02-01';

  // Кумулятивный расход по кампании = сумма всех дней (с 01.02.2026). Фолбэк, пока
  // backfill не прошёл, — расход из 30-дневного снимка. Имена — из истории/снимка.
  const cumCost = {}; const nameOf = {};
  for (const [id, node] of Object.entries(spendDaily)) {
    const days = (node && node.days) || {};
    cumCost[id] = Object.values(days).reduce((s, v) => s + num(v), 0);
    if (node && node.name) nameOf[id] = node.name;
  }
  for (const c of snapCamps) {
    const id = String(c.id);
    if (!(id in cumCost)) cumCost[id] = num(c.cost);
    if (!nameOf[id]) nameOf[id] = c.name || '';
  }
  const present30 = new Set(snapCamps.map((c) => String(c.id)));
  const allIds = new Set([...Object.keys(cumCost), ...present30]);

  // «новая» — если первый расход по кампании был за последние 7 дней (по spendDaily)
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const firstSeen = {};
  for (const [id, node] of Object.entries(spendDaily)) {
    const ds = Object.keys((node && node.days) || {}).sort();
    if (ds.length) firstSeen[id] = ds[0];
  }

  const projects = await getProjects();
  const provSet = new Set(projects.filter((p) => p.kind === 'provider').map((p) => p.slug));
  const siteSet = new Set(projects.filter((p) => p.kind === 'site').map((p) => p.slug));

  const SEL = 'select campaign_id, name, status, in_budget, provider_alloc, site_alloc, alloc from ad_campaign_settings';
  let rows = await q(SEL);
  const have = new Set(rows.map((r) => r.campaign_id));

  // Новым кампаниям (в т.ч. историческим из spendDaily) — строка настроек по умолчанию
  const fresh = [];
  for (const id of allIds) {
    if (have.has(id)) continue;
    const d = guessDefaults({ id, name: nameOf[id] || '' });
    await q(
      `insert into ad_campaign_settings (campaign_id, name, status, in_budget, alloc)
       values ($1,$2,$3,$4,$5) on conflict (campaign_id) do nothing`,
      [id, nameOf[id] || '', d.status, d.in_budget, d.alloc]
    );
    fresh.push(id);
  }
  if (fresh.length) rows = await q(SEL);

  // Миграция старых строк без единой привязки: alloc = из двухуровневой + запись обратно
  for (const r of rows) {
    if (!r.alloc) {
      r.alloc = resolveAlloc(r.provider_alloc, r.site_alloc, provSet, siteSet);
      await q('update ad_campaign_settings set alloc=$2 where campaign_id=$1', [r.campaign_id, r.alloc]);
    }
  }

  const settingsMap = {};
  for (const r of rows) settingsMap[r.campaign_id] = r;

  const list = rows
    .map((r) => ({
      id: r.campaign_id,
      name: nameOf[r.campaign_id] || r.name || r.campaign_id,
      cost: cumCost[r.campaign_id] || 0,
      status: r.status,
      in_budget: r.in_budget,
      alloc: r.alloc,
      is_new: !!(firstSeen[r.campaign_id] && firstSeen[r.campaign_id] >= weekAgo),
      present: present30.has(r.campaign_id),
    }))
    .sort((a, b) => b.cost - a.cost);

  const attr = attribute([...allIds].map((id) => ({ id, cost: cumCost[id] || 0 })), settingsMap, projects);

  // net по провайдерам-проектам, у которых задан roy_key
  const net = projects
    .filter((p) => p.kind === 'provider' && !p.archived && p.roy_key)
    .map((p) => {
      const revenue = revenueFor(p.roy_key);
      const spend = attr.spendProv[p.slug] || 0;
      return { slug: p.slug, name: p.name, revenue, spend, net: revenue == null ? null : revenue - spend };
    });

  return { projects, campaigns: list, attr, net, generated: (m && m.generated) || null, since };
}

// Сохранение правок из кабинета. projects: [{id?,slug,name,kind,roy_key,archived,sort}],
// deletedProjects: [id], settings: [{campaign_id,status,in_budget,provider_alloc,site_alloc}],
// deletedCampaigns: [campaign_id].
export async function saveBoard(payload = {}) {
  const { projects = [], deletedProjects = [], settings = [], deletedCampaigns = [] } = payload;
  for (const p of projects) {
    if (p.id) {
      await q(
        'update ad_projects set name=$2, kind=$3, roy_key=$4, archived=$5, sort=$6 where id=$1',
        [p.id, String(p.name || ''), p.kind === 'site' ? 'site' : 'provider', String(p.roy_key || ''), Boolean(p.archived), num(p.sort)]
      );
    } else if (p.slug) {
      await q(
        `insert into ad_projects (slug, name, kind, roy_key, archived, sort)
         values ($1,$2,$3,$4,$5,$6) on conflict (slug) do update set name=excluded.name, kind=excluded.kind, roy_key=excluded.roy_key, archived=excluded.archived, sort=excluded.sort`,
        [String(p.slug), String(p.name || ''), p.kind === 'site' ? 'site' : 'provider', String(p.roy_key || ''), Boolean(p.archived), num(p.sort)]
      );
    }
  }
  for (const id of deletedProjects) await q('delete from ad_projects where id=$1', [id]);
  for (const s of settings) {
    const status = ['active', 'archived', 'excluded'].includes(s.status) ? s.status : 'active';
    await q(
      `insert into ad_campaign_settings (campaign_id, status, in_budget, alloc, updated_at)
       values ($1,$2,$3,$4, now())
       on conflict (campaign_id) do update set status=excluded.status, in_budget=excluded.in_budget,
         alloc=excluded.alloc, updated_at=now()`,
      [String(s.campaign_id), status, Boolean(s.in_budget), String(s.alloc || 'split')]
    );
  }
  for (const id of deletedCampaigns) await q('delete from ad_campaign_settings where campaign_id=$1', [String(id)]);
  return { ok: true };
}
