import { parseFilters } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { geoReport, techReport } from '@/lib/query';
import { countryName } from '@/lib/ua';
import { directDemographics, approvedCampaignNames, GENDER_ORDER, AGE_ORDER } from '@/lib/direct';
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

// Пол/возраст: считаем по кликам рекламы Директа (две наши кампании).
// Порядок строк фиксированный, чтобы не прыгал; проценты от суммы кликов.
function Demo({ rows, order, head }) {
  if (!rows || rows.length === 0) return null;
  const map = new Map();
  let total = 0;
  for (const r of rows) {
    const cur = map.get(r.key) || { clicks: 0, conv: 0 };
    cur.clicks += r.clicks;
    cur.conv += r.conv;
    map.set(r.key, cur);
    total += r.clicks;
  }
  const list = order.filter((k) => map.has(k)).map((k) => ({ k, ...map.get(k) }));
  const max = Math.max(1, ...list.map((r) => r.clicks));
  return (
    <table>
      <thead><tr><th>{head}</th><th className="n">Клики</th><th className="n">Доля</th><th className="n">Конверсии</th></tr></thead>
      <tbody>
        {list.map((r) => (
          <tr key={r.k}>
            <td>{r.k}</td>
            <BarCell value={r.clicks} max={max} />
            <td className="n muted">{pct(r.clicks, total)}</td>
            <td className="n">{num(r.conv)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function Geo({ searchParams }) {
  const f = parseFilters(await searchParams);

  let demoAll = null;
  let demoErr = '';
  try {
    demoAll = await directDemographics(f.from, f.to);
  } catch (e) {
    demoErr = e.message || String(e);
  }
  // В снимке коннектора у строк демографии нет campaign_id, есть только имя кампании,
  // поэтому фильтруем по имени согласованной кампании (тот же список, что в «Маркетинге»).
  const approved = approvedCampaignNames();
  const demoRows = (demoAll || []).filter((r) => approved.has(r.campaign_name));

  const [{ countries, cities }, tech] = await Promise.all([geoReport(f), techReport(f)]);
  const maxC = Math.max(1, ...countries.map((r) => r.visits));
  const maxCity = Math.max(1, ...cities.map((r) => r.visits));

  const genderRows = demoRows.map((r) => ({ key: r.gender, clicks: r.clicks, conv: r.conversions }));
  const ageRows = demoRows.map((r) => ({ key: r.age, clicks: r.clicks, conv: r.conversions }));
  const hasDemo = demoRows.length > 0;
  // эндпоинт ответил данными, но ни одна строка не про наши кампании:
  // почти всегда это отсутствие campaign_id в строках (данные по всему аккаунту)
  const gotDataNoMatch = (demoAll || []).length > 0 && demoRows.length === 0;

  return (
    <div className="grid">
      <div className="grid cols2">
        <Card title="Пол" hint="по рекламным кликам Директа, согласованные кампании (РСЯ и AdminVPS Регионы исключены)">
          {hasDemo ? <Demo rows={genderRows} order={GENDER_ORDER} head="Пол" /> : gotDataNoMatch ? (
            <p className="note">
              Демография из Директа приходит, но ни одна строка не совпала с согласованным списком кампаний.
              Скорее всего, изменились названия кампаний в снимке. Проверьте список в <code>lib/direct.js</code>
              (<code>VPS_CAMPAIGN_ALLOW</code>) и обновите снимок маркетинга.
            </p>
          ) : (
            <p className="note">
              Пол и возраст сайт сам не собирает, эти данные есть только в рекламном кабинете. Возьмутся из снимка
              маркетинга (тот же источник, что на вкладке «Маркетинг»). Обновите снимок командой «обнови маркетинг».
              {demoErr ? <span className="dim"> Сейчас: {demoErr}</span> : null}
            </p>
          )}
        </Card>
        <Card title="Возраст" hint="по рекламным кликам Директа, согласованные кампании">
          {hasDemo ? <Demo rows={ageRows} order={AGE_ORDER} head="Возраст" /> : (
            <p className="note">Появится вместе с полом, из того же источника (демография Яндекс.Директа).</p>
          )}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Страны" hint="топ 10, определяются на стороне Vercel по адресу запроса">
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

        <Card title="Города" hint="топ 10">
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
