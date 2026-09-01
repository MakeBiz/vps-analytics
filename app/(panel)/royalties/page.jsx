import { num } from '@/lib/format';
import { loadRoyalties, monthLabel, daysInMonth } from '@/lib/royalties';
import { Card, Kpi, Empty, BarCell } from '@/components/ui';
import RoyBars from '@/components/RoyBars';
import RoyToggle from '@/components/RoyToggle';

export const dynamic = 'force-dynamic';

const BRASS = '#c6a15b';       // TW первичные / основной
const BRASS_D = '#977c3f';     // TW повторные
const STEEL = '#5b7a99';       // AdminVPS / вторичный
const GREEN = '#6cbf8b';       // is*hosting / плюс
const AEZA = '#b98cd6';        // Aeza / 4-й партнёр
const RED = '#d1697a';         // минус / риск
const BUILD = 'rgba(198,161,91,.32)'; // достройка месяца
const FORE = '#46586b';        // прогноз

const dec = (n) => String(n).replace('.', ',');
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function daysElapsed(from, to) {
  const p = (s) => { const [d, m, y] = String(s).split('.').map(Number); return Date.UTC(y, m - 1, d); };
  try { return Math.max(1, Math.round((p(to) - p(from)) / 86400000)); } catch { return 1; }
}
function heat(p) {
  if (p == null) return 'transparent';
  if (p >= 40) return '#2f6b4c';
  if (p >= 25) return '#5f6a37';
  if (p >= 15) return '#7a5a34';
  if (p >= 8) return '#82492f';
  return '#7d3a41';
}
const HS = { green: GREEN, amber: BRASS, red: RED };
const one = (label, value, color) => ({ label, parts: [{ name: label, value, color }] });

