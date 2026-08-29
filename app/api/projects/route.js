import { isAuthed } from '@/lib/auth';
import { saveBoard } from '@/lib/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Сохранение конфигурации проектов и настроек кампаний. Только для авторизованного
// пользователя кабинета (тот же логин, что и вся панель).
export async function POST(req) {
  if (!(await isAuthed())) return json({ error: 'unauthorized' }, 401);
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  try {
    await saveBoard(body || {});
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
}
