import { parseFilters } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { bySite, providerBySite, providerNames } from '@/lib/query';
import { directCampaigns, campaignMap, isOurCampaign, CAMPAIGNS } from '@/lib/direct';
import { Card, Empty, Kpi } from '@/components/ui';

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

  const ourClicksBySite = Object.fromEntries(siteRows.map((r) => [r.key, r.clicks]));
  const ourVisitsBySite = Object.fromEntries(siteRows.map((r) => [r.key, r.visits]));
  const provBySite = {};
  for (const r of provRows) {
    (provBySite[r.site_key] ||= new Map());
    provBySite[r.site_key].set(r.provider, (provBySite[r.site_key].get(r.provider) || 0) + r.clicks);
  }

  // только наши две кампании, по номеру
  const camps = (direct?.campaigns || []).filter(isOurCampaign);

  const rows = camps.map((c) => {
    const m = campaignMap(c.campaign_id);
    const sites = m ? m.sites : [];
    const label = m ? m.name : c.name;
    const ourClicks = sites.reduce((s, k) => s + (ourClicksBySite[k] || 0), 0);
    const ourVisits = sites.reduce((s, k) => s + (ourVisitsBySite[k] || 0), 0);
    const provMap = new Map();
    for (const k of sites) {
      for (const [slug, n2] of provBySite[k] || []) provMap.set(slug, (provMap.get(slug) || 0) + n2);
    }
    const providers = [...provMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { c, label, sites, ourClicks, ourVisits, providers };
  }).sort((a, b) => b.c.cost - a.c.cost);

  const gaps = rows.filter((r) => r.c.cost > 0 && r.c.conversions === 0 && r.ourClicks > 0);

  const totalCost = rows.reduce((s, r) => s + r.c.cost, 0);
  const totalConv = rows.reduce((s, r) => s + r.c.conversions, 0);
  const totalOurClicks = rows.reduce((s, r) => s + r.ourClicks, 0);

  return (
    <div className="grid">
      <div className="grid kpis">
        <Kpi label="Расход за период" value={rub(totalCost)} sub="две кампании: ПодборVPS и ServerCalc" />
        <Kpi label="Конверсии Директа" value={num(totalConv)} sub="цель provider_click" />
        <Kpi label="Средний CPA" value={cpa(totalCost, totalConv) ? rub(cpa(totalCost, totalConv)) : '—'} sub="расход ÷ конверсии" />
        <Kpi label="Переходы по панели" value={num(totalOurClicks)} sub="считает панель, независимо" />
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
              <li key={r.c.campaign_id}>
                <b>{r.label}</b>: расход {rub(r.c.cost)}, в Директе 0 конверсий, а панель видит <b>{num(r.ourClicks)}</b> переходов
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Экономика по кампаниям" hint="расход из Директа против переходов, которые считает панель">
        {rows.length === 0 ? (
          <Empty text={derr ? 'Нет данных Директа за период' : 'За период нет кликов по этим кампаниям'} />
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Кампания</th>
                  <th className="n">Расход</th>
                  <th className="n">Клики Директа</th>
                  <th className="n">CTR</th>
                  <th className="n">CPC</th>
                  <th className="n">Конв. Директа</th>
                  <th className="n">Переходы (панель)</th>
                  <th className="n">CPA по Директу</th>
                  <th className="n">CPA по панели</th>
                  <th>Куда ушли (топ)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cD = cpa(r.c.cost, r.c.conversions);
                  const cP = cpa(r.c.cost, r.ourClicks);
                  return (
                    <tr key={r.c.campaign_id}>
                      <td>
                        {r.label}
                        <div className="dim mono" style={{ fontSize: 11 }}>№ {r.c.campaign_id}</div>
                      </td>
                      <td className="n">{rub(r.c.cost)}</td>
                      <td className="n muted">{num(r.c.clicks)}</td>
                      <td className="n muted">{r.c.ctr.toFixed(1)}%</td>
                      <td className="n muted">{rub(r.c.avg_cpc)}</td>
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
          Берём только две кампании, привязанные по номеру: {Object.entries(CAMPAIGNS).map(([id, m]) => `${m.name} (№ ${id})`).join(', ')}. Остальные кампании Директа в раздел не входят. «CPA по Директу» считается по цели Метрики, «CPA по панели» — по переходам, которые панель ловит сама; пока панель копит данные, второй столбец растёт день ото дня.
        </p>
      </Card>
    </div>
  );
}
