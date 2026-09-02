import { sites as allSites } from '@/lib/query';
import { loadMarketing } from '@/lib/marketing';
import SeoView from '@/components/SeoView';

export const dynamic = 'force-dynamic';

// Данные — снимок кабинетов (Яндекс.Вебмастер + Google Search Console), который
// обновляет коннектор на Маке. Секции webmaster/gsc в data/marketing.json.
export default async function SeoPage() {
  const m = loadMarketing();
  const siteList = await allSites();
  const sites = siteList
    .filter((s) => !s.archived)
    .map((s) => ({ key: s.key, name: s.name, domain: s.domain }));

  return (
    <SeoView
      webmaster={m?.webmaster?.sites || []}
      gsc={m?.gsc?.sites || []}
      sites={sites}
      wmGenerated={m?.webmaster?.generated || null}
      gscGenerated={m?.gsc?.generated || null}
      gscWindow={m?.gsc?.window || null}
    />
  );
}
