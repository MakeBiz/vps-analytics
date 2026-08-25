import { num, pct } from '@/lib/format';
import { loadMarketing } from '@/lib/marketing';
import { VPS_CAMPAIGN_ALLOW as ALLOW, baseCampaignName as baseName } from '@/lib/direct';
import { Card, Kpi, Empty } from '@/components/ui';
import MarketingBoard from '@/components/MarketingBoard';

// какому нашему сайту соответствует кампания-агрегатор (для воронки)
const SITE_OF = { 'Podborvps.ru': 'podborvps', 'Servercalc': 'servercalc-ru' };
const typeOf = (kind) => (kind === 'site' ? 'agg' : kind === 'rsya' ? 'rsya' : 'prov');

export const dynamic = 'force-dynamic';

const rub = (n) => num(Math.round(n)) + ' ₽';
const cpc = (n) => (n != null ? String(n).replace('.', ',') + ' ₽' : '—');
const STEEL = '#5b7a99';
const BRASS = '#c6a15b';
const SEV = { bad: '#e0736d', warn: '#d9a441', good: '#3fae7a' };
const GENDER_RU = { GENDER_MALE: 'Мужчины', GENDER_FEMALE: 'Женщины', UNKNOWN: 'Не определён' };
const AGE_RU = { AGE_0_17: '0-17', AGE_18_24: '18-24', AGE_25_34: '25-34', AGE_35_44: '35-44', AGE_45_54: '45-54', AGE_55: '55+', UNKNOWN: 'Не определён' };

function ceilingFor(c) {
  if (!/TW Cloud/i.test(c.name) || c.kind === 'rsya') return null;
  return /Регионы/i.test(c.name) ? 28.5 : 33;
}

// Список согласованных кампаний и baseName теперь общие — в lib/direct.js
// (VPS_CAMPAIGN_ALLOW), их же использует демография на вкладке «Гео».

