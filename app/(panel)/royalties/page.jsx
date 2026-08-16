import { parseFilters } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { directCampaigns } from '@/lib/direct';
import { partnerCampaign, loadSnapshot, CPC_CEILING } from '@/lib/partners';
import Chart from '@/components/Chart';
import { Card, Kpi, Empty, BarCell } from '@/components/ui';

export const dynamic = 'force-dynamic';

const BRASS = '#c6a15b';
const STEEL = '#5b7a99';

function GeoBar({ foreign, ru, other }) {
  const tot = foreign + ru + other || 1;
  const segs = [
    ['Зарубеж', foreign, BRASS],
    ['Россия', ru, STEEL],
    ['Прочее', other, '#3a4756'],
  ];
  return (
    <div>
      <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {segs.map(([label, v, color]) =>
          v > 0 ? <div key={label} title={`${label}: ${v}`} style={{ width: (v / tot * 100) + '%', background: color }} /> : null
        )}
      </div>
      <div className="chips" style={{ marginTop: 8 }}>
        {segs.map(([label, v, color]) => (
          <span key={label} className="tag" style={{ borderColor: color, color }}>
            {label} {v} · {pct(v, tot)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function Royalties({ searchParams }) {
  const f = parseFilters(await searchParams);
  const snap = loadSnapshot();

  let camps = [];
  let directError = '';
  try {
    const d = await directCampaigns(f.from, f.to);
    camps = (d.campaigns || [])
      .map((c) => ({ ...c, meta: partnerCampaign(c.campaign_id) }))
      .filter((c) => c.meta)
      .sort((a, b) => a.meta.order - b.meta.order);
  } catch (e) {
    directError = e.message || String(e);
  }

  const spend = { Timeweb: { cost: 0, clicks: 0 }, AdminVPS: { cost: 0, clicks: 0 } };
  for (const c of camps) { spend[c.meta.partner].cost += c.cost; spend[c.meta.partner].clicks += c.clicks; }

  const cpcRows = camps
    .filter((c) => c.clicks > 0)
    .map((c) => ({ label: (c.meta.partner === 'Timeweb' ? 'TW ' : 'AV ') + c.meta.label, cpc: Math.round(c.avg_cpc) }))
    .sort((a, b) => b.cpc - a.cpc);
  const maxCpc = Math.max(1, CPC_CEILING, ...cpcRows.map((r) => r.cpc));

  const tw = snap?.timeweb, av = snap?.adminvps;
  const maxCountry = Math.max(1, ...((av?.countries) || []).map((c) => c.n));

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div className="note">
          Реф-реклама Timeweb и AdminVPS. Директ живой за период фильтра, регистрации и выплаты из кабинетов —
          снимок на <b>{snap?.generated || '—'}</b> (обновляется раз в неделю). У AdminVPS в кабинете нет UTM,
          поэтому его регистрации считаются партнёркой целиком, без разбивки по кампаниям.
        </div>
      </Card>

      {tw && av ? (() => {
        const rows = [
          { p: 'Timeweb', rev: tw.revenueTotal, spend: tw.spendWindow },
          { p: 'AdminVPS', rev: av.revenueTotal, spend: av.spendWindow },
        ];
        const tot = { rev: rows.reduce((s, r) => s + r.rev, 0), spend: rows.reduce((s, r) => s + r.spend, 0) };
        const line = (name, rev, spend, strong) => (
          <tr key={name} style={strong ? { fontWeight: 600 } : undefined}>
            <td>{name}</td>
            <td className="n">{num(rev)} ₽</td>
            <td className="n muted">{num(spend)} ₽</td>
          </tr>
        );
        return (
          <Card title="Экономика партнёрок" hint="всего получено из кабинетов против расхода Директа">
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Партнёр</th>
                    <th className="n">Всего получено</th>
                    <th className="n">Расход Директ (окно)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => line(r.p, r.rev, r.spend))}
                  {line('Итого', tot.rev, tot.spend, true)}
                </tbody>
              </table>
            </div>
            <div className="note" style={{ marginTop: 8 }}>
              Всего получено это все выплаты из кабинетов за историю (Timeweb январь-август, склейка с OLD-выгрузкой;
              AdminVPS май-август). Расход пока только живой Директ за окно 08.07-15.08, полного расхода в API нет.
              Чистый доход по полному расходу считается в Royalties-дашборде, подключу сюда отдельно
            </div>
          </Card>
        );
      })() : null}

      <div className="grid kpis">
        <Kpi label="Timeweb, расход Директ" value={num(Math.round(spend.Timeweb.cost)) + ' ₽'} sub={num(spend.Timeweb.clicks) + ' кликов'} />
        <Kpi label="Timeweb, регистрации" value={tw ? num(tw.regsTotalPeriod) : '—'} sub="июль-август, по меткам" />
        <Kpi label="Timeweb, всего получено" value={tw ? num(tw.revenueTotal) + ' ₽' : '—'} sub="январь-август, из кабинета" />
        <Kpi label="AdminVPS, расход Директ" value={num(Math.round(spend.AdminVPS.cost)) + ' ₽'} sub={num(spend.AdminVPS.clicks) + ' кликов'} />
        <Kpi label="AdminVPS, регистрации" value={av ? num(av.regsTotal) : '—'} sub="апрель-август, все каналы" />
        <Kpi label="AdminVPS, зарубеж" value={av ? av.geo.foreignPct + '%' : '—'} sub={av ? num(av.geo.foreign) + ' из ' + num(av.status.total) : ''} />
        <Kpi label="AdminVPS, всего получено" value={av ? num(av.revenueTotal) + ' ₽' : '—'} sub="май-август" />
        <Kpi label="AdminVPS, отвал" value={av ? (100 - av.status.activePct) + '%' : '—'} sub={av ? 'активных ' + num(av.status.active) + ' из ' + num(av.status.total) : ''} />
      </div>

      <div className="grid cols2">
        <Card title="Timeweb, регистрации по месяцам" hint="из кабинета, снимок">
          {tw ? <Chart rows={tw.regsByMonth} tz="UTC" keys={[['total', 'Регистрации', BRASS]]} /> : <Empty />}
        </Card>
        <Card title="AdminVPS, регистрации по месяцам" hint="зарубеж против России">
          {av ? <Chart rows={av.regsByMonth} tz="UTC" keys={[['foreign', 'Зарубеж', BRASS], ['ru', 'Россия', STEEL]]} /> : <Empty />}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="AdminVPS, география заказов" hint="доля зарубежных локаций">
          {av ? (
            <>
              <GeoBar foreign={av.geo.foreign} ru={av.geo.ru} other={av.geo.other} />
              <table style={{ marginTop: 12 }}>
                <tbody>
                  {av.countries.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <BarCell value={c.n} max={maxCountry} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : <Empty />}
        </Card>
        <Card title="Цена клика по кампаниям" hint={`потолок окупаемости Timeweb ~${CPC_CEILING} ₽`}>
          {cpcRows.length ? (
            <table>
              <tbody>
                {cpcRows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <BarCell value={r.cpc} max={maxCpc} suffix=" ₽" />
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty text={directError || 'Нет данных Директа за период'} />}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Timeweb, выручка по месяцам" hint="₽, вся история со склейкой OLD">
          {tw ? <Chart rows={tw.revenueByMonth} tz="UTC" keys={[['sum', 'Выручка', BRASS]]} /> : <Empty />}
        </Card>
        <Card title="AdminVPS, выручка по месяцам" hint="₽, комиссии">
          {av ? <Chart rows={av.revenueByMonth} tz="UTC" keys={[['sum', 'Выручка', STEEL]]} /> : <Empty />}
        </Card>
      </div>

      <Card title="Кампании Директа" hint="живой расход за период фильтра">
        {camps.length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Партнёр</th>
                  <th>Кампания</th>
                  <th className="n">Показы</th>
                  <th className="n">Клики</th>
                  <th className="n">Расход</th>
                  <th className="n">CTR</th>
                  <th className="n">CPC</th>
                </tr>
              </thead>
              <tbody>
                {camps.map((c) => (
                  <tr key={c.campaign_id}>
                    <td><span className={'tag ' + (c.meta.partner === 'Timeweb' ? 'b' : 's')}>{c.meta.partner}</span></td>
                    <td>{c.meta.label}</td>
                    <td className="n muted">{num(c.impressions)}</td>
                    <td className="n">{num(c.clicks)}</td>
                    <td className="n">{num(Math.round(c.cost))} ₽</td>
                    <td className="n muted">{c.ctr.toFixed(1).replace('.', ',')}%</td>
                    <td className="n">{Math.round(c.avg_cpc)} ₽</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text={directError || 'Нет данных Директа за период'} />}
      </Card>

      {snap ? <Card><div className="note">{snap.note}</div></Card> : null}
    </div>
  );
}
