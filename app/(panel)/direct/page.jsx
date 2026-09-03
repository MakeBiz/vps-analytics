import { loadMarketing } from '@/lib/marketing';
import { VPS_CAMPAIGN_ALLOW as ALLOW } from '@/lib/direct';
import DirectView from '@/components/DirectView';

export const dynamic = 'force-dynamic';

// Рекламный дашборд Директа: снимок коннектора Яндекса за ~30 дней (data/marketing.json).
// Кампании фильтруем по согласованному списку VPS-кампаний (тот же, что на «Маркетинге»).
export default async function DirectPage() {
  const m = loadMarketing();
  const campaigns = (m?.direct?.campaigns || []).filter((c) => ALLOW.has(String(c.id)));
  return (
    <DirectView
      campaigns={campaigns}
      daily={m?.direct?.dailyVps || []}
      queries={m?.directQueries || { top: [], minusCandidates: [] }}
      generated={m?.generated || null}
      win={m?.window || null}
    />
  );
}
