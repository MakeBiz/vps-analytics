import Link from 'next/link';
import { parseFilters, qs } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { providerBySite, providerDetail, providerNames } from '@/lib/query';
import { BarCell, Card, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

const dash = (v) => (v ? v : <span className="dim">—</span>);

// Направления вместо сайтов: serverselection разбит на EN (корень) и RU (/ru).
const DIRECTIONS = [
  { key: 'servercalc-ru', name: 'ServerCalc.ru', site: 'servercalc-ru' },
  { key: 'serverselection-en', name: 'ServerSelection · EN', site: 'serverselection' },
  { key: 'serverselection-ru', name: 'ServerSelection · RU', site: 'serverselection' },
  { key: 'podborvps', name: 'ПодборVPS', site: 'podborvps' },
];

export default async function Providers({ searchParams }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const selected = Array.isArray(sp?.provider) ? sp.provider[0] : sp?.provider || '';

  const [rows, names] = await Promise.all([providerBySite(f), providerNames()]);
  const cols = f.site ? DIRECTIONS.filter((d) => d.site === f.site) : DIRECTIONS;

  const totals = new Map();
  for (const r of rows) {
    if (!totals.has(r.provider)) totals.set(r.provider, { total: 0, sessions: 0, by: {} });
    const t = totals.get(r.provider);
    t.total += r.clicks;
    t.sessions += r.sessions;
    t.by[r.site_key] = (t.by[r.site_key] || 0) + r.clicks;
  }
  const list = [...totals.entries()].sort((a, b) => b[1].total - a[1].total);
  const grand = list.reduce((s, [, v]) => s + v.total, 0);
  const max = list[0]?.[1].total || 1;

  const detail = selected ? await providerDetail(f, selected) : null;

  return (
    <div className="grid">
      <Card title="Провайдеры по сайтам" hint="сколько переходов ушло с какого сайта к какому провайдеру">
        {list.length === 0 ? <Empty text="За период переходов к провайдерам не было" /> : (
          <div className="scroll tall">
            <table>
              <thead>
                <tr>
                  <th>Провайдер</th>
                  {cols.map((s) => <th key={s.key} className="n">{s.name}</th>)}
                  <th className="n">Всего</th>
                  <th className="n">Доля</th>
                  <th className="n">Визитов с переходом</th>
                </tr>
              </thead>
              <tbody>
                {list.map(([slug, v]) => (
                  <tr key={slug} style={slug === selected ? { background: 'rgba(198,161,91,.10)' } : undefined}>
                    <td>
                      <Link href={'/providers' + qs(f, { provider: slug === selected ? '' : slug })}>
                        {names.get(slug) || slug}
                      </Link>
                      <span className="dim mono" style={{ marginLeft: 6 }}>{slug}</span>
                    </td>
                    {cols.map((s) => (
                      <td key={s.key} className="n muted">{v.by[s.key] ? num(v.by[s.key]) : '·'}</td>
                    ))}
                    <BarCell value={v.total} max={max} />
                    <td className="n muted">{pct(v.total, grand)}</td>
                    <td className="n dim">{num(v.sessions)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="muted"><b>Итого</b></td>
                  {cols.map((s) => (
                    <td key={s.key} className="n muted">
                      {num(list.reduce((acc, [, v]) => acc + (v.by[s.key] || 0), 0))}
                    </td>
                  ))}
                  <td className="n"><b>{num(grand)}</b></td>
                  <td className="n" /><td className="n" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detail ? (
        <>
          <Card title={`Разбор: ${names.get(selected) || selected}`} hint="с каких меток приходили те, кто ушёл к этому провайдеру">
            <div className="scroll tall">
              <table>
                <thead>
                  <tr><th>source</th><th>medium</th><th>campaign</th><th>content</th><th className="n">Переходы</th></tr>
                </thead>
                <tbody>
                  {detail.byUtm.map((r, i) => (
                    <tr key={i}>
                      <td>{dash(r.utm_source)}</td>
                      <td>{dash(r.utm_medium)}</td>
                      <td><span className="trunc">{dash(r.utm_campaign)}</span></td>
                      <td><span className="trunc">{dash(r.utm_content)}</span></td>
                      <td className="n">{num(r.clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid cols2">
            <Card title="Места и кнопки" hint="откуда на странице нажимали">
              <div className="scroll tall">
                <table>
                  <thead><tr><th>Место</th><th>Кнопка</th><th>Страница</th><th className="n">Переходы</th></tr></thead>
                  <tbody>
                    {detail.byPlace.map((r, i) => (
                      <tr key={i}>
                        <td>{r.placement ? <span className="tag b">{r.placement}</span> : <span className="dim">—</span>}</td>
                        <td><span className="trunc">{dash(r.label)}</span></td>
                        <td className="mono"><span className="trunc">{dash(r.path)}</span></td>
                        <td className="n">{num(r.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Адреса назначения" hint="какие именно партнёрские ссылки открывали">
              <div className="scroll tall">
                <table>
                  <thead><tr><th>Ссылка</th><th className="n">Переходы</th></tr></thead>
                  <tbody>
                    {detail.targets.map((r, i) => (
                      <tr key={i}>
                        <td className="mono"><span className="trunc" title={r.target_url}>{r.target_url}</span></td>
                        <td className="n">{num(r.clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
