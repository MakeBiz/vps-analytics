import { parseFilters } from '@/lib/filters';
import { num } from '@/lib/format';
import { providerBySite, providerDetail, providerNames, visitsByDirection } from '@/lib/query';
import { Card } from '@/components/ui';
import ProvidersView from '@/components/ProvidersView';

export const dynamic = 'force-dynamic';

const dash = (v) => (v ? v : <span className="dim">—</span>);

// ServerSelection (EN и RU) с этой вкладки пока убран целиком по просьбе.
// Остальные направления показываем; понятные названия — ниже, иначе ключ как есть.
const HIDE = new Set(['serverselection-en', 'serverselection-ru']);
const DIR_NAME = {
  'servercalc-ru': 'ServerCalc.ru',
  'servercalc-online': 'ServerCalc.online',
  'podborvps': 'ПодборVPS',
};

export default async function Providers({ searchParams }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const selected = Array.isArray(sp?.provider) ? sp.provider[0] : sp?.provider || '';

  const [rowsRaw, names, visitsRows] = await Promise.all([providerBySite(f), providerNames(), visitsByDirection(f)]);

  // выкидываем ServerSelection из строк и итогов
  const rows = rowsRaw
    .filter((r) => !HIDE.has(r.site_key))
    .map((r) => ({ provider: r.provider, name: names.get(r.provider) || r.provider, site_key: r.site_key, clicks: r.clicks, sessions: r.sessions }));

  // доступные направления берём из данных (минус скрытые), в стабильном порядке
  const present = [...new Set(rows.map((r) => r.site_key))];
  const ORDER = ['podborvps', 'servercalc-ru', 'servercalc-online'];
  present.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  const directions = present.map((k) => ({ key: k, name: DIR_NAME[k] || k }));

  const visits = {};
  for (const v of visitsRows) if (!HIDE.has(v.direction)) visits[v.direction] = v.visits;

  const detail = selected ? await providerDetail(f, selected) : null;

  return (
    <div className="grid">
      <Card title="Провайдеры по сайтам" hint="сколько переходов ушло с какого сайта к какому провайдеру">
        <ProvidersView rows={rows} directions={directions} visits={visits} selectedProvider={selected} />
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
