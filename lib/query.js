import { q } from './db';

/**
 * Все отчёты собираются здесь. Правило: один разрез — один запрос,
 * склейка визитов и переходов делается по ключу уже в JS, потому что
 * события несут метки своей сессии (денормализация сделана на записи)
 */

async function siteId(key) {
  if (!key) return null;
  const r = await q('select id from sites where key = $1', [key]);
  return r[0]?.id ?? -1;
}

export async function baseParams(f) {
  return [f.from, f.tz, f.toExclusive, await siteId(f.site), f.bots];
}

// Служебный трафик. Наши же домены, Метрика и Vercel мелькают в реферерах
// из-за нашего тестирования и служебных редиректов между площадками, а не
// от живых людей. Чтобы цифры были «чистыми» во всех отчётах, вырезаем их
// прямо в условии. Прямые заходы (referrer_host = '') остаются — пустой
// строки в списке нет. Список зашит намеренно (без bind-параметра): иначе
// сдвинулись бы номера $N, а providerDetail завязан на $6 = провайдер.
const SERVICE_HOSTS = [
  'podborvps.ru', 'www.podborvps.ru',
  'servercalc.ru', 'www.servercalc.ru',
  'servercalc.com', 'www.servercalc.com',
  'servercalc.online', 'www.servercalc.online',
  'serverselection.online', 'www.serverselection.online',
  'metrika.yandex.ru',
  'vercel.com', 'vps-analytics.vercel.app',
  'dashboard.makebiztehnologies.com', 'makebiztehnologies.com', 'www.makebiztehnologies.com',
];
function svcExcl(col) {
  const list = SERVICE_HOSTS.map((h) => `'${h}'`).join(', ');
  return `${col} not in (${list}) and ${col} not like '%.vercel.app'`;
}

// $1 начало периода, $2 таймзона, $3 конец (не включая), $4 сайт, $5 показывать ли роботов
const W_EV = `ts >= ($1::timestamp at time zone $2)
  and ts <  ($3::timestamp at time zone $2)
  and ($4::int is null or site_id = $4)
  and ($5::bool or is_bot = false)
  and ${svcExcl('referrer_host')}`;

const W_EV_E = `e.ts >= ($1::timestamp at time zone $2)
  and e.ts <  ($3::timestamp at time zone $2)
  and ($4::int is null or e.site_id = $4)
  and ($5::bool or e.is_bot = false)
  and ${svcExcl('e.referrer_host')}`;

const W_SE = `started_at >= ($1::timestamp at time zone $2)
  and started_at <  ($3::timestamp at time zone $2)
  and ($4::int is null or site_id = $4)
  and ($5::bool or is_bot = false)
  and ${svcExcl('referrer_host')}`;

export async function sites() {
  return q('select id, key, name, domain, archived from sites order by archived, id');
}

export async function overview(f) {
  const p = await baseParams(f);
  const [s] = await q(
    `select count(*)::int visits,
            count(distinct visitor_id)::int visitors,
            coalesce(avg(extract(epoch from (last_seen_at - started_at))),0)::int avg_sec,
            coalesce(sum(pageviews),0)::int pv,
            coalesce(sum(outclicks),0)::int clicks,
            count(*) filter (where pageviews <= 1 and outclicks = 0)::int bounced
       from sessions where ${W_SE}`,
    p
  );
  return s || { visits: 0, visitors: 0, avg_sec: 0, pv: 0, clicks: 0, bounced: 0 };
}

export async function overviewPrev(f) {
  return overview({ ...f, from: f.prevFrom, toExclusive: f.from });
}

export async function byDay(f) {
  const p = await baseParams(f);
  // Пустые дни достраиваем нулями: иначе график «склеивает» провалы
  // и период на нём короче, чем выбран в фильтре
  return q(
    `select g.d,
            coalesce(t.visits,0)::int visits,
            coalesce(t.clicks,0)::int clicks,
            coalesce(t.pv,0)::int pv
       from generate_series($1::date, ($3::date - interval '1 day'), interval '1 day') g(d)
       left join (
         select d, sum(visits)::int visits, sum(clicks)::int clicks, sum(pv)::int pv from (
           select (started_at at time zone $2)::date d, count(*) visits, 0 clicks, 0 pv
             from sessions where ${W_SE} group by 1
           union all
           select (ts at time zone $2)::date, 0,
                  count(*) filter (where type = 'out'),
                  count(*) filter (where type = 'pv')
             from events where ${W_EV} group by 1
         ) x group by d
       ) t on t.d = g.d
      order by g.d`,
    p
  );
}

