import { parseFilters } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { bySite, providerBySite, providerNames } from '@/lib/query';
import { directCampaigns, sitesForCampaign, CAMPAIGN_TO_SITES } from '@/lib/direct';
import { BarCell, Card, Empty, Kpi } from '@/components/ui';

export const dynamic = 'force-dynamic';

const rub = (x) => num(Math.round(Number(x || 0))) + ' ₽';
const cpa = (cost, conv) => (Number(conv) > 0 ? Math.round(Number(cost) / Number(conv)) : null);

export default async function Economics({ searchParams }) {
  const f = parseFilters(await searchParams);

  let direct = null;
  let derr = '';
  try {
    direct = await directCampaigns(f.from, f.to);
  } catch (e) {
    derr = e.message || String(e);
  }

  const [siteRows, provRows, names] = await Promise.all([
    bySite(f), providerBySite(f), providerNames(),
  ]);

  // наши переходы по сайтам и по провайдерам
  const ourClicksBySite = Object.fromEntries(siteRows.map((r) => [r.key, r.clicks]));
  const ourVisitsBySite = Object.fromEntries(siteRows.map((r) => [r.key, r.visits]));
  const provBySite = {};
  for (const r of provRows) {
    (provBySite[r.site_key] ||= new Map());
    provBySite[r.site_key].set(r.provider, (provBySite[r.site_key].get(r.provider) || 0) + r.clicks);
  }

  const camps = direct?.campaigns || [];
  const ours = camps.filter((c) => sitesForCampaign(c.name).length > 0);
  const others = camps.filter((c) => sitesForCampaign(c.name).length === 0);

  // сводка нашей стороны на кампанию Директа
  const rowsOurs = ours.map((c) => {
    const sites = sitesForCampaign(c.name);
    const ourClicks = sites.reduce((s, k) => s + (ourClicksBySite[k] || 0), 0);
    const ourVisits = sites.reduce((s, k) => s + (ourVisitsBySite[k] || 0), 0);
    const provMap = new Map();
    for (const k of sites) {
      for (const [slug, n2] of provBySite[k] || []) provMap.set(slug, (provMap.get(slug) || 0) + n2);
    }
    const providers = [...provMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { c, sites, ourClicks, ourVisits, providers };
  });

  const gaps = rowsOurs.filter((r) => r.c.cost > 0 && r.c.conversions === 0 && r.ourClicks > 0);

  const sum = direct?.summary || {};
  const totalCost = camps.reduce((s, c) => s + c.cost, 0);
  const oursCost = ours.reduce((s, c) => s + c.cost, 0);
  const othersCost = others.reduce((s, c) => s + c.cost, 0);
  const maxCost = Math.max(1, ...camps.map((c) => c.cost));

  return (
    <div className="grid">
      <div className="grid kpis">
        <Kpi label="Расход, всего" value={rub(sum.cost || totalCost)} sub={`клики Директа: ${num(sum.clicks || 0)}`} />
        <Kpi label="Конверсии (provider_click)" value={num(sum.conversions || 0)} sub="цель Метрики в Директе" />
        <Kpi label="Средний CPA" value={cpa(sum.cost || totalCost, sum.conversions) ? rub(cpa(sum.cost || totalCost, sum.conversions)) : '—'} sub="расход ÷ конверсии" />
        <Kpi label="Расход на наши сайты" value={rub(oursCost)} sub={`мимо: ${rub(othersCost)}`} />
      </div>

      {derr ? (
        <Card title="Данные Директа временно недоступны">
          <p className="note">Сервис data.makebiztehnologies.com не ответил: <code>{derr}</code>. Наша сторона (переходы) ниже показана, расход подтянется, когда сервис снова доступен.</p>
        </Card>
      ) : null}

      {gaps.length ? (
        <Card title="⚠ Разрыв в трекинге конверсий">
          <p className="note">
            Директ показывает 0 конверсий там, где панель видит переходы к провайдерам. Значит цель
            <code> provider_click</code> не долетает в Директ (обычно не тот счётчик Метрики или цель не заведена). Чинить на стороне цели, деньги при этом работают:
          </p>
          <ul className="note">
            {gaps.map((r) => (
              <li key={r.c.name}>
                <b>{r.c.name}</b>: расход {rub(r.c.cost)}, в Директе 0 конверсий, а панель видит <b>{num(r.ourClicks)}</b> переходов
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Экономика наших сайтов" hint="расход из Директа против переходов, которые считает панель">
        {rowsOurs.length === 0 ? (
          <Empty text={derr ? 'Нет данных Директа за период' : 'За период нет кампаний Директа, ведущих на наши сайты'} />
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Кампания → сайт</th>
                  <th className="n">Расход</th>
                  <th className="n">Клики Директа</th>
                  <th className="n">Конв. Директа</th>
                  <th className="n">Переходы (панель)</th>
                  <th className="n">CPA по Директу</th>
                  <th className="n">CPA по панели</th>
                  <th>Куда ушли (топ)</th>
                </tr>
              </thead>
              <tbody>
                {rowsOurs.map((r) => {
                  const cD = cpa(r.c.cost, r.c.conversions);
                  const cP = cpa(r.c.cost, r.ourClicks);
                  return (
                    <tr key={r.c.name}>
                      <td>
                        {r.c.name}
                        <div className="dim">{r.sites.join(', ')}</div>
                      </td>
                      <td className="n">{rub(r.c.cost)}</td>
                      <td className="n muted">{num(r.c.clicks)}</td>
                      <td className="n">{num(r.c.conversions)}</td>
                      <td className="n">{num(r.ourClicks)}</td>
                      <td className="n">{cD ? rub(cD) : <span className="dim">—</span>}</td>
                      <td className="n">{cP ? rub(cP) : <span className="dim">—</span>}</td>
                      <td className="muted">
                        {r.providers.length
                          ? r.providers.map(([slug, n2]) => `${names.get(slug) || slug} (${n2})`).join(', ')
                          : <span className="dim">пока нет</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="note" style={{ marginTop: 10 }}>
          «CPA по Директу» считается по цели Метрики, «CPA по панели» — по переходам, которые панель ловит сама. Пока панель копит данные, второй столбец будет расти день ото дня. Соответствие кампаний сайтам: {Object.keys(CAMPAIGN_TO_SITES).join(', ')} — правится в коде одной строкой.
        </p>
      </Card>

      <Card title="Все кампании Директа" hint="полный расход за период, включая кампании мимо наших сайтов">
        {camps.length === 0 ? <Empty text={derr ? 'Сервис Директа недоступен' : 'Нет данных за период'} /> : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Кампания</th>
                  <th className="n">Расход</th>
                  <th className="n">Клики</th>
                  <th className="n">Показы</th>
                  <th className="n">CTR</th>
                  <th className="n">CPC</th>
                  <th className="n">Конверсии</th>
                  <th className="n">CPA</th>
                </tr>
              </thead>
              <tbody>
                {[...camps].sort((a, b) => b.cost - a.cost).map((c) => {
                  const our = sitesForCampaign(c.name).length > 0;
                  const cA = cpa(c.cost, c.conversions);
                  return (
                    <tr key={c.name}>
                      <td>
                        {c.name}{' '}
                        {our ? <span className="tag b">наш сайт</span> : <span className="tag">мимо</span>}
                      </td>
                      <BarCell value={c.cost} max={maxCost} suffix=" ₽" />
                      <td className="n muted">{num(c.clicks)}</td>
                      <td className="n dim">{num(c.impressions)}</td>
                      <td className="n muted">{c.ctr.toFixed(1)}%</td>
                      <td className="n muted">{rub(c.avg_cpc)}</td>
                      <td className="n">{num(c.conversions)}</td>
                      <td className="n">{cA ? rub(cA) : <span className="dim">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {others.length ? (
        <Card title="Мимо наших сайтов" hint="эти кампании не проходят через панель, их KPI живёт в другом месте">
          <p className="note">
            Расход {rub(othersCost)}. Реф-кампании (Timeweb, AdminVPS) ведут прямо на провайдера — их результат это регистрации в кабинете партнёра, а не переход, поэтому конверсия provider_click тут структурно ноль (появится, когда добавим слой партнёров). Кампании другого продукта (Solara) к этой связке не относятся.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
