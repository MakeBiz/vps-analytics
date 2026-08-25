import { parseFilters } from '@/lib/filters';
import { organicReport, overview, sites as allSites } from '@/lib/query';
import { loadMarketing } from '@/lib/marketing';
import OrganicView from '@/components/OrganicView';

export const dynamic = 'force-dynamic';

export default async function Organic({ searchParams }) {
  const f = parseFilters(await searchParams);

  const [rep, ov, siteList] = await Promise.all([
    organicReport(f),
    overview(f),
    allSites(),
  ]);

  // Запросы поиска — из снимка коннектора (обновляется командой «обнови маркетинг»).
  const m = loadMarketing();
  // Яндекс.Вебмастер: строки [запрос, показы, клики]
  const webmaster = (m?.webmaster?.sites || []).map((s) => ({
    host: s.host,
    queries: (s.queries || []).map((r) => ({
      q: r[0], impressions: Number(r[1]) || 0, clicks: Number(r[2]) || 0,
    })),
  }));
  // Google Search Console: {host, queries:[{q,impressions,clicks,ctr,position}]} либо строки [q,impr,clicks,ctr,pos].
  // Появится, когда коннектор начнёт писать секцию gsc в снимок. До тех пор пусто — блоки Google деградируют мягко.
  const gsc = (m?.gsc?.sites || []).map((s) => ({
    host: s.host,
    queries: (s.queries || []).map((r) => (Array.isArray(r)
      ? { q: r[0], impressions: Number(r[1]) || 0, clicks: Number(r[2]) || 0, ctr: Number(r[3]) || 0, position: r[4] != null ? Number(r[4]) : null }
      : { q: r.q, impressions: Number(r.impressions) || 0, clicks: Number(r.clicks) || 0, ctr: Number(r.ctr) || 0, position: r.position != null ? Number(r.position) : null })),
  }));

  const sites = siteList.filter((s) => !s.archived).map((s) => ({ key: s.key, name: s.name }));

  return (
    <OrganicView
      rep={rep}
      total={ov.visits}
      webmaster={webmaster}
      gsc={gsc}
      wmGenerated={m?.generated || null}
      gscGenerated={m?.gsc?.generated || null}
      sites={sites}
      tz={f.tz}
    />
  );
}
