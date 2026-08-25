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

  // Запросы поиска — из снимка Вебмастера (обновляется командой «обнови маркетинг»).
  const m = loadMarketing();
  const webmaster = (m?.webmaster?.sites || []).map((s) => ({
    host: s.host,
    queries: (s.queries || []).map((r) => ({
      q: r[0], impressions: Number(r[1]) || 0, clicks: Number(r[2]) || 0,
    })),
  }));

  const sites = siteList.filter((s) => !s.archived).map((s) => ({ key: s.key, name: s.name }));

  return (
    <OrganicView
      rep={rep}
      total={ov.visits}
      webmaster={webmaster}
      wmGenerated={m?.generated || null}
      sites={sites}
      tz={f.tz}
    />
  );
}
