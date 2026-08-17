'use client';
import { useMemo, useState, useTransition } from 'react';
import { savePartners } from '@/app/(panel)/partners/actions';

const BRASS = '#c6a15b';
const STEEL = '#5b7a99';

const FLAG_ICON = { sanction: '🚫', broken: '⚠️', unverified: '❓', ppc: '📣', orphan: '🧩' };

// Пояснения к значкам и колонкам: что это и что делать
const FLAG_HELP = {
  sanction: { title: '🚫 Санкции', body: 'Партнёр под санкциями (OFAC). Его нельзя размещать на английском/дубайском сайте, только на российских. Действие: держать выключенным на ServerSelection, оставить на РФ-сайтах.' },
  broken: { title: '⚠️ Оффер сломан', body: 'Текущая реф-ссылка или программа платит не так, как нужно (например только за Shared, а не VPS, либо не платит за продления). Действие: получить допсоглашение или перейти на правильную программу (например Agency), после этого снять значок.' },
  unverified: { title: '❓ Не подтверждён', body: '«Не подтверждён» значит, что мы не зафиксировали главное — сколько партнёр платит (ставку комиссии) и на какой срок (разово или пожизненно/recurring). Пока это неизвестно, нельзя понять, выгодно ли его продвигать.\n\nЧто сделать:\n1) открыть страницу его партнёрской программы (кнопка ниже),\n2) войти в кабинет партнёра,\n3) найти ставку по VPS и срок выплат,\n4) вписать их и поставить галочку «Проверено».' },
  ppc: { title: '📣 Ограничения рекламы', body: 'У партнёра есть правила по контекстной рекламе (обычно запрет ставок по бренду или требование письменного согласования). Действие: учитывать это в кампаниях Директа и Google, чтобы не нарушить и не потерять выплаты.' },
  orphan: { title: '🧩 Сирота', body: 'Партнёр стоит на сайте, но его нет в списке официальных партнёров, либо решено его не добавлять. Действие: определиться — убрать с сайта или оформить партнёрство.' },
};
const HELP = {
  verified: { title: '✓ Колонка «Проверено»', body: 'Отмечает, что ты лично сверил партнёра: реф-ссылка открывается и ведёт в нужный кабинет, а ставка и срок выплат актуальны. Ставь галочку после того, как проверил ссылку и условия. Снятая галочка означает «нужно перепроверить» — условия могли устареть или ссылку ещё не сверяли.' },
  status: { title: 'Колонка «Статус»', body: 'Подключён — мы зарегистрированы в партнёрке и можем получать выплаты. На согласовании — заявка подана, ждём одобрения. Не партнёр — не работаем с ними или решили не добавлять.' },
  sites: { title: 'Тумблеры по сайтам', body: 'Показывают, на каких наших сайтах опубликован партнёр. вкл — виден на сайте, выкл — скрыт. ✕ — сочетание запрещено правилом (RU-only партнёр не идёт на английский сайт, санкционный не идёт в Дубай), включить нельзя.' },
};

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

const COLS = [
  { w: '23%' }, { w: '11%' }, { w: '13%' },
  { w: '9%' }, { w: '9%' }, { w: '10%' },
  { w: '7%' }, { w: '8%' }, { w: '10%' },
];

