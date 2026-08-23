import { num, pct } from '@/lib/format';
import { loadRoyalties, monthLabel, daysInMonth } from '@/lib/royalties';
import { Card, Kpi, Empty, BarCell } from '@/components/ui';

export const dynamic = 'force-dynamic';

const BRASS = '#c6a15b';       // TW первичные
const BRASS_D = '#977c3f';     // TW повторные
const STEEL = '#5b7a99';       // AdminVPS
const GREEN = '#6cbf8b';       // is*hosting / плюс
const RED = '#d1697a';         // минус / риск
const BUILD = 'rgba(198,161,91,.30)'; // достройка месяца
const FORE = '#3a4756';        // прогноз

const rub = (n) => num(Math.round(n || 0)) + ' ₽';
const rubK = (n) => Math.round((n || 0) / 1000) + 'к';
const dec = (n) => String(n).replace('.', ',');
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// день от начала периода до снимка, для «оплат в день»
function daysElapsed(from, to) {
  const p = (s) => { const [d, m, y] = String(s).split('.').map(Number); return Date.UTC(y, m - 1, d); };
  try { return Math.max(1, Math.round((p(to) - p(from)) / 86400000)); } catch { return 1; }
}

// цвет ячейки хитмапа по проценту удержания
function heat(p) {
  if (p == null) return 'transparent';
  if (p >= 40) return '#2f6b4c';
  if (p >= 25) return '#5f6a37';
  if (p >= 15) return '#7a5a34';
  if (p >= 8) return '#82492f';
  return '#7d3a41';
}

const HS = { green: GREEN, amber: BRASS, red: RED };