export default async function Marketing() {
  const m = loadMarketing();
  if (!m) {
    return (
      <div className="grid" style={{ gap: 14 }}>
        <Card><Empty text="Снимок маркетинга не найден (data/marketing.json)" /></Card>
      </div>
    );
  }

  const camps = (m.direct?.campaigns || []).filter((c) => ALLOW.has(String(c.id)));
  const allowNames = new Set(camps.map((c) => baseName(c.name)));
  const vps = camps.filter((c) => c.kind !== 'other');
  const vpsCost = vps.reduce((s, c) => s + c.cost, 0);
  const vpsClicks = vps.reduce((s, c) => s + c.clicks, 0);

  const sites = m.metrika?.sites || [];
  const spendBySite = {};
  for (const c of camps) if (c.kind === 'site' && c.site) spendBySite[c.site] = (spendBySite[c.site] || 0) + c.cost;
  const cpaFor = (x) => (spendBySite[x.key] && x.providerClicks ? spendBySite[x.key] / x.providerClicks : null);

  const q = m.directQueries || {};
  const ws = m.wordstat || [];
  const maxWs = Math.max(1, ...ws.map((w) => w.count));

  // ---- данные доски (рейтинг + воронка) ----
  const boardCamps = camps.map((c) => ({
    id: String(c.id), name: c.name, base: baseName(c.name),
    cost: c.cost, clicks: c.clicks, ctr: c.ctr, cpc: c.cpc, kind: c.kind,
    type: typeOf(c.kind),
    impr: c.ctr > 0 ? Math.round((c.clicks * 100) / c.ctr) : 0,
    ceiling: ceilingFor(c),
  }));
  const groups = {};
  for (const a of m.direct?.ads || []) {
    const b = baseName(a.campaign_name);
    if (!allowNames.has(b)) continue;
    (groups[b] = groups[b] || []).push({ group: a.group_name, clicks: a.clicks, cost: a.cost, cpc: a.avg_cpc });
  }
  const aggFunnel = [];
  for (const c of boardCamps.filter((x) => x.type === 'agg')) {
    const site = sites.find((s) => s.key === SITE_OF[c.base]);
    if (site) aggFunnel.push({ site: site.key, name: site.name, clicks: c.clicks, cost: c.cost, visits: site.visits, providerClicks: site.providerClicks });
  }
  const provFunnel = boardCamps.filter((x) => x.type === 'prov').sort((a, b) => b.cost - a.cost)
    .map((c) => ({ name: c.base, impr: c.impr, clicks: c.clicks, cpc: c.cpc, cost: c.cost }));
  const funnel = { aggregators: aggFunnel, providers: provFunnel };

  // каннибализация: один запрос в нескольких кампаниях
  const byQ = {};
  for (const r of q.top || []) {
    if (!allowNames.has(baseName(r.camp))) continue;
    (byQ[r.q] = byQ[r.q] || []).push({ camp: r.camp, clicks: r.clicks, cost: r.cost });
  }
  const cannibal = Object.entries(byQ).filter(([, a]) => a.length > 1)
    .map(([qq, a]) => ({ q: qq, camps: a, clicks: a.reduce((s, x) => s + x.clicks, 0), cost: a.reduce((s, x) => s + x.cost, 0) }))
    .sort((a, b) => b.cost - a.cost);

  const shownSites = sites.filter((s) => s.key !== 'serverselection');

  // ---- KPI за период ----
  const vpsImpr = boardCamps.reduce((s, c) => s + (c.impr || 0), 0);
  const ctrAll = vpsImpr ? (vpsClicks / vpsImpr) * 100 : 0;
  const overpay = boardCamps.filter((c) => c.ceiling && c.cpc / c.ceiling > 1).length;
  const cpas = aggFunnel.map((a) => (a.providerClicks ? a.cost / a.providerClicks : null)).filter((x) => x != null);
  const cpaMin = cpas.length ? Math.min(...cpas) : null;
  const cpaMax = cpas.length ? Math.max(...cpas) : null;
  const cpaLabel = cpaMin == null ? '—' : (Math.round(cpaMin) === Math.round(cpaMax) ? rub(cpaMin) : `${rub(cpaMin)}–${rub(cpaMax)}`);

  // ---- рекомендации из данных ----
  const recs = [];
  boardCamps.filter((c) => c.ceiling && c.cpc / c.ceiling > 1.15)
    .sort((a, b) => b.cpc / b.ceiling - a.cpc / a.ceiling)
    .forEach((c) => recs.push({ sev: 'bad', t: `Снизить ставки: ${c.base}`, x: `CPC ${cpc(c.cpc)}, это ×${(c.cpc / c.ceiling).toFixed(2).replace('.', ',')} к целевому потолку ${String(c.ceiling).replace('.', ',')} ₽` }));
  if (cannibal.length) {
    const qs = cannibal.slice(0, 4).map((r) => `«${r.q}»`).join(', ');
    const nc = new Set(cannibal.flatMap((r) => r.camps.map((x) => x.camp))).size;
    recs.push({ sev: 'bad', t: 'Развести кампании минус-словами', x: `${cannibal.length} запросов делят ${nc} кампаний: ${qs} — перестать торговаться с собой за клик` });
  }
  aggFunnel.forEach((a) => {
    const cpa = a.providerClicks ? a.cost / a.providerClicks : null;
    if (cpa == null) return;
    const conv = a.visits ? Math.round((a.providerClicks / a.visits) * 100) : 0;
    if (cpa > 60) recs.push({ sev: 'warn', t: `Чинить воронку: ${a.name}`, x: `переход стоит ${rub(cpa)}, конверсия визит→переход ${conv}% — теряем деньги на шаге сайта` });
    else recs.push({ sev: 'good', t: `Масштабировать: ${a.name}`, x: `переход ${rub(cpa)} в цель, конверсия ${conv}% — можно добавлять бюджет` });
  });

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div className="note" style={{ margin: 0 }}>
          Маркетинг из коннектора Яндекса: Директ, Метрика, Вебмастер, Wordstat. Снимок от {m.generated},{' '}
          {m.window}. Обновляется по запросу (коннектор на Маке, панель к нему вживую не ходит).
          <br />
          В расчёт и вывод берутся только согласованные кампании Директа. Ниже: показатели за период, рейтинг
          кампаний с оценкой, экономика воронки по типам, каннибализация и рекомендации. Кампании без расхода
          за период не показываются.
        </div>
      </Card>

      {/* ---- KPI за период ---- */}
      <div className="grid kpis">
        <Kpi label="Расход за период" value={rub(vpsCost)} sub={`${vps.length} кампаний`} />
        <Kpi label="Клики" value={num(vpsClicks)} sub={`CTR ${ctrAll.toFixed(1).replace('.', ',')}%`} />
        <Kpi label="Средний CPC" value={vpsClicks ? cpc(Math.round((vpsCost / vpsClicks) * 10) / 10) : '—'} sub={overpay ? `${overpay} кампаний выше потолка` : 'в пределах потолка'} />
        <Kpi label="Стоимость перехода" value={cpaLabel} sub={cpaMin != null ? 'цель ~60 ₽' : 'нет данных воронки'} />
      </div>

      <MarketingBoard camps={boardCamps} groups={groups} funnel={funnel} />

      {m.direct?.dailyVps?.length ? (
        <Card title="Директ по дням" hint="показы и переходы по VPS-кампаниям (без Solara)">
          {(() => {
            const dd = m.direct.dailyVps;
            const mxi = Math.max(1, ...dd.map((x) => x.impressions || 0));
            const mxc = Math.max(1, ...dd.map((x) => x.clicks || 0));
            const sumI = dd.reduce((s, x) => s + (x.impressions || 0), 0);
            const sumC = dd.reduce((s, x) => s + (x.clicks || 0), 0);
            const sumCost = dd.reduce((s, x) => s + (x.cost || 0), 0);
            return (
              <>
                <div style={{ display: 'flex', gap: 14, fontSize: 12, marginBottom: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ color: STEEL }}>▪ показы</span>
                  <span style={{ color: BRASS }}>▪ переходы</span>
                  <span className="dim" style={{ marginLeft: 'auto' }}>
                    за период: Σ показы <b style={{ color: STEEL }}>{num(sumI)}</b>{' · '}
                    Σ переходы <b style={{ color: BRASS }}>{num(sumC)}</b>{' · '}
                    Σ расход <b>{rub(sumCost)}</b>
                  </span>
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
                {[...m.direct.ads].filter((a) => allowNames.has(baseName(a.campaign_name))).sort((a, b) => b.cost - a.cost).map((a, i) => (
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
              {shownSites.map((x) => {
                const cpa = cpaFor(x);
                const top = (x.goals || []).slice(0, 5).map(([s, n]) => `${s} ${n}`).join(', ');
                return (
                  <tr key={x.key}>
                    <td>{x.name}</td>
                    <td className="n">{num(x.visits)}</td>
                    <td className="n">{num(x.providerClicks)}</td>
                    <td className="n muted">{x.visits ? pct(x.providerClicks, x.visits) : '—'}</td>
                    <td className="n" style={cpa && cpa > 60 ? { color: SEV.bad, fontWeight: 600 } : undefined}>{cpa ? rub(cpa) : '—'}</td>
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
        const rows = m.direct.demographics.filter((r) => allowNames.has(baseName(r.campaign_name)));
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
            <div style={{ background: 'var(--panel-2)', borderRadius: 6, height: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
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
                {(q.top || []).filter((r) => allowNames.has(baseName(r.camp))).map((r, i) => (
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

      <Card title="Каннибализация запросов" hint="один запрос тянут несколько кампаний — конкурируем сами с собой и поднимаем цену">
        {cannibal.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>Пересечений по запросам между кампаниями не найдено.</div>
        ) : (
          <div className="scroll">
            <table>
              <thead><tr><th>Запрос</th><th className="n">Клики</th><th className="n">Расход</th><th>Кампании, которые за него бьются</th></tr></thead>
              <tbody>
                {cannibal.map((r, i) => (
                  <tr key={i}>
                    <td><b>{r.q}</b></td>
                    <td className="n">{num(r.clicks)}</td>
                    <td className="n">{rub(r.cost)}</td>
                    <td className="dim" style={{ fontSize: 12 }}>
                      {r.camps.map((c, j) => (
                        <span key={j}>{j ? ' · ' : ''}{c.camp} <span className="mono">({num(c.clicks)})</span></span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="dim" style={{ fontSize: 12, marginTop: 8 }}>
          Что делать: развести кампании минус-словами или объединить в одну группу, чтобы не торговаться с собой за клик.
        </div>
      </Card>

      <Card title="Рекомендации" hint="что делать в первую очередь, по данным за период">
        {recs.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>Явных проблем по данным за период не видно.</div>
        ) : (
          <div>
            {recs.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < recs.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEV[r.sev], marginTop: 5, flex: 'none' }} />
                <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.t}</div><div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{r.x}</div></div>
              </div>
            ))}
          </div>
        )}
        <div className="note" style={{ marginTop: 12 }}>
          Лучшие заголовки и метки без каннибализации появятся, когда подключим данные по объявлениям (CTR и тексты на уровне объявления) и разметку yclid для привязки переходов к кампании.
        </div>
      </Card>

      <Card title="Спрос по ключам (Wordstat)" hint="показов в месяц, регион Россия">
        <div className="grid" style={{ gap: 10 }}>
          {ws.map((w, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                <span>{w.phrase}</span><span className="mono">{num(w.count)}</span>
              </div>
              <div style={{ background: 'var(--panel-2)', borderRadius: 6, height: 16, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <div style={{ width: Math.round((w.count / maxWs) * 100) + '%', height: '100%', background: STEEL, opacity: 0.85 }} />
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
