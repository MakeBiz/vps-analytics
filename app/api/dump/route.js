import { createHash, timingSafeEqual } from 'node:crypto';
import { hasDb, qRaw } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Выгрузка сырых строк для переезда в кабинет (20.09.2026).
 *
 * Панель уходит с Vercel: визиты и события переезжают в хранилище кабинета
 * (mart.px_*), справочники и настройки туда же. Забирает их скрипт
 * Коннектор/px_migrate.py на Маке страницами по номеру строки, поэтому
 * повторный прогон доливает только новое.
 *
 * Только чтение. Доступ тем же ключом STATS_TOKEN, что у /api/stats и
 * /api/spend, заголовком x-stats-token (в адресе ключ не нужен: адреса
 * оседают в журналах). После переезда маршрут уходит вместе с панелью.
 *
 *   ?table=counts                       сколько строк и последнее событие
 *   ?table=events&after=<id>&limit=2000 события с номером больше after
 *   ?table=sessions&after=<id>&since=<ISO>  визиты по ключу, since по last_seen_at
 *   ?table=providers|sites|partner_publish|ad_projects|ad_campaign_settings  целиком
 */

function tokenOk(given) {
  const want = process.env.STATS_TOKEN || '';
  if (!want || !given) return false;
  const a = createHash('sha256').update(String(given)).digest();
  const b = createHash('sha256').update(want).digest();
  return timingSafeEqual(a, b);
}

const j = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const WHOLE = {
  providers: 'select slug, name, hosts from providers order by slug',
  sites: 'select id, key, name, domain, archived, line, created_at from sites order by id',
  partner_publish: 'select slug, pub, weight, verified, reminder, updated_at from partner_publish order by slug',
  ad_projects: 'select id, slug, name, kind, roy_key, archived, sort, created_at from ad_projects order by id',
  ad_campaign_settings:
    'select campaign_id, name, status, in_budget, provider_alloc, site_alloc, alloc, updated_at from ad_campaign_settings order by campaign_id',
};

export async function GET(req) {
  const url = new URL(req.url);
  const key = req.headers.get('x-stats-token') || url.searchParams.get('key') || '';
  if (!process.env.STATS_TOKEN) return j({ ok: false, error: 'STATS_TOKEN не задан в проекте Vercel' }, 503);
  if (!tokenOk(key)) return j({ ok: false, error: 'Неверный или пустой ключ доступа' }, 401);
  if (!hasDb) return j({ ok: false, error: 'База не подключена (DATABASE_URL)' }, 503);

  const table = url.searchParams.get('table') || '';
  const limit = Math.max(1, Math.min(5000, parseInt(url.searchParams.get('limit') || '2000', 10) || 2000));

  try {
    if (table === 'counts') {
      const [c] = await qRaw(`
        select (select count(*) from sessions)::bigint as sessions,
               (select count(*) from events)::bigint as events,
               (select coalesce(max(id), 0) from events)::bigint as max_event_id,
               (select max(ts) from events) as last_event,
               (select min(ts) from events) as first_event,
               (select count(*) from providers)::int as providers,
               (select count(*) from partner_publish)::int as partner_publish,
               (select count(*) from ad_projects)::int as ad_projects,
               (select count(*) from ad_campaign_settings)::int as ad_campaign_settings`);
      const bySite = await qRaw(`
        select s.key as site_key, count(e.id)::bigint as events, max(e.ts) as last_event
          from sites s left join events e on e.site_id = s.id
         group by s.key order by s.key`);
      return j({ ok: true, table, counts: c, bySite, at: new Date().toISOString() });
    }

    if (WHOLE[table]) {
      const rows = await qRaw(WHOLE[table]);
      return j({ ok: true, table, rows, next: null });
    }

    if (table === 'events') {
      const after = String(parseInt(url.searchParams.get('after') || '0', 10) || 0);
      const rows = await qRaw(
        `select e.*, s.key as site_key
           from events e join sites s on s.id = e.site_id
          where e.id > $1::bigint
          order by e.id
          limit $2`,
        [after, limit]
      );
      const next = rows.length === limit ? String(rows[rows.length - 1].id) : null;
      return j({ ok: true, table, rows, next });
    }

    if (table === 'sessions') {
      const after = url.searchParams.get('after') || '';
      const since = url.searchParams.get('since') || null;
      const rows = await qRaw(
        `select se.*, s.key as site_key
           from sessions se join sites s on s.id = se.site_id
          where se.id > $1
            and ($3::timestamptz is null or se.last_seen_at >= $3::timestamptz)
          order by se.id
          limit $2`,
        [after, limit, since]
      );
      const next = rows.length === limit ? rows[rows.length - 1].id : null;
      return j({ ok: true, table, rows, next });
    }

    return j({ ok: false, error: 'table: counts, events, sessions, ' + Object.keys(WHOLE).join(', ') }, 400);
  } catch (e) {
    return j({ ok: false, error: (e && e.message) || String(e) }, 500);
  }
}
