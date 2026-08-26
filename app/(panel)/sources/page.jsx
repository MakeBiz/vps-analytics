import { parseFilters } from '@/lib/filters';
import { channelsBySite, utmBreakdown, sites as allSites } from '@/lib/query';
import SourcesView from '@/components/SourcesView';

export const dynamic = 'force-dynamic';

export default async function Sources({ searchParams }) {
  const f = parseFilters(await searchParams);
  // Сайт выбирается в единой шапке (общий фильтр). Данные приходят уже с учётом
  // выбранного сайта; разбивка по сайту в строках сохраняется для таблиц.
  const [channelRows, utmRows, siteList] = await Promise.all([
    channelsBySite(f), utmBreakdown(f), allSites(),
  ]);
  const sites = siteList.filter((s) => !s.archived).map((s) => ({ key: s.key, name: s.name }));

  return <SourcesView channelRows={channelRows} utmRows={utmRows} sites={sites} />;
}
