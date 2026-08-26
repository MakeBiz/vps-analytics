'use client';
import { num, pct, dur } from '@/lib/format';
import Chart, { Bars } from '@/components/Chart';
import { BarCell, Card, Empty, Kpi } from '@/components/ui';
import ChannelTable from '@/components/ChannelTable';

const delta = (now, prev) => (prev ? ((now - prev) / prev) * 100 : undefined);

/**
 * «Обзор». Сайт выбирается в единой шапке (общий фильтр), данные приходят уже
 * с учётом выбранного сайта — тут просто агрегируем всё, что пришло: KPI с
 * динамикой к прошлому периоду, график по дням, таблицы сайтов/провайдеров/каналов
 * и график по часам. Разбивка по сайту в данных сохраняется (для таблицы «Сайты»).
 */
export default function OverviewView({ ovRows, prevRows, dayRows, hourRows, siteRows, channelRows, provRows, provNames, sites, tz }) {
  const on = () => true; // фильтр сайта теперь в шапке; здесь берём все пришедшие строки

  const sumOv = (rows) => rows.filter((r) => on(r.site_key)).reduce((a, r) => ({
    visits: a.visits + r.visits, visitors: a.visitors + r.visitors, pv: a.pv + r.pv,
    clicks: a.clicks + r.clicks, bounced: a.bounced + r.bounced, sec_sum: a.sec_sum + r.sec_sum,
  }), { visits: 0, visitors: 0, pv: 0, clicks: 0, bounced: 0, sec_sum: 0 });
  const ov = sumOv(ovRows);
  const prev = sumOv(prevRows);
  const avgSec = ov.visits ? Math.round(ov.sec_sum / ov.visits) : 0;
  const prevAvgSec = prev.visits ? Math.round(prev.sec_sum / prev.visits) : 0;

  // график по дням: суммируем выбранные сайты по дате
  const dayMap = {};
  for (const r of dayRows) {
    if (!on(r.site_key)) continue;
    const e = dayMap[r.d] || (dayMap[r.d] = { d: r.d, visits: 0, clicks: 0 });
    e.visits += r.visits; e.clicks += r.clicks;
  }
  const days = Object.values(dayMap).sort((a, b) => (a.d < b.d ? -1 : 1));

  // по часам 0..23
  const hourAgg = Array.from({ length: 24 }, (_, h) => ({ h, visits: 0, clicks: 0 }));
  for (const r of hourRows) { if (on(r.site_key)) { hourAgg[r.h].visits += r.visits; hourAgg[r.h].clicks += r.clicks; } }

  // сайты: только выбранные
  const siteFiltered = siteRows.filter((r) => on(r.key));
  const maxSiteClicks = Math.max(1, ...siteFiltered.map((r) => r.clicks));

  // провайдеры: агрегируем по выбранным сайтам напрямую по ключу сайта.
  // (ключ у providerBySite совпадает с ключом сайта: podborvps / servercalc-ru / servercalc-com;
  // serverselection выведен в архив и в данные не попадает)
  const provMap = {};
  for (const r of provRows) { if (on(r.site_key)) provMap[r.provider] = (provMap[r.provider] || 0) + r.clicks; }
  const topProv = Object.entries(provMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxProv = topProv[0]?.[1] || 1;

  // каналы: агрегируем по выбранным сайтам
  const chMap = {};
  for (const r of channelRows) {
    if (!on(r.site_key)) continue;
    const e = chMap[r.channel] || (chMap[r.channel] = { channel: r.channel, visits: 0, visitors: 0, pv: 0, clicks: 0 });
    e.visits += r.visits; e.visitors += r.visitors; e.pv += r.pv; e.clicks += r.clicks;
  }
  const chRows = Object.values(chMap);
  const totalCh = chRows.reduce((s, r) => s + r.visits, 0);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="grid kpis">
        <Kpi label="Визиты" value={num(ov.visits)} delta={delta(ov.visits, prev.visits)} />
        <Kpi label="Посетители" value={num(ov.visitors)} delta={delta(ov.visitors, prev.visitors)} />
        <Kpi label="Просмотры страниц" value={num(ov.pv)} delta={delta(ov.pv, prev.pv)} />
        <Kpi label="Переходы к провайдерам" value={num(ov.clicks)} delta={delta(ov.clicks, prev.clicks)} />
        <Kpi label="Конверсия в переход" value={pct(ov.clicks, ov.visits)} sub={`было ${pct(prev.clicks, prev.visits)}`} />
        <Kpi label="Среднее время визита" value={dur(avgSec)} sub={`отказы ${pct(ov.bounced, ov.visits)}, было ${pct(prev.bounced, prev.visits)}`} />
      </div>

      <Card title="Динамика по дням" hint="визиты и переходы по выбранным сайтам">
        <Chart rows={days} tz={tz} />
      </Card>

      <Card title="Сайты" hint="визиты и переходы к провайдерам за период">
        {siteFiltered.length === 0 ? <Empty /> : (
          <div className="scroll">
            <table>
              <thead>
                <tr><th>Сайт</th><th className="n">Визиты</th><th className="n">Посетители</th><th className="n">Просмотры</th><th className="n">Переходы</th><th className="n">Конверсия</th></tr>
              </thead>
              <tbody>
                {siteFiltered.map((r) => (
                  <tr key={r.key}>
                    <td>{r.name}</td>
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
                    <td>{provNames[slug] || slug}</td>
                    <BarCell value={n} max={maxProv} />
                    <td className="n muted">{pct(n, ov.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Откуда приходят" hint="каналы: реклама, органика, соцсети, прямые">
          {chRows.length === 0 ? <Empty /> : <ChannelTable rows={chRows} totalVisits={totalCh} />}
        </Card>
      </div>

      <Card title="Время суток" hint={`визиты по часам, ${tz}`}>
        <Bars rows={hourAgg} labelKey="h" valueKey="visits" formatLabel={(h) => String(h).padStart(2, '0') + ':00'} />
      </Card>
    </div>
  );
}
