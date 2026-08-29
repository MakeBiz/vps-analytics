'use client';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import RoyMarketingSpend from '@/components/RoyMarketingSpend';

const rub = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU') + ' ₽';
const GOOD = '#3fae7a';
const RED = '#e0736d';
const stLabel = { active: 'Активная', archived: 'Архивная', excluded: 'Исключена' };
const stStyle = {
  active: { background: 'rgba(63,174,122,.14)', color: '#6cd7a2', borderColor: 'rgba(63,174,122,.35)' },
  archived: { background: 'rgba(217,164,65,.14)', color: '#e8c37a', borderColor: 'rgba(217,164,65,.32)' },
  excluded: { background: 'rgba(224,115,109,.12)', color: '#e79a95', borderColor: 'rgba(224,115,109,.3)' },
};
const nextStatus = { active: 'archived', archived: 'excluded', excluded: 'active' };
const COLORS = ['#c6a15b', '#5b7a99', '#6cbf8b', '#d1697a', '#d9a441', '#7f9dbb', '#b98cc4', '#5bb0b0'];

function Toggle({ on, onClick, title }) {
  // Включено — зелёная; выключено — белый бегунок на нейтральном фоне.
  return (
    <span onClick={onClick} title={title} style={{
      display: 'inline-block', position: 'relative', width: 38, height: 22, borderRadius: 20, cursor: 'pointer',
      background: on ? 'rgba(63,174,122,.55)' : 'var(--panel-2)', border: '1px solid ' + (on ? '#3fae7a' : 'var(--line)'), transition: '.15s',
    }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#ffffff', transition: '.15s' }} />
    </span>
  );
}

export default function ProjectsView({ initial, spend }) {
  const [projects, setProjects] = useState(() => initial.projects.map((p, i) => ({ ...p, color: COLORS[i % COLORS.length] })));
  const [camps, setCamps] = useState(() => initial.campaigns);
  const [delProj, setDelProj] = useState([]);
  const [delCamp, setDelCamp] = useState([]);
  const [archOpen, setArchOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState('provider');

  const revenueMap = useMemo(() => {
    const m = {}; for (const n of initial.net || []) m[n.slug] = n.revenue; return m;
  }, [initial.net]);

  const provs = projects.filter((p) => p.kind === 'provider');
  const sites = projects.filter((p) => p.kind === 'site');
  const activeProvs = provs.filter((p) => !p.archived);
  const activeSites = sites.filter((p) => !p.archived);
  const colorOf = (slug) => projects.find((p) => p.slug === slug)?.color || 'var(--steel)';

  // клиентское разнесение — для живого предпросмотра (сервер пересчитает при сохранении)
  const attr = useMemo(() => {
    const provSet = new Set(activeProvs.map((p) => p.slug));
    const siteSet = new Set(activeSites.map((p) => p.slug));
    const sp = {}; activeProvs.forEach((p) => { sp[p.slug] = 0; });
    const ss = {}; activeSites.forEach((p) => { ss[p.slug] = 0; });
    let sharedP = 0; let sharedS = 0; let counted = 0;
    for (const c of camps) {
      if (c.status === 'excluded' || !c.in_budget) continue;
      counted += c.cost;
      const a = c.alloc;
      if (provSet.has(a)) sp[a] += c.cost; else sharedP += c.cost;
      if (siteSet.has(a)) ss[a] += c.cost; else sharedS += c.cost;
    }
    const perP = activeProvs.length ? sharedP / activeProvs.length : 0;
    activeProvs.forEach((p) => { sp[p.slug] += perP; });
    const perS = activeSites.length ? sharedS / activeSites.length : 0;
    activeSites.forEach((p) => { ss[p.slug] += perS; });
    return { sp, ss, sharedP, sharedS, perP, perS, counted };
  }, [camps, projects]);

  // ---- правки кампаний ----
  const patchCamp = (id, patch) => { setDirty(true); setCamps((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c))); };
  const setStatus = (c, status) => patchCamp(c.id, { status, ...(status === 'excluded' ? { in_budget: false } : {}), is_new: false });
  const removeCamp = (id) => { setDirty(true); setDelCamp((d) => [...d, id]); setCamps((cs) => cs.filter((c) => c.id !== id)); };

  // ---- правки проектов ----
  const patchProj = (id, patch) => { setDirty(true); setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p))); };
  const addProject = () => {
    const name = newName.trim(); if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9а-я]+/gi, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36).slice(-4);
    setDirty(true);
    setProjects((ps) => [...ps, { id: null, slug, name, kind: newKind, roy_key: '', archived: false, sort: 900, color: COLORS[ps.length % COLORS.length] }]);
    setNewName('');
  };
  const removeProject = (p) => { setDirty(true); if (p.id) setDelProj((d) => [...d, p.id]); setProjects((ps) => ps.filter((x) => x !== p)); };

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const body = {
        projects: projects.map((p, i) => ({ id: p.id, slug: p.slug, name: p.name, kind: p.kind, roy_key: p.roy_key, archived: p.archived, sort: p.sort ?? i })),
        deletedProjects: delProj,
        settings: camps.map((c) => ({ campaign_id: c.id, status: c.status, in_budget: c.in_budget, alloc: c.alloc })),
        deletedCampaigns: delCamp,
      };
      const r = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
      setMsg('Сохранено'); setDirty(false); setDelProj([]); setDelCamp([]);
      setTimeout(() => setMsg(''), 2500);
    } catch (e) { setMsg('Ошибка: ' + (e.message || e)); }
    setSaving(false);
  };

  const allocSelect = (c) => {
    const isNew = c.is_new;
    return (
      <select value={c.alloc} onChange={(e) => patchCamp(c.id, { alloc: e.target.value, is_new: false })}
        style={{ background: 'var(--panel-2)', color: 'var(--text)', colorScheme: 'dark', border: '1px solid ' + (isNew ? 'var(--brass)' : 'var(--line)'), borderRadius: 8, padding: '5px 7px', fontSize: 12.5, maxWidth: 210 }}>
        <option value="split">Общая — поровну на всё</option>
        <optgroup label="Провайдер">{activeProvs.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</optgroup>
        <optgroup label="Сайт">{activeSites.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</optgroup>
      </select>
    );
  };

  const campRow = (c) => (
    <tr key={c.id} style={c.status === 'excluded' ? { opacity: 0.5 } : undefined}>
      <td>
        {c.is_new ? <span style={{ ...stStyle.active, background: 'rgba(198,161,91,.18)', color: 'var(--brass)', borderColor: 'rgba(198,161,91,.4)', fontSize: 11, padding: '2px 8px', borderRadius: 20, border: '1px solid', marginRight: 6 }}>новая</span> : null}
        {c.name}
        <div style={{ color: 'var(--muted)', fontSize: 11 }}>№ {c.id}{!c.present ? ' · нет в снимке' : ''}</div>
      </td>
      <td>{allocSelect(c)}</td>
      <td>
        <select value={c.status} onChange={(e) => setStatus(c, e.target.value)}
          style={{ ...stStyle[c.status], colorScheme: 'dark', fontSize: 12.5, padding: '4px 8px', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontWeight: 500 }}>
          <option value="active">Активная</option>
          <option value="archived">Архивная</option>
          <option value="excluded">Исключена</option>
        </select>
      </td>
      <td style={{ textAlign: 'center' }}><Toggle on={c.in_budget} onClick={() => patchCamp(c.id, { in_budget: !c.in_budget })} title="учитывать в бюджете" /></td>
      <td className="n">{rub(c.cost)}</td>
      <td><span onClick={() => removeCamp(c.id)} title="удалить" style={{ color: 'var(--muted)', cursor: 'pointer', padding: '2px 6px' }}>✕</span></td>
    </tr>
  );

  const active = camps.filter((c) => c.status === 'active');
  const archived = camps.filter((c) => c.status !== 'active');
  const head = (
    <tr><th>Кампания</th><th>Привязка</th><th>Статус</th><th style={{ textAlign: 'center' }}>В бюджете</th><th className="n">Расход</th><th /></tr>
  );

  const spendBars = (list, spend) => {
    const max = Math.max(1, ...list.map((p) => spend[p.slug] || 0));
    return list.map((p) => (
      <div key={p.slug} style={{ margin: '9px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
          <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: p.color, marginRight: 7 }} />{p.name}</span>
          <span className="n" style={{ fontWeight: 600 }}>{rub(spend[p.slug] || 0)}</span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: 'var(--panel-2)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: Math.round((spend[p.slug] || 0) / max * 100) + '%', background: p.color }} />
        </div>
      </div>
    ));
  };

  const saveBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
      {dirty ? <span style={{ fontSize: 13, color: 'var(--brass)' }}>● есть несохранённые изменения</span> : null}
      {msg ? <span style={{ fontSize: 13, color: msg.startsWith('Ошибка') ? RED : GOOD }}>{msg}</span> : null}
      <button onClick={save} disabled={saving} style={{ background: dirty ? 'linear-gradient(180deg,#c6a15b,#b18e49)' : 'var(--panel-2)', border: '1px solid ' + (dirty ? '#b18e49' : 'var(--line)'), color: dirty ? '#20170a' : 'var(--text)', fontWeight: 600, borderRadius: 9, padding: '9px 18px', cursor: 'pointer', fontSize: 13.5, opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Сохраняю…' : 'Сохранить'}
      </button>
    </div>
  );

  return (
    <div className="grid" style={{ gap: 14 }}>
      {/* РАСХОД НА РЕКЛАМУ (снимок по сохранённым отметкам) */}
      {spend ? <RoyMarketingSpend spend={spend} /> : null}

      {/* ПРОЕКТЫ */}
      <Card title="Проекты" hint="Два уровня: провайдеры (под них считаем net-роялти) и сайты. Архивный проект не участвует в разнесении.">
        <div style={{ marginBottom: 12 }}>{saveBar}</div>
        {[['provider', 'Провайдеры'], ['site', 'Сайты']].map(([kind, label]) => (
          <div key={kind} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {projects.filter((p) => p.kind === kind).map((p) => (
                <span key={p.id ?? p.slug} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 22, border: '1px solid var(--line)', background: 'var(--panel-2)', fontSize: 13, opacity: p.archived ? 0.5 : 1 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: p.color }} />{p.name}
                  {kind === 'provider' ? (
                    <input value={p.roy_key || ''} onChange={(e) => patchProj(p.id, { roy_key: e.target.value })} placeholder="roy" title="ключ дохода в royalties.json (tw/avps/ish/aeza)"
                      style={{ width: 44, background: 'var(--panel)', color: 'var(--dim)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 5px', fontSize: 11 }} />
                  ) : null}
                  <span onClick={() => patchProj(p.id, { archived: !p.archived })} style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 11, border: '1px solid var(--line)', borderRadius: 12, padding: '1px 7px' }}>{p.archived ? 'вернуть' : 'в архив'}</span>
                  <span onClick={() => removeProject(p)} style={{ cursor: 'pointer', color: 'var(--muted)' }} title="удалить">✕</span>
                </span>
              ))}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Новый проект" style={{ minWidth: 200, background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', fontSize: 13 }} />
          <select value={newKind} onChange={(e) => setNewKind(e.target.value)} style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 9px', fontSize: 13 }}>
            <option value="provider">Провайдер</option>
            <option value="site">Сайт</option>
          </select>
          <button onClick={addProject} style={{ background: 'var(--panel-2)', border: '1px solid var(--line)', color: 'var(--text)', borderRadius: 9, padding: '8px 14px', cursor: 'pointer', fontSize: 13 }}>+ Добавить</button>
        </div>
      </Card>

      {/* АКТИВНЫЕ КАМПАНИИ */}
      <Card title="Активные кампании Директа" hint={`Тянутся автоматически при утреннем прогоне. Расход — накопительно с ${initial.since || '2026-02-01'} (не за 30 дней). Новые — сверху с пометкой «новая».`}>
        <div className="scroll"><table><thead>{head}</thead>
          <tbody>{active.length ? active.map(campRow) : <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>активных кампаний нет</td></tr>}</tbody>
        </table></div>
      </Card>

      {/* АРХИВ */}
      <Card title={<span onClick={() => setArchOpen((v) => !v)} style={{ cursor: 'pointer' }}>Архив кампаний ({archived.length}) {archOpen ? '▾' : '▸'}</span>} hint="Архивные и исключённые — не мешают наверху. По галке решаешь, учитывать их расход в бюджете.">
        {archOpen ? (
          <div className="scroll"><table><thead>{head}</thead>
            <tbody>{archived.length ? archived.map(campRow) : <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>архив пуст</td></tr>}</tbody>
          </table></div>
        ) : <div className="note" style={{ margin: 0 }}>Свёрнуто. Нажми заголовок, чтобы раскрыть {archived.length} кампан.</div>}
      </Card>

      <div className="note" style={{ margin: 0 }}>
        Доход и рентабельность по провайдерам — в блоке «Расход на рекламу» вверху (обновляются после «Сохранить»). Расход — накопительный с {initial.since || '2026-02-01'}.
      </div>
    </div>
  );
}
