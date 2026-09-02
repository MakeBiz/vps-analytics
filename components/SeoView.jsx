'use client';
import { useMemo, useState } from 'react';
import { num } from '@/lib/format';
import { Card, Kpi, Empty } from '@/components/ui';

const YA = '#c6a15b';   // Яндекс — латунь
const GO = '#5b7a99';   // Google — сталь
const GOOD = '#6cbf8b';
const WARN = '#d9a441';
const STEEL = '#5b7a99';
const BAD = '#d1697a';
const ENG_RU = { yandex: 'Яндекс', google: 'Google' };
const pct = (n) => (Math.round((Number(n) || 0) * 10) / 10).toFixed(1) + '%';

// Мусорные строки Google Search Console: операторные запросы конкурентной разведки
// (site:, -site:, длинные булевы конструкции) — это не реальные пользователи, прячем.
const isJunk = (q) => !q || /site:/i.test(q) || q.length > 90;

// Цвет и подпись позиции: топ-3 / топ-10 / 11–30 / за топ-30.
const posColor = (p) => (p == null ? 'var(--dim)' : p <= 3 ? GOOD : p <= 10 ? WARN : p <= 30 ? STEEL : 'var(--dim)');
const posBucket = (p) => (p == null ? null : p <= 3 ? 'top3' : p <= 10 ? 'top10' : p <= 30 ? 'p30' : 'tail');

// ISO-3166 alpha-3 (как отдаёт GSC) → русское название. Неизвестное — код заглавными.
const CMAP = {
  rus: 'Россия', ukr: 'Украина', blr: 'Беларусь', kaz: 'Казахстан', usa: 'США', are: 'ОАЭ',
  deu: 'Германия', gbr: 'Великобритания', fra: 'Франция', nld: 'Нидерланды', pol: 'Польша',
  esp: 'Испания', ita: 'Италия', tur: 'Турция', ind: 'Индия', chn: 'Китай', jpn: 'Япония',
  kor: 'Ю. Корея', bra: 'Бразилия', can: 'Канада', aus: 'Австралия', irn: 'Иран', isr: 'Израиль',
  che: 'Швейцария', swe: 'Швеция', idn: 'Индонезия', vnm: 'Вьетнам', sgp: 'Сингапур',
  hkg: 'Гонконг', uzb: 'Узбекистан', aze: 'Азербайджан', geo: 'Грузия', arm: 'Армения',
  mda: 'Молдова', lva: 'Латвия', ltu: 'Литва', est: 'Эстония', fin: 'Финляндия', cze: 'Чехия',
  rou: 'Румыния', bgr: 'Болгария', grc: 'Греция', prt: 'Португалия', aut: 'Австрия', bel: 'Бельгия',
  irl: 'Ирландия', nor: 'Норвегия', dnk: 'Дания', hun: 'Венгрия', ukr2: 'Украина', mex: 'Мексика',
  egy: 'Египет', sau: 'Сауд. Аравия', pak: 'Пакистан', tha: 'Таиланд', mys: 'Малайзия', phl: 'Филиппины',
  zaf: 'ЮАР', nga: 'Нигерия', kgz: 'Киргизия', tjk: 'Таджикистан', tkm: 'Туркмения',
};
const cname = (c) => CMAP[(c || '').toLowerCase()] || (c || '').toUpperCase();

// Целевые ключи для «слежения» (RU + EN, тема VPS/сервер). Матчим подстрокой по запросам.
const TARGETS = [
  'vps', 'впс', 'аренда vps', 'vps сервер', 'vps хостинг', 'виртуальный сервер', 'vds',
  'выделенный сервер', 'подбор сервера', 'калькулятор сервера', 'конфигуратор сервера',
  'server calculator', 'vps calculator', 'vps hosting', 'dedicated server', 'cloud server',
];

