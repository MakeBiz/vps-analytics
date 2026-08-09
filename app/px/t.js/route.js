import { TRACKER } from '@/lib/tracker-src';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  return new Response(TRACKER, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
