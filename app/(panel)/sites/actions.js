'use server';

import { revalidatePath } from 'next/cache';
import { q } from '@/lib/db';
import { isAuthed } from '@/lib/auth';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function addSite(formData) {
  if (!(await isAuthed())) return;
  const name = String(formData.get('name') || '').trim();
  const domain = String(formData.get('domain') || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const key = slugify(formData.get('key') || domain || name);
  if (!name || !key) return;
  await q('insert into sites (key, name, domain) values ($1,$2,$3) on conflict (key) do nothing', [key, name, domain]);
  revalidatePath('/sites');
}

export async function saveSite(formData) {
  if (!(await isAuthed())) return;
  const id = parseInt(formData.get('id'), 10);
  const name = String(formData.get('name') || '').trim();
  const domain = String(formData.get('domain') || '').trim();
  const archived = formData.get('archived') === 'on';
  if (!id || !name) return;
  await q('update sites set name = $2, domain = $3, archived = $4 where id = $1', [id, name, domain, archived]);
  revalidatePath('/sites');
}

export async function saveProvider(formData) {
  if (!(await isAuthed())) return;
  const slug = String(formData.get('slug') || '');
  const name = String(formData.get('name') || '').trim();
  const hosts = String(formData.get('hosts') || '')
    .split(/[\s,]+/).map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
    .filter(Boolean);
  if (!slug || !name) return;
  await q('update providers set name = $2, hosts = $3 where slug = $1', [slug, name, hosts]);
  revalidatePath('/sites');
}