export async function byHour(f) {
  const p = await baseParams(f);
  return q(
    `select h, sum(visits)::int visits, sum(clicks)::int clicks from (
        select extract(hour from (started_at at time zone $2))::int h, count(*) visits, 0 clicks
          from sessions where ${W_SE} group by 1
        union all
        select extract(hour from (ts at time zone $2))::int, 0, count(*) filter (where type = 'out')
          from events where ${W_EV} group by 1
      ) t group by h order by h`,
    p
  );
}

export async function bySite(f) {
  const p = await baseParams(f);
  return q(
    `select s.key, s.name,
            count(se.id)::int visits,
            count(distinct se.visitor_id)::int visitors,
            coalesce(sum(se.pageviews),0)::int pv,
            coalesce(sum(se.outclicks),0)::int clicks
       from sites s
       left join sessions se on se.site_id = s.id and ${W_SE}
      where s.archived = false
      group by s.id, s.key, s.name
      order by clicks desc, visits desc`,
    p
  );
}

// Сводка с разбивкой по сайту — чтобы на «Обзоре» мультивыбор сайтов менял
// KPI, график и таблицы на клиенте без перезапроса. sec_sum и bounced отдаём
// сырьём, среднее время и отказы считаем уже после агрегации выбранных сайтов.
export async function overviewBySite(f) {
  const p = await baseParams(f);
  return q(
    `select s.key site_key,
            count(se.id)::int visits,
            count(distinct se.visitor_id)::int visitors,
            coalesce(sum(se.pageviews),0)::int pv,
            coalesce(sum(se.outclicks),0)::int clicks,
            count(se.id) filter (where se.pageviews <= 1 and se.outclicks = 0)::int bounced,
            coalesce(sum(extract(epoch from (se.last_seen_at - se.started_at))),0)::int sec_sum
       from sites s
       left join sessions se on se.site_id = s.id and ${W_SE}
      where s.archived = false
      group by s.key`,
    p
  );
}

export async function byDayBySite(f) {
  const p = await baseParams(f);
  return q(
    `select to_char(g.d,'YYYY-MM-DD') d, s.key site_key,
            coalesce(t.visits,0)::int visits, coalesce(t.clicks,0)::int clicks
       from generate_series($1::date, ($3::date - interval '1 day'), interval '1 day') g(d)
       cross join (select id, key from sites where archived = false) s
       left join (
         select d, site_id, sum(visits)::int visits, sum(clicks)::int clicks from (
           select (started_at at time zone $2)::date d, site_id, count(*) visits, 0 clicks
             from sessions where ${W_SE} group by 1,2
           union all
           select (ts at time zone $2)::date, site_id, 0, count(*) filter (where type = 'out')
             from events where ${W_EV} group by 1,2
         ) x group by d, site_id
       ) t on t.d = g.d and t.site_id = s.id
      order by g.d`,
    p
  );
}

export async function byHourBySite(f) {
  const p = await baseParams(f);
  return q(
    `select t.h, s.key site_key, sum(t.visits)::int visits, sum(t.clicks)::int clicks from (
        select extract(hour from (started_at at time zone $2))::int h, site_id, count(*) visits, 0 clicks
          from sessions where ${W_SE} group by 1,2
        union all
        select extract(hour from (ts at time zone $2))::int, site_id, 0, count(*) filter (where type = 'out')
          from events where ${W_EV} group by 1,2
      ) t join sites s on s.id = t.site_id
      group by t.h, s.key order by t.h`,
    p
  );
}

// Источник верхнего уровня: метка, либо реферер, либо прямой заход
const SRC_LABEL = `case
    when utm_source <> '' then utm_source
    when referrer_host <> '' then 'ref: ' || referrer_host
    else '(прямые заходы)' end`;

export async function sourcesTop(f) {
  const p = await baseParams(f);
  return q(
    `select ${SRC_LABEL} src, count(*)::int visits, count(distinct visitor_id)::int visitors,
            coalesce(sum(pageviews),0)::int pv, coalesce(sum(outclicks),0)::int clicks
       from sessions where ${W_SE}
      group by 1 order by clicks desc, visits desc limit 100`,
    p
  );
}

