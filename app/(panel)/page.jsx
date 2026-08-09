import Link from 'next/link';
import { parseFilters, qs } from '@/lib/filters';
import { num, pct, dur, fmtDate } from '@/lib/format';
import { byDay, byHour, bySite, overview, overviewPrev, providerBySite, providerNames, sourcesTop } from '@/lib/query';
import Chart, { Bars } from '@/components/Chart';
import { BarCell, Card, Empty, Kpi } from '@/components/ui';

export const dynamic = 'force-dynamic';

function delta(now, prev) {
  if (!prev) return undefined;
  return ((now - prev) / prev) * 100;
}

export default async function Overview({ searchParams }) {
  const f = parseFilters(await searchParams);
  const [ov, prev, days, hours, siteRows, srcRows, provRows, names] = await Promise.all([
    overview(f), overviewPrev(f), byDay(f), byHour(f), bySite(f), sourcesTop(f), providerBySite(f), providerNames(),
  ]);

  const provTotals = new Map();
  for (const r of provRows) provTotals.set(r.provider, (provTotals.get(r.provider) || 0) + r.clicks);
  const topProv = [...provTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxProv = topProv[0]?.[1] || 1;

  const topSrc = srcRows.slice(0, 8);
  const maxSrcVisits = Math.max(1, ...topSrc.map((r) => r.visits));
  const maxSiteClicks = Math.max(1, ...siteRows.map((r) => r.clicks));

  const hourRows = Array.from({ length: 24 }, (_, h) => {
    const r = hours.find((x) => x.h === h);
    return { h, visits: r?.visits || 0, clicks: r?.clicks || 0 };
  });

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid kpis">
        <Kpi label="Визиты" value={num(ov.visits)} delta={delta(ov.visits, prev.visits)} />
        <Kpi label="Посетители" value={num(ov.visitors)} delta={delta(ov.visitors, prev.visitors)} />
        <Kpi label="Просмотры страниц" value={num(ov.pv)} delta={delta(ov.pv, prev.pv)} />
        <Kpi label="Переходы к провайдерам" value={num(ov.clicks)} delta={delta(ov.clicks, prev.clicks)} />
        <Kpi label="Конверсия в переход" value={pct(ov.clicks, ov.visits)} sub={`было ${pct(prev.clicks, prev.visits)}`} />
        <Kpi label="Среднее время визита" value={dur(ov.avg_sec)} sub={`отказы ${pct(ov.bounced, ov.visits)}`} />
      </div>

      <Card title="Динамика по дням" hint={`${fmtDate(new Date(f.from + 'T12:00:00Z'), 'UTC')} — ${fmtDate(new Date(f.to + 'T12:00:00Z'), 'UTC')}, ${f.tz}`}>
        <Chart rows={days} tz={f.tz} />
      </Card>

      <Card title="Сайты" hint="визиты и переходы к провайдерам за период">
        {siteRows.length === 0 ? <Empty /> : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Сайт</th>
                  <th className="n">Визиты</th>
                  <th className="n">Посетители</th>
                  <th className="n">Просмотры</th>
                  <th className="n">Переходы</th>
                  <th className="n">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {siteRows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <Link href={'/providers' + qs({ ...f, site: r.key })}>{r.name}</Link>
                    </td>
                    <td className="n">{num(r.visits)}</td>
                    <td className="n muted">{num(r.visitors)}</td>
                    <td className="n muted">{num(r.pv)}</td>
                    <BarCell value={r.clicks} max={maxSiteClicks} />
                    <td className="n muted">{pct(r.clicks, r.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid cols2">
        <Card title="Куда уходят" hint="топ провайдеров">
          {topProv.length === 0 ? <Empty /> : (
            <table>
              <tbody>
                {topProv.map(([slug, n]) => (
                  <tr key={slug}>
                    <td>
                      <Link href={'/providers' + qs(f, { provider: slug })}>{names.get(slug) || slug}</Link>
                    </td>
                    <BarCell value={n} max={maxProv} />
                    <td className="n muted">{pct(n, ov.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Откуда приходят" hint="топ источников">
          {topSrc.length === 0 ? <Empty /> : (
            <table>
              <tbody>
                {topSrc.map((r) => (
                  <tr key={r.src}>
                    <td><span className="trunc">{r.src}</span></td>
                    <BarCell value={r.visits} max={maxSrcVisits} />
                    <td className="n muted">{num(r.clicks)} пер.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Время суток" hint={`визиты по часам, ${f.tz}`}>
        <Bars rows={hourRows} labelKey="h" valueKey="visits" formatLabel={(h) => String(h).padStart(2, '0') + ':00'} />
      </Card>
    </div>
  );
}
