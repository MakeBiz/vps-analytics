'use client';
import { useMemo, useState } from 'react';
import { num } from '@/lib/format';
import { Card, Kpi, Empty } from '@/components/ui';

const YA = '#c6a15b';   // Яндекс — латунь
const GO = '#5b7a99';   // Google — сталь
const SEV = { bad: '#d1697a', warn: '#d9a441', good: '#6cbf8b', steel: '#5b7a99' };
const pctF = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const convColor = (v) => (v >= 12 ? SEV.good : v >= 6 ? SEV.warn : 'var(--dim)');
const ENG_RU = { yandex: 'Яндекс', google: 'Google' };

// Линия на каждый сайт: rows = [{d, [siteKey]: visits}], series = [{key,name,color}].
// При наведении показываем вертикальную линию и всплывающие цифры по каждому сайту за день.
function Line({ rows, series }) {
  const [hi, setHi] = useState(null);
  const n = rows.length;
  const W = 320, H = 92;
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => r[s.key] || 0)));
  const X = (i) => (n > 1 ? (i / (n - 1)) * W : 0);
  const Y = (v) => H - ((v || 0) / max) * (H - 8) - 4;
  const pts = (key) => rows.map((r, i) => `${X(i).toFixed(1)},${Y(r[key]).toFixed(1)}`).join(' ');
  const empty = series.length === 0 || rows.every((r) => series.every((s) => !r[s.key]));
  if (empty) return <div className="empty">Органических визитов за период пока нет</div>;
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    let i = Math.round(((e.clientX - rect.left) / rect.width) * (n - 1));
    setHi(Math.max(0, Math.min(n - 1, i)));
  };
  const leftPct = hi != null ? (X(hi) / W) * 100 : 0;
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHi(null)}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
           style={{ display: 'block', cursor: 'crosshair' }} onMouseMove={onMove}>
        {hi != null && <line x1={X(hi)} x2={X(hi)} y1="0" y2={H} stroke="var(--line)" strokeWidth="1" />}
        {series.map((s) => (
          <polyline key={s.key} points={pts(s.key)} fill="none" stroke={s.color} strokeWidth="2" />
        ))}
      </svg>
      {hi != null && (
        <div style={{
          position: 'absolute', top: -6, left: `${leftPct}%`,
          transform: `translateX(${leftPct > 70 ? '-100%' : leftPct < 30 ? '0' : '-50%'})`,
          background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 8,
          padding: '7px 10px', fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 3,
          boxShadow: '0 6px 20px rgba(0,0,0,.35)',
        }}>
          <div className="dim" style={{ fontSize: 11, marginBottom: 4 }}>{rows[hi].d}</div>
          {series.map((s) => (
            <div key={s.key} style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
              <span><b style={{ color: s.color }}>—</b> {s.name}</span>
              <span className="mono" style={{ fontWeight: 600 }}>{num(rows[hi][s.key] || 0)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="dim" style={{ fontSize: 11.5, marginTop: 6, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <span key={s.key}><b style={{ color: s.color }}>—</b> {s.name}</span>
        ))}
        <span style={{ marginLeft: 'auto' }}>{rows[0]?.d} … {rows[rows.length - 1]?.d}</span>
      </div>
    </div>
  );
}

function Bars({ rows, label, color = YA, max }) {
  const mx = max || Math.max(1, ...rows.map((r) => r.visits));
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
            <span>{label(r)}</span><span className="mono">{num(r.visits)}</span>
          </div>
          <div style={{ background: 'var(--panel-2)', borderRadius: 5, height: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
            <div style={{ width: Math.max(2, Math.round((r.visits / mx) * 100)) + '%', height: '100%', background: color, opacity: 0.9 }} />
          </div>
        </div>
      ))}
      {rows.length === 0 ? <div className="empty">нет данных</div> : null}
    </div>
  );
}

export default function OrganicView({ rep, total = 0, webmaster = [], gsc = [], wmGenerated, gscGenerated, sites = [], tz }) {
  const nameOf = useMemo(() => Object.fromEntries(sites.map((s) => [s.key, s.name])), [sites]);
  const [qfilter, setQfilter] = useState('all'); // all | yandex | google | opp | lowctr
  const [qsort, setQsort] = useState({ k: 'impressions', d: -1 });

  // Заходы без реферера ('none') движок не несут — оцениваем по сайту:
  // servercalc.com (английский/международный) → Google, русские сайты → Яндекс.
  const engFold = (engine, siteKey) =>
    engine === 'none' ? (siteKey.includes('-com') ? 'google' : 'yandex') : engine;

  const { perSite, tot } = useMemo(() => {
    const bs = {};
    const t = { org: 0, ya: 0, go: 0, ot: 0, clicks: 0, yaC: 0, goC: 0 };
    for (const r of rep.byEngineSite || []) {
      const m = bs[r.site_key] || (bs[r.site_key] = { site_key: r.site_key, yandex: 0, google: 0, other: 0, visits: 0, clicks: 0 });
      const eng = engFold(r.engine, r.site_key);
      const bucket = eng === 'yandex' ? 'yandex' : eng === 'google' ? 'google' : 'other';
      m[bucket] += r.visits; m.visits += r.visits; m.clicks += r.clicks;
      t.org += r.visits; t.clicks += r.clicks;
      if (eng === 'yandex') { t.ya += r.visits; t.yaC += r.clicks; }
      else if (eng === 'google') { t.go += r.visits; t.goC += r.clicks; }
      else t.ot += r.visits;
    }
    return { perSite: Object.values(bs).sort((a, b) => b.visits - a.visits), tot: t };
  }, [rep.byEngineSite]);

  const share = pctF(tot.org, total);
  const conv = pctF(tot.clicks, tot.org);

  // объединяем запросы: Яндекс (Вебмастер) + Google (Search Console)
  const allQ = useMemo(() => {
    const out = [];
    for (const s of webmaster) for (const w of s.queries || []) {
      out.push({ q: w.q, host: s.host, engine: 'yandex', impressions: w.impressions, clicks: w.clicks, ctr: w.impressions ? (w.clicks / w.impressions) * 100 : 0, position: null });
    }
    for (const s of gsc) for (const w of s.queries || []) {
      out.push({ q: w.q, host: s.host, engine: 'google', impressions: w.impressions, clicks: w.clicks, ctr: w.ctr != null && w.ctr > 0 ? w.ctr : (w.impressions ? (w.clicks / w.impressions) * 100 : 0), position: w.position });
    }
    return out;
  }, [webmaster, gsc]);
  const yaQ = useMemo(() => allQ.filter((x) => x.engine === 'yandex'), [allQ]);
  const goQ = useMemo(() => allQ.filter((x) => x.engine === 'google'), [allQ]);

  const qRows = useMemo(() => {
    let r = allQ;
    if (qfilter === 'yandex') r = r.filter((x) => x.engine === 'yandex');
    else if (qfilter === 'google') r = r.filter((x) => x.engine === 'google');
    else if (qfilter === 'opp') r = r.filter((x) => x.position != null && x.position >= 4 && x.position <= 15);
    else if (qfilter === 'lowctr') r = r.filter((x) => x.impressions >= 50 && x.ctr < 3);
    const cmp = { impressions: (a, b) => a.impressions - b.impressions, clicks: (a, b) => a.clicks - b.clicks, ctr: (a, b) => a.ctr - b.ctr, position: (a, b) => (a.position ?? 999) - (b.position ?? 999) };
    return [...r].sort((a, b) => (cmp[qsort.k] ? cmp[qsort.k](a, b) * qsort.d : 0)).slice(0, 120);
  }, [allQ, qfilter, qsort]);
  const sortBy = (k) => setQsort((s) => (s.k === k ? { k, d: -s.d } : { k, d: k === 'position' ? 1 : -1 }));

  const pagesTop = (rep.pages || []).slice(0, 12);

  const recs = useMemo(() => {
    const out = [];
    // Google-запросы у порога топа (позиция 4–15) — подтолкнуть
    goQ.filter((w) => w.position != null && w.position >= 4 && w.position <= 15 && w.impressions >= 20)
      .sort((a, b) => b.impressions - a.impressions).slice(0, 2)
      .forEach((w) => out.push({ sev: 'warn', t: `Google, у порога топа: «${w.q}»`, x: `позиция ${w.position.toFixed(1)}, ${num(w.impressions)} показов — дописать раздел под запрос, чтобы выйти в топ-3` }));
    // страницы с органикой, но низкой конверсией
    for (const pg of rep.pages || []) {
      const c = pctF(pg.clicks, pg.visits);
      if (pg.visits >= 8 && c < 8) { out.push({ sev: 'bad', t: `Низкая конверсия: ${pg.path}`, x: `${nameOf[pg.site_key] || pg.site_key} · органика ${pg.visits}, переходов ${pg.clicks} (${c}%) — усилить блоки провайдеров и CTA` }); }
      if (out.length >= 4) break;
    }
    // низкий CTR при высоких показах (любой движок)
    allQ.filter((w) => w.impressions >= 50 && w.ctr < 3).slice(0, 2)
      .forEach((w) => out.push({ sev: 'warn', t: `Низкий CTR (${ENG_RU[w.engine]}): «${w.q}»`, x: `${num(w.impressions)} показов, CTR ${w.ctr.toFixed(1)}% — переписать title и description посадочной` }));
    // разрыв движков по сайту
    for (const s of perSite) {
      if (s.visits >= 10 && s.google === 0 && s.yandex > 0) out.push({ sev: 'steel', t: `${nameOf[s.site_key] || s.site_key}: нет органики Google`, x: `${s.yandex} визитов из Яндекса, из Google 0 — проверить индексацию в Google Search Console` });
    }
    return out.slice(0, 7);
  }, [goQ, allQ, rep.pages, perSite, nameOf]);

  const cityMax = Math.max(1, ...(rep.cities || []).map((c) => c.visits));

  // Динамика по дням в разрезе САЙТОВ: сводим строки {d, site_key, visits} в
  // {d, [siteKey]: visits} и оставляем только сайты с органикой, каждому — свой цвет.
  const daySeries = useMemo(() => {
    const palette = ['#c6a15b', '#5b7a99', '#6cbf8b', '#d1697a', '#d9a441', '#7f9dbb'];
    const byD = {};
    const totals = {};
    for (const r of rep.byDay || []) {
      (byD[r.d] || (byD[r.d] = { d: r.d }))[r.site_key] = r.visits;
      totals[r.site_key] = (totals[r.site_key] || 0) + r.visits;
    }
    const rows = Object.values(byD).sort((a, b) => (a.d < b.d ? -1 : 1));
    const series = Object.keys(totals)
      .filter((k) => totals[k] > 0)
      .sort((a, b) => totals[b] - totals[a])
      .map((k, i) => ({ key: k, name: nameOf[k] || k, color: palette[i % palette.length] }));
    return { rows, series };
  }, [rep.byDay, nameOf]);

  return (
    <div className="grid" style={{ gap: 14 }}>
      <Card>
        <div className="note" style={{ margin: 0 }}>
          Бесплатный поиск по нашим сайтам: сколько визитов и переходов даёт органика, из Яндекса и Google, по каким
          страницам и городам, и что подкрутить. Заходы без реферера (это не реклама — просто браузер не передал источник)
          относим к движку по сайту: servercalc.com → Google, русские сайты → Яндекс (оценка, точный движок поисковик не передал).
          Трафик, гео и конверсия — живьём из пикселя за период. Поисковые запросы: Яндекс — из Вебмастера{wmGenerated ? ` (снимок ${wmGenerated})` : ''}, Google — из Search Console
          {gscGenerated ? ` (снимок ${gscGenerated})` : (gsc.length ? '' : ' (подключается)')}.
        </div>
      </Card>

      {/* KPI */}
      <div className="grid kpis">
        <Kpi label="Органика всего" value={num(tot.org)} sub={`${share}% от всех заходов`} />
        <Kpi label="Яндекс" value={num(tot.ya)} sub={`${pctF(tot.ya, tot.org)}% органики`} />
        <Kpi label="Google" value={num(tot.go)} sub={`${pctF(tot.go, tot.org)}% органики`} />
        <Kpi label="Конверсия в переход" value={conv + '%'} sub={`${num(tot.clicks)} переходов`} />
      </div>

      {/* Динамика */}
      <Card title="Динамика органики" hint="визиты по дням, линия на каждый сайт">
        <Line rows={daySeries.rows} series={daySeries.series} />
      </Card>

      {/* Поисковые запросы: Яндекс + Google вместе — вынесены наверх */}
      <Card title="Поисковые запросы" hint="Яндекс (Вебмастер) и Google (Search Console) вместе">
        <div className="chips" style={{ margin: '0 0 12px' }}>
          {[['all', 'Все'], ['yandex', 'Яндекс'], ['google', 'Google'], ['opp', 'Позиция 4–15'], ['lowctr', 'Низкий CTR']].map(([k, l]) => (
            <button key={k} className={'chip' + (qfilter === k ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setQfilter(k)}>{l}</button>
          ))}
        </div>
        {allQ.length === 0 ? (
          <Empty text="Запросов пока нет — сайты молодые и ещё почти не ранжируются. Наполнится по мере роста; Google-запросы — когда коннектор начнёт писать данные Search Console" />
        ) : (
          <div className="scroll tall">
            <table>
              <thead>
                <tr>
                  <th>Запрос</th><th>Движок</th><th>Сайт</th>
                  <th className="n" style={{ cursor: 'pointer', color: qsort.k === 'impressions' ? 'var(--brass)' : undefined }} onClick={() => sortBy('impressions')}>Показы</th>
                  <th className="n" style={{ cursor: 'pointer', color: qsort.k === 'clicks' ? 'var(--brass)' : undefined }} onClick={() => sortBy('clicks')}>Клики</th>
                  <th className="n" style={{ cursor: 'pointer', color: qsort.k === 'ctr' ? 'var(--brass)' : undefined }} onClick={() => sortBy('ctr')}>CTR</th>
                  <th className="n" style={{ cursor: 'pointer', color: qsort.k === 'position' ? 'var(--brass)' : undefined }} onClick={() => sortBy('position')}>Позиция</th>
                </tr>
              </thead>
              <tbody>
                {qRows.map((w, i) => (
                  <tr key={i}>
                    <td>{w.q}</td>
                    <td style={{ color: w.engine === 'yandex' ? YA : GO, fontSize: 12 }}>{ENG_RU[w.engine]}</td>
                    <td className="dim" style={{ fontSize: 12 }}>{w.host}</td>
                    <td className="n muted">{num(w.impressions)}</td>
                    <td className="n">{num(w.clicks)}</td>
                    <td className="n" style={{ color: w.impressions >= 50 && w.ctr < 3 ? SEV.warn : undefined }}>{w.ctr.toFixed(1)}%</td>
                    <td className="n" style={{ color: w.position != null && w.position >= 4 && w.position <= 15 ? SEV.warn : undefined }}>{w.position != null ? w.position.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
          Позиция по Яндексу появится, когда добавим её в коннектор Вебмастера. По Google позиция и CTR приходят из Search Console.
        </div>
      </Card>

      {/* По сайтам */}
      <Card title="Органика по сайтам" hint="визиты → переходы → конверсия, с разбивкой по движку">
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Сайт</th><th className="n">Визиты</th><th className="n">Яндекс</th><th className="n">Google</th><th className="n">Переходы</th><th className="n">Конверсия</th></tr>
            </thead>
            <tbody>
              {perSite.map((s) => {
                const c = pctF(s.clicks, s.visits);
                return (
                  <tr key={s.site_key}>
                    <td>{nameOf[s.site_key] || s.site_key}</td>
                    <td className="n">{num(s.visits)}</td>
                    <td className="n muted" style={{ color: s.yandex ? YA : undefined }}>{num(s.yandex)}</td>
                    <td className="n muted" style={{ color: s.google ? GO : undefined }}>{num(s.google)}</td>
                    <td className="n">{num(s.clicks)}</td>
                    <td className="n" style={{ color: convColor(c), fontWeight: 600 }}>{c}%</td>
                  </tr>
                );
              })}
              {perSite.length === 0 ? <tr><td colSpan={6}><Empty text="Органических визитов за период нет" /></td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Страницы входа + География */}
      <div className="grid cols2" style={{ gap: 14 }}>
        <Card title="Страницы входа" hint="топ посадочных по органике и их конверсия">
          <div className="scroll tall">
            <table>
              <thead><tr><th>Страница</th><th>Сайт</th><th className="n">Визиты</th><th className="n">Пер.</th><th className="n">Конв.</th></tr></thead>
              <tbody>
                {pagesTop.map((pg, i) => {
                  const c = pctF(pg.clicks, pg.visits);
                  return (
                    <tr key={i}>
                      <td><span className="trunc" title={pg.path}>{pg.path}</span></td>
                      <td className="dim" style={{ fontSize: 12 }}>{nameOf[pg.site_key] || pg.site_key}</td>
                      <td className="n">{num(pg.visits)}</td>
                      <td className="n muted">{num(pg.clicks)}</td>
                      <td className="n" style={{ color: convColor(c) }}>{c}%</td>
                    </tr>
                  );
                })}
                {pagesTop.length === 0 ? <tr><td colSpan={5}><Empty text="нет данных" /></td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="География органики" hint="топ городов по визитам">
          <Bars rows={(rep.cities || []).map((c) => ({ visits: c.visits, city: c.city, country: c.country }))} label={(r) => `${r.city}${r.country ? ', ' + r.country : ''}`} color={YA} max={cityMax} />
        </Card>
      </div>

      {/* Устройства */}
      <Card title="Устройства органики" hint="по визитам">
        <div className="grid cols2" style={{ gap: 16 }}>
          <div>
            <div style={{ fontSize: 12.5, color: YA, fontWeight: 600, marginBottom: 8 }}>Устройства</div>
            <Bars rows={rep.devices || []} label={(r) => r.k || '—'} color={YA} />
          </div>
          <div>
            <div style={{ fontSize: 12.5, color: GO, fontWeight: 600, marginBottom: 8 }}>ОС</div>
            <Bars rows={rep.oss || []} label={(r) => r.k || '—'} color={GO} />
          </div>
        </div>
      </Card>

      {/* Рекомендации */}
      <Card title="Рекомендации" hint="что подкрутить по органике">
        {recs.length === 0 ? (
          <div className="note" style={{ margin: 0 }}>Пока мало органики для рекомендаций — копим данные. Появятся, как только наберётся трафик и позиции.</div>
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
      </Card>
    </div>
  );
}
