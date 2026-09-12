import { parseFilters } from '@/lib/filters';
import { loadMarketing } from '@/lib/marketing';
import { VPS_CAMPAIGN_ALLOW as ALLOW } from '@/lib/direct';
import { spendDaysRange } from '@/lib/projects';
import DirectView from '@/components/DirectView';

export const dynamic = 'force-dynamic';

// Рекламный дашборд Директа: снимок коннектора Яндекса за ~30 дней (data/marketing.json).
// Кампании фильтруем по согласованному списку VPS-кампаний (тот же, что на «Маркетинге»).
export default async function DirectPage({ searchParams }) {
  const f = parseFilters(await searchParams);
  const m = loadMarketing();
  const campaigns = (m?.direct?.campaigns || []).filter((c) => ALLOW.has(String(c.id)));

  // График живёт на истории по дням из кабинета (с 01.02.2026) и слушается периода
  // из шапки. Конверсии есть только в 30-дневном снимке коннектора — накладываем их
  // на те дни, где они реально есть, остальные точки линии не рисуем.
  let days = [];
  try {
    days = await spendDaysRange(f.from, f.to);
  } catch {
    days = [];
  }
  // Конверсии берём из истории кабинета, а где её ещё нет — из 30-дневного снимка.
  const convByDate = {};
  for (const r of (m?.direct?.dailyVps || [])) convByDate[String(r.date).slice(0, 10)] = r.conversions ?? null;
  const daily = days.length
    ? days.map((d) => ({ ...d, conversions: d.conversions != null ? d.conversions : (convByDate[d.date] ?? null) }))
    : (m?.direct?.dailyVps || []);

  return (
    <DirectView
      campaigns={campaigns}
      daily={daily}
      period={{ from: f.from, to: f.to, fallback: days.length === 0 }}
      queries={m?.directQueries || { top: [], minusCandidates: [] }}
      generated={m?.generated || null}
      win={m?.window || null}
      gran={f.gran}
      granAuto={f.granAuto}
    />
  );
}
