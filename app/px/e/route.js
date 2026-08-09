import { ensureSchema, qRaw, hasDb } from '@/lib/db';
import { isBot, device as uaDevice, os as uaOs, browser as uaBrowser } from '@/lib/ua';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OK = () =>
  new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type',
      'Cache-Control': 'no-store',
    },
  });

export async function OPTIONS() {
  return OK();
}

// Небольшие кэши в памяти лямбды: справочники меняются редко,
// а лишний поход в базу на каждое событие того не стоит
const CACHE_MS = 60_000;
let sitesAt = 0;
let sitesMap = new Map();
let provAt = 0;
let provList = [];

async function sites() {
  if (Date.now() - sitesAt < CACHE_MS && sitesMap.size) return sitesMap;
  const rows = await qRaw('select id, key from sites where archived = false');
  sitesMap = new Map(rows.map((r) => [r.key, r.id]));
  sitesAt = Date.now();
  return sitesMap;
}

async function providers() {
  if (Date.now() - provAt < CACHE_MS && provList.length) return provList;
  provList = await qRaw('select slug, hosts from providers');
  provAt = Date.now();
  return provList;
}

function clean(v, len = 255) {
  if (v === null || v === undefined) return '';
  return String(v).slice(0, len);
}

// Метки рекламы из адреса вырезаем: они уже разложены по колонкам,
// а в отчёте по страницам только дробят одну страницу на десятки строк
const TRACK = /^(utm_|yclid|ysclid|ymclid|gclid|gbraid|wbraid|fbclid|msclkid|_openstat|from|rb_clickid|erid)/i;

function cleanPath(u) {
  const raw = String(u || '');
  const i = raw.indexOf('?');
  if (i < 0) return raw.slice(0, 300);
  const base = raw.slice(0, i);
  let keep;
  try {
    const sp = new URLSearchParams(raw.slice(i + 1));
    keep = [...sp.entries()].filter(([k]) => !TRACK.test(k));
  } catch {
    return base.slice(0, 300);
  }
  if (!keep.length) return base.slice(0, 300);
  return (base + '?' + keep.map(([k, v]) => k + (v ? '=' + v : '')).join('&')).slice(0, 300);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function resolveProvider(targetHost, hint) {
  const host = (targetHost || '').replace(/^www\./, '').toLowerCase();
  if (host) {
    const list = await providers();
    for (const p of list) {
      for (const h of p.hosts || []) {
        const hh = h.replace(/^www\./, '').toLowerCase();
        if (host === hh || host.endsWith('.' + hh)) return p.slug;
      }
    }
  }
  if (hint) return clean(hint, 60).toLowerCase();
  if (!host) return '';
  const slug = host.split('.').slice(0, -1).join('.') || host;
  // Новый хост назначения заводим в справочник, чтобы его можно было
  // переименовать в панели, а не искать глазами в сыром журнале
  try {
    await qRaw(
      'insert into providers (slug, name, hosts) values ($1,$2,$3) on conflict (slug) do nothing',
      [slug, host, [host]]
    );
    provAt = 0;
  } catch {}
  return slug;
}

export async function POST(req) {
  if (!hasDb) return OK();
  let b;
  try {
    b = JSON.parse(await req.text());
  } catch {
    return OK();
  }
  if (!b || !b.k || !b.s || !b.v) return OK();

  try {
    await ensureSchema();
    const map = await sites();
    const siteId = map.get(String(b.k));
    if (!siteId) return OK();

    const h = req.headers;
    const ua = h.get('user-agent') || '';
    const bot = isBot(ua);
    const country = (h.get('x-vercel-ip-country') || '').toUpperCase();
    let city = h.get('x-vercel-ip-city') || '';
    try {
      city = decodeURIComponent(city);
    } catch {}

    const f = b.f || {};
    const type = clean(b.t, 12) || 'pv';
    const isPv = type === 'pv';
    const isOut = type === 'out';

    const targetUrl = clean(b.h, 500);
    const targetHost = isOut ? clean(b.hh, 120) || hostOf(targetUrl) : '';
    const provider = isOut ? await resolveProvider(targetHost, clean(b.pr, 60)) : '';

    const params = [
      /* 1 */ clean(b.s, 64),
      /* 2 */ siteId,
      /* 3 */ clean(b.v, 64),
      /* 4 */ cleanPath(f.lp || b.u),
      /* 5 */ clean(f.r, 400),
      /* 6 */ hostOf(f.r),
      /* 7 */ clean(f.us, 120).toLowerCase(),
      /* 8 */ clean(f.um, 120).toLowerCase(),
      /* 9 */ clean(f.uc, 160).toLowerCase(),
      /* 10 */ clean(f.un, 160).toLowerCase(),
      /* 11 */ clean(f.ut, 160).toLowerCase(),
      /* 12 */ clean(f.ci, 200),
      /* 13 */ clean(f.ct, 20),
      /* 14 */ country,
      /* 15 */ clean(city, 80),
      /* 16 */ uaDevice(ua),
      /* 17 */ uaOs(ua),
      /* 18 */ uaBrowser(ua),
      /* 19 */ clean(f.lang, 20),
      /* 20 */ bot,
      /* 21 */ isPv ? 1 : 0,
      /* 22 */ isOut ? 1 : 0,
      /* 23 */ type,
      /* 24 */ clean(b.en, 80),
      /* 25 */ cleanPath(b.u),
      /* 26 */ clean(b.ti, 200),
      /* 27 */ provider,
      /* 28 */ targetHost,
      /* 29 */ targetUrl,
      /* 30 */ clean(b.pl, 120),
      /* 31 */ clean(b.lb, 160),
      /* 32 */ b.m ? JSON.stringify(b.m).slice(0, 4000) : null,
    ];

    await qRaw(
      `with s as (
         insert into sessions (
           id, site_id, visitor_id, started_at, last_seen_at, landing_path, referrer, referrer_host,
           utm_source, utm_medium, utm_campaign, utm_content, utm_term, click_id, click_id_type,
           country, city, device, os, browser, lang, is_bot, pageviews, outclicks
         ) values (
           $1,$2,$3, now(), now(), $4,$5,$6,
           $7,$8,$9,$10,$11,$12,$13,
           $14,$15,$16,$17,$18,$19,$20,$21,$22
         )
         on conflict (id) do update set
           last_seen_at = now(),
           pageviews = sessions.pageviews + $21,
           outclicks = sessions.outclicks + $22
         returning *
       )
       insert into events (
         site_id, session_id, visitor_id, ts, type, name, path, title,
         provider, target_host, target_url, placement, label,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term, click_id,
         country, city, device, browser, os, referrer_host, is_bot, meta
       )
       select s.site_id, s.id, s.visitor_id, now(), $23, $24, $25, $26,
              $27, $28, $29, $30, $31,
              s.utm_source, s.utm_medium, s.utm_campaign, s.utm_content, s.utm_term, s.click_id,
              s.country, s.city, s.device, s.browser, s.os, s.referrer_host, s.is_bot,
              $32::jsonb
       from s`,
      params
    );
  } catch (e) {
    // Счётчик никогда не должен отвечать ошибкой: сайт важнее статистики
    console.error('collect', e && e.message);
  }
  return OK();
}
