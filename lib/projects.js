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

// Значения по умолчанию для новой кампании (пока пользователь не задал вручную).
export function guessDefaults(c) {
  const id = String(c.id);
  const name = String(c.name || '').toLowerCase();
  if (id === '713238736') return { status: 'excluded', in_budget: false, provider_alloc: 'none', site_alloc: 'none' }; // Solara — не VPS
  let provider = 'split';
  let site = 'split';
  if (SITE_CAMP[id]) { site = SITE_CAMP[id]; provider = 'split'; }
  else if (/adminvps/.test(name)) provider = 'adminvps';
  else if (/aeza/.test(name)) provider = 'aeza';
  else if (/ishosting|is\*hosting/.test(name)) provider = 'ishosting';
  else if (/timeweb|tw cloud|tw мск|tw спб/.test(name)) provider = 'timeweb';
  return { status: 'active', in_budget: true, provider_alloc: provider, site_alloc: site };
}

export async function getProjects() {
  return q('select id, slug, name, kind, roy_key, archived, sort from ad_projects order by kind desc, sort, id');
}

// Разнесение расхода по проектам. Общие ('split') делятся ПОРОВНУ на активные
// проекты своего уровня. Статус excluded и снятая галка in_budget — мимо бюджета.
export function attribute(campaigns, settingsMap, projects) {
  const provs = projects.filter((p) => p.kind === 'provider' && !p.archived);
  const sites = projects.filter((p) => p.kind === 'site' && !p.archived);
  const spendProv = {}; provs.forEach((p) => { spendProv[p.slug] = 0; });
  const spendSite = {}; sites.forEach((p) => { spendSite[p.slug] = 0; });
  let sharedProv = 0; let sharedSite = 0; let counted = 0; let unattr = 0; let excluded = 0;
  for (const c of campaigns) {
    const s = settingsMap[String(c.id)];
    const cost = num(c.cost);
    if (!s || s.status === 'excluded' || !s.in_budget) { if (s && s.status === 'excluded') excluded += cost; continue; }
    counted += cost;
    if (s.provider_alloc === 'split') sharedProv += cost;
    else if (spendProv[s.provider_alloc] != null) spendProv[s.provider_alloc] += cost;
    else if (s.provider_alloc === 'none') unattr += cost;
    if (s.site_alloc === 'split') sharedSite += cost;
    else if (spendSite[s.site_alloc] != null) spendSite[s.site_alloc] += cost;
  }
  const perProv = provs.length ? sharedProv / provs.length : 0;
  provs.forEach((p) => { spendProv[p.slug] += perProv; });
  const perSite = sites.length ? sharedSite / sites.length : 0;
  sites.forEach((p) => { spendSite[p.slug] += perSite; });
  return { spendProv, spendSite, sharedProv, sharedSite, perProv, perSite, counted, unattr, excluded };
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
  const campaigns = (m && m.direct && Array.isArray(m.direct.campaigns)) ? m.direct.campaigns : [];
  const projects = await getProjects();
  let rows = await q('select campaign_id, name, status, in_budget, provider_alloc, site_alloc from ad_campaign_settings');
  const have = new Set(rows.map((r) => r.campaign_id));

  // Новым кампаниям создаём строку настроек со значениями по умолчанию
  const fresh = [];
  for (const c of campaigns) {
    const id = String(c.id);
    if (have.has(id)) continue;
    const d = guessDefaults(c);
    await q(
      `insert into ad_campaign_settings (campaign_id, name, status, in_budget, provider_alloc, site_alloc)
       values ($1,$2,$3,$4,$5,$6) on conflict (campaign_id) do nothing`,
      [id, c.name || '', d.status, d.in_budget, d.provider_alloc, d.site_alloc]
    );
    fresh.push(id);
  }
  if (fresh.length) rows = await q('select campaign_id, name, status, in_budget, provider_alloc, site_alloc from ad_campaign_settings');

  const settingsMap = {};
  for (const r of rows) settingsMap[r.campaign_id] = r;

  // Собираем кампании для UI: расход из снимка, настройки из БД; помечаем «новые»
  const costOf = {}; const nameOf = {};
  for (const c of campaigns) { costOf[String(c.id)] = num(c.cost); nameOf[String(c.id)] = c.name || ''; }
  const list = rows
    .map((r) => ({
      id: r.campaign_id,
      name: nameOf[r.campaign_id] || r.name || r.campaign_id,
      cost: costOf[r.campaign_id] || 0,
      status: r.status,
      in_budget: r.in_budget,
      provider_alloc: r.provider_alloc,
      site_alloc: r.site_alloc,
      is_new: fresh.includes(r.campaign_id),
      present: costOf[r.campaign_id] != null, // есть ли в текущем снимке (был расход)
    }))
    .sort((a, b) => b.cost - a.cost);

  const attr = attribute(campaigns.map((c) => ({ id: c.id, cost: c.cost })), settingsMap, projects);

  // net по провайдерам-проектам, у которых задан roy_key
  const net = projects
    .filter((p) => p.kind === 'provider' && !p.archived && p.roy_key)
    .map((p) => {
      const revenue = revenueFor(p.roy_key);
      const spend = attr.spendProv[p.slug] || 0;
      return { slug: p.slug, name: p.name, revenue, spend, net: revenue == null ? null : revenue - spend };
    });

  return { projects, campaigns: list, attr, net, generated: (m && m.generated) || null };
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
      `insert into ad_campaign_settings (campaign_id, status, in_budget, provider_alloc, site_alloc, updated_at)
       values ($1,$2,$3,$4,$5, now())
       on conflict (campaign_id) do update set status=excluded.status, in_budget=excluded.in_budget,
         provider_alloc=excluded.provider_alloc, site_alloc=excluded.site_alloc, updated_at=now()`,
      [String(s.campaign_id), status, Boolean(s.in_budget), String(s.provider_alloc || 'split'), String(s.site_alloc || 'split')]
    );
  }
  for (const id of deletedCampaigns) await q('delete from ad_campaign_settings where campaign_id=$1', [String(id)]);
  return { ok: true };
}