export default function PartnerPublishTable({ initial, sites, generated }) {
  const [rows, setRows] = useState(() => initial.map((p) => ({ ...p, pub: { ...(p.pub || {}) } })));
  const [saved, setSaved] = useState('');
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState('');
  const [onlyViol, setOnlyViol] = useState(false);
  const [help, setHelp] = useState(null); // {title, body}

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <span className="dim" style={{ fontSize: 11.5 }}>Нажми на значок за пояснением:</span>
          {Object.entries(FLAG_ICON).map(([t, icon]) => (
            <button key={t} onClick={() => setHelp(FLAG_HELP[t])} style={legendChip}>
              {icon} {FLAG_HELP[t].title.replace(/^\S+\s/, '')}
            </button>
          ))}
          <button onClick={() => setHelp(HELP.verified)} style={legendChip}>✓ проверено</button>
          <button onClick={() => setHelp(HELP.sites)} style={legendChip}>вкл/выкл/✕ сайты</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {help ? (
          <div style={{ margin: 12, padding: '12px 14px', border: `1px solid ${BRASS}`, borderRadius: 8, background: 'rgba(198,161,91,.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <b style={{ color: BRASS }}>{help.title}</b>
              <button onClick={() => setHelp(null)} style={{ background: 'none', border: 'none', color: '#93a0ae', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ fontSize: 13, marginTop: 6, color: '#d3dae1', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{help.body}</div>
            {help.link ? (
              <a href={help.link.url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 10, background: BRASS, color: '#141a20', fontWeight: 600, fontSize: 12.5, textDecoration: 'none', borderRadius: 6, padding: '6px 12px' }}>
                {help.link.label} ↗
              </a>
            ) : null}
          </div>
        ) : null}
        <div className="scroll">
          <table style={{ tableLayout: 'fixed', width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
            <colgroup>{COLS.map((c, i) => <col key={i} style={{ width: c.w }} />)}</colgroup>
            <thead>
              <tr>
                <th style={thL}>Партнёр</th>
                <th style={thL}>Гео</th>
                <th style={thL}>Статус <HelpDot onClick={() => setHelp(HELP.status)} /></th>
                {sites.map((s) => (
                  <th key={s.id} style={thC} title={s.dom}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div className="dim" style={{ fontSize: 10.5, fontWeight: 400 }}>{s.lang}</div>
                  </th>
                ))}
                <th style={thC}>Вес</th>
                <th style={thC}>Проверено <HelpDot onClick={() => setHelp(HELP.verified)} /></th>
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
                        {(p.flags || []).map((f, i) => (
                          <button key={i} onClick={() => setHelp(rowFlagHelp(p, f))} title="нажми за пояснением" style={iconBtn}>{FLAG_ICON[f.t] || '•'}</button>
                        ))}
                        {p.reminder ? <button onClick={() => setHelp({ title: '⏰ Напоминание', body: p.reminder })} title="нажми за пояснением" style={iconBtn}>⏰</button> : null}
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

// Пояснение к значку в конкретной строке: общий смысл + текущие данные партнёра + ссылка
function rowFlagHelp(p, f) {
  const base = FLAG_HELP[f.t] || { title: 'Замечание', body: '' };
  const rate = (p.rate || '').trim() || 'не заполнена';
  const term = (p.term || '').trim() || 'не указан';
  let body = base.body;
  body += `\n\nСейчас у «${p.name}»: ставка — ${rate}; срок выплат — ${term}.`;
  if (f.txt) body += `\nЗамечание по партнёру: ${f.txt}`;
  const url = (p.prog && p.prog !== '') ? p.prog : ((p.ref && p.ref !== '—' && p.ref !== '') ? p.ref : '');
  const link = url ? { url, label: `Открыть партнёрскую программу «${p.name}»` } : null;
  return { title: base.title, body, link };
}

function HelpDot({ onClick }) {
  return (
    <button onClick={onClick} title="что это значит" style={{ width: 16, height: 16, borderRadius: 16, border: `1px solid ${BRASS}`, background: 'transparent', color: BRASS, fontSize: 10.5, lineHeight: '14px', padding: 0, cursor: 'pointer', verticalAlign: 'middle' }}>?</button>
  );
}

const thBase = { fontSize: 11.5, color: '#93a0ae', fontWeight: 600, padding: '10px 10px', borderBottom: '1px solid var(--line)', background: '#141a20', position: 'sticky', top: 0 };
const thL = { ...thBase, textAlign: 'left' };
const thC = { ...thBase, textAlign: 'center' };
const tdBase = { padding: '6px 10px', borderBottom: '1px solid #1c242e', verticalAlign: 'middle', fontSize: 13 };
const tdL = { ...tdBase, textAlign: 'left' };
const tdC = { ...tdBase, textAlign: 'center' };
const tdEllipsis = { ...tdBase, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#c3ccd6' };
const iconBtn = { background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer', fontSize: 12.5, flexShrink: 0, lineHeight: 1 };
const legendChip = { background: '#1b2430', border: '1px solid var(--line)', color: '#c3ccd6', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, cursor: 'pointer' };

function btn(bg, color) {
  return { background: bg, color, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' };
}
function pill(on, blocked, violated) {
  let bg = '#1b2430', color = '#8a97a5', border = 'var(--line)';
  if (blocked) { bg = '#20262e'; color = '#5a6570'; }
  else if (on) { bg = 'rgba(63,174,122,.15)'; color = '#3fae7a'; border = '#2f6f52'; }
  if (violated) { bg = 'rgba(224,102,102,.15)'; color = '#e06666'; border = '#7a3b3b'; }
  return { width: 52, background: bg, color, border: `1px solid ${border}`, padding: '4px 0', borderRadius: 6, fontSize: 12, cursor: blocked ? 'not-allowed' : 'pointer' };
}
