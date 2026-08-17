'use client';
import { useMemo, useState, useTransition } from 'react';
import { savePartners } from '@/app/(panel)/partners/actions';

const BRASS = '#c6a15b';
const STEEL = '#5b7a99';

const FLAG_ICON = { sanction: '🚫', broken: '⚠️', unverified: '❓', ppc: '📣', orphan: '🧩' };

function blockedOn(partner, site) {
  if (site.lang === 'EN' && partner.lang === 'RU') return 'RU-only не идёт на английский сайт';
  const sanctioned = (partner.flags || []).some((f) => f.t === 'sanction');
  if (sanctioned && site.lang === 'EN') return 'санкции OFAC: нельзя в Дубай';
  return '';
}

const STATUS_META = {
  'Зарегистрированы': { c: '#3fae7a', t: 'подключён' },
  'На согласовании': { c: BRASS, t: 'на согласовании' },
  'Не партнёр': { c: '#8a97a5', t: 'не партнёр' },
};

// Фиксированная сетка колонок: суммарно 100%, строки не прыгают
const COLS = [
  { w: '23%' }, // партнёр
  { w: '11%' }, // гео
  { w: '13%' }, // статус
  { w: '9%' },  // сайт 1
  { w: '9%' },  // сайт 2
  { w: '10%' }, // сайт 3
  { w: '7%' },  // вес
  { w: '8%' },  // проверено
  { w: '10%' }, // ссылка
];

