import { createHash, timingSafeEqual } from 'node:crypto';
import { hasDb } from '@/lib/db';
import { spendExport } from '@/lib/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Истинный рекламный расход так, как он проставлен в кабинете «Проекты и кампании»:
 * учитываются ТОЛЬКО кампании со статусом не «исключена» и галкой «в бюджете», а
 * разнесение по провайдерам/сайтам — по привязке из кабинета.
 *
 * Нужен сборке роялти на Маке (build_royalties.py), чтобы расход в дашборде совпадал
 * с кабинетом, а не считался по старому списку из пяти кампаний.
 *
 * Доступ — тем же read-only ключом STATS_TOKEN, что и /api/stats (пароль панели не
 * годится: скрипт ходит без входа). Ключа в коде нет, он живёт в переменной окружения.
 */

function tokenOk(given) {
  const want = process.env.STATS_TOKEN || '';
  if (!want || !given) return false;
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

export async function GET(req) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || url.searchParams.get('token') || req.headers.get('x-stats-token') || '';

  if (!process.env.STATS_TOKEN) return j({ ok: false, error: 'STATS_TOKEN не задан в проекте Vercel' }, 503);
  if (!tokenOk(key)) return j({ ok: false, error: 'Неверный или пустой ключ доступа (?key=...)' }, 401);
  if (!hasDb) return j({ ok: false, error: 'База не подключена (DATABASE_URL)' }, 503);

  try {
    const data = await spendExport();
    return j({ ok: true, service: 'Истинный расход Директа из кабинета «Проекты и кампании»', ...data });
  } catch (e) {
    return j({ ok: false, error: (e && e.message) || String(e) }, 500);
  }
}
