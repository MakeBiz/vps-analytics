import { parseFilters } from '@/lib/filters';
import { loadMarketing } from '@/lib/marketing';
import { VPS_CAMPAIGN_ALLOW as ALLOW } from '@/lib/direct';
import { spendPeriod } from '@/lib/projects';
import DirectView from '@/components/DirectView';

export const dynamic = 'force-dynamic';

// Складываем дни в итоги периода. Конверсии и расход по «конверсионным» дням
// считаем отдельно: если за часть дней конверсий нет, CPA по всему расходу
// периода был бы завышен, поэтому делим только на сопоставимый расход.
function sumDays(rows) {
  const t = { days: rows.length, cost: 0, clicks: 0, impressions: 0, conversions: 0, convDays: 0, convCost: 0 };
  for (const r of rows) {
    t.cost += r.cost || 0;
    t.clicks += r.clicks || 0;
    t.impressions += r.impressions || 0;
    if (r.conversions != null) { t.conversions += r.conversions; t.convDays += 1; t.convCost += r.cost || 0; }
  }
  return t;
}

// Рекламный дашборд Директа: снимок коннектора Яндекса за ~30 дней (data/marketing.json).
// Кампании фильтруем по согласованному списку VPS-кампаний (тот же, что на «Маркетинге»).
export default async function DirectPage({ searchParams }) {
  const f = parseFilters(await searchParams);
  const m = loadMarketing();
  const campaigns = (m?.direct?.campaigns || []).filter((c) => ALLOW.has(String(c.id)));

  // График живёт на истории по дням из кабинета (с 01.02.2026) и слушается периода
  // из шапки. Конверсии есть только в 30-дневном снимке коннектора — накладываем их
  // на те дни, где они реально есть, остальные точки линии не рисуем.
  // Дни периода, дни прошлого такого же отрезка и разбивка по кампаниям —
  // одним проходом по истории кабинета и одним запросом настроек.
  let days = [], prevDays = [], periodCamps = [];
  try {
    const r = await spendPeriod(f.from, f.to, f.prevFrom);
    days = r.days; prevDays = r.prevDays; periodCamps = r.campaigns;
  } catch {
    days = []; prevDays = []; periodCamps = [];
  }
  // Тип кампании (поиск / РСЯ / бренд) есть только в снимке — подмешиваем по id.
  const kindById = {};
  for (const c of (m?.direct?.campaigns || [])) kindById[String(c.id)] = c.kind;
  const campTable = periodCamps.length
    ? periodCamps.map((c) => ({ ...c, kind: kindById[String(c.id)] || '' }))
    : campaigns;
  // Конверсии берём из истории кабинета, а где её ещё нет — из 30-дневного снимка.
  const convByDate = {};
  for (const r of (m?.direct?.dailyVps || [])) convByDate[String(r.date).slice(0, 10)] = r.conversions ?? null;
  const daily = days.length
    ? days.map((d) => ({ ...d, conversions: d.conversions != null ? d.conversions : (convByDate[d.date] ?? null) }))
    : (m?.direct?.dailyVps || []);

  return (
    <DirectView
      campaigns={campTable}
      fromHistory={periodCamps.length > 0}
      daily={daily}
      totals={days.length ? sumDays(daily) : null}
      prevTotals={prevDays.length ? sumDays(prevDays) : null}
      period={{ from: f.from, to: f.to, prevFrom: f.prevFrom, prevTo: f.prevTo, fallback: days.length === 0 }}
      queries={m?.directQueries || { top: [], minusCandidates: [] }}
      generated={m?.generated || null}
      win={m?.window || null}
      gran={f.gran}
      granAuto={f.granAuto}
    />
  );
}
