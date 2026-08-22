import { num, pct } from '@/lib/format';
import { loadMarketing } from '@/lib/marketing';
import { Card, Kpi, Empty, BarCell } from '@/components/ui';

export const dynamic = 'force-dynamic';

const rub = (n) => num(Math.round(n)) + ' ₽';
const cpc = (n) => (n != null ? String(n).replace('.', ',') + ' ₽' : '—');
const STEEL = '#5b7a99';
const BRASS = '#c6a15b';
const GENDER_RU = { GENDER_MALE: 'Мужчины', GENDER_FEMALE: 'Женщины', UNKNOWN: 'Не определён' };
const AGE_RU = { AGE_0_17: '0-17', AGE_18_24: '18-24', AGE_25_34: '25-34', AGE_35_44: '35-44', AGE_45_54: '45-54', AGE_55: '55+', UNKNOWN: 'Не определён' };

function ceilingFor(c) {
  if (!/TW Cloud/i.test(c.name) || c.kind === 'rsya') return null;
  return /Регионы/i.test(c.name) ? 28.5 : 33;
}

export default async function Marketing() {
  const m = loadMarketing();
  if (!m) {
    return (
      <div className="grid" style={{ gap: 14 }}>
        <Card><Empty text="Снимок маркетинга не найден (data/marketing.json)" /></Card>
      </div>
    );
  }

  const camps = m.direct?.campaigns || [];
  const tr = m.direct?.trends || {};
  const vps = camps.filter((c) => c.kind !== 'other');
  const vpsCost = vps.reduce((s, c) => s + c.cost, 0);
  const vpsClicks = vps.reduce((s, c) => s + c.clicks, 0);
  const avgCpc = vpsClicks ? vpsCost / vpsClicks : 0;

  const sites = m.metrika?.sites || [];
  const provClicks = sites.reduce((s, x) => s + (x.providerClicks || 0), 0);
  const spendBySite = {};
  for (const c of camps) if (c.kind === 'site' && c.site) spendBySite[c.site] = (spendBySite[c.site] || 0) + c.cost;
  const cpaFor = (x) => (spendBySite[x.key] && x.providerClicks ? spendBySite[x.key] / x.providerClicks : null);

  const maxCost = Math.max(1, ...camps.map((c) => c.cost));
  const q = m.directQueries || {};
  const ws = m.wordstat || [];
  const maxWs = Math.max(1, ...ws.map((w) => w.count));

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div className="note" style={{ margin: 0 }}>
          Маркетинг из коннектора Яндекса: Директ, Метрика, Вебмастер, Wordstat. Снимок от {m.generated},{' '}
          {m.window}. Обновляется по запросу (коннектор на Маке, панель к нему вживую не ходит).
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        {[
          { v: rub(vpsCost), l: 'Расход Директа (VPS)', s: `${num(vpsClicks)} кликов`, t: tr.spend, down: true },
          { v: cpc(Number(avgCpc.toFixed(1))), l: 'Средний CPC', s: 'по VPS-кампаниям', t: tr.cpc, down: true },
          { v: num(provClicks), l: 'Переходы к провайдеру', s: 'Метрика, все сайты' },
          { v: provClicks ? rub(vpsCost / provClicks) : '—', l: 'Цена перехода', s: 'расход / переходы' },
        ].map((k, i) => {
          const good = k.t == null ? null : (k.down ? k.t <= 0 : k.t >= 0);
          return (
            <div key={i} className="card" style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.15 }}>{k.v}</div>
              <div style={{ fontSize: 12, marginTop: 3 }}>{k.l}</div>
              <div className="dim" style={{ fontSize: 11 }}>{k.s}</div>
              {k.t != null ? (
                <div style={{ fontSize: 11, marginTop: 3, color: good ? '#3fae7a' : '#e0736d' }}>
                  {k.t > 0 ? '▲ +' : '▼ '}{k.t}% к пред. 30 дн
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Card title="Директ: расход по кампаниям" hint="за 30 дней, красным CPC выше потолка">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Кампания</th><th className="n">Расход</th><th className="n">Клики</th>
                <th className="n">CTR</th><th className="n">CPC</th><th className="n">Доля расхода</th>
              </tr>
            </thead>
            <tbody>
              {camps.map((c) => {
                const cap = ceilingFor(c);
                const over = cap != null && c.cpc > cap;
                return (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className="n">{rub(c.cost)}</td>
                    <td className="n">{num(c.clicks)}</td>
                    <td className="n muted">{String(c.ctr).replace('.', ',')}%</td>
                    <td className="n" style={over ? { color: '#e0736d', fontWeight: 600 } : undefined}>{cpc(c.cpc)}</td>
                    <BarCell value={c.cost} max={maxCost} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {m.direct?.dailyVps?.length ? (
        <Card title="Директ по дням" hint="показы и переходы по VPS-кампаниям (без Solara)">
          {(() => {
            const dd = m.direct.dailyVps;
            const mxi = Math.max(1, ...dd.map((x) => x.impressions || 0));
            const mxc = Math.max(1, ...dd.map((x) => x.clicks || 0));
            return (
              <>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: STEEL }}>▪ показы</span>
                  <span style={{ color: BRASS }}>▪ переходы</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 130 }}>
                  {dd.map((x, i) => (
                    <div key={i} title={`${x.date}: ${num(x.impressions)} показов, ${num(x.clicks)} переходов, ${rub(x.cost)}`}
                         style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 1, height: '100%' }}>
                      <div style={{ flex: 1, height: Math.round(((x.impressions || 0) / mxi) * 100) + '%', background: STEEL, borderRadius: '2px 2px 0 0', minHeight: 1 }} />
                      <div style={{ flex: 1, height: Math.round(((x.clicks || 0) / mxc) * 100) + '%', background: BRASS, borderRadius: '2px 2px 0 0', minHeight: 1 }} />
                    </div>
                  ))}
                </div>
                <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>{dd[0].date} … {dd[dd.length - 1].date}</div>
              </>
            );
          })()}
        </Card>
      ) : (
        <Card title="Директ по дням" hint="показы и переходы по датам">
          <div className="note" style={{ margin: 0 }}>
            График появится после переустановки обновлённого коннектора и команды «обнови маркетинг»: тогда дни придут по VPS-кампаниям (без Solara) с показами и переходами.
          </div>
        </Card>
      )}

      {m.direct?.ads?.length ? (
        <Card title="Топ объявлений Директа" hint="за 30 дней, по расходу">
          <div className="scroll">
            <table>
              <thead><tr><th>Объявление</th><th className="n">Клики</th><th className="n">Расход</th><th className="n">CPC</th></tr></thead>
              <tbody>
                {[...m.direct.ads].sort((a, b) => b.cost - a.cost).map((a, i) => (
                  <tr key={i}>
                    <td>{a.campaign_name}<span className="dim" style={{ fontSize: 12 }}> / {a.group_name}</span></td>
                    <td className="n">{num(a.clicks)}</td>
                    <td className="n">{rub(a.cost)}</td>
                    <td className="n muted">{cpc(a.avg_cpc)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card title="Метрика: конверсии и цена перехода по сайтам" hint="переход к провайдеру — главная цель денег">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Сайт</th><th className="n">Визиты</th><th className="n">Переходы</th>
                <th className="n">Визит→переход</th><th className="n">Цена перехода</th><th>Топ провайдеров</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((x) => {
                const cpa = cpaFor(x);
                const top = (x.goals || []).slice(0, 5).map(([s, n]) => `${s} ${n}`).join(', ');
                return (
                  <tr key={x.key}>
                    <td>{x.name}</td>
                    <td className="n">{num(x.visits)}</td>
                    <td className="n">{num(x.providerClicks)}</td>
                    <td className="n muted">{x.visits ? pct(x.providerClicks, x.visits) : '—'}</td>
                    <td className="n" style={cpa && cpa > 60 ? { color: '#e0736d', fontWeight: 600 } : undefined}>{cpa ? rub(cpa) : '—'}</td>
                    <td className="dim" style={{ fontSize: 12 }}>{top || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
          Калькулятор ServerCalc: начал подбор {sites.find((s) => s.key === 'servercalc-ru')?.calc?.start ?? 0},
          получил подбор {sites.find((s) => s.key === 'servercalc-ru')?.calc?.result ?? 0},
          фильтр каталога {sites.find((s) => s.key === 'servercalc-ru')?.calc?.filter ?? 0}.
        </div>
      </Card>

      {m.direct?.demographics?.length ? (() => {
        const rows = m.direct.demographics.filter((r) => r.campaign_name !== 'Solara');
        const agg = (key) => {
          const mp = {};
          for (const r of rows) mp[r[key]] = (mp[r[key]] || 0) + r.clicks;
          return Object.entries(mp).sort((a, b) => b[1] - a[1]);
        };
        const genders = agg('gender');
        const ages = agg('age');
        const gt = genders.reduce((s, [, n]) => s + n, 0) || 1;
        const at = ages.reduce((s, [, n]) => s + n, 0) || 1;
        const bar = (label, n, total, color) => (
          <div key={label} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span>{label}</span><span className="mono">{pct(n, total)}</span></div>
            <div style={{ background: '#141a20', borderRadius: 6, height: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <div style={{ width: Math.round((n / total) * 100) + '%', height: '100%', background: color }} />
            </div>
          </div>
        );
        return (
          <Card title="Демография Директа (VPS)" hint="по кликам, без Solara">
            <div className="grid cols2" style={{ gap: 16 }}>
              <div>
                <div style={{ fontSize: 12.5, color: STEEL, fontWeight: 600, marginBottom: 8 }}>Пол</div>
                {genders.map(([k, n]) => bar(GENDER_RU[k] || k, n, gt, STEEL))}
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: BRASS, fontWeight: 600, marginBottom: 8 }}>Возраст</div>
                {ages.map(([k, n]) => bar(AGE_RU[k] || k, n, at, BRASS))}
              </div>
            </div>
          </Card>
        );
      })() : null}

      <div className="grid cols2" style={{ gap: 14 }}>
        <Card title="Реальные запросы Директа" hint="что искали, топ по расходу">
          <div className="scroll tall">
            <table>
              <thead><tr><th>Запрос</th><th className="n">Клики</th><th className="n">Расход</th><th>Кампания</th></tr></thead>
              <tbody>
                {(q.top || []).map((r, i) => (
                  <tr key={i}>
                    <td>{r.q}</td>
                    <td className="n">{num(r.clicks)}</td>
                    <td className="n">{rub(r.cost)}</td>
                    <td className="dim" style={{ fontSize: 12 }}>{r.camp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Кандидаты в минус-слова" hint="мусорные запросы, отсечь в кампаниях">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(q.minusCandidates || []).map((w, i) => (
              <span key={i} className="tag" style={{ padding: '5px 10px', borderRadius: 8, background: '#2a1f1f', color: '#e0a7a2', fontSize: 13 }}>−{w}</span>
            ))}
          </div>
          <div className="note" style={{ marginTop: 12 }}>
            Почти весь расход Директа идёт на брендовые запросы партнёров (timeweb, adminvps). Небрендовый VPS-спрос
            в расходе пока копеечный.
          </div>
        </Card>
      </div>

      <Card title="Спрос по ключам (Wordstat)" hint="показов в месяц, регион Россия">
        <div className="grid" style={{ gap: 10 }}>
          {ws.map((w, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                <span>{w.phrase}</span><span className="mono">{num(w.count)}</span>
              </div>
              <div style={{ background: '#141a20', borderRadius: 6, height: 16, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <div style={{ width: Math.round((w.count / maxWs) * 100) + '%', height: '100%', background: '#5b7a99', opacity: 0.85 }} />
              </div>
              {w.tails?.length ? (
                <div className="dim" style={{ fontSize: 11.5, marginTop: 3 }}>
                  {w.tails.map(([t, n]) => `${t}${n ? ' (' + num(n) + ')' : ''}`).join(' · ')}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card title="SEO из Вебмастера" hint="поисковые запросы из органики">
        {(m.webmaster?.sites || []).map((s) => (
          <div key={s.host} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.host}</div>
            {s.queries?.length ? (
              <table>
                <thead><tr><th>Запрос</th><th className="n">Показы</th><th className="n">Клики</th></tr></thead>
                <tbody>
                  {s.queries.map((r, i) => (
                    <tr key={i}><td>{r[0]}</td><td className="n">{num(r[1])}</td><td className="n">{num(r[2])}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="dim" style={{ fontSize: 12 }}>органических запросов нет, сайт ещё не ранжируется</div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}
