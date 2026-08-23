import { parseFilters } from '@/lib/filters';
import {
  overviewBySite, byDayBySite, byHourBySite, bySite,
  channelsBySite, providerBySite, providerNames, sites as allSites,
} from '@/lib/query';
import OverviewView from '@/components/OverviewView';

export const dynamic = 'force-dynamic';

export default async function Overview({ searchParams }) {
  const f = parseFilters(await searchParams);
  // Сайт выбирается кнопками на самой вкладке (мультивыбор), поэтому тянем
  // данные сразу по всем сайтам, а глобальный фильтр сайта тут не применяем.
  const f2 = { ...f, site: null };
  const prevF = { ...f2, from: f.prevFrom, toExclusive: f.from };

  const [ovRows, prevRows, dayRows, hourRows, siteRows, channelRows, provRows, names, siteList] = await Promise.all([
    overviewBySite(f2), overviewBySite(prevF), byDayBySite(f2), byHourBySite(f2),
    bySite(f2), channelsBySite(f2), providerBySite(f2), providerNames(), allSites(),
  ]);

  const provNames = Object.fromEntries(names); // Map -> объект для передачи в клиент
  const sites = siteList.filter((s) => !s.archived).map((s) => ({ key: s.key, name: s.name }));

  return (
    <OverviewView
      ovRows={ovRows} prevRows={prevRows} dayRows={dayRows} hourRows={hourRows}
      siteRows={siteRows} channelRows={channelRows} provRows={provRows}
      provNames={provNames} sites={sites} tz={f.tz}
    />
  );
}
