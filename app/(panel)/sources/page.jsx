import { parseFilters } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { channelsTop, referrers, sourcesTop, utmBreakdown } from '@/lib/query';
import { BarCell, Card, Empty } from '@/components/ui';
import ChannelTable from '@/components/ChannelTable';

export const dynamic = 'force-dynamic';

const dash = (v) => (v ? v : <span className="dim">—</span>);

export default async function Sources({ searchParams }) {
  const f = parseFilters(await searchParams);
  const [channels, top, utm, refs] = await Promise.all([channelsTop(f), sourcesTop(f), utmBreakdown(f), referrers(f)]);
  const totalChVisits = channels.reduce((s, r) => s + (r.visits || 0), 0);
  const maxTop = Math.max(1, ...top.map((r) => r.visits));
  const maxUtm = Math.max(1, ...utm.map((r) => r.visits));
  const maxRef = Math.max(1, ...refs.map((r) => r.visits));

  return (
    <div className="grid">
      <Card title="Каналы захода" hint="реклама, органика, соцсети, прямые; сортировка по клику. Переходы и конверсия это клик к провайдеру">
        {channels.length === 0 ? <Empty /> : <ChannelTable rows={channels} totalVisits={totalChVisits} />}
      </Card>

      <Card title="Источники" hint="метка utm_source, либо сайт-реферер, либо прямой заход">
        {top.length === 0 ? <Empty /> : (
          <div className="scroll tall">
            <table>
              <thead>
                <tr>
                  <th>Источник</th>
                  <th className="n">Визиты</th>
                  <th className="n">Посетители</th>
                  <th className="n">Просмотры</th>
                  <th className="n">Переходы</th>
                  <th className="n">Конверсия</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.src}>
                    <td><span className="trunc">{r.src}</span></td>
                    <BarCell value={r.visits} max={maxTop} />
                    <td className="n muted">{num(r.visitors)}</td>
                    <td className="n muted">{num(r.pv)}</td>
                    <td className="n">{num(r.clicks)}</td>
                    <td className="n muted">{pct(r.clicks, r.visits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Разбор по меткам" hint="source / medium / campaign / content / term, метка первого касания в визите">
        {utm.length === 0 ? <Empty text="За период не было визитов с метками" /> : (
          <div className="scroll tall">
            <table>
              <thead>
                <tr>
                  <th>Сайт</th>
                  <th>source</th>
                  <th>medium</th>
                  <th>campaign</th>
                  <th>content</th>
                  <th>term</th>
                  <th className="n">Визиты</th>
                  <th className="n">Переходы</th>
                  <th className="n">Конверсия</th>
                  <th className="n">С кликом рекламы</th>
                </tr>
              </thead>
              <tbody>
                {utm.map((r, i) => (
                  <tr key={i}>
                    <td className="muted">{r.site_name}</td>
                    <td>{dash(r.utm_source)}</td>
                    <td>{dash(r.utm_medium)}</td>
                    <td><span className="trunc">{dash(r.utm_campaign)}</span></td>
                    <td><span className="trunc">{dash(r.utm_content)}</span></td>
                    <td><span className="trunc">{dash(r.utm_term)}</span></td>
                    <BarCell value={r.visits} max={maxUtm} />
                    <td className="n">{num(r.clicks)}</td>
                    <td className="n muted">{pct(r.clicks, r.visits)}</td>
                    <td className="n dim">{num(r.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Рефереры без меток" hint="откуда пришли, когда меток в адресе не было">
        {refs.length === 0 ? <Empty /> : (
          <div className="scroll tall">
            <table>
              <thead>
                <tr><th>Сайт-источник</th><th className="n">Визиты</th><th className="n">Переходы</th></tr>
              </thead>
              <tbody>
                {refs.map((r) => (
                  <tr key={r.referrer_host}>
                    <td>{r.referrer_host}</td>
                    <BarCell value={r.visits} max={maxRef} />
                    <td className="n muted">{num(r.clicks)}</td>
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