export default function PartnerPublishTable({ initial, sites, generated }) {
  const [rows, setRows] = useState(() => initial.map((p) => ({ ...p, pub: { ...(p.pub || {}) } })));
  const [saved, setSaved] = useState('');
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState('');
  const [onlyViol, setOnlyViol] = useState(false);

  const viol = useMemo(() => {
    const list = [];
    for (const p of rows) for (const s of sites) if (p.pub?.[s.id] && blockedOn(p, s)) list.push({ slug: p.slug, site: s.id });
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

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((p) => {
      if (onlyViol && !sites.some((s) => p.pub?.[s.id] && blockedOn(p, s))) return false;
      if (!needle) return true;
      return (p.name + ' ' + (p.country || '')).toLowerCase().includes(needle);
    });
  }, [rows, q, onlyViol, sites]);

  function toggle(slug, siteId) {
    setRows((rs) => rs.map((p) => {
      if (p.slug !== slug) return p;
      const site = sites.find((s) => s.id === siteId);
      if (blockedOn(p, site)) return p;
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
      const pub = { ...p.pub }; let ch = false;
      for (const s of sites) if (pub[s.id] && blockedOn(p, s)) { pub[s.id] = false; ch = true; }
      return ch ? { ...p, pub } : p;
    }));
    setDirty(true); setSaved('');
  }
  function save() {
    const payload = rows.map((p) => ({ slug: p.slug, pub: p.pub, weight: p.weight, verified: p.verified, reminder: p.reminder || '' }));
    start(async () => {
      const res = await savePartners(payload);
      if (res?.ok) { setDirty(false); setSaved(`Сохранено: ${res.saved}${res.stripped ? `, снято по правилам: ${res.stripped}` : ''}`); }
      else setSaved(res?.error === 'nodb' ? 'База не подключена' : 'Не удалось сохранить');
    });
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="note" style={{ margin: 0, maxWidth: 560 }}>
            Какой партнёр на каких сайтах опубликован. Тумблер включает партнёра на сайте, запрещённые
            сочетания заблокированы. Сохранение пишет желаемое состояние в базу панели. Снимок на <b>{generated || '—'}</b>.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {viol.length ? <button onClick={fixViolations} style={btn('#5a2b2b', '#ffd7d7')}>Исправить нарушения ({viol.length})</button> : null}
            <button onClick={save} disabled={pending || !dirty} style={btn(dirty && !pending ? BRASS : '#26313d', dirty && !pending ? '#141a20' : '#93a0ae')}>
              {pending ? 'Сохраняю…' : dirty ? 'Сохранить' : 'Сохранено'}
            </button>
            {saved ? <span className="dim" style={{ fontSize: 12.5 }}>{saved}</span> : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию или стране"
            style={{ flex: '1 1 240px', maxWidth: 300, background: '#141a20', color: '#e6ebf0', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 10px', fontSize: 13 }} />
          <label className="dim" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={onlyViol} onChange={(e) => setOnlyViol(e.target.checked)} /> только нарушения
          </label>
          <span className="chips" style={{ marginLeft: 'auto' }}>
            <span className="tag">всего {counts.total}</span>
            <span className="tag" style={{ borderColor: '#3fae7a', color: '#3fae7a' }}>подключено {counts.reg}</span>
            <span className="tag" style={{ borderColor: BRASS, color: BRASS }}>на согласовании {counts.pend}</span>
            <span className="tag" style={{ borderColor: '#8a97a5', color: '#8a97a5' }}>не партнёр {counts.no}</span>
          </span>
        </div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 8 }}>
          Значки: 🚫 санкции · ⚠️ оффер сломан · ❓ не подтверждён · 📣 ограничения рекламы · 🧩 сирота · ⏰ напоминание · ✕ запрещено правилом
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="scroll">
          <table style={{ tableLayout: 'fixed', width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
            <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: c.w }} />)}</colgroup>
            <thead>
              <tr>
                <th style={thL}>Партнёр</th>
                <th style={thL}>Гео</th>
                <th style={thL}>Статус</th>
                {sites.map((s) => (
                  <th key={s.id} style={thC} title={s.dom}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div className="dim" style={{ fontSize: 10.5, fontWeight: 400 }}>{s.lang}</div>
                  </th>
                ))}
                <th style={thC}>Вес</th>
                <th style={thC}>Проверено</th>
                <th style={thC}>Ссылка</th>
              </tr>
            </thead>
            <tbody>
              {view.map((p) => {
                const sm = STATUS_META[p.status] || { c: '#8a97a5', t: p.status };
                return (
                  <tr key={p.slug} style={{ height: 46 }}>
                    <td style={tdL}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</span>
                        <span style={{ color: p.lang === 'RU' ? STEEL : BRASS, fontSize: 10.5, border: `1px solid ${p.lang === 'RU' ? STEEL : BRASS}`, borderRadius: 4, padding: '0 4px', flexShrink: 0 }}>{p.lang}</span>
                        {p.score ? <span className="dim" style={{ fontSize: 11, flexShrink: 0 }}>{p.score}</span> : null}
                        {(p.flags || []).map((f, i) => <span key={i} title={f.txt} style={{ fontSize: 11.5, flexShrink: 0 }}>{FLAG_ICON[f.t] || '•'}</span>)}
                        {p.reminder ? <span title={p.reminder} style={{ fontSize: 11.5, flexShrink: 0 }}>⏰</span> : null}
                      </div>
                    </td>
                    <td style={tdEllipsis} title={p.country}>{p.country || '—'}</td>
                    <td style={tdL}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 8, background: sm.c, flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5 }}>{sm.t}</span>
                      </span>
                    </td>
                    {sites.map((s) => {
                      const blk = blockedOn(p, s);
                      const on = Boolean(p.pub?.[s.id]);
                      const violated = on && blk;
                      return (
                        <td key={s.id} style={tdC}>
                          <button onClick={() => toggle(p.slug, s.id)} disabled={Boolean(blk)} title={blk || (on ? 'включён' : 'выключен')} style={pill(on, Boolean(blk), violated)}>
                            {blk ? '✕' : on ? 'вкл' : 'выкл'}
                          </button>
                        </td>
                      );
                    })}
                    <td style={tdC}>
                      <input type="number" min={0} max={100} value={p.weight ?? 0} onChange={(e) => setWeight(p.slug, e.target.value)}
                        style={{ width: 50, background: '#141a20', color: '#e6ebf0', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
                    </td>
                    <td style={tdC}>
                      <input type="checkbox" checked={Boolean(p.verified)} onChange={(e) => setVerified(p.slug, e.target.checked)} />
                    </td>
                    <td style={tdC}>
                      {p.ref && p.ref !== '—' && p.ref !== ''
                        ? <a href={p.ref} target="_blank" rel="noreferrer" title={p.ref} style={{ color: STEEL, textDecoration: 'none', fontSize: 15 }}>🔗</a>
                        : <span className="dim" style={{ fontSize: 12 }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thBase = { fontSize: 11.5, color: '#93a0ae', fontWeight: 600, padding: '10px 10px', borderBottom: '1px solid var(--line)', background: '#141a20', position: 'sticky', top: 0 };
const thL = { ...thBase, textAlign: 'left' };
const thC = { ...thBase, textAlign: 'center' };
const tdBase = { padding: '6px 10px', borderBottom: '1px solid #1c242e', verticalAlign: 'middle', fontSize: 13 };
const tdL = { ...tdBase, textAlign: 'left' };
const tdC = { ...tdBase, textAlign: 'center' };
const tdEllipsis = { ...tdBase, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#c3ccd6' };

function btn(bg, color) {
  return { background: bg, color, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' };
}
function pill(on, blocked, violated) {
  let bg = '#1b2430', color = '#8a97a5', border = 'var(--line)';
  if (blocked) { bg = '#20262e'; color = '#5a6570'; }
  else if (on) { bg = 'rgba(63,174,122,.15)'; color = '#3fae7a'; border = '#2f6f52'; }
  if (violated) { bg = 'rgba(224,102,102,.15)'; color = '#e06666'; border = '#7a3b3b'; }
  return { width: 52, background: bg, color, border: `1px solid ${border}`, borderRadius: 6, padding: '4px 0', fontSize: 12, cursor: blocked ? 'not-allowed' : 'pointer' };
}
