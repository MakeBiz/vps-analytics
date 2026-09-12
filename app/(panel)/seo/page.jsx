import { parseFilters } from '@/lib/filters';
import { organicReport, overview, sites as allSites } from '@/lib/query';
import { loadMarketing } from '@/lib/marketing';
import SeoView from '@/components/SeoView';
import OrganicView from '@/components/OrganicView';

export const dynamic = 'force-dynamic';

/**
 * «Поиск» — одна страница на всю поисковую картину. Первая вкладка «Переходы»
 * это живая органика с пикселя (период, сайт и разрез из общей шапки работают),
 * остальные вкладки — снимок кабинетов Яндекс.Вебмастер + Google Search Console,
 * который пишет коннектор на Маке. AI-видимость живёт отдельным разделом (/ai):
 * там другой источник и другие работы.
 */
export default async function SearchPage({ searchParams }) {
  const f = parseFilters(await searchParams);
  const m = loadMarketing();

  const [rep, ov, siteList] = await Promise.all([organicReport(f), overview(f), allSites()]);

  const live = siteList.filter((s) => !s.archived);
  const sitesShort = live.map((s) => ({ key: s.key, name: s.name }));
  const sitesFull = live.map((s) => ({ key: s.key, name: s.name, domain: s.domain }));

  // Запросы поиска для блока органики: те же снимки кабинетов, но в разрезе запросов.
  const webmaster = (m?.webmaster?.sites || []).map((s) => ({
    host: s.host,
    queries: (s.queries || []).map((r) => ({
      q: r[0], impressions: Number(r[1]) || 0, clicks: Number(r[2]) || 0,
      position: r[3] != null ? Number(r[3]) : null, ctr: Number(r[4]) || 0,
    })),
  }));
  const gsc = (m?.gsc?.sites || []).map((s) => ({
    host: s.host,
    queries: (s.queries || []).map((r) => (Array.isArray(r)
      ? { q: r[0], impressions: Number(r[1]) || 0, clicks: Number(r[2]) || 0, ctr: Number(r[3]) || 0, position: r[4] != null ? Number(r[4]) : null }
      : { q: r.q, impressions: Number(r.impressions) || 0, clicks: Number(r.clicks) || 0, ctr: Number(r.ctr) || 0, position: r.position != null ? Number(r.position) : null })),
  }));

  const organic = (
    <OrganicView
      rep={rep}
      total={ov.visits}
      webmaster={webmaster}
      gsc={gsc}
      wmGenerated={m?.generated || null}
      gscGenerated={m?.gsc?.generated || null}
      sites={sitesShort}
      tz={f.tz}
      gran={f.gran}
      granAuto={f.granAuto}
    />
  );

  return (
    <SeoView
      webmaster={m?.webmaster?.sites || []}
      gsc={m?.gsc?.sites || []}
      aiviz={m?.aiviz || null}
      sites={sitesFull}
      wmGenerated={m?.webmaster?.generated || null}
      gscGenerated={m?.gsc?.generated || null}
      gscWindow={m?.gsc?.window || null}
      organic={organic}
    />
  );
}
