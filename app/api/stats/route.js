import { createHash, timingSafeEqual } from 'node:crypto';
import { hasDb } from '@/lib/db';
import { parseFilters } from '@/lib/filters';
import { overview, bySite, providerBySite, providerNames, sourcesTop } from '@/lib/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Read-only выдача аналитики в JSON для внешних потребителей (другие чаты, скрипты).
 * Доступ по отдельному токену STATS_TOKEN, а НЕ по паролю панели: этот ключ
 * даёт только чтение агрегатов и его не страшно положить в адрес запроса.
 * Токена в коде нет (репозиторий публичный), он живёт в переменной окружения.
 */

function tokenOk(given) {
  const want = process.env.STATS_TOKEN || '';
  if (!want || !given) return false;
  // сравнение постоянного времени, чтобы токен нельзя было подобрать по задержке
  const a = createHash('sha256').update(String(given)).digest();
  const b = createHash('sha256').update(want).digest();
  return timingSafeEqual(a, b);
}

const j = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });

function pctNum(part, whole) {
  const w = Number(whole || 0);
  if (!w) return 0;
  return Math.round((Number(part || 0) / w) * 1000) / 10;
}

export async function GET(req) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || url.searchParams.get('token') || req.headers.get('x-stats-token') || '';

  if (!process.env.STATS_TOKEN) {
    return j({ ok: false, error: 'STATS_TOKEN не задан в проекте Vercel. Пока его нет, чтение закрыто.' }, 503);
  }
  if (!tokenOk(key)) {
    return j({ ok: false, error: 'Неверный или пустой ключ доступа (?key=...)' }, 401);
  }
  if (!hasDb) {
    return j({ ok: false, error: 'База не подключена (DATABASE_URL)' }, 503);
  }

  try {
    const sp = Object.fromEntries(url.searchParams.entries());
    const f = parseFilters(sp);

    const [ov, siteRows, provRows, names, srcRows] = await Promise.all([
      overview(f), bySite(f), providerBySite(f), providerNames(), sourcesTop(f),
    ]);

    const provTotals = new Map();
    for (const r of provRows) provTotals.set(r.provider, (provTotals.get(r.provider) || 0) + r.clicks);
    const totalClicks = [...provTotals.values()].reduce((s, n) => s + n, 0);
    const providers = [...provTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([slug, clicks]) => ({
        provider: slug,
        name: names.get(slug) || slug,
        clicks,
        share_percent: pctNum(clicks, totalClicks),
      }));

    return j({
      ok: true,
      service: 'Сквозная аналитика по сайтам-каталогам',
      generated_at: new Date(sp.__now ? Number(sp.__now) : Date.now()).toISOString(),
      period: { range: f.range, from: f.from, to: f.to, timezone: f.tz, site: f.site || 'все сайты', include_bots: f.bots },
      overview: {
        visits: ov.visits,
        visitors: ov.visitors,
        pageviews: ov.pv,
        provider_clicks: ov.clicks,
        conversion_percent: pctNum(ov.clicks, ov.visits),
        avg_seconds: ov.avg_sec,
        bounce_percent: pctNum(ov.bounced, ov.visits),
      },
      sites: siteRows.map((r) => ({
        site: r.name,
        key: r.key,
        visits: r.visits,
        visitors: r.visitors,
        pageviews: r.pv,
        provider_clicks: r.clicks,
        conversion_percent: pctNum(r.clicks, r.visits),
      })),
      providers,
      top_sources: srcRows.slice(0, 15).map((r) => ({
        source: r.src,
        visits: r.visits,
        visitors: r.visitors,
        provider_clicks: r.clicks,
      })),
    });
  } catch (e) {
    return j({ ok: false, error: (e && e.message) || String(e) }, 500);
  }
}
