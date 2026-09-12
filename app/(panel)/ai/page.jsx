import { sites as allSites } from '@/lib/query';
import { loadMarketing } from '@/lib/marketing';
import SeoView from '@/components/SeoView';

export const dynamic = 'force-dynamic';

/**
 * AI-видимость (GEO): цитируют ли нас нейросети. Отдельный раздел, потому что
 * источник другой (зонд Perplexity + OpenAI + GigaChat), метрика другая (есть
 * упоминание или нет, а не позиция) и работы другие, чем в классическом SEO.
 */
export default async function AiPage() {
  const m = loadMarketing();
  const siteList = await allSites();
  const sites = siteList.filter((s) => !s.archived).map((s) => ({ key: s.key, name: s.name, domain: s.domain }));

  return (
    <SeoView
      mode="ai"
      aiviz={m?.aiviz || null}
      sites={sites}
      wmGenerated={m?.aiviz?.generated || m?.generated || null}
    />
  );
}
