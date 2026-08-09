import { COOKIE, expected, passwordSet, same, tokenFor } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const form = await req.formData();
  const pass = String(form.get('password') || '');
  const url = new URL(req.url);
  if (!passwordSet() || !same(tokenFor(pass), expected())) {
    return Response.redirect(new URL('/login?e=1', url.origin), 303);
  }
  const res = new Response(null, { status: 303, headers: { Location: new URL('/', url.origin).toString() } });
  res.headers.append(
    'Set-Cookie',
    `${COOKIE}=${expected()}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${60 * 60 * 24 * 90}`
  );
  return res;
}
