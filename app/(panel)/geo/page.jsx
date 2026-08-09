import { parseFilters } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { geoReport, techReport } from '@/lib/query';
import { countryName } from '@/lib/ua';
import { BarCell, Card, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

function Simple({ rows, head }) {
  if (!rows || rows.length === 0) return <Empty />;
  const max = Math.max(1, ...rows.map((r) => r.visits));
  return (
    <div className="tall">
      <table>
        <thead><tr><th>{head}</th><th className="n">Визиты</th><th className="n">Переходы</th><th className="n">CR</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.k || <span className="dim">не определено</span>}</td>
              <BarCell value={r.visits} max={max} />
              <td className="n">{num(r.clicks)}</td>
              <td className="n muted">{pct(r.clicks, r.visits)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Geo({ searchParams }) {
  const f = parseFilters(await searchParams);
  const [{ countries, cities }, tech] = await Promise.all([geoReport(f), techReport(f)]);
  const maxC = Math.max(1, ...countries.map((r) => r.visits));
  const maxCity = Math.max(1, ...cities.map((r) => r.visits));

  return (
    <div className="grid">
      <div className="grid cols2">
        <Card title="Страны" hint="определяются на стороне Vercel по адресу запроса">
          {countries.length === 0 ? <Empty /> : (
            <div className="tall">
              <table>
                <thead><tr><th>Страна</th><th className="n">Визиты</th><th className="n">Переходы</th><th className="n">CR</th></tr></thead>
                <tbody>
                  {countries.map((r) => (
                    <tr key={r.country}>
                      <td>{countryName(r.country)}</td>
                      <BarCell value={r.visits} max={maxC} />
                      <td className="n">{num(r.clicks)}</td>
                      <td className="n muted">{pct(r.clicks, r.visits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Города">
          {cities.length === 0 ? <Empty /> : (
            <div className="tall">
              <table>
                <thead><tr><th>Город</th><th className="n">Визиты</th><th className="n">Переходы</th><th className="n">CR</th></tr></thead>
                <tbody>
                  {cities.map((r, i) => (
                    <tr key={i}>
                      <td>{r.city} <span className="dim">{countryName(r.country)}</span></td>
                      <BarCell value={r.visits} max={maxCity} />
                      <td className="n">{num(r.clicks)}</td>
                      <td className="n muted">{pct(r.clicks, r.visits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid cols3">
        <Card title="Устройства"><Simple rows={tech.devices} head="Тип" /></Card>
        <Card title="Системы"><Simple rows={tech.oss} head="ОС" /></Card>
        <Card title="Браузеры"><Simple rows={tech.browsers} head="Браузер" /></Card>
      </div>
      <Card title="Языки браузера"><Simple rows={tech.langs} head="Язык" /></Card>
    </div>
  );
}
