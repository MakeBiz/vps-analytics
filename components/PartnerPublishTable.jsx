'use client';
import { useMemo, useState, useTransition } from 'react';
import { savePartners } from '@/app/(panel)/partners/actions';

const BRASS = '#c6a15b';
const STEEL = '#5b7a99';

function blockedOn(partner, site) {
  if (site.lang === 'EN' && partner.lang === 'RU') return 'RU-only не идёт на английский сайт';
  const sanctioned = (partner.flags || []).some((f) => f.t === 'sanction');
  if (sanctioned && site.lang === 'EN') return 'санкции OFAC: нельзя в Дубай';
  return '';
}

const STATUS_COLOR = {
  'Зарегистрированы': '#3fae7a',
  'На согласовании': BRASS,
  'Не партнёр': '#8a97a5',
};

export default function PartnerPublishTable({ initial, sites, generated }) {
  const [rows, setRows] = useState(() =>
    initial.map((p) => ({ ...p, pub: { ...(p.pub || {}) } }))
  );
  const [saved, setSaved] = useState('');
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  const viol = useMemo(() => {
    const list = [];
    for (const p of rows) for (const s of sites) {
      if (p.pub?.[s.id] && blockedOn(p, s)) list.push({ slug: p.slug, site: s.id });
    }
    return list;
  }, [rows, sites]);

  const counts = useMemo(() => {
    const c = { total: rows.length, reg: 0, pend: 0, no: 0 };
    for (const p of rows) {
      if (p.status === 'Зарегистрированы') c.reg++;
      else if (p.status === 'На согласовании') c.pend++;
      else c.no++;
    }
    return c;
  }, [rows]);

  function toggle(slug, siteId) {
    setRows((rs) => rs.map((p) => {
      if (p.slug !== slug) return p;
      const site = sites.find((s) => s.id === siteId);
      if (blockedOn(p, site)) return p; // запрещено — не включаем
      return { ...p, pub: { ...p.pub, [siteId]: !p.pub[siteId] } };
    }));
    setDirty(true); setSaved('');
  }

  function setWeight(slug, val) {
    const w = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    setRows((rs) => rs.map((p) => (p.slug === slug ? { ...p, weight: w } : p)));
    setDirty(true); setSaved('');
  }

  function setVerified(slug, val) {
    setRows((rs) => rs.map((p) => (p.slug === slug ? { ...p, verified: val } : p)));
    setDirty(true); setSaved('');
  }

  function fixViolations() {
    setRows((rs) => rs.map((p) => {
      const pub = { ...p.pub };
      let changed = false;
      for (const s of sites) if (pub[s.id] && blockedOn(p, s)) { pub[s.id] = false; changed = true; }
      return changed ? { ...p, pub } : p;
    }));
    setDirty(true); setSaved('');
  }

  function save() {
    const payload = rows.map((p) => ({
      slug: p.slug, pub: p.pub, weight: p.weight, verified: p.verified, reminder: p.reminder || '',
    }));
    start(async () => {
      const res = await savePartners(payload);
      if (res?.ok) {
        setDirty(false);
        setSaved(`Сохранено: ${res.saved}${res.stripped ? `, снято по правилам: ${res.stripped}` : ''}`);
      } else {
        setSaved(res?.error === 'nodb' ? 'База не подключена — сохранять некуда' : 'Не удалось сохранить');
      }
    });
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="note" style={{ margin: 0, maxWidth: 620 }}>
            Какой партнёр на каких сайтах опубликован. Тумблер включает или выключает партнёра на сайте,
            запрещённые сочетания (RU-only на английском, санкционный в Дубае) заблокированы. Сохранение
            пишет желаемое состояние в базу панели; фактическую выкатку на сайты делает конвейер публикации.
            Снимок на <b>{generated || '—'}</b>.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {viol.length ? (
              <button onClick={fixViolations} style={btn('#5a2b2b', '#ffd7d7')}>
                Исправить нарушения ({viol.length})
              </button>
            ) : null}
            <button onClick={save} disabled={pending || !dirty} style={btn(dirty && !pending ? BRASS : '#26313d', dirty && !pending ? '#141a20' : '#93a0ae')}>
              {pending ? 'Сохраняю…' : dirty ? 'Сохранить' : 'Сохранено'}
            </button>
            {saved ? <span className="dim" style={{ fontSize: 12.5 }}>{saved}</span> : null}
          </div>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          <span className="tag">всего {counts.total}</span>
          <span className="tag" style={{ borderColor: '#3fae7a', color: '#3fae7a' }}>зарегистрировано {counts.reg}</span>
          <span className="tag" style={{ borderColor: BRASS, color: BRASS }}>на согласовании {counts.pend}</span>
          <span className="tag" style={{ borderColor: '#8a97a5', color: '#8a97a5' }}>не партнёр {counts.no}</span>
          {viol.length ? <span className="tag" style={{ borderColor: '#e06666', color: '#e06666' }}>нарушений {viol.length}</span> : null}
        </div>
      </div>

      <div className="card">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Партнёр</th>
                <th>Статус</th>
                {sites.map((s) => (
                  <th key={s.id} className="n" title={s.dom}>
                    {s.name}<br /><span className="dim" style={{ fontSize: 11 }}>{s.lang}</span>
                  </th>
                ))}
                <th className="n">Вес</th>
                <th className="n">Проверено</th>
                <th>Ссылка / напоминание</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.slug}>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {p.name}
                      {p.score ? <span className="dim" style={{ fontWeight: 400, fontSize: 12 }}> · {p.score}</span> : null}
                      <span className="tag" style={{ marginLeft: 6, borderColor: p.lang === 'RU' ? STEEL : BRASS, color: p.lang === 'RU' ? STEEL : BRASS, fontSize: 11 }}>{p.lang}</span>
                    </div>
                    <div className="dim" style={{ fontSize: 11.5 }}>{p.country}</div>
                    {(p.flags || []).map((f, i) => (
                      <div key={i} style={{ fontSize: 11, color: flagColor(f.t), marginTop: 2 }}>▪ {f.txt}</div>
                    ))}
                  </td>
                  <td><span style={{ color: STATUS_COLOR[p.status] || '#8a97a5', fontSize: 12.5 }}>{p.status}</span></td>
                  {sites.map((s) => {
                    const blk = blockedOn(p, s);
                    const on = Boolean(p.pub?.[s.id]);
                    const violated = on && blk;
                    return (
                      <td key={s.id} className="n">
                        <button
                          onClick={() => toggle(p.slug, s.id)}
                          disabled={Boolean(blk)}
                          title={blk || (on ? 'включён' : 'выключен')}
                          style={pill(on, Boolean(blk), violated)}
                        >
                          {blk ? '✕' : on ? 'вкл' : 'выкл'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="n">
                    <input
                      type="number" min={0} max={100} value={p.weight ?? 0}
                      onChange={(e) => setWeight(p.slug, e.target.value)}
                      style={{ width: 54, background: '#141a20', color: '#e6ebf0', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', textAlign: 'right' }}
                    />
                  </td>
                  <td className="n">
                    <input type="checkbox" checked={Boolean(p.verified)} onChange={(e) => setVerified(p.slug, e.target.checked)} />
                  </td>
                  <td style={{ maxWidth: 260 }}>
                    {p.ref && p.ref !== '—' ? (
                      <a href={p.ref} target="_blank" rel="noreferrer" style={{ color: STEEL, fontSize: 12, wordBreak: 'break-all' }}>{p.ref}</a>
                    ) : <span className="dim" style={{ fontSize: 12 }}>ссылки нет</span>}
                    {p.refChecked ? <div className="dim" style={{ fontSize: 11 }}>проверена {p.refChecked}</div> : null}
                    {p.reminder ? <div style={{ fontSize: 11.5, color: BRASS, marginTop: 3 }}>⏰ {p.reminder}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function btn(bg, color) {
  return { background: bg, color, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' };
}
function pill(on, blocked, violated) {
  let bg = '#1b2430', color = '#8a97a5', border = 'var(--line)';
  if (blocked) { bg = '#20262e'; color = '#5a6570'; }
  else if (on) { bg = 'rgba(63,174,122,.15)'; color = '#3fae7a'; border = '#2f6f52'; }
  if (violated) { bg = 'rgba(224,102,102,.15)'; color = '#e06666'; border = '#7a3b3b'; }
  return { minWidth: 46, background: bg, color, border: `1px solid ${border}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: blocked ? 'not-allowed' : 'pointer' };
}
function flagColor(t) {
  if (t === 'sanction') return '#e06666';
  if (t === 'broken') return '#e0a166';
  if (t === 'ppc') return '#8a97a5';
  if (t === 'orphan') return '#c6a15b';
  return '#8a97a5';
}