// Канал захода: реклама (по click-id и платной метке), органика поисковиков
// (реферер без рекламных признаков), соцсети, прочее. Отличаем рекламный заход
// от органического так: у рекламы есть click-id (yclid/gclid и т.п.) или платный
// utm_medium (cpc/ppc/paid); органика это переход из поисковика БЕЗ этих признаков.
// Наши же площадки и служебный шум исключаем через ${'W_SE'} (svcExcl), а заходы
// с utm-меткой без платного признака отдельным каналом не выделяем — они падают в
// «Другие сайты»/«Прямые» по реферреру (партнёрские метки разложим отдельно позже).
const SRC_CHANNEL = `case
    when click_id_type in ('yclid','ysclid') or (utm_medium in ('cpc','ppc','paid','banner','cpm') and utm_source like '%yandex%') then 'Реклама · Яндекс Директ'
    when click_id_type in ('gclid','wbraid','gbraid') or (utm_medium in ('cpc','ppc','paid') and utm_source like '%google%') then 'Реклама · Google Ads'
    when click_id <> '' or utm_medium in ('cpc','ppc','paid') then 'Реклама · прочее'
    when referrer_host like '%yandex%' or referrer_host = 'ya.ru' then 'Органика · Яндекс'
    when referrer_host like '%google%' then 'Органика · Google'
    when referrer_host like '%bing%' or referrer_host like '%duckduckgo%' or referrer_host like '%rambler%' or referrer_host = 'go.mail.ru' then 'Органика · прочие поисковики'
    when referrer_host like '%vk.com%' or referrer_host like '%t.me%' or referrer_host like '%telegram%' or referrer_host like '%dzen%' or referrer_host like '%youtube%' or referrer_host like '%facebook%' or referrer_host like '%instagram%' or referrer_host = 'ok.ru' then 'Соцсети'
    when referrer_host <> '' then 'Другие сайты'
    else 'Прямые заходы' end`;

export async function channelsTop(f) {
  const p = await baseParams(f);
  return q(
    `select ${SRC_CHANNEL} channel, count(*)::int visits, count(distinct visitor_id)::int visitors,
            coalesce(sum(pageviews),0)::int pv, coalesce(sum(outclicks),0)::int clicks
       from sessions where ${W_SE}
      group by 1 order by visits desc, clicks desc limit 100`,
    p
  );
}

// То же, но с разбивкой по сайту — чтобы на вкладке «Источники» можно было
// фильтровать каналы по выбранным сайтам на клиенте без перезапроса.
export async function channelsBySite(f) {
  const p = await baseParams(f);
  return q(
    `select sites.key site_key, ${SRC_CHANNEL} channel,
            count(*)::int visits, count(distinct visitor_id)::int visitors,
            coalesce(sum(pageviews),0)::int pv, coalesce(sum(outclicks),0)::int clicks
       from sessions join sites on sites.id = sessions.site_id
      where ${W_SE}
      group by 1,2`,
    p
  );
}

export async function utmBreakdown(f) {
  const p = await baseParams(f);
  // Сайт добавлен в разрез, чтобы одинаковые метки на разных сайтах
  // не сливались в одну строку и было видно, с какого сайта каждая метка
  return q(
    `select sites.key site_key, sites.name site_name,
            utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            count(*)::int visits, count(distinct visitor_id)::int visitors,
            coalesce(sum(outclicks),0)::int clicks,
            count(*) filter (where click_id <> '')::int paid
       from sessions join sites on sites.id = sessions.site_id
      where ${W_SE} and (utm_source <> '' or utm_medium <> '' or utm_campaign <> '')
      group by 1,2,3,4,5,6,7 order by clicks desc, visits desc limit 300`,
    p
  );
}

export async function referrers(f) {
  const p = await baseParams(f);
  return q(
    `select referrer_host, count(*)::int visits, coalesce(sum(outclicks),0)::int clicks
       from sessions where ${W_SE} and utm_source = '' and referrer_host <> ''
      group by 1 order by visits desc limit 100`,
    p
  );
}

