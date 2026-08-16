import { num, pct } from '@/lib/format';
import { loadPayments } from '@/lib/payments';
import Chart from '@/components/Chart';
import { Card, Kpi, Empty, BarCell } from '@/components/ui';
import RefreshButton from '@/components/RefreshButton';

export const dynamic = 'force-dynamic';

const BRASS = '#c6a15b';
const STEEL = '#5b7a99';

// Оставляем в гео только страны (отсекаем мусор из скобок вроде GlobalSign)
const KNOWN_GEO = new Set([
  'Россия', 'Финляндия', 'Нидерланды', 'Польша', 'Германия',
  'Великобритания', 'Франция', 'Испания', 'Казахстан', 'Швеция', 'США',
]);
function geoOnly(rows) {
  return (rows || []).filter((r) => KNOWN_GEO.has(r.name));
}

export default async function Payments() {
  const p = loadPayments();
  if (!p) {
    return (
      <div className="grid" style={{ gap: 14 }}>
        <Card><Empty text="Снимок оплат не найден (data/payments.json)" /></Card>
      </div>
    );
  }

  const tw = p.partners?.timeweb;
  const av = p.partners?.adminvps;
  const avGeo = av ? geoOnly(av.geoTop) : [];
  const maxGeo = Math.max(1, ...avGeo.map((c) => c.n));

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="note" style={{ margin: 0, maxWidth: 640 }}>
            Полный журнал комиссий партнёров из кабинетов (Timeweb и AdminVPS). Снимок на <b>{p.generated || '—'}</b>,
            обновляется <b>по запросу</b>: выгрузки кладутся в папку вручную и пересобираются движком, живого фида у
            кабинетов пока нет. Это правильный источник денег — вся история по журналу оплат, а не когортный срез.
          </div>
          <RefreshButton />
        </div>
      </Card>

      <div className="grid kpis">
        <Kpi label="Всего комиссий" value={num(p.combined?.total) + ' ₽'} sub="Timeweb + AdminVPS, вся история" />
        <Kpi label="Timeweb, комиссия" value={tw ? num(tw.total) + ' ₽' : '—'} sub={tw ? num(tw.accruals) + ' начислений' : ''} />
        <Kpi label="AdminVPS, доход" value={av ? num(av.total) + ' ₽' : '—'} sub={av ? num(av.accruals) + ' начислений' : ''} />
        <Kpi label="AdminVPS, выведено" value={av ? num(av.withdrawn) + ' ₽' : '—'} sub="за период" />
        <Kpi label="Timeweb, платящих" value={tw ? num(tw.paying) : '—'} sub={tw ? 'из ' + num(tw.clients) + ' клиентов' : ''} />
        <Kpi label="Timeweb, регистраций" value={tw ? num(tw.regs) : '—'} sub="уникальных, вся история" />
        <Kpi label="AdminVPS, привлечено" value={av?.reg ? num(av.reg.total) : '—'} sub={av?.reg ? 'живых ' + num(av.reg.alive) : ''} />
        <Kpi label="AdminVPS, отвал" value={av?.reg ? String(av.reg.churnPct).replace('.', ',') + '%' : '—'} sub={av?.reg ? num(av.reg.churned) + ' из ' + num(av.reg.total) : ''} />
      </div>

      <Card title="Комиссии по месяцам, все партнёры" hint="₽, полный журнал">
        {p.combined?.byMonth?.length ? (
          <Chart rows={p.combined.byMonth} tz="UTC" keys={[['sum', 'Комиссия', BRASS]]} />
        ) : <Empty />}
      </Card>

      <div className="grid cols2">
        <Card title="Timeweb, комиссия по месяцам" hint={tw ? `итого ${num(tw.total)} ₽` : '₽'}>
          {tw?.byMonth?.length ? <Chart rows={tw.byMonth} tz="UTC" keys={[['sum', 'Комиссия', BRASS]]} /> : <Empty />}
        </Card>
        <Card title="AdminVPS, комиссия по месяцам" hint={av ? `итого ${num(av.total)} ₽` : '₽'}>
          {av?.byMonth?.length ? <Chart rows={av.byMonth} tz="UTC" keys={[['sum', 'Комиссия', STEEL]]} /> : <Empty />}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="AdminVPS, оплаты по локациям" hint="откуда платящие заказы">
          {avGeo.length ? (
            <table>
              <tbody>
                {avGeo.map((c) => (
                  <tr key={c.name}>
                    <td>{c.name}</td>
                    <BarCell value={c.n} max={maxGeo} />
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <Empty />}
        </Card>
        <Card title="Что показывает слой оплат" hint="источник и метод">
          <div className="note" style={{ marginTop: 0 }}>
            Timeweb: объединены старая и новая выгрузки по журналу начислений без задвоения, период{' '}
            {tw?.period?.from || '—'} … {tw?.period?.to || '—'}. AdminVPS: журнал операций, учтён только «Доход»,
            выводы средств в комиссию не входят. Деньги считаются по журналу оплат, а не по колонке «Всего начислений»
            в снимке клиентов (она занижена, охватывает только недавнюю когорту).
          </div>
          {av?.reg ? (
            <div className="note" style={{ marginTop: 10 }}>
              По AdminVPS из журнала привлечений: по штукам лидирует Россия, а по деньгам — Финляндия и Нидерланды.
              То есть зарубежные локации дают меньше регистраций, но платят дороже и стабильнее.
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
