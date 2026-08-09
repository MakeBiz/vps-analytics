import { parseFilters } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { pagesReport } from '@/lib/query';
import { BarCell, Card, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Pages({ searchParams }) {
  const f = parseFilters(await searchParams);
  const { rows, landings } = await pagesReport(f);
  const maxViews = Math.max(1, ...rows.map((r) => r.views));
  const maxLand = Math.max(1, ...landings.map((r) => r.visits));

  return (
    <div className="grid">
      <Card title="Страницы" hint="просмотры и переходы к провайдерам с этой страницы">
        {rows.length === 0 ? <Empty /> : (
          <div className="scroll tall">
            <table>
              <thead>
                <tr>
                  <th>Адрес</th><th className="n">Просмотры</th><th className="n">Визиты</th>
                  <th className="n">Переходы</th><th className="n">Переходов на визит</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.path}>
                    <td className="mono"><span className="trunc" title={r.path}>{r.path}</span></td>
                    <BarCell value={r.views} max={maxViews} />
                    <td className="n muted">{num(r.sessions)}</td>
                    <td className="n">{num(r.clicks)}</td>
                    <td className="n muted">{pct(r.clicks, r.sessions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Точки входа" hint="с какой страницы начинался визит">
        {landings.length === 0 ? <Empty /> : (
          <div className="scroll tall">
            <table>
              <thead><tr><th>Адрес входа</th><th className="n">Визиты</th><th className="n">Переходы</th><th className="n">Конверсия</th></tr></thead>
              <tbody>
                {landings.map((r) => (
                  <tr key={r.path}>
                    <td className="mono"><span className="trunc" title={r.path}>{r.path}</span></td>
                    <BarCell value={r.visits} max={maxLand} />
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
  );
}
