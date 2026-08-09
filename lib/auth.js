import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const COOKIE = 'px_admin';

export function passwordSet() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function tokenFor(pass) {
  return createHash('sha256').update('px|' + pass).digest('hex');
}

export function expected() {
  return tokenFor(process.env.ADMIN_PASSWORD || '');
}

export function same(a = '', b = '') {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export async function isAuthed() {
  if (!passwordSet()) return false;
  const jar = await cookies();
  const v = jar.get(COOKIE)?.value || '';
  return same(v, expected());
}

export async function requireAuth() {
  if (!(await isAuthed())) redirect('/login');
}
