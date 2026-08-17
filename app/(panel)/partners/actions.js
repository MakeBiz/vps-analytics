'use server';

import { revalidatePath } from 'next/cache';
import { q, hasDb } from '@/lib/db';
import { isAuthed } from '@/lib/auth';
import { sitesList, partnerMeta, blockedOn } from '@/lib/partnerPublish';

/**
 * Сохранить желаемое состояние публикации партнёров.
 * rows: [{ slug, pub:{siteId:bool}, weight:int, verified:bool, reminder:str }]
 * Правила запрета применяются на сервере: включить партнёра там, где он заблокирован
 * (RU-only на EN-сайте, санкционный в Дубае), нельзя — такие тумблеры гасятся.
 */
export async function savePartners(rows) {
  if (!(await isAuthed())) return { ok: false, error: 'auth' };
  if (!hasDb) return { ok: false, error: 'nodb' };
  if (!Array.isArray(rows)) return { ok: false, error: 'bad-input' };

  const sites = sitesList();
  let saved = 0;
  let stripped = 0;

  for (const r of rows) {
    const slug = String(r?.slug || '').slice(0, 60);
    if (!slug) continue;
    const meta = partnerMeta(slug);
    const pubIn = (r && typeof r.pub === 'object' && r.pub) || {};
    const pub = {};
    for (const s of sites) {
      let on = Boolean(pubIn[s.id]);
      if (on && meta && blockedOn(meta, s)) { on = false; stripped++; }
      pub[s.id] = on;
    }
    let weight = parseInt(r?.weight, 10);
    if (!Number.isFinite(weight)) weight = 0;
    weight = Math.max(0, Math.min(100, weight));
    const verified = Boolean(r?.verified);
    const reminder = String(r?.reminder || '').slice(0, 500);

    await q(
      `insert into partner_publish (slug, pub, weight, verified, reminder, updated_at)
       values ($1, $2::jsonb, $3, $4, $5, now())
       on conflict (slug) do update set
         pub = excluded.pub, weight = excluded.weight,
         verified = excluded.verified, reminder = excluded.reminder,
         updated_at = now()`,
      [slug, JSON.stringify(pub), weight, verified, reminder]
    );
    saved++;
  }

  revalidatePath('/partners');
  return { ok: true, saved, stripped };
}
