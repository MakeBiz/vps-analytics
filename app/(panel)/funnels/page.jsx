import Link from 'next/link';
import { parseFilters } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { funnelTraffic, funnelEvents } from '@/lib/query';
import { Card, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

const BRASS = '#c6a15b';
const STEEL = '#5b7a99';
const GREEN = '#3fae7a';

// Четыре направления: serverselection разбит на EN (корень) и RU (/ru).
const DIRECTIONS = [
  { key: 'podborvps', name: 'ПодборVPS', dom: 'podborvps.ru' },
  { key: 'servercalc-ru', name: 'ServerCalc.ru', dom: 'servercalc.ru' },
  { key: 'serverselection-en', name: 'ServerSelection · EN', dom: 'serverselection.online (Дубай)' },
  { key: 'serverselection-ru', name: 'ServerSelection · RU', dom: 'serverselection.online/ru' },
];

function Steps({ steps, color }) {
  const top = steps[0]?.value || 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const w = top > 0 ? Math.max(3, Math.round((s.value / top) * 100)) : 0;
        const drop = prev != null && prev > 0 ? Math.round((1 - s.value / prev) * 100) : null;
        return (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13 }}>{s.label}</span>
              <span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                <b>{num(s.value)}</b>
                <span className="dim" style={{ fontSize: 11.5, marginLeft: 6 }}>{top > 0 ? pct(s.value, top) : '0%'} от верха</span>
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, background: '#141a20', borderRadius: 6, height: 22, overflow: 'hidden', border: '1px solid var(--line)' }}>
                <div style={{ width: w + '%', height: '100%', background: color, opacity: 0.85 }} />
              </div>
              <span style={{ width: 92, textAlign: 'right', fontSize: 11.5 }} className={drop != null && drop > 0 ? 'down' : 'muted'}>
                {drop != null ? (drop > 0 ? `−${drop}% отвал` : 'без потерь') : ''}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function Funnels({ searchParams }) {
  const sp = (await searchParams) || {};
  const f = parseFilters(sp);
  const dir = typeof sp.dir === 'string' ? sp.dir : 'all';

  const [traffic, fe] = await Promise.all([funnelTraffic(f), funnelEvents(f)]);

  const tBy = new Map(traffic.map((r) => [r.direction, r]));
  const eBy = new Map();
  for (const r of fe) {
    if (!eBy.has(r.direction)) eBy.set(r.direction, {});
    eBy.get(r.direction)[r.ev] = r.sessions;
  }
  const anyEv = fe.length > 0;

  function href(d) {
    const q = new URLSearchParams();
    for (const k of ['d', 'from', 'to', 'tz', 'bots']) if (sp[k]) q.set(k, String(sp[k]));
    if (d && d !== 'all') q.set('dir', d);
    const s = q.toString();
    return '/funnels' + (s ? '?' + s : '');
  }

  const shown = dir === 'all' ? DIRECTIONS : DIRECTIONS.filter((d) => d.key === dir);

  const chip = (active) => ({
    padding: '5px 11px', borderRadius: 8, fontSize: 12.5, textDecoration: 'none',
    border: '1px solid ' + (active ? BRASS : 'var(--line)'),
    background: active ? 'rgba(198,161,91,.14)' : '#1b2430',
    color: active ? BRASS : '#c3ccd6',
  });

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div className="note" style={{ margin: 0 }}>
          Путь пользователя по каждому направлению и где теряются люди. ServerSelection разделён на английскую (Дубай)
          и русскую версии — это четыре разных направления. Трафик-воронка считается из наших данных сразу; воронки
          «Калькулятор» и «Акции» собираются из событий сайта и копятся с момента подключения этих шагов к пикселю.
          {!anyEv ? <><br /><b style={{ color: BRASS }}>Шаги калькулятора и акций пока не накопились</b> — появятся после первых заходов.</> : null}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Link href={href('all')} style={chip(dir === 'all')}>Все направления</Link>
          {DIRECTIONS.map((d) => (
            <Link key={d.key} href={href(d.key)} style={chip(dir === d.key)}>{d.name}</Link>
          ))}
        </div>
      </Card>

      <Card title="Сравнение направлений" hint="конверсия по периоду фильтра">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Направление</th>
                <th className="n">Визиты</th>
                <th className="n">Переходы</th>
                <th className="n">Визит → переход</th>
                <th className="n">Калькулятор: старт → клик</th>
                <th className="n">Акции: копия → переход</th>
              </tr>
            </thead>
            <tbody>
              {DIRECTIONS.map((d) => {
                const t = tBy.get(d.key) || { visits: 0, pv: 0, clicks: 0 };
                const e = eBy.get(d.key) || {};
                const calcConv = e.calc_start ? pct(e.calc_click || 0, e.calc_start) : '—';
                const promoConv = e.promo_copy ? pct(e.promo_click || 0, e.promo_copy) : '—';
                return (
                  <tr key={d.key}>
                    <td>{d.name}</td>
                    <td className="n">{num(t.visits)}</td>
                    <td className="n">{num(t.clicks)}</td>
                    <td className="n">{t.visits ? pct(t.clicks, t.visits) : '0%'}</td>
                    <td className="n muted">{calcConv}</td>
                    <td className="n muted">{promoConv}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {shown.map((d) => {
        const t = tBy.get(d.key) || { visits: 0, pv: 0, clicks: 0 };
        const e = eBy.get(d.key) || {};
        const traf = [
          { label: 'Визиты', value: t.visits },
          { label: 'Просмотры страниц', value: t.pv },
          { label: 'Переходы к провайдеру', value: t.clicks },
        ];
        const calc = [
          { label: 'Начал подбор (calc_start)', value: e.calc_start || 0 },
          { label: 'Получил результат (calc_result)', value: e.calc_result || 0 },
          { label: 'Клик к партнёру из результатов (calc_click)', value: e.calc_click || 0 },
        ];
        const promo = [
          { label: 'Скопировал промокод (promo_copy)', value: e.promo_copy || 0 },
          { label: 'Перешёл по промокоду (promo_click)', value: e.promo_click || 0 },
        ];
        const calcHas = calc.some((x) => x.value > 0);
        const promoHas = promo.some((x) => x.value > 0);
        return (
          <Card key={d.key} title={d.name} hint={d.dom}>
            <div className="grid cols2" style={{ gap: 16 }}>
              <div>
                <div style={{ fontSize: 12.5, color: STEEL, fontWeight: 600, marginBottom: 8 }}>Трафик</div>
                <Steps steps={traf} color={STEEL} />
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: BRASS, fontWeight: 600, marginBottom: 8 }}>Калькулятор</div>
                {calcHas ? <Steps steps={calc} color={BRASS} /> : <div className="empty" style={{ padding: '10px 0' }}>копится с выката</div>}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12.5, color: GREEN, fontWeight: 600, marginBottom: 8 }}>Акции и промокоды</div>
              {promoHas ? <div style={{ maxWidth: 520 }}><Steps steps={promo} color={GREEN} /></div> : <div className="empty" style={{ padding: '10px 0' }}>копится с выката</div>}
            </div>
          </Card>
        );
      })}
      {shown.length === 0 ? <Card><Empty /></Card> : null}
    </div>
  );
}