// Кросс-таблица «сайт → провайдер»: главный ответ на вопрос, куда уходят люди
export async function providerBySite(f) {
  const p = await baseParams(f);
  // Направление вместо сайта: serverselection делится на EN (корень) и RU (/ru) по пути.
  return q(
    `select e.provider, ${DIRECTION_EV} site_key, count(*)::int clicks,
            count(distinct e.session_id)::int sessions
       from events e join sites s on s.id = e.site_id
      where e.type = 'out' and s.archived = false and ${W_EV_E}
      group by 1,2`,
    p
  );
}

export async function providerNames() {
  const rows = await q('select slug, name from providers');
  return new Map(rows.map((r) => [r.slug, r.name]));
}

// Всего визитов по направлению (для конверсии на вкладке «Провайдеры»):
// сколько визитов пришло на каждый сайт, чтобы посчитать долю дошедших до перехода.
export async function visitsByDirection(f) {
  const p = await baseParams(f);
  return q(
    `select ${DIRECTION_SE} direction, count(se.id)::int visits
       from sessions se join sites s on s.id = se.site_id
      where ${W_SE} and s.archived = false
      group by 1`,
    p
  );
}

export async function providerDetail(f, provider) {
  const p = [...(await baseParams(f)), provider];
  const byUtm = await q(
    `select utm_source, utm_medium, utm_campaign, utm_content, count(*)::int clicks
       from events where type = 'out' and provider = $6 and ${W_EV}
      group by 1,2,3,4 order by clicks desc limit 100`,
    p
  );
  const byPlace = await q(
    `select placement, label, path, count(*)::int clicks
       from events where type = 'out' and provider = $6 and ${W_EV}
      group by 1,2,3 order by clicks desc limit 100`,
    p
  );
  const bySiteRows = await q(
    `select s.key, s.name, count(*)::int clicks
       from events e join sites s on s.id = e.site_id
      where e.type = 'out' and e.provider = $6 and ${W_EV_E}
      group by 1,2 order by clicks desc`,
    p
  );
  const targets = await q(
    `select target_host, target_url, count(*)::int clicks
       from events where type = 'out' and provider = $6 and ${W_EV}
      group by 1,2 order by clicks desc limit 30`,
    p
  );
  return { byUtm, byPlace, bySiteRows, targets };
}

export async function placements(f) {
  const p = await baseParams(f);
  return q(
    `select placement, label, provider, count(*)::int clicks,
            count(distinct session_id)::int sessions
       from events where type = 'out' and ${W_EV}
      group by 1,2,3 order by clicks desc limit 300`,
    p
  );
}

export async function customEvents(f) {
  const p = await baseParams(f);
  return q(
    `select name, count(*)::int hits, count(distinct session_id)::int sessions
       from events where type = 'ev' and ${W_EV}
      group by 1 order by hits desc limit 100`,
    p
  );
}

export async function pagesReport(f) {
  const p = await baseParams(f);
  const rows = await q(
    `select path,
            count(*) filter (where type = 'pv')::int views,
            count(distinct session_id) filter (where type = 'pv')::int sessions,
            count(*) filter (where type = 'out')::int clicks
       from events where ${W_EV} and path <> ''
      group by path order by views desc, clicks desc limit 200`,
    p
  );
  const landings = await q(
    `select landing_path path, count(*)::int visits, coalesce(sum(outclicks),0)::int clicks
       from sessions where ${W_SE} and landing_path <> ''
      group by 1 order by visits desc limit 100`,
    p
  );
  return { rows, landings };
}

export async function geoReport(f) {
  const p = await baseParams(f);
  const countries = await q(
    `select country, count(*)::int visits, coalesce(sum(outclicks),0)::int clicks
       from sessions where ${W_SE} group by 1 order by visits desc limit 10`,
    p
  );
  const cities = await q(
    `select city, country, count(*)::int visits, coalesce(sum(outclicks),0)::int clicks
       from sessions where ${W_SE} and city <> '' group by 1,2 order by visits desc limit 10`,
    p
  );
  return { countries, cities };
}

export async function techReport(f) {
  const p = await baseParams(f);
  const one = (col) =>
    q(
      `select ${col} k, count(*)::int visits, coalesce(sum(outclicks),0)::int clicks
         from sessions where ${W_SE} group by 1 order by visits desc limit 30`,
      p
    );
  const [devices, oss, browsers, langs] = await Promise.all([
    one('device'), one('os'), one('browser'), one('lang'),
  ]);
  return { devices, oss, browsers, langs };
}