export default async function Royalties() {
  const R = loadRoyalties();
  if (!R) {
    return <div className="grid" style={{ gap: 14 }}><Card><Empty text="Снимок партнёрок не найден (data/royalties.json)" /></Card></div>;
  }
  const { tw, avps, ish, ads, derived, current, dow, net_months, health, meta } = R;
  const aeza = R.aeza || { months: {}, total: 0 };
  const months = R.months || [];
  const fcMonths = Object.keys(tw.forecast || {});
  const aezaM = (m) => aeza.months?.[m] || {};
  const aezaFc = aeza.forecast || {};
  const aezaFcOf = (m) => aezaFc[m] || 0;

  const grandTotal = (tw.total || 0) + (avps.total || 0) + (ish.total || 0) + (aeza.total || 0);
  const netCum = net_months.length ? net_months[net_months.length - 1].cum : (derived.net || 0);
  const days = daysElapsed(meta.period_start, meta.asof);
  const weeksElapsed = Math.max(1, Math.round(days / 7));
  const perDay = Math.round(grandTotal / days);
  const perWeek = Math.round(grandTotal / weeksElapsed);
  const payers = (tw.retention && tw.retention[0]) ? tw.retention[0].clients : (tw.payers || 0);
  const payPerClient = payers ? (tw.cnt / payers) : 0;
  const revPerReg = tw.regs ? Math.round(tw.total / tw.regs) : 0;
  // средний срок жизни (мес) на платящего: ожидаемые активные месяцы / доля плативших
  let lifeMonths = 0;
  for (let t = 0; t < 6; t++) {
    const vals = (tw.cohorts || []).filter((c) => c.ret && c.ret[t] != null).map((c) => c.ret[t]);
    if (vals.length) lifeMonths += (vals.reduce((a, b) => a + b, 0) / vals.length) / 100;
  }
  const conv = tw.regs ? payers / tw.regs : 0;
  const lifeMonthsPayer = conv ? (lifeMonths / conv) : 0;

  // ——— тренды к прошлому периоду: текущий месяц (с проекцией до конца) к прошлому полному
  const cm = current.month;
  const pmIdx = months.indexOf(cm) - 1;
  const pm = pmIdx >= 0 ? months[pmIdx] : null;
  const mtot = (m) => (tw.months[m]?.sum || 0) + (avps.months[m]?.isum || 0) + (ish.months[m]?.income || 0) + (aezaM(m).income || 0);
  const pctChg = (a, b) => (b ? ((a - b) / b) * 100 : null);
  const dRev = pm ? pctChg(current.total?.proj || mtot(cm), mtot(pm)) : null;
  const dNet = pm ? pctChg((current.total?.proj || 0) - (current.ads?.proj || 0), (net_months.find((r) => r.m === pm) || {}).net || 0) : null;
  const chk = (m) => (tw.months[m]?.cnt ? tw.months[m].sum / tw.months[m].cnt : 0);
  const dCheck = pm ? pctChg(chk(cm), chk(pm)) : null;
  const dLtv = pm ? pctChg(tw.months[cm]?.ltv_cum || 0, tw.months[pm]?.ltv_cum || 0) : null;

  // ——— доход по месяцам + прогноз (стек)
  const HOLD = '#e0b34e';                 // потенциал: разморозка холда AdminVPS
  const holdSchedule = R.projection?.avps?.pending_schedule || {};
  const holdOf = (m) => holdSchedule[m] || 0;
  const incSeries = months.map((m) => {
    const parts = [
      { name: 'TW первичные', value: tw.months[m]?.fs || 0, color: BRASS },
      { name: 'TW повторные', value: tw.months[m]?.rs || 0, color: BRASS_D },
      { name: 'AdminVPS', value: avps.months[m]?.isum || 0, color: STEEL },
      { name: 'is*hosting', value: ish.months[m]?.income || 0, color: GREEN },
      { name: 'Aeza', value: aezaM(m).income || 0, color: AEZA },
    ];
    if (m === current.month) parts.push({ name: 'достройка месяца', value: Math.max(0, (current.total?.proj || 0) - (current.total?.fact || 0)), color: BUILD });
    if (holdOf(m)) parts.push({ name: 'потенциал холд AdminVPS', value: holdOf(m), color: HOLD });
    return { label: monthLabel(m), parts };
  });
  for (const m of fcMonths) {
    incSeries.push({ label: monthLabel(m) + ' п', parts: [
      { name: 'прогноз', value: (tw.forecast[m]?.first || 0) + (tw.forecast[m]?.rep || 0) + (avps.forecast?.[m] || 0), color: FORE },
      ...(aezaFcOf(m) ? [{ name: 'Aeza (прогноз)', value: aezaFcOf(m), color: AEZA }] : []),
      ...(holdOf(m) ? [{ name: 'потенциал холд AdminVPS', value: holdOf(m), color: HOLD }] : []),
    ] });
  }

  // ——— средняя оплата в день (по месяцам) и средний чек (по месяцам)
  const perDaySeries = months.map((m) => {
    const s = (tw.months[m]?.sum || 0) + (avps.months[m]?.isum || 0) + (ish.months[m]?.income || 0) + (aezaM(m).income || 0);
    const dm = m === current.month ? (current.days_done || daysInMonth(m)) : daysInMonth(m);
    return one(monthLabel(m), Math.round(s / dm), STEEL);
  });
  const checkSeries = months.map((m) => one(monthLabel(m), tw.months[m]?.cnt ? Math.round(tw.months[m].sum / tw.months[m].cnt) : 0, BRASS));
  const firstRepSeries = months.map((m) => {
    const mo = tw.months[m] || {};
    return { label: monthLabel(m), parts: [
      { name: 'первичная', value: mo.fc ? Math.round(mo.fs / mo.fc) : 0, color: BRASS },
      { name: 'повторная', value: mo.rc ? Math.round(mo.rs / mo.rc) : 0, color: STEEL },
    ] };
  });

  // ——— по дням недели (Timeweb + AdminVPS, сумма по месяцам)
  const sum7 = (obj) => { const a = [0, 0, 0, 0, 0, 0, 0]; for (const k of Object.keys(obj || {})) (obj[k] || []).forEach((v, i) => { a[i] += v || 0; }); return a; };
  const regDow = sum7(dow?.tw?.reg).map((v, i) => v + sum7(dow?.avps?.reg)[i]);
  const payCntDow = sum7(dow?.tw?.pay_cnt).map((v, i) => v + sum7(dow?.avps?.pay_cnt)[i]);
  const paySumDow = sum7(dow?.tw?.pay_sum).map((v, i) => v + sum7(dow?.avps?.pay_sum)[i]);
  const regDowSeries = DOW.map((d, i) => one(d, regDow[i], BRASS));
  const payDowDatasets = {
    cnt: { kilo: false, series: DOW.map((d, i) => one(d, payCntDow[i], STEEL)) },
    rub: { kilo: true, series: DOW.map((d, i) => one(d, paySumDow[i], BRASS)) },
  };
  const bestReg = DOW[regDow.indexOf(Math.max(...regDow))];
  const bestPayCnt = DOW[payCntDow.indexOf(Math.max(...payCntDow))];
  const bestPaySum = DOW[paySumDow.indexOf(Math.max(...paySumDow))];

  // ——— сводная
  const factRows = months.map((m) => {
    const t = tw.months[m]?.sum || 0, a = avps.months[m]?.isum || 0, i = ish.months[m]?.income || 0, z = aezaM(m).income || 0;
    const net = (net_months.find((r) => r.m === m) || {}).net;
    const cnt = tw.months[m]?.cnt || 0;
    const dm = m === current.month ? (current.days_done || daysInMonth(m)) : daysInMonth(m);
    const regs = tw.months[m]?.regs || 0, paid = tw.months[m]?.regs_paid || 0;
    return { m, t, a, i, z, all: t + a + i + z, net, check: cnt ? Math.round(t / cnt) : 0, perday: Math.round((t + a + i + z) / dm), cReg: ads.eff?.[m]?.conv_click_reg, cPay: regs ? Math.round((paid / regs) * 100) : null };
  });
  const totFact = factRows.reduce((s, r) => ({ t: s.t + r.t, a: s.a + r.a, i: s.i + r.i, z: s.z + r.z, all: s.all + r.all }), { t: 0, a: 0, i: 0, z: 0, all: 0 });
  const fcRows = fcMonths.map((m) => { const t = (tw.forecast[m]?.first || 0) + (tw.forecast[m]?.rep || 0); const a = avps.forecast?.[m] || 0; const z = aezaFcOf(m); return { m, t, a, z, all: t + a + z }; });

  const note = (t) => <div className="note" style={{ marginTop: 10 }}>{t}</div>;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div className="note" style={{ margin: 0 }}>
          Партнёрки Директ: реф-реклама и выплаты по Timeweb, AdminVPS, is*hosting (Affise) и Aeza. Снимок на{' '}
          <b>{meta.asof}</b>, период с {meta.period_start}. Тот же источник, что и Royalties-дашборд: деньги по журналу
          оплат кабинетов, доход is*hosting из USD по курсу {ish.rate}, Aeza из EUR по курсу {aeza.rate || 100}. Обновляется по запросу вместе с роялти.
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
        <Kpi label="Всего получено, ₽" value={num(grandTotal)} delta={dRev} />
        <Kpi label="Чистый доход, ₽" value={(netCum >= 0 ? '+' : '') + num(netCum)} delta={dNet} />
        <Kpi label="LTV клиента, ₽" value={num(derived.ltv)} delta={dLtv} />
        <Kpi label="Средний чек, ₽" value={num(tw.avg_check)} delta={dCheck} />
        <Kpi label="Оплат в день, ₽" value={num(perDay)} delta={dRev} />
        <Kpi label="Оплат в неделю, ₽" value={num(perWeek)} delta={dRev} />
        <Kpi label="Конверсия рег→оплата" value={dec(derived.conv_reg_pay) + '%'} />
      </div>

      <Card title="Доход по месяцам и прогноз, ₽" hint="факт по источникам + подтверждённые продления, наведите на столбец">
        <RoyBars series={incSeries} height={264} mode="stack" kilo unit="₽" />
        <div className="chips" style={{ marginTop: 10 }}>
          {[['TW первичные', BRASS], ['TW повторные', BRASS_D], ['AdminVPS', STEEL], ['is*hosting', GREEN], ['Aeza', AEZA], ['достройка месяца', BRASS], ['потенциал холд AdminVPS', HOLD], ['прогноз', FORE]].map(([l, c]) => (
            <span key={l} className="tag" style={{ borderColor: c, color: c }}>{l}</span>
          ))}
        </div>
        {note(`Столбцы факта разбиты по источникам, включая is*hosting и Aeza. Светлый хвост текущего месяца это достройка по темпу, жёлтая часть это потенциал разморозки холда AdminVPS (рулонный буфер ~${num(R.projection?.avps?.pending_monthly || 0)} ₽/мес: сейчас в холде ${num(R.projection?.avps?.pending || 0)} ₽, он постоянно пополняется новыми начислениями и столько же размораживается, поэтому в прогнозе держится ровно, а не иссякает, и каждый следующий месяц выше). Серые столбцы справа это прогноз продлений; розовый сегмент на них это прогноз Aeza — ровный темп ~${num(aeza.run_rate_month || 0)} ₽/мес (средний за первые ${aeza.fc_days || '—'} дн., партнёр только разгоняется, пересчитается по мере накопления). Основную выручку даёт Timeweb.`)}
      </Card>

      <div className="grid cols2">
        <Card title="Средняя сумма оплат в день, ₽" hint="по месяцам, вся выручка ÷ дни месяца">
          <RoyBars series={perDaySeries} height={230} unit="₽" />
          {note('Сколько в среднем приносит один день месяца. Пик пришёлся на лето, к августу темп чуть просел, но держится выше весны.')}
        </Card>
        <Card title="Средний чек по месяцам, ₽" hint="Timeweb, выручка ÷ число оплат">
          <RoyBars series={checkSeries} height={230} unit="₽" />
          {note('Средний размер одной оплаты. Летние месяцы дали более крупные чеки, что говорит о более дорогих тарифах и продлениях.')}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Регистрации по дням недели" hint="Timeweb + AdminVPS, за период">
          <RoyBars series={regDowSeries} height={230} />
          {note(`Больше всего регистраций в ${bestReg}. К выходным поток регистраций заметно падает: суббота и воскресенье слабее буднего дня примерно вдвое.`)}
        </Card>
        <Card title="Оплаты по дням недели" hint="Штуки или ₽, Timeweb + AdminVPS">
          <RoyToggle toggles={[{ key: 'unit', options: [{ label: 'Штуки', val: 'cnt' }, { label: '₽', val: 'rub' }] }]} datasets={payDowDatasets} height={230} />
          {note(`По числу оплат лидирует ${bestPayCnt}, по деньгам ${bestPaySum}. Оплаты распределены ровнее регистраций и заметно живее в выходные, значит платят и в субботу-воскресенье.`)}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Средний чек: первичные и повторные, ₽" hint="Timeweb, помесячно, наведите на столбец">
          <RoyBars series={firstRepSeries} height={230} mode="group" unit="₽" />
          {note('Сравнение первой оплаты клиента и последующих. Повторные обычно не ниже первичных, то есть клиенты не мельчают со временем, а часто берут больше.')}
        </Card>
        <Card title="Retention оплат" hint="сколько клиентов дошли до N-й оплаты (Timeweb)">
          {(tw.retention || []).map((r) => (
            <div key={r.n} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
                <span>{r.n}+ оплата</span><span className="mono">{r.pct}% · {num(r.clients)}</span>
              </div>
              <div style={{ background: 'var(--panel-2)', borderRadius: 6, height: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <div style={{ width: r.pct + '%', height: '100%', background: BRASS }} />
              </div>
            </div>
          ))}
          {note('Каждая ступень это доля клиентов, вернувшихся за следующей оплатой. Главный обрыв между первой и второй оплатой: удержать клиента после первого платежа это главная точка роста.')}
        </Card>
      </div>

      <Card title="Жизнь клиента (Timeweb)" hint="сколько в среднем клиент платит, живёт и приносит">
        <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <Kpi label="LTV, ₽" value={num(derived.ltv)} sub="доход с платящего клиента" />
          <Kpi label="Оплат на клиента" value={dec(payPerClient.toFixed(1))} sub={`${num(tw.cnt)} оплат / ${num(payers)} клиентов`} />
          <Kpi label="Срок жизни" value={'≈ ' + Math.round(lifeMonthsPayer) + ' мес'} sub="оценка по кривой удержания" />
          <Kpi label="Выручка на регистрацию, ₽" value={num(revPerReg)} sub={`${num(tw.total)} / ${num(tw.regs)} рег.`} />
        </div>
        {note('LTV это сколько денег в среднем приносит один платящий клиент за всё время. В среднем клиент делает около ' + dec(payPerClient.toFixed(1)) + ' оплат и остаётся с нами порядка ' + Math.round(lifeMonthsPayer) + ' месяцев. Рост LTV и срока жизни важнее разовых чеков: повторные оплаты дешевле рекламы.')}
      </Card>

      <Card title="Тепловая карта retention по когортам" hint="строка · месяц регистрации, столбец · месяц жизни; % активных плательщиков">
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Когорта</th><th className="n">Рег.</th>{['M0', 'M1', 'M2', 'M3', 'M4', 'M5'].map((h) => <th key={h} className="n" style={{ textAlign: 'center' }}>{h}</th>)}</tr>
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
                          <span style={{ display: 'inline-block', minWidth: 42, padding: '2px 6px', borderRadius: 5, background: heat(v), color: '#0e1216', fontWeight: 600 }}
                                title={c.rev_per_reg?.[i] != null ? `доход на регистрацию ${c.rev_per_reg[i]} ₽` : undefined}>{v}%</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {note('Строка это месяц регистрации когорты, столбцы M0..M5 это её месяцы жизни, цвет от красного к зелёному по доле ещё платящих. Наведите на ячейку, чтобы увидеть накопленный доход на регистрацию. Видно, что после M0 доля быстро падает.')}
      </Card>

      <div className="grid cols2">
        <Card title="Потенциал продлений по неделям, ₽" hint="ожидаемые продления по датам «оплачен до»">
          <div className="scroll tall">
            <table>
              <thead><tr><th>Неделя с</th><th className="n">Ожидается</th><th className="n">Клиентов</th></tr></thead>
              <tbody>
                {(() => { const mx = Math.max(1, ...tw.potential.weeks.map((w) => w.sum)); return tw.potential.weeks.map((w) => (
                  <tr key={w.w}><td>{w.w}</td><BarCell value={w.sum} max={mx} /><td className="n muted">{w.cnt}</td></tr>
                )); })()}
              </tbody>
            </table>
          </div>
          {note('Подтверждённый пайплайн: у этих клиентов оплата истекает на неделе, ждём продления. Помогает планировать ближайшую выручку и вовремя напомнить о продлении.')}
        </Card>
        <Card title="Потенциал продлений по месяцам, ₽" hint="13 мес вперёд, без учёта новых регистраций">
          <div className="scroll tall">
            <table>
              <thead><tr><th>Месяц</th><th className="n">Ожидается</th><th className="n">Клиентов</th></tr></thead>
              <tbody>
                {(() => { const mx = Math.max(1, ...tw.potential.months.map((w) => w.sum)); return tw.potential.months.map((w) => (
                  <tr key={w.m}><td>{monthLabel(w.m)}</td><BarCell value={w.sum} max={mx} /><td className="n muted">{w.cnt}</td></tr>
                )); })()}
                {(() => { const t = tw.potential.total || { sum13: tw.potential.months.reduce((s, w) => s + w.sum, 0), cnt13: tw.potential.months.reduce((s, w) => s + w.cnt, 0) }; return (
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--line)' }}><td>Итого за 13 мес</td><td className="n">{num(t.sum13)}</td><td className="n">{t.cnt13}</td></tr>
                ); })()}
              </tbody>
            </table>
          </div>
          {note('Тот же пайплайн продлений, помесячно на 13 месяцев вперёд с итогом. Крупные месяцы это когорты, которые массово продлеваются, к ним стоит готовить удержание заранее.')}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Каналы Timeweb, ₽" hint="метка utm_source из точки регистрации">
          <div className="scroll">
            <table>
              <thead><tr><th>Канал</th><th className="n">Рег.</th><th className="n">Платящих</th><th className="n">Конв.</th><th className="n">Доход</th><th className="n">Доход/рег</th></tr></thead>
              <tbody>
                {(() => { const mx = Math.max(1, ...ads.sources.map((s) => s.rev)); return ads.sources.map((s) => (
                  <tr key={s.k}>
                    <td>{s.k}</td><td className="n">{num(s.regs)}</td><td className="n muted">{num(s.payers)}</td>
                    <td className="n muted">{s.conv}%</td><BarCell value={s.rev} max={mx} /><td className="n muted">{num(s.rev_reg)}</td>
                  </tr>
                )); })()}
              </tbody>
            </table>
          </div>
          {note('Откуда приходят платящие регистрации Timeweb. «Доход/рег» это ценность канала на одну регистрацию: высокий при малом объёме значит дорогие штучные клиенты.')}
        </Card>
        <Card title="is*hosting (Affise), ₽" hint="партнёрская сеть, доход в рублях по курсу">
          <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            <Kpi label="Доход, ₽" value={num(ish.total)} sub={`${ish.usd} USD × ${ish.rate}`} />
            <Kpi label="Конверсии" value={num(ish.conv)} sub={`из ${num(ish.clicks)} визитов`} />
          </div>
          <table style={{ marginTop: 10 }}>
            <thead><tr><th>Оффер</th><th className="n">Визиты</th><th className="n">Конв.</th><th className="n">Доход</th></tr></thead>
            <tbody>
              {ish.by_offer.map((o) => (<tr key={o.title}><td>{o.title}</td><td className="n">{num(o.clicks)}</td><td className="n muted">{num(o.conv)}</td><td className="n">{num(o.income)}</td></tr>))}
            </tbody>
          </table>
          {note('Третий партнёр через сеть Affise. Воронка визит → конверсия, регистраций как отдельного события нет. Пока небольшой объём, но канал живой.')}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Aeza, ₽" hint="VPS-хостинг, доход накопительно по недельным снимкам кабинета">
          <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            <Kpi label="Доход всего, ₽" value={num(aeza.total)} sub={`холд + заработано, €${dec(String(aeza.eur ?? 0))}`} />
            {aeza.weekly ? <Kpi label="За неделю, ₽" value={'+' + num(aeza.weekly.income)} sub={`${aeza.weekly.from}→${aeza.weekly.to}${aeza.weekly.regs ? ', +' + aeza.weekly.regs + ' рег.' : ''}`} /> : <Kpi label="Операции" value={num(aeza.ops || 0)} sub="за последние дни" />}
            {aeza.snapshot ? <Kpi label="Регистрации" value={num(aeza.snapshot.registrations)} sub={`активных ${num(aeza.snapshot.active_referrals)}`} /> : null}
            {aeza.run_rate_month != null ? <Kpi label="Прогноз, ₽/мес" value={num(aeza.run_rate_month)} sub={`темп ${num(aeza.run_rate_day || 0)} ₽/день`} /> : null}
          </div>
          {Array.isArray(aeza.history) && aeza.history.length ? (
            <table style={{ marginTop: 10 }}>
              <thead><tr><th>Снимок</th><th className="n">Холд, €</th><th className="n">Заработано, €</th><th className="n">Всего, ₽</th><th className="n">Рег.</th></tr></thead>
              <tbody>
                {aeza.history.map((x) => (
                  <tr key={x.date}><td>{x.date}</td><td className="n">{x.hold_eur != null ? dec(String(x.hold_eur)) : '—'}</td><td className="n">{x.earned_eur != null ? dec(String(x.earned_eur)) : '—'}</td><td className="n"><b>{num(Math.round((x.cum_eur || 0) * (aeza.rate || 100)))}</b></td><td className="n muted">{x.registrations != null ? num(x.registrations) : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {note(`Четвёртый партнёр Aeza. Лента операций в кабинете живёт всего 3 дня, поэтому историю ведём по недельным скринам сводного экрана (реестр выше). Доход накопительно: «средств в холде» + «всего заработано» × ${aeza.rate || 100} ₽ — эти цифры из 3-дневного окна не выпадают. ${aeza.snapshot?.ahead ? `Последний снимок (${aeza.snapshot.asof}) свежее данных роялти (на ${aeza.asof || '—'}) — показан на карточках, а в факт войдёт при следующем полном обновлении. ` : ''}В прогноз заложен ровный темп ~${num(aeza.run_rate_month || 0)} ₽/мес (средний за ${aeza.fc_days || '—'} дн. с ${aeza.first || '—'}), пересчитывается по мере накопления снимков.`)}
        </Card>
        <Card title="AdminVPS · снимок кабинета" hint="со сводного экрана реф-программы, весь период">
          {avps.snapshot ? (
            <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              <Kpi label="Посетители" value={num(avps.snapshot.visitors)} sub={`конверсия ${dec(String(avps.snapshot.conversion ?? 0))}%`} />
              <Kpi label="Клиенты" value={num(avps.snapshot.clients)} sub="со снимка" />
              <Kpi label="Ожидающие, ₽" value={num(Math.round(avps.snapshot.pending_rub || 0))} sub="в холде, ~40 дн" />
              <Kpi label="Баланс, ₽" value={num(Math.round(avps.snapshot.balance_rub || 0))} sub={`к выводу ${num(Math.round(avps.snapshot.available_rub || 0))}`} />
            </div>
          ) : <Empty text="Снимок кабинета AdminVPS не задан" />}
          {avps.snapshot ? note(`Посетители и конверсия видны только на этом снимке — в платёжных выгрузках их нет. «Ожидающие» это заработанный доход в холде (${num(R.projection?.avps?.pending || 0)} ₽), разморозка ~40 дней. Холд рулонный: пока старое размораживается, новые начисления его пополняют, поэтому в прогнозе он идёт ровным темпом ~${num(R.projection?.avps?.pending_monthly || 0)} ₽/мес и не иссякает.`) : null}
        </Card>
      </div>

      {(() => {
        const dd = Math.max(1, days);
        const ishCnt = ish.conv || 0, aezaCnt = aeza.ops || 0;
        const rows = [
          ['Timeweb', tw.total || 0, tw.cnt || 0, 'оплаты', BRASS, ads.total?.tw_spend || 0],
          ['AdminVPS', avps.total || 0, avps.cnt || 0, 'начисления', STEEL, ads.total?.av_spend || 0],
          ['is*hosting', ish.total || 0, ishCnt, 'конверсии', GREEN, 0],
          ['Aeza', aeza.total || 0, aezaCnt, 'операции', AEZA, 0],
        ].filter((r) => r[1] > 0).sort((a, b) => b[1] - a[1]);
        const tot = rows.reduce((s, r) => s + r[1], 0) || 1;
        const totSpend = rows.reduce((s, r) => s + (r[5] || 0), 0);
        const totNet = tot - totSpend;
        return (
          <Card title="Заход по партнёрам, ₽" hint="доход, доля, расход, чистая прибыль, средняя сумма в день и средний чек за период">
            <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', margin: '2px 0 12px' }}>
              {rows.map((r) => <div key={r[0]} title={`${r[0]}: ${num(Math.round(r[1]))} ₽`} style={{ width: (r[1] / tot * 100).toFixed(1) + '%', background: r[4] }} />)}
            </div>
            <div className="scroll">
              <table>
                <thead><tr><th>Партнёр</th><th className="n">Доход, ₽</th><th className="n">Доля</th><th className="n">Расход, ₽</th><th className="n">Чистыми, ₽</th><th className="n">Сумма в день, ₽</th><th className="n">Средний чек, ₽</th></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const net = r[1] - (r[5] || 0);
                    return (
                      <tr key={r[0]}>
                        <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: r[4], marginRight: 6 }} />{r[0]}</td>
                        <td className="n"><b>{num(Math.round(r[1]))}</b></td>
                        <td className="n">{dec((r[1] / tot * 100).toFixed(1))}%</td>
                        <td className="n" style={{ color: r[5] ? RED : undefined }}>{r[5] ? '−' + num(Math.round(r[5])) : '—'}</td>
                        <td className="n" style={{ color: net >= 0 ? GREEN : RED }}>{(net >= 0 ? '+' : '') + num(Math.round(net))}</td>
                        <td className="n">{num(Math.round(r[1] / dd))}</td>
                        <td className="n" title={`${r[3]}: ${num(r[2])}`}>{r[2] ? num(Math.round(r[1] / r[2])) : '—'}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line)' }}>
                    <td>Итого</td><td className="n">{num(Math.round(tot))}</td><td className="n">100%</td>
                    <td className="n" style={{ color: totSpend ? RED : undefined }}>{totSpend ? '−' + num(Math.round(totSpend)) : '—'}</td>
                    <td className="n" style={{ color: totNet >= 0 ? GREEN : RED }}>{(totNet >= 0 ? '+' : '') + num(Math.round(totNet))}</td>
                    <td className="n">{num(Math.round(tot / dd))}</td><td className="n">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {note('Вклад каждого партнёра деньгами: доход, расход Директа и чистая прибыль. Расход рекламы есть только у Timeweb и AdminVPS, у is*hosting и Aeza выплаты без нашей рекламы. Средний чек это доход на одну оплату (у is*hosting на конверсию, у Aeza на операцию начисления). Основную выручку даёт Timeweb, AdminVPS второй, is*hosting и Aeza пока небольшие, но живые.')}
          </Card>
        );
      })()}

      <Card title="Сводная по месяцам, ₽" hint="факт с итогом, ниже достройка и подтверждённые продления">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Месяц</th><th className="n">Timeweb</th><th className="n">AdminVPS</th><th className="n">is*hosting</th><th className="n">Aeza</th>
                <th className="n">Всего</th><th className="n">Чистыми</th><th className="n">Ср. чек</th>
                <th className="n">Оплат/день</th><th className="n">Конв. в рег.</th><th className="n">Конв. в оплату</th>
              </tr>
            </thead>
            <tbody>
              {factRows.map((r) => (
                <tr key={r.m}>
                  <td>{monthLabel(r.m)}</td>
                  <td className="n">{num(r.t)}</td>
                  <td className="n">{r.a ? num(r.a) : '—'}</td>
                  <td className="n">{r.i ? num(r.i) : '—'}</td>
                  <td className="n">{r.z ? num(r.z) : '—'}</td>
                  <td className="n"><b>{num(r.all)}</b></td>
                  <td className="n" style={{ color: r.net == null ? undefined : r.net >= 0 ? GREEN : RED }}>{r.net == null ? '—' : (r.net >= 0 ? '+' : '') + num(r.net)}</td>
                  <td className="n muted">{r.check ? num(r.check) : '—'}</td>
                  <td className="n muted">{num(r.perday)}</td>
                  <td className="n muted">{r.cReg != null ? dec(r.cReg) + '%' : '—'}</td>
                  <td className="n muted">{r.cPay != null ? r.cPay + '%' : '—'}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line)' }}>
                <td>Итого факт</td><td className="n">{num(totFact.t)}</td><td className="n">{num(totFact.a)}</td><td className="n">{num(totFact.i)}</td><td className="n">{num(totFact.z)}</td>
                <td className="n">{num(totFact.all)}</td><td className="n" style={{ color: GREEN }}>+{num(netCum)}</td>
                <td className="n muted">{num(tw.avg_check)}</td><td className="n muted">—</td><td className="n muted">—</td><td className="n muted">—</td>
              </tr>
              {fcRows.map((r) => (
                <tr key={r.m} style={{ color: 'var(--dim)' }}>
                  <td>{monthLabel(r.m)} · прогноз</td><td className="n">{num(r.t)}</td><td className="n">{r.a ? num(r.a) : '—'}</td><td className="n">—</td><td className="n">{r.z ? num(r.z) : '—'}</td>
                  <td className="n">{num(r.all)}</td><td className="n" colSpan={5}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {note('Вся картина деньгами в одной таблице: по месяцам с итогом, ниже прогнозные строки продлений. «Чистыми» это за вычетом расхода Директа, «Конв. в рег.» это клик→регистрация, «Конв. в оплату» это регистрация→оплата.')}
      </Card>

      <div className="grid cols2">
        <Card title="Топ-клиенты и риск оттока" hint="Timeweb, по сумме оплат за историю">
          <div className="scroll tall">
            <table>
              <thead><tr><th>Клиент</th><th className="n">Оплат</th><th className="n">Сумма, ₽</th><th className="n">Ср. чек, ₽</th><th>Статус</th></tr></thead>
              <tbody>
                {(tw.top_clients || []).slice(0, 12).map((c) => (
                  <tr key={c.login}>
                    <td className="mono">{c.login}</td><td className="n muted">{c.cnt}</td><td className="n">{num(c.sum)}</td>
                    <td className="n muted">{c.cnt ? num(Math.round(c.sum / c.cnt)) : '—'}</td>
                    <td>{c.risk ? <span className="tag" style={{ borderColor: RED, color: RED }}>риск</span> : <span className="dim">{c.status}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {note(`Под риском оттока: ${num(tw.churn_risk?.cnt)} клиентов на ${num(tw.churn_risk?.sum)} ₽ (скоро истекает оплата, продление не подтверждено). Их стоит трогать напоминанием в первую очередь.`)}
        </Card>
        <Card title="Реклама Директа: P&L, ₽" hint="полный расход за период, обе партнёрки">
          <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            <Kpi label="Расход Директа, ₽" value={num(ads.total.spend)} sub={`${num(ads.total.clicks)} кликов`} />
            <Kpi label="CPC, ₽" value={num(ads.total.cpc)} sub={`CTR ${dec(ads.total.ctr)}%`} />
            <Kpi label="CPL, ₽" value={num(ads.total.cpl)} sub="расход / регистрация" />
            <Kpi label="CAC, ₽" value={num(ads.total.cac)} sub="расход / платящий" />
          </div>
          {note(`Возврат на рекламу ROAS ${dec(derived.roas)}, окупаемость ${derived.payback} мес. TW-расход ${num(ads.total.tw_spend)}, AdminVPS ${num(ads.total.av_spend)}. Это полный расход из кабинета, шире живого окна на «Маркетинге».`)}
        </Card>
      </div>

      <div className="grid cols2">
        <Card title="Timeweb, детально" hint="из кабинета, вся история со склейкой OLD">
          <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            <Kpi label="Всего получено, ₽" value={num(tw.total)} sub={`${num(tw.cnt)} оплат`} />
            <Kpi label="Регистрации" value={num(tw.regs)} sub={`платящих ${num(tw.payers)}`} />
            <Kpi label="Активных плательщиков" value={num(tw.active_paying)} sub={`из ${num(tw.active)} активных`} />
            <Kpi label="LTV, ₽" value={num(tw.ltv)} sub={`ср. чек ${num(tw.avg_check)}`} />
          </div>
        </Card>
        <Card title="AdminVPS, детально" hint="журнал операций, только доход">
          <div className="grid kpis" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
            <Kpi label="Всего получено, ₽" value={num(avps.total)} sub={`${num(avps.cnt)} начислений`} />
            <Kpi label="Регистрации" value={num(avps.regs)} sub={`активных ${num(avps.active)}`} />
            <Kpi label="Отвал" value={dec(avps.churn_pct) + '%'} sub={`${num(avps.churn)} из ${num(avps.regs)}`} />
            <Kpi label="Доход на активного, ₽" value={num(avps.income_per_active)} sub="в среднем" />
          </div>
          {Array.isArray(avps.tariffs) && avps.tariffs.length ? (
            <table style={{ marginTop: 10 }}>
              <thead><tr><th>Тариф</th><th className="n">Рег.</th><th className="n">Доход, ₽</th></tr></thead>
              <tbody>
                {(() => { const mx = Math.max(1, ...avps.tariffs.map((t) => t.income)); return [...avps.tariffs].sort((a, b) => b.income - a.income).slice(0, 6).map((t) => (
                  <tr key={t.k}><td>{t.k}</td><td className="n muted">{num(t.regs)}</td><BarCell value={t.income} max={mx} /></tr>
                )); })()}
              </tbody>
            </table>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