export default async function Royalties() {
  const R = loadRoyalties();
  if (!R) {
    return (
      <div className="grid" style={{ gap: 14 }}>
        <Card><Empty text="Снимок партнёрок не найден (data/royalties.json)" /></Card>
      </div>
    );
  }

  const { tw, avps, ish, ads, derived, current, dow, net_months, health, meta } = R;
  const months = R.months || [];
  const fcMonths = Object.keys(tw.forecast || {});

  const grandTotal = (tw.total || 0) + (avps.total || 0) + (ish.total || 0);
  const netCum = net_months.length ? net_months[net_months.length - 1].cum : (derived.net || 0);
  const days = daysElapsed(meta.period_start, meta.asof);
  const perDay = Math.round(grandTotal / days);
  const regsAll = (tw.regs || 0) + (avps.regs || 0);

  // ——— серия «доход по месяцам + прогноз» (стек)
  const inc = months.map((m) => ({
    m, fc: false,
    first: tw.months[m]?.fs || 0, rep: tw.months[m]?.rs || 0,
    av: avps.months[m]?.isum || 0, ish: ish.months[m]?.income || 0,
    build: 0, forecast: 0,
  }));
  const cur = inc.find((x) => x.m === current.month);
  if (cur) cur.build = Math.max(0, (current.total?.proj || 0) - (current.total?.fact || 0));
  for (const m of fcMonths) {
    inc.push({
      m, fc: true, first: 0, rep: 0, av: 0, ish: 0, build: 0,
      forecast: (tw.forecast[m]?.first || 0) + (tw.forecast[m]?.rep || 0) + (avps.forecast?.[m] || 0),
    });
  }
  const incMax = Math.max(1, ...inc.map((x) => x.first + x.rep + x.av + x.ish + x.build + x.forecast));
  const H = 190;
  const seg = (color, v, key) => (v > 0 ? <div key={key} style={{ height: Math.max(1, Math.round((v / incMax) * H)) + 'px', background: color }} /> : null);

  // ——— чистыми по месяцам
  const netMax = Math.max(1, ...net_months.map((r) => Math.abs(r.net)));

  // ——— средний чек первичные/повторные по месяцам
  const checkRows = months.map((m) => {
    const mo = tw.months[m] || {};
    return { m, first: mo.fc ? Math.round(mo.fs / mo.fc) : 0, rep: mo.rc ? Math.round(mo.rs / mo.rc) : 0 };
  });
  const checkMax = Math.max(1, ...checkRows.flatMap((r) => [r.first, r.rep]));

  // ——— по дням недели: сумма по месяцам, Timeweb + AdminVPS
  const sum7 = (obj) => {
    const acc = [0, 0, 0, 0, 0, 0, 0];
    for (const k of Object.keys(obj || {})) (obj[k] || []).forEach((v, i) => { acc[i] += v || 0; });
    return acc;
  };
  const regDow = sum7(dow?.tw?.reg).map((v, i) => v + sum7(dow?.avps?.reg)[i]);
  const payDow = sum7(dow?.tw?.pay_cnt).map((v, i) => v + sum7(dow?.avps?.pay_cnt)[i]);
  const regDowMax = Math.max(1, ...regDow);
  const payDowMax = Math.max(1, ...payDow);
  const bestReg = DOW[regDow.indexOf(Math.max(...regDow))];
  const bestPay = DOW[payDow.indexOf(Math.max(...payDow))];

  // ——— сводная таблица
  const daysDone = current.days_done || daysInMonth(current.month);
  const summaryRow = (m) => {
    const t = tw.months[m]?.sum || 0;
    const a = avps.months[m]?.isum || 0;
    const i = ish.months[m]?.income || 0;
    const all = t + a + i;
    const net = (net_months.find((r) => r.m === m) || {}).net;
    const cnt = tw.months[m]?.cnt || 0;
    const check = cnt ? Math.round(t / cnt) : 0;
    const dm = m === current.month ? daysDone : daysInMonth(m);
    const cReg = ads.eff?.[m]?.conv_click_reg;
    const regs = tw.months[m]?.regs || 0;
    const paid = tw.months[m]?.regs_paid || 0;
    const cPay = regs ? Math.round((paid / regs) * 100) : null;
    return { m, t, a, i, all, net, check, perday: Math.round(all / dm), cReg, cPay };
  };
  const factRows = months.map(summaryRow);
  const totFact = factRows.reduce((s, r) => ({ t: s.t + r.t, a: s.a + r.a, i: s.i + r.i, all: s.all + r.all }), { t: 0, a: 0, i: 0, all: 0 });
  const fcRows = fcMonths.map((m) => {
    const t = (tw.forecast[m]?.first || 0) + (tw.forecast[m]?.rep || 0);
    const a = avps.forecast?.[m] || 0;
    return { m, t, a, all: t + a };
  });

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div className="note" style={{ margin: 0 }}>
          Партнёрки Директ: реф-реклама и выплаты по Timeweb, AdminVPS и is*hosting (Affise). Снимок на{' '}
          <b>{meta.asof}</b>, период с {meta.period_start}. Это тот же источник, что и Royalties-дашборд:
          деньги считаются по журналу оплат кабинетов, доход is*hosting переведён из USD по курсу {ish.rate} ₽.
          Обновляется по запросу вместе с роялти. Рекламные срезы Директа (заголовки, тексты, запросы) на вкладке «Маркетинг».
        </div>
      </Card>

      {Array.isArray(health) && health.length ? (
        <div className="chips">
          {health.map((h, i) => (
            <span key={i} className="tag" style={{ borderColor: HS[h.s] || 'var(--line)', color: HS[h.s] || 'var(--muted)', padding: '5px 10px' }}>
              {h.k}: <b>{h.v}</b> · {h.note}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid kpis">
        <Kpi label="Всего получено" value={rub(grandTotal)} sub="Timeweb + AdminVPS + is*hosting" />
        <Kpi label="Чистый доход" value={(netCum >= 0 ? '+' : '') + rub(netCum)} sub="выручка минус расход Директа" />
        <Kpi label="Оплат в день" value={rub(perDay)} sub={`в среднем за ${days} дн.`} />
        <Kpi label="Средний чек" value={rub(tw.avg_check)} sub={`первичн. ${rub(tw.avg_first)} / повт. ${rub(tw.avg_rep)}`} />
        <Kpi label="Конверсия рег→оплата" value={dec(derived.conv_reg_pay) + '%'} sub={`клик→рег ${dec(derived.conv_click_reg)}%`} />
        <Kpi label="ROAS" value={dec(derived.roas)} sub="возврат на рекламу" />
        <Kpi label="Окупаемость" value={derived.payback + ' мес'} sub={`LTV ${num(derived.ltv)} / CAC ${num(derived.cac)} ₽`} />
        <Kpi label="Регистрации" value={num(regsAll)} sub={`TW ${num(tw.regs)} / AV ${num(avps.regs)}`} />
      </div>

      <Card title="Доход по месяцам и прогноз" hint="факт по источникам + подтверждённые продления">
        <div className="scroll">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, minWidth: 620 }}>
            {inc.map((x) => {
              const total = x.first + x.rep + x.av + x.ish + x.build + x.forecast;
              return (
                <div key={x.m} style={{ flex: 1, minWidth: 0, textAlign: 'center' }}
                     title={`${monthLabel(x.m)}${x.fc ? ' (прогноз)' : ''}: ${rub(total)}`}>
                  <div style={{ fontSize: 10, color: total ? 'var(--muted)' : 'transparent', height: 13 }}>{total ? rubK(total) : '·'}</div>
                  <div style={{ height: H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    {seg(FORE, x.forecast, 'f')}
                    {seg(BUILD, x.build, 'b')}
                    {seg(GREEN, x.ish, 'i')}
                    {seg(STEEL, x.av, 'a')}
                    {seg(BRASS_D, x.rep, 'r')}
                    {seg(BRASS, x.first, 'p')}
                  </div>
                  <div style={{ fontSize: 9.5, color: 'var(--dim)', marginTop: 3, whiteSpace: 'nowrap' }}>{monthLabel(x.m)}{x.fc ? ' п' : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {[['TW первичные', BRASS], ['TW повторные', BRASS_D], ['AdminVPS', STEEL], ['is*hosting', GREEN], ['достройка месяца', BRASS], ['прогноз', FORE]].map(([l, c]) => (
            <span key={l} className="tag" style={{ borderColor: c, color: c }}>{l}</span>
          ))}
        </div>
      </Card>

      <Card title="Сводная по месяцам" hint="факт с итогом, ниже подтверждённые продления">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Месяц</th><th className="n">Timeweb</th><th className="n">AdminVPS</th><th className="n">is*hosting</th>
                <th className="n">Всего</th><th className="n">Чистыми</th><th className="n">Ср. чек</th>
                <th className="n">Оплат/день</th><th className="n">Конв. в рег.</th><th className="n">Конв. в оплату</th>
              </tr>
            </thead>
            <tbody>
              {factRows.map((r) => (
                <tr key={r.m}>
                  <td>{monthLabel(r.m)}</td>
                  <td className="n">{rub(r.t)}</td>
                  <td className="n">{r.a ? rub(r.a) : '—'}</td>
                  <td className="n">{r.i ? rub(r.i) : '—'}</td>
                  <td className="n"><b>{rub(r.all)}</b></td>
                  <td className="n" style={{ color: r.net == null ? undefined : r.net >= 0 ? GREEN : RED }}>{r.net == null ? '—' : (r.net >= 0 ? '+' : '') + num(r.net)}</td>
                  <td className="n muted">{r.check ? num(r.check) : '—'}</td>
                  <td className="n muted">{num(r.perday)}</td>
                  <td className="n muted">{r.cReg != null ? dec(r.cReg) + '%' : '—'}</td>
                  <td className="n muted">{r.cPay != null ? r.cPay + '%' : '—'}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line)' }}>
                <td>Итого факт</td>
                <td className="n">{rub(totFact.t)}</td>
                <td className="n">{rub(totFact.a)}</td>
                <td className="n">{rub(totFact.i)}</td>
                <td className="n">{rub(totFact.all)}</td>
                <td className="n" style={{ color: GREEN }}>+{num(netCum)}</td>
                <td className="n muted">{num(tw.avg_check)}</td>
                <td className="n muted">—</td><td className="n muted">—</td><td className="n muted">—</td>
              </tr>
              {cur && cur.build ? (
                <tr style={{ fontStyle: 'italic', color: 'var(--muted)' }}>
                  <td>{monthLabel(current.month)} · достройка</td>
                  <td className="n">{rub((current.tw?.proj || 0) - (current.tw?.fact || 0))}</td>
                  <td className="n">{rub((current.avps?.proj || 0) - (current.avps?.fact || 0))}</td>
                  <td className="n">—</td>
                  <td className="n">{rub((current.total?.proj || 0) - (current.total?.fact || 0))}</td>
                  <td className="n" colSpan={5}></td>
                </tr>
              ) : null}
              {fcRows.map((r) => (
                <tr key={r.m} style={{ color: 'var(--dim)' }}>
                  <td>{monthLabel(r.m)} · прогноз</td>
                  <td className="n">{rub(r.t)}</td>
                  <td className="n">{r.a ? rub(r.a) : '—'}</td>
                  <td className="n">—</td>
                  <td className="n">{rub(r.all)}</td>
                  <td className="n" colSpan={5}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid cols2">
        <Card title="Чистыми по месяцам" hint="выручка минус расход Директа, справа накопительно">
          {net_months.map((r) => (
            <div key={r.m} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '5px 0' }}>
              <div style={{ width: 38, fontSize: 12, color: 'var(--dim)' }}>{monthLabel(r.m)}</div>
              <div style={{ flex: 1, display: 'flex', height: 16 }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  {r.net < 0 ? <div style={{ width: (Math.abs(r.net) / netMax * 100) + '%', background: RED, height: '100%', borderRadius: '4px 0 0 4px' }} /> : null}
                </div>
                <div style={{ width: 1, background: 'var(--line)' }} />
                <div style={{ flex: 1 }}>
                  {r.net >= 0 ? <div style={{ width: (r.net / netMax * 100) + '%', background: GREEN, height: '100%', borderRadius: '0 4px 4px 0' }} /> : null}
                </div>
              </div>
              <div style={{ width: 78, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: r.net >= 0 ? GREEN : RED }}>
                {(r.net >= 0 ? '+' : '') + num(r.net)}
              </div>
              <div style={{ width: 66, textAlign: 'right', fontSize: 11.5, color: 'var(--dim)' }}>Σ {num(r.cum)}</div>
            </div>
          ))}
        </Card>

        <Card title="Retention оплат" hint="сколько клиентов дошли до N-й оплаты (Timeweb)">
          {(tw.retention || []).map((r) => (
            <div key={r.n} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                <span>{r.n}+ оплата</span><span className="mono">{r.pct}% · {num(r.clients)}</span>
              </div>
              <div style={{ background: 'var(--panel-2)', borderRadius: 6, height: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <div style={{ width: r.pct + '%', height: '100%', background: BRASS }} />
              </div>
            </div>
          ))}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Средний чек: первичные и повторные" hint="₽, помесячно (Timeweb)">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 150 }}>
            {checkRows.map((r) => (
              <div key={r.m} style={{ flex: 1, textAlign: 'center' }} title={`${monthLabel(r.m)}: первичн. ${r.first} / повт. ${r.rep} ₽`}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 120 }}>
                  <div style={{ width: 14, height: Math.round(r.first / checkMax * 120) + 'px', background: BRASS, borderRadius: '2px 2px 0 0' }} />
                  <div style={{ width: 14, height: Math.round(r.rep / checkMax * 120) + 'px', background: STEEL, borderRadius: '2px 2px 0 0' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 4 }}>{monthLabel(r.m)}</div>
              </div>
            ))}
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            <span className="tag" style={{ borderColor: BRASS, color: BRASS }}>первичная</span>
            <span className="tag" style={{ borderColor: STEEL, color: STEEL }}>повторная</span>
          </div>
        </Card>

        <Card title="По дням недели" hint="регистрации и оплаты, Timeweb + AdminVPS">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150 }}>
            {DOW.map((d, i) => (
              <div key={d} style={{ flex: 1, textAlign: 'center' }} title={`${d}: ${regDow[i]} рег., ${payDow[i]} оплат`}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 120 }}>
                  <div style={{ width: 12, height: Math.round(regDow[i] / regDowMax * 120) + 'px', background: BRASS, borderRadius: '2px 2px 0 0' }} />
                  <div style={{ width: 12, height: Math.round(payDow[i] / payDowMax * 120) + 'px', background: STEEL, borderRadius: '2px 2px 0 0' }} />
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--dim)', marginTop: 4 }}>{d}</div>
              </div>
            ))}
          </div>
          <div className="note" style={{ marginTop: 8 }}>Больше регистраций: <b>{bestReg}</b>, больше оплат: <b>{bestPay}</b></div>
        </Card>
      </div>

      <Card title="Тепловая карта retention по когортам" hint="строка · месяц регистрации, столбец · месяц жизни; % активных плательщиков">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Когорта</th><th className="n">Рег.</th>
                {['M0', 'M1', 'M2', 'M3', 'M4', 'M5'].map((h) => <th key={h} className="n">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(tw.cohorts || []).map((c) => (
                <tr key={c.m}>
                  <td>{monthLabel(c.m)}</td>
                  <td className="n">{num(c.size)}</td>
                  {Array.from({ length: 6 }).map((_, i) => {
                    const v = c.ret?.[i];
                    return (
                      <td key={i} className="n" style={{ textAlign: 'center' }}>
                        {v == null ? <span className="dim">—</span> : (
                          <span style={{ display: 'inline-block', minWidth: 40, padding: '2px 6px', borderRadius: 5, background: heat(v), color: '#0e1216', fontWeight: 600 }}
                                title={c.rev_per_reg?.[i] != null ? `доход/рег ${c.rev_per_reg[i]} ₽` : undefined}>
                            {v}%
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="note" style={{ marginTop: 8 }}>Виден типовой обрыв после M0: большинство платит один раз. Наведи на ячейку, чтобы увидеть накопленный доход на регистрацию.</div>
      </Card>

      <div className="grid cols2">
        <Card title="Потенциал продлений по неделям" hint="ожидаемые продления по датам «оплачен до»">
          <div className="scroll tall">
            <table>
              <thead><tr><th>Неделя с</th><th className="n">Ожидается</th><th className="n">Клиентов</th></tr></thead>
              <tbody>
                {(() => { const mx = Math.max(1, ...tw.potential.weeks.map((w) => w.sum)); return tw.potential.weeks.map((w) => (
                  <tr key={w.w}><td>{w.w}</td><BarCell value={w.sum} max={mx} suffix=" ₽" /><td className="n muted">{w.cnt}</td></tr>
                )); })()}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Потенциал продлений по месяцам" hint="подтверждённый пайплайн, без новых регистраций">
          <div className="scroll tall">
            <table>
              <thead><tr><th>Месяц</th><th className="n">Ожидается</th><th className="n">Клиентов</th></tr></thead>
              <tbody>
                {(() => { const mx = Math.max(1, ...tw.potential.months.map((w) => w.sum)); return tw.potential.months.map((w) => (
                  <tr key={w.m}><td>{monthLabel(w.m)}</td><BarCell value={w.sum} max={mx} suffix=" ₽" /><td className="n muted">{w.cnt}</td></tr>
                )); })()}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Каналы Timeweb" hint="метка utm_source из точки регистрации">
          <div className="scroll">
            <table>
              <thead><tr><th>Канал</th><th className="n">Рег.</th><th className="n">Платящих</th><th className="n">Конв.</th><th className="n">Доход</th><th className="n">Доход/рег</th></tr></thead>
              <tbody>
                {(() => { const mx = Math.max(1, ...ads.sources.map((s) => s.rev)); return ads.sources.map((s) => (
                  <tr key={s.k}>
                    <td>{s.k}</td>
                    <td className="n">{num(s.regs)}</td>
                    <td className="n muted">{num(s.payers)}</td>
                    <td className="n muted">{s.conv}%</td>
                    <BarCell value={s.rev} max={mx} suffix=" ₽" />
                    <td className="n muted">{num(s.rev_reg)} ₽</td>
                  </tr>
                )); })()}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="is*hosting (Affise)" hint="партнёрская сеть, доход в ₽ по курсу">
          <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            <Kpi label="Доход" value={rub(ish.total)} sub={`${ish.usd} USD × ${ish.rate}`} />
            <Kpi label="Конверсии" value={num(ish.conv)} sub={`из ${num(ish.clicks)} визитов`} />
          </div>
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Оффер</th><th className="n">Визиты</th><th className="n">Конв.</th><th className="n">Доход</th></tr></thead>
            <tbody>
              {ish.by_offer.map((o) => (
                <tr key={o.title}><td>{o.title}</td><td className="n">{num(o.clicks)}</td><td className="n muted">{num(o.conv)}</td><td className="n">{rub(o.income)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="note" style={{ marginTop: 8 }}>Воронка визит → конверсия, регистраций как отдельного события нет. Данные напрямую из API Affise.</div>
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Топ-клиенты и риск оттока" hint="Timeweb, по сумме оплат за историю">
          <div className="scroll tall">
            <table>
              <thead><tr><th>Клиент</th><th className="n">Оплат</th><th className="n">Сумма</th><th>Статус</th></tr></thead>
              <tbody>
                {(tw.top_clients || []).slice(0, 12).map((c) => (
                  <tr key={c.login}>
                    <td className="mono">{c.login}</td>
                    <td className="n muted">{c.cnt}</td>
                    <td className="n">{rub(c.sum)}</td>
                    <td>{c.risk ? <span className="tag" style={{ borderColor: RED, color: RED }}>риск</span> : <span className="dim">{c.status}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note" style={{ marginTop: 8 }}>Под риском оттока: <b style={{ color: RED }}>{num(tw.churn_risk?.cnt)}</b> клиентов на <b>{rub(tw.churn_risk?.sum)}</b> (скоро истекает оплата, продление не подтверждено).</div>
        </Card>

        <Card title="Реклама Директа: P&L" hint="полный расход за период, обе партнёрки">
          <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            <Kpi label="Расход Директа" value={rub(ads.total.spend)} sub={`${num(ads.total.clicks)} кликов`} />
            <Kpi label="CPC" value={rub(ads.total.cpc)} sub={`CTR ${dec(ads.total.ctr)}%`} />
            <Kpi label="CPL (цена рег.)" value={rub(ads.total.cpl)} sub="расход / регистрация" />
            <Kpi label="CAC" value={rub(ads.total.cac)} sub="расход / платящий" />
          </div>
          <div className="note" style={{ marginTop: 10 }}>
            ROAS <b>{dec(derived.roas)}</b>, окупаемость <b>{derived.payback} мес</b>. TW-расход {rub(ads.total.tw_spend)},
            AdminVPS-расход {rub(ads.total.av_spend)}. Это полный расход из кабинета, шире, чем живое окно на «Маркетинге».
          </div>
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Timeweb, детально" hint="из кабинета, вся история со склейкой OLD">
          <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            <Kpi label="Всего получено" value={rub(tw.total)} sub={`${num(tw.cnt)} оплат`} />
            <Kpi label="Регистрации" value={num(tw.regs)} sub={`платящих ${num(tw.payers)}`} />
            <Kpi label="Активных плательщиков" value={num(tw.active_paying)} sub={`из ${num(tw.active)} активных`} />
            <Kpi label="LTV" value={rub(tw.ltv)} sub={`ср. чек ${rub(tw.avg_check)}`} />
          </div>
        </Card>
        <Card title="AdminVPS, детально" hint="журнал операций, только доход">
          <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            <Kpi label="Всего получено" value={rub(avps.total)} sub={`${num(avps.cnt)} начислений`} />
            <Kpi label="Регистрации" value={num(avps.regs)} sub={`активных ${num(avps.active)}`} />
            <Kpi label="Отвал" value={dec(avps.churn_pct) + '%'} sub={`${num(avps.churn)} из ${num(avps.regs)}`} />
            <Kpi label="Доход на активного" value={rub(avps.income_per_active)} sub="в среднем" />
          </div>
          {Array.isArray(avps.tariffs) && avps.tariffs.length ? (
            <table style={{ marginTop: 10 }}>
              <thead><tr><th>Тариф</th><th className="n">Рег.</th><th className="n">Доход</th></tr></thead>
              <tbody>
                {(() => { const mx = Math.max(1, ...avps.tariffs.map((t) => t.income)); return [...avps.tariffs].sort((a, b) => b.income - a.income).slice(0, 6).map((t) => (
                  <tr key={t.k}><td>{t.k}</td><td className="n muted">{num(t.regs)}</td><BarCell value={t.income} max={mx} suffix=" ₽" /></tr>
                )); })()}
              </tbody>
            </table>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
