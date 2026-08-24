import { isAuthed } from '@/lib/auth';
import { parseFilters } from '@/lib/filters';
import { logAll } from '@/lib/query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEAD = [
  'Дата и время (UTC)', 'Сайт', 'Событие', 'Имя события', 'Страница', 'Провайдер', 'Хост назначения',
  'Ссылка назначения', 'Место', 'Кнопка', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
  'Метка рекламы', 'Реферер (хост)', 'Страна', 'Город', 'Устройство', 'Браузер', 'Сессия',
];

function cell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return '"' + s.replaceAll('"', '""') + '"';
}

export async function GET(req) {
  if (!(await isAuthed())) return new Response('Нет доступа', { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const f = parseFilters(sp);
  const rows = await logAll(f, { type: sp.type || '', provider: sp.provider || '', search: sp.q || '' });

  const lines = [HEAD.map(cell).join(';')];
  for (const r of rows) {
    lines.push([
      new Date(r.ts).toISOString().replace('T', ' ').slice(0, 19),
      r.site, r.type, r.name, r.path, r.provider, r.target_host, r.target_url,
      r.placement, r.label, r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content,
      r.click_id, r.referrer_host, r.country, r.city, r.device, r.browser, r.session_id,
    ].map(cell).join(';'));
  }
  // BOM, чтобы Excel открыл кириллицу без плясок с кодировкой
  const body = '﻿' + lines.join('\r\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="events-${f.from}_${f.to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
