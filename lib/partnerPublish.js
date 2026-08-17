/**
 * Партнёры и публикация: какой партнёр на каких сайтах включён.
 *
 * База состояния — сид data/partner-publish.json (реальное состояние на момент
 * сборки прототипа). Поверх сида накладываются правки из таблицы partner_publish
 * в Postgres (тумблеры по сайтам, вес, «проверено», напоминание). Так вкладка
 * работает даже до первой правки (показывает сид), а сохранённые изменения живут
 * в базе панели.
 *
 * ВАЖНО (архитектурный форк): панель на Vercel не пушит в репозитории сайтов.
 * Здесь хранится ЖЕЛАЕМОЕ состояние публикации. Фактическую выкатку в data сайтов
 * (флаги enHidden/локаль в servercalc-site и т.п.) делает конвейер публикации.
 */
import fs from 'node:fs';
import path from 'node:path';
import { q } from '@/lib/db';
import { hasDb } from '@/lib/db';

let seedCache = null;
function seed() {
  if (seedCache) return seedCache;
  try {
    const p = path.join(process.cwd(), 'data', 'partner-publish.json');
    seedCache = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    seedCache = { generated: '', sites: [], partners: [] };
  }
  return seedCache;
}

export function sitesList() {
  return seed().sites || [];
}

export function seedPartners() {
  return seed().partners || [];
}

export function partnerMeta(slug) {
  return (seed().partners || []).find((p) => p.slug === slug) || null;
}

// Правила запрета: RU-only-партнёр не может стоять на английском сайте;
// санкционный (OFAC) не может стоять на дубайском (serverselection).
export function blockedOn(partner, site) {
  if (site.lang === 'EN' && partner.lang === 'RU') {
    return 'RU-only партнёр не публикуется на английском сайте';
  }
  const sanctioned = (partner.flags || []).some((f) => f.t === 'sanction');
  if (sanctioned && site.lang === 'EN') {
    return 'санкции OFAC: нельзя на дубайский (EN) сайт';
  }
  return '';
}

// Нарушения текущего состояния: включён там, где запрещён.
export function violations(partners, sites) {
  const out = [];
  for (const p of partners) {
    for (const s of sites) {
      if (p.pub?.[s.id] && blockedOn(p, s)) {
        out.push({ slug: p.slug, name: p.name, site: s.id, reason: blockedOn(p, s) });
      }
    }
  }
  return out;
}

export async function loadPartnerPublish() {
  const base = seed();
  const sites = base.sites || [];
  const partners = (base.partners || []).map((p) => ({ ...p, pub: { ...(p.pub || {}) } }));

  if (hasDb) {
    try {
      const rows = await q('select slug, pub, weight, verified, reminder from partner_publish');
      const by = new Map(rows.map((r) => [r.slug, r]));
      for (const p of partners) {
        const o = by.get(p.slug);
        if (!o) continue;
        if (o.pub && typeof o.pub === 'object') p.pub = { ...p.pub, ...o.pub };
        if (o.weight != null) p.weight = o.weight;
        if (typeof o.verified === 'boolean') p.verified = o.verified;
        if (o.reminder != null) p.reminder = o.reminder;
      }
    } catch {
      // база недоступна — отдаём сид
    }
  }
  return { generated: base.generated, sites, partners };
}