function logWhere(f, opts, p) {
  const extra = [];
  let i = p.length;
  if (opts.type) { p.push(opts.type); extra.push(`and e.type = $${++i}`); }
  if (opts.provider) { p.push(opts.provider); extra.push(`and e.provider = $${++i}`); }
  if (opts.search) {
    p.push('%' + String(opts.search).toLowerCase() + '%');
    i++;
    extra.push(`and (lower(e.path) like $${i} or lower(e.label) like $${i} or lower(e.utm_campaign) like $${i}
                or lower(e.utm_source) like $${i} or lower(e.target_host) like $${i} or lower(e.provider) like $${i})`);
  }
  return { sql: `${W_EV_E} ${extra.join(' ')}`, i };
}

export async function logRows(f, opts = {}) {
  const page = opts.page || 0;
  const per = opts.per || 100;
  const p = await baseParams(f);
  const { sql, i } = logWhere(f, opts, p);
  const params = [...p, per, page * per];
  const rows = await q(
    `select e.id, e.ts, s.name site, s.key site_key, e.type, e.name, e.path, e.provider, e.target_host,
            e.target_url, e.placement, e.label, e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content,
            e.click_id, e.referrer_host, e.country, e.city, e.device, e.browser, e.session_id, e.visitor_id, e.is_bot, e.meta
       from events e join sites s on s.id = e.site_id
      where ${sql}
      order by e.ts desc limit $${i + 1} offset $${i + 2}`,
    params
  );
  const [{ n }] = await q(`select count(*)::int n from events e where ${sql}`, p);
  return { rows, total: n };
}

export async function logAll(f, opts = {}) {
  const p = await baseParams(f);
  const { sql } = logWhere(f, opts, p);
  return q(
    `select e.ts, s.name site, e.type, e.name, e.path, e.provider, e.target_host, e.target_url,
            e.placement, e.label, e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content,
            e.click_id, e.referrer_host, e.country, e.city, e.device, e.browser, e.session_id
       from events e join sites s on s.id = e.site_id
      where ${sql} order by e.ts desc limit 50000`,
    p
  );
}

export async function providerList() {
  return q('select slug, name, hosts from providers order by name');
}

export async function lastEventAt() {
  const r = await q('select max(ts) t from events');
  return r[0]?.t || null;
}

// Направление = сайт, но serverselection разбит на EN (корень) и RU (/ru) по пути.
// Итого 4 направления: podborvps, servercalc-ru, serverselection-en, serverselection-ru.
const DIRECTION_EV = `case
    when s.key = 'serverselection' and e.path like '/ru%' then 'serverselection-ru'
    when s.key = 'serverselection' then 'serverselection-en'
    else s.key end`;
const DIRECTION_SE = `case
    when s.key = 'serverselection' and se.landing_path like '/ru%' then 'serverselection-ru'
    when s.key = 'serverselection' then 'serverselection-en'
    else s.key end`;

// Воронки: уникальные сессии по именованным событиям, в разрезе направления.
// Шаги калькулятора (calc_start/calc_result/calc_click), акций (promo_copy/promo_click)
// и news_click приходят как кастомные события 'ev' от пикселя сайта. Копятся с момента,
// когда на сайтах включили отправку этих событий в пиксель.
export async function funnelEvents(f) {
  const p = await baseParams(f);
  return q(
    `select ${DIRECTION_EV} direction, e.name ev, count(distinct e.session_id)::int sessions
       from events e join sites s on s.id = e.site_id
      where e.type = 'ev'
        and e.name in ('calc_start','calc_result','calc_click','promo_copy','promo_click','news_click')
        and s.archived = false
        and ${W_EV_E}
      group by 1,2`,
    p
  );
}

// Трафик-воронка в разрезе направления (serverselection делится по языку посадки).
export async function funnelTraffic(f) {
  const p = await baseParams(f);
  return q(
    `select ${DIRECTION_SE} direction,
            count(se.id)::int visits,
            coalesce(sum(se.pageviews),0)::int pv,
            coalesce(sum(se.outclicks),0)::int clicks
       from sessions se join sites s on s.id = se.site_id
      where ${W_SE} and s.archived = false
      group by 1`,
    p
  );
}
