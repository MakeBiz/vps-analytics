import { parseFilters } from '@/lib/filters';
import { num, pct } from '@/lib/format';
import { bySite, funnelEvents } from '@/lib/query';
import { Card, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

const BRASS = '#c6a15b';
const STEEL = '#5b7a99';
const GREEN = '#3fae7a';

// Один шаг воронки: полоса шириной от первого шага + число + % от верха + отвал от предыдущего
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
  const f = parseFilters(await searchParams);
  const [siteRows, fe] = await Promise.all([bySite(f), funnelEvents(f)]);

  // сводим события в map: site_key -> {ev: sessions}
  const evBy = new Map();
  for (const r of fe) {
    if (!evBy.has(r.site_key)) evBy.set(r.site_key, {});
    evBy.get(r.site_key)[r.ev] = r.sessions;
  }
  const anyEv = fe.length > 0;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div className="note" style={{ margin: 0 }}>
          Путь пользователя по каждому сайту и где теряются люди. Трафик-воронка (визиты → просмотры → переходы к провайдеру)
          считается из наших данных за период. Воронки «Калькулятор» и «Акции» собираются из событий калькулятора и промокодов —
          они копятся с момента, когда мы включили отправку этих шагов в аналитику, поэтому первые дни могут быть неполными.
          {!anyEv ? <><br /><b style={{ color: BRASS }}>Шаги калькулятора и акций пока не накопились</b> — данные появятся после выката и первых заходов.</> : null}
        </div>
      </Card>

      {siteRows.length === 0 ? <Card><Empty /></Card> : siteRows.map((s) => {
        const ev = evBy.get(s.key) || {};
        const traffic = [
          { label: 'Визиты', value: s.visits },
          { label: 'Просмотры страниц', value: s.pv },
          { label: 'Переходы к провайдеру', value: s.clicks },
        ];
        const calc = [
          { label: 'Начал подбор (calc_start)', value: ev.calc_start || 0 },
          { label: 'Получил результат (calc_result)', value: ev.calc_result || 0 },
          { label: 'Клик к партнёру из результатов (calc_click)', value: ev.calc_click || 0 },
        ];
        const promo = [
          { label: 'Скопировал промокод (promo_copy)', value: ev.promo_copy || 0 },
          { label: 'Перешёл по промокоду (promo_click)', value: ev.promo_click || 0 },
        ];
        const calcHas = calc.some((x) => x.value > 0);
        const promoHas = promo.some((x) => x.value > 0);
        const convClick = s.visits > 0 ? pct(s.clicks, s.visits) : '0%';

        return (
          <Card key={s.key} title={s.name} hint={`конверсия визит → переход ${convClick}`}>
            <div className="grid cols2" style={{ gap: 16 }}>
              <div>
                <div style={{ fontSize: 12.5, color: STEEL, fontWeight: 600, marginBottom: 8 }}>Трафик сайта</div>
                <Steps steps={traffic} color={STEEL} />
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
    </div>
  );
}