function Sparkline({ points, color = YA, w = 220, h = 40 }) {
  if (!points || points.length < 2) return <div className="dim" style={{ fontSize: 11 }}>динамика появится со временем</div>;
  const vals = points.map((p) => p[1]);
  const max = Math.max(1, ...vals), min = Math.min(...vals);
  const n = points.length;
  const X = (i) => (n > 1 ? (i / (n - 1)) * (w - 4) + 2 : 2);
  const Y = (v) => h - 3 - ((v - min) / (max - min || 1)) * (h - 8);
  const line = points.map((p, i) => `${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polygon points={`2,${h - 3} ${line} ${X(n - 1)},${h - 3}`} fill={color} opacity="0.12" />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(n - 1)} cy={Y(vals[n - 1])} r="2.6" fill={color} />
    </svg>
  );
}

// Горизонтальные бары (гео/страны).
function Bars({ rows, label, sub, color = GO, max }) {
  const mx = max || Math.max(1, ...rows.map((r) => r.v));
  if (!rows.length) return <div className="empty">нет данных</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
            <span>{label(r)}</span><span className="mono">{num(r.v)}{sub ? <span className="dim" style={{ fontSize: 11 }}> {sub(r)}</span> : null}</span>
          </div>
          <div style={{ background: 'var(--panel-2)', borderRadius: 5, height: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <div style={{ width: Math.max(2, Math.round((r.v / mx) * 100)) + '%', height: '100%', background: color, opacity: 0.9 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────── ВКЛАДКА: ПОЗИЦИИ ───────────────────────────
function PositionsTab({ pool }) {
  const [eng, setEng] = useState('all'); // all | yandex | google
  const [sort, setSort] = useState({ k: 'impressions', d: -1 });

  const rows = useMemo(() => pool.filter((x) => x.position != null && !isJunk(x.q)), [pool]);
  const scoped = useMemo(() => (eng === 'all' ? rows : rows.filter((x) => x.engine === eng)), [rows, eng]);

  // Распределение позиций по движкам
  const dist = useMemo(() => {
    const d = { yandex: { top3: 0, top10: 0, p30: 0, tail: 0 }, google: { top3: 0, top10: 0, p30: 0, tail: 0 } };
    for (const x of rows) { const b = posBucket(x.position); if (b) d[x.engine][b]++; }
    return d;
  }, [rows]);

  const best = useMemo(() => scoped.filter((x) => x.position <= 10).sort((a, b) => a.position - b.position).slice(0, 25), [scoped]);
  const opp = useMemo(() => scoped.filter((x) => x.position > 10 && x.position <= 30).sort((a, b) => b.impressions - a.impressions).slice(0, 25), [scoped]);

  const full = useMemo(() => {
    const cmp = {
      impressions: (a, b) => a.impressions - b.impressions,
      clicks: (a, b) => a.clicks - b.clicks,
      position: (a, b) => a.position - b.position,
    };
    return [...scoped].sort((a, b) => (cmp[sort.k] ? cmp[sort.k](a, b) * sort.d : 0)).slice(0, 200);
  }, [scoped, sort]);
  const sortBy = (k) => setSort((s) => (s.k === k ? { k, d: -s.d } : { k, d: k === 'position' ? 1 : -1 }));
  const [showFull, setShowFull] = useState(false);

  // Целевые ключи: лучшая позиция по каждому таргету среди выбранного пула
  const targets = useMemo(() => TARGETS.map((t) => {
    const hits = rows.filter((x) => x.q.toLowerCase().includes(t));
    if (!hits.length) return { t, none: true };
    const bestHit = hits.reduce((a, b) => (a.position <= b.position ? a : b));
    return { t, ...bestHit };
  }), [rows]);

  const DistCol = ({ label, color, d }) => {
    const tot = d.top3 + d.top10 + d.p30 + d.tail || 1;
    const seg = [['top3', GOOD, 'Топ-3'], ['top10', WARN, '4–10'], ['p30', STEEL, '11–30'], ['tail', 'var(--dim)', '30+']];
    return (
      <div>
        <div style={{ fontSize: 12.5, color, fontWeight: 600, marginBottom: 8 }}>{label} · {tot} запр.</div>
        <div style={{ display: 'flex', height: 14, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--line)' }}>
          {seg.map(([k, c]) => d[k] ? <div key={k} title={`${d[k]}`} style={{ width: (d[k] / tot) * 100 + '%', background: c }} /> : null)}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 7, fontSize: 12 }}>
          {seg.map(([k, c, l]) => (
            <span key={k} style={{ color: 'var(--dim)' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: c, marginRight: 5 }} />
              {l}: <b style={{ color: 'var(--text)' }}>{d[k]}</b>
            </span>
          ))}
        </div>
      </div>
    );
  };

  const QTable = ({ list, showSort }) => (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>Запрос</th><th>Движок</th><th>Сайт</th>
            <th className="n" style={showSort ? { cursor: 'pointer', color: sort.k === 'impressions' ? 'var(--brass)' : undefined } : undefined} onClick={showSort ? () => sortBy('impressions') : undefined}>Показы</th>
            <th className="n" style={showSort ? { cursor: 'pointer', color: sort.k === 'clicks' ? 'var(--brass)' : undefined } : undefined} onClick={showSort ? () => sortBy('clicks') : undefined}>Клики</th>
            <th className="n" style={showSort ? { cursor: 'pointer', color: sort.k === 'position' ? 'var(--brass)' : undefined } : undefined} onClick={showSort ? () => sortBy('position') : undefined}>Позиция</th>
          </tr>
        </thead>
        <tbody>
          {list.map((x, i) => (
            <tr key={i}>
              <td><span className="trunc" title={x.q}>{x.q}</span></td>
              <td style={{ color: x.engine === 'yandex' ? YA : GO, fontSize: 12 }}>{ENG_RU[x.engine]}</td>
              <td className="dim" style={{ fontSize: 12 }}>{x.name}</td>
              <td className="n muted">{num(x.impressions)}</td>
              <td className="n">{num(x.clicks)}</td>
              <td className="n" style={{ color: posColor(x.position), fontWeight: 600 }}>{x.position.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!rows.length) return <Empty text="Позиций пока нет — кабинеты ещё копят данные по запросам. Появятся автоматически." />;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title="Где мы в выдаче" hint="распределение позиций по всем запросам, где сайты ранжируются (Яндекс.Вебмастер + Google Search Console)">
        <div className="grid cols2" style={{ gap: 20 }}>
          <DistCol label="Яндекс" color={YA} d={dist.yandex} />
          <DistCol label="Google" color={GO} d={dist.google} />
        </div>
      </Card>

      <Card title="Целевые ключи" hint="лучшая позиция по ключевым темам среди запросов, попавших в выборку кабинетов. «—» — тема пока не в выборке (мало показов)">
        <div className="scroll">
          <table>
            <thead><tr><th>Ключ</th><th>Лучшая позиция</th><th>Движок</th><th>Сайт</th><th className="n">Показы</th></tr></thead>
            <tbody>
              {targets.map((t, i) => (
                <tr key={i}>
                  <td>{t.t}</td>
                  <td style={{ color: posColor(t.none ? null : t.position), fontWeight: 600 }}>{t.none ? '—' : t.position.toFixed(1)}</td>
                  <td style={{ color: t.none ? 'var(--dim)' : t.engine === 'yandex' ? YA : GO, fontSize: 12 }}>{t.none ? '' : ENG_RU[t.engine]}</td>
                  <td className="dim" style={{ fontSize: 12 }}>{t.none ? '' : t.name}</td>
                  <td className="n muted">{t.none ? '' : num(t.impressions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="chips" style={{ margin: '0' }}>
        {[['all', 'Все движки'], ['yandex', 'Яндекс'], ['google', 'Google']].map(([k, l]) => (
          <button key={k} className={'chip' + (eng === k ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setEng(k)}>{l}</button>
        ))}
      </div>

      <div className="grid cols2" style={{ gap: 14 }}>
        <Card title="Лучшие позиции" hint="где мы в топ-10 — наши сильные запросы">
          {best.length ? <QTable list={best} /> : <Empty text="В топ-10 пока нет запросов под этот фильтр." />}
        </Card>
        <Card title="На пороге топа" hint="позиции 11–30 с показами — куда дожать контентом, чтобы выйти в топ">
          {opp.length ? <QTable list={opp} /> : <Empty text="Запросов на позициях 11–30 под этот фильтр нет." />}
        </Card>
      </div>

      <Card title={`Все запросы с позициями (${full.length})`} hint="полный список, сортируется по клику на заголовок">
        <div onClick={() => setShowFull((v) => !v)} style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: showFull ? 10 : 0 }}>
          {showFull ? 'Свернуть ▾' : 'Показать таблицу ▸'}
        </div>
        {showFull ? <QTable list={full} showSort /> : null}
      </Card>
    </div>
  );
}

// ─────────────────────────── ВКЛАДКА: ИНДЕКСАЦИЯ ───────────────────────────
function IndexingTab({ list }) {
  const Sev = ({ problems }) => {
    const map = [['FATAL', BAD, 'фатальные'], ['CRITICAL', BAD, 'критичные'], ['POSSIBLE_PROBLEM', WARN, 'возможные'], ['RECOMMENDATION', STEEL, 'рекоменд.']];
    const items = map.filter(([k]) => (problems || {})[k]);
    if (!items.length) return <span className="dim" style={{ fontSize: 12 }}>проблем нет</span>;
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {items.map(([k, c, l]) => (
          <span key={k} style={{ fontSize: 11.5, color: c, border: '1px solid var(--line)', borderRadius: 5, padding: '1px 7px' }}>{l}: {problems[k]}</span>
        ))}
      </div>
    );
  };
  const Stat = ({ big, label, color }) => (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{big}</div>
      <div className="dim" style={{ fontSize: 11.5 }}>{label}</div>
    </div>
  );

  return (
    <div className="grid cols2" style={{ gap: 14 }}>
      {list.map((s) => {
        const y = s.y?.indexing || {};
        const g = s.g || {};
        const smSub = (g.sitemaps || []).reduce((a, m) => a + (m.submitted || 0), 0);
        return (
          <Card key={s.host} title={s.name} hint={s.host}>
            <div className="grid cols2" style={{ gap: 16 }}>
              <div>
                <div style={{ fontSize: 12.5, color: YA, fontWeight: 600, marginBottom: 10 }}>Яндекс</div>
                <div style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
                  <Stat big={y.searchable != null ? num(y.searchable) : '—'} label="в поиске" color={YA} />
                  <Stat big={y.excluded != null ? num(y.excluded) : '—'} label="исключено" />
                  <Stat big={y.sqi ? num(y.sqi) : '—'} label="ИКС" />
                </div>
                <Sev problems={y.problems} />
                <div style={{ marginTop: 10 }}>
                  <div className="dim" style={{ fontSize: 11, marginBottom: 3 }}>страниц в поиске Яндекса — динамика</div>
                  <Sparkline points={y.history} color={YA} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: GO, fontWeight: 600, marginBottom: 10 }}>Google</div>
                <div style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
                  <Stat big={g.pagesInSearch != null ? num(g.pagesInSearch) : '—'} label="страниц в выдаче" color={GO} />
                  <Stat big={smSub ? num(smSub) : '—'} label="в карте сайта" />
                </div>
                {g.sitemaps && g.sitemaps.length ? (
                  <div className="dim" style={{ fontSize: 11.5 }}>
                    {g.sitemaps.map((m, i) => (
                      <div key={i} style={{ marginBottom: 2 }}>
                        <span className="trunc" title={m.path} style={{ maxWidth: 200, display: 'inline-block', verticalAlign: 'bottom' }}>{(m.path || '').replace(/^https?:\/\//, '')}</span>
                        {' — '}{num(m.submitted)} URL{m.errors ? <span style={{ color: BAD }}> · ошибок {m.errors}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : <div className="dim" style={{ fontSize: 11.5 }}>карта сайта в GSC не найдена</div>}
                <div className="dim" style={{ fontSize: 11, marginTop: 10 }}>
                  «в выдаче» — сколько уникальных страниц реально показывались в Google за окно снимка.
                </div>
              </div>
            </div>
          </Card>
        );
      })}
      {list.length === 0 ? <Card><Empty text="Нет данных индексации." /></Card> : null}
    </div>
  );
}

// ─────────────────────────── ВКЛАДКА: ГЕО ───────────────────────────
function GeoTab({ list }) {
  const combined = useMemo(() => {
    const agg = {};
    for (const s of list) for (const c of s.g?.countries || []) {
      const k = c.country;
      const a = agg[k] || (agg[k] = { country: k, impressions: 0, clicks: 0, wpos: 0 });
      a.impressions += c.impressions; a.clicks += c.clicks; a.wpos += (c.position || 0) * (c.impressions || 0);
    }
    return Object.values(agg).map((a) => ({ ...a, position: a.impressions ? a.wpos / a.impressions : null }))
      .sort((a, b) => b.impressions - a.impressions);
  }, [list]);

  const totalImp = combined.reduce((s, c) => s + c.impressions, 0);
  const top = combined.slice(0, 15);

  if (!combined.length) return <Empty text="Гео пока нет — данные по странам приходят из Google Search Console, наберутся по мере показов." />;

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title="География выдачи" hint="показы, клики и средняя позиция по странам — из Google Search Console. Для международных сайтов (servercalc.com, serverselection.online) это карта присутствия в мире.">
        <div className="grid cols2" style={{ gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>Топ стран по показам</div>
            <Bars rows={top.map((c) => ({ v: c.impressions, c }))} label={(r) => cname(r.c.country)}
                  sub={(r) => `· поз. ${r.c.position ? r.c.position.toFixed(0) : '—'}`} color={GO} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>Таблица</div>
            <div className="scroll tall">
              <table>
                <thead><tr><th>Страна</th><th className="n">Показы</th><th className="n">Доля</th><th className="n">Клики</th><th className="n">Ср. позиция</th></tr></thead>
                <tbody>
                  {combined.map((c, i) => (
                    <tr key={i}>
                      <td>{cname(c.country)}</td>
                      <td className="n">{num(c.impressions)}</td>
                      <td className="n muted">{totalImp ? Math.round((c.impressions / totalImp) * 100) : 0}%</td>
                      <td className="n">{num(c.clicks)}</td>
                      <td className="n" style={{ color: posColor(c.position) }}>{c.position != null ? c.position.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────── ВКЛАДКА: AI-ВИДИМОСТЬ ───────────────────────────
const ENG_LABEL = { perplexity: 'Perplexity', openai: 'ChatGPT' };

function AIVizTab({ aiviz, nameByHost }) {
  const ourDomains = useMemo(() => Object.keys(nameByHost), [nameByHost]);
  const isOurs = (h) => ourDomains.some((d) => h === d || h.endsWith('.' + d));

  if (!aiviz || !aiviz.engines || !aiviz.engines.length || !(aiviz.questions || []).length) {
    return (
      <Card title="AI-видимость (GEO)" hint="цитируют ли нас ChatGPT и Perplexity по целевым вопросам">
        <div className="note" style={{ margin: 0 }}>
          Зонд готов, но ещё не запускался. Добавь API-ключи Perplexity и/или OpenAI в файл <b>ai-keys.json</b> на Маке
          (папка «Аналитика рынка», рядом с токенами) — и при следующем обновлении зонд сам прогонит целевые вопросы через
          answer-движки и покажет, по каким из них нас цитируют и упоминают. Запускается раз в неделю (платные вызовы API).
          {aiviz && aiviz.note ? <div className="dim" style={{ marginTop: 8, fontSize: 12 }}>Статус: {aiviz.note}</div> : null}
        </div>
      </Card>
    );
  }

  const engines = aiviz.engines;
  const totals = aiviz.totals || {};
  const bySite = aiviz.bySite || {};

  const Badge = ({ cell }) => {
    if (!cell || cell.error) return <span className="dim" style={{ fontSize: 12 }}>ошибка</span>;
    const cited = cell.cited || [], ment = cell.mentioned || [];
    const c = cited.length ? GOOD : ment.length ? WARN : 'var(--dim)';
    const label = cited.length ? 'цитируют' : ment.length ? 'упоминают' : 'нет';
    const who = (cited.length ? cited : ment).map((d) => nameByHost[d] || d).join(', ');
    return (
      <div>
        <span style={{ color: c, fontWeight: 600, fontSize: 12.5 }}>{label}</span>
        {who ? <span className="dim" style={{ fontSize: 11.5 }}> · {who}</span> : null}
        {cell.sources && cell.sources.length ? (
          <div style={{ fontSize: 11, marginTop: 2 }}>
            {cell.sources.slice(0, 6).map((h, i) => (
              <span key={i} style={{ color: isOurs(h) ? GOOD : 'var(--muted)' }}>{h}{i < Math.min(5, cell.sources.length - 1) ? ', ' : ''}</span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card title="AI-видимость (GEO)" hint={`цитируют ли нас answer-движки по целевым вопросам · снимок ${aiviz.generated || ''}`}>
        <div className="grid cols2" style={{ gap: 16 }}>
          {engines.map((e) => {
            const t = totals[e] || { asked: 0, cited: 0, mentioned: 0 };
            return (
              <div key={e} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{ENG_LABEL[e] || e}</div>
                <div style={{ display: 'flex', gap: 22 }}>
                  <div><div style={{ fontSize: 22, fontWeight: 700, color: GOOD }}>{t.cited}<span className="dim" style={{ fontSize: 14, fontWeight: 400 }}> / {t.asked}</span></div><div className="dim" style={{ fontSize: 11.5 }}>цитируют (ссылка на нас)</div></div>
                  <div><div style={{ fontSize: 22, fontWeight: 700, color: WARN }}>{t.mentioned}<span className="dim" style={{ fontSize: 14, fontWeight: 400 }}> / {t.asked}</span></div><div className="dim" style={{ fontSize: 11.5 }}>упоминают (в тексте)</div></div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="По сайтам" hint="в скольких вопросах движок сослался на сайт / упомянул его">
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Сайт</th>{engines.map((e) => <th key={e} className="n">{ENG_LABEL[e] || e}</th>)}</tr>
            </thead>
            <tbody>
              {Object.keys(bySite).map((dom) => (
                <tr key={dom}>
                  <td>{nameByHost[dom] || dom}<div style={{ color: 'var(--muted)', fontSize: 11 }}>{dom}</div></td>
                  {engines.map((e) => {
                    const s = (bySite[dom] || {})[e] || { asked: 0, cited: 0, mentioned: 0 };
                    return <td key={e} className="n"><span style={{ color: s.cited ? GOOD : 'var(--dim)', fontWeight: 600 }}>{s.cited}</span> <span className="dim">цит</span> · <span style={{ color: s.mentioned ? WARN : 'var(--dim)' }}>{s.mentioned}</span> <span className="dim">упом</span></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="По вопросам" hint="что отвечают движки и кого цитируют. Наши домены в источниках подсвечены зелёным — так видно, кого выдают вместо нас">
        <div className="scroll tall">
          <table>
            <thead>
              <tr><th>Вопрос</th>{engines.map((e) => <th key={e}>{ENG_LABEL[e] || e}</th>)}</tr>
            </thead>
            <tbody>
              {aiviz.questions.map((row, i) => (
                <tr key={i}>
                  <td style={{ maxWidth: 260 }}>{row.q}</td>
                  {engines.map((e) => <td key={e}><Badge cell={(row.per || {})[e]} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────── КОРНЕВОЙ КОМПОНЕНТ ───────────────────────────
export default function SeoView({ webmaster = [], gsc = [], aiviz = null, sites = [], wmGenerated, gscGenerated, gscWindow }) {
  const [tab, setTab] = useState('positions'); // positions | indexing | geo
  const [site, setSite] = useState('all');     // 'all' | host

  const nameByHost = useMemo(() => Object.fromEntries(sites.map((s) => [s.domain, s.name])), [sites]);

  // Единая структура по хостам
  const bySite = useMemo(() => {
    const map = {};
    for (const s of webmaster) {
      const h = s.host; (map[h] || (map[h] = { host: h })).y = {
        queries: (s.queries || []).map((r) => ({ q: r[0], impressions: +r[1] || 0, clicks: +r[2] || 0, position: r[3] != null ? +r[3] : null, ctr: +r[4] || 0 })),
        indexing: s.indexing || {},
      };
    }
    for (const s of gsc) {
      const h = s.host; (map[h] || (map[h] = { host: h })).g = {
        queries: (s.queries || []).map((q) => ({ q: q.q, impressions: +q.impressions || 0, clicks: +q.clicks || 0, position: q.position != null ? +q.position : null, ctr: (+q.ctr || 0) * 100 })),
        countries: s.countries || [], pagesInSearch: s.pagesInSearch, sitemaps: s.sitemaps || [],
      };
    }
    for (const h in map) map[h].name = nameByHost[h] || h;
    return map;
  }, [webmaster, gsc, nameByHost]);

  // Порядок сайтов — как в списке сайтов панели; только те, по кому есть данные
  const order = useMemo(() => {
    const present = new Set(Object.keys(bySite));
    const ord = sites.map((s) => s.domain).filter((d) => present.has(d));
    for (const h of present) if (!ord.includes(h)) ord.push(h);
    return ord;
  }, [bySite, sites]);

  const scopedHosts = site === 'all' ? order : order.filter((h) => h === site);
  const scopedList = scopedHosts.map((h) => bySite[h]).filter(Boolean);

  // Пул запросов (для вкладки «Позиции») по выбранным сайтам
  const pool = useMemo(() => {
    const out = [];
    for (const s of scopedList) {
      for (const q of s.y?.queries || []) out.push({ ...q, engine: 'yandex', host: s.host, name: s.name });
      for (const q of s.g?.queries || []) out.push({ ...q, engine: 'google', host: s.host, name: s.name });
    }
    return out;
  }, [scopedList]);

  const TABS = [['positions', 'Позиции'], ['indexing', 'Индексация'], ['geo', 'Гео'], ['aiviz', 'AI-видимость']];

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* Панель управления: сайт + вкладка */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="chips" title="Выбор сайта">
            <button className={'chip' + (site === 'all' ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setSite('all')}>Все сайты</button>
            {order.map((h) => (
              <button key={h} className={'chip' + (site === h ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setSite(h)}>{bySite[h].name}</button>
            ))}
          </div>
          <div className="dim" style={{ fontSize: 11.5, textAlign: 'right' }}>
            Вебмастер: {wmGenerated || '—'} · GSC: {gscGenerated || '—'}
            {gscWindow ? <div>окно Google: {gscWindow.from} — {gscWindow.to}</div> : null}
          </div>
        </div>
        <div className="chips" style={{ marginTop: 12 }}>
          {TABS.map(([k, l]) => (
            <button key={k} className={'chip' + (tab === k ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </Card>

      {tab === 'positions' ? <PositionsTab pool={pool} /> : null}
      {tab === 'indexing' ? <IndexingTab list={scopedList} /> : null}
      {tab === 'geo' ? <GeoTab list={scopedList} /> : null}
      {tab === 'aiviz' ? <AIVizTab aiviz={aiviz} nameByHost={nameByHost} /> : null}
    </div>
  );
}
