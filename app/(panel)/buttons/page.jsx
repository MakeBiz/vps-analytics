import { parseFilters } from '@/lib/filters';
import { num } from '@/lib/format';
import { customEvents, placements, providerNames } from '@/lib/query';
import { BarCell, Card, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function Buttons({ searchParams }) {
  const f = parseFilters(await searchParams);
  const [rows, evs, names] = await Promise.all([placements(f), customEvents(f), providerNames()]);

  const byPlace = new Map();
  for (const r of rows) {
    const k = r.placement || '(без метки места)';
    byPlace.set(k, (byPlace.get(k) || 0) + r.clicks);
  }
  const placeList = [...byPlace.entries()].sort((a, b) => b[1] - a[1]);
  const maxPlace = placeList[0]?.[1] || 1;

  const byLabel = new Map();
  for (const r of rows) {
    const k = r.label || '(без текста)';
    byLabel.set(k, (byLabel.get(k) || 0) + r.clicks);
  }
  const labelList = [...byLabel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
  const maxLabel = labelList[0]?.[1] || 1;
  const maxRow = Math.max(1, ...rows.map((r) => r.clicks));

  return (
    <div className="grid">
      <div className="grid cols2">
        <Card title="Места на сайте" hint="метка utm_campaign исходящей ссылки: калькулятор, каталог, карточка провайдера">
          {placeList.length === 0 ? <Empty /> : (
            <table>
              <tbody>
                {placeList.map(([k, n]) => (
                  <tr key={k}>
                    <td><span className="tag b">{k}</span></td>
                    <BarCell value={n} max={maxPlace} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Текст кнопок" hint="что именно было написано на нажатой кнопке">
          {labelList.length === 0 ? <Empty /> : (
            <div className="tall">
              <table>
                <tbody>
                  {labelList.map(([k, n]) => (
                    <tr key={k}>
                      <td><span className="trunc">{k}</span></td>
                      <BarCell value={n} max={maxLabel} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="Все нажатия подробно" hint="место, текст кнопки и провайдер вместе">
        {rows.length === 0 ? <Empty /> : (
          <div className="scroll tall">
            <table>
              <thead>
                <tr>
                  <th>Место</th><th>Кнопка</th><th>Провайдер</th>
                  <th className="n">Нажатия</th><th className="n">Визиты</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.placement ? <span className="tag b">{r.placement}</span> : <span className="dim">—</span>}</td>
                    <td><span className="trunc">{r.label || <span className="dim">—</span>}</span></td>
                    <td>{names.get(r.provider) || r.provider || <span className="dim">—</span>}</td>
                    <BarCell value={r.clicks} max={maxRow} />
                    <td className="n muted">{num(r.sessions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Свои события" hint="то, что сайт присылает через px.event(), например шаги калькулятора">
        {evs.length === 0 ? (
          <Empty text="Своих событий нет. Их можно слать вызовом px.event('calc_start') из кода сайта" />
        ) : (
          <table>
            <thead><tr><th>Событие</th><th className="n">Срабатываний</th><th className="n">Визитов</th></tr></thead>
            <tbody>
              {evs.map((r) => (
                <tr key={r.name}>
                  <td className="mono">{r.name}</td>
                  <td className="n">{num(r.hits)}</td>
                  <td className="n muted">{num(r.sessions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
