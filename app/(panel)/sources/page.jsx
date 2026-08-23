import { parseFilters } from '@/lib/filters';
import { channelsBySite, utmBreakdown, sites as allSites } from '@/lib/query';
import SourcesView from '@/components/SourcesView';

export const dynamic = 'force-dynamic';

export default async function Sources({ searchParams }) {
  const f = parseFilters(await searchParams);
  // Сайт выбирается кнопками на самой вкладке (мультивыбор), поэтому данные
  // тянем сразу по всем сайтам, а глобальный фильтр сайта тут не применяем.
  const f2 = { ...f, site: null };
  const [channelRows, utmRows, siteList] = await Promise.all([
    channelsBySite(f2), utmBreakdown(f2), allSites(),
  ]);
  const sites = siteList.filter((s) => !s.archived).map((s) => ({ key: s.key, name: s.name }));

  return <SourcesView channelRows={channelRows} utmRows={utmRows} sites={sites} />;
}
