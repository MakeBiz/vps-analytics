/**
 * Проверка живости для балансировщика App Platform (Timeweb): без базы и без
 * авторизации, отвечает 200 пока процесс жив.
 *
 * Базу сюда намеренно не тянем. Если Postgres прилёг, приложение должно
 * остаться поднятым и отдавать страницы, которые живут на JSON (роялти,
 * маркетинг), а не уходить в бесконечный перезапуск по проверке состояния.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response('ok', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
