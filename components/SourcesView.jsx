'use client';
import { useState } from 'react';
import { Card, Empty } from '@/components/ui';
import ChannelTable from '@/components/ChannelTable';

const num = (n) => Number(n || 0).toLocaleString('ru-RU');
const fp = (x) => (Number(x) || 0).toFixed(1).replace('.', ',') + '%';
const dash = (v) => (v ? v : <span className="dim">—</span>);

/**
 * Вкладка «Источники»: сверху мультивыбор сайтов, ниже каналы захода и разбор
 * по utm-меткам. Фильтр по сайтам и сортировка работают на клиенте, без
 * перезагрузки: данные приходят с сервера уже с разбивкой по сайту.
 */
export default function SourcesView({ channelRows = [], utmRows = [], sites = [] }) {
  const allKeys = sites.map((s) => s.key);
  const [sel, setSel] = useState(() => new Set(allKeys));
  const [sortUtm, setSortUtm] = useState('visits');
  const allOn = sel.size === allKeys.length;

  const clickSite = (k) => setSel((prev) => {
    if (prev.size === allKeys.length) return new Set([k]); // из «Все» → только этот
    const n = new Set(prev);
    n.has(k) ? n.delete(k) : n.add(k);
    return n.size === 0 ? new Set(allKeys) : n;
  });

  // каналы: агрегируем по выбранным сайтам
  const chMap = {};
  for (const r of channelRows) {
    if (!sel.has(r.site_key)) continue;
    const e = chMap[r.channel] || (chMap[r.channel] = { channel: r.channel, visits: 0, visitors: 0, pv: 0, clicks: 0 });
    e.visits += r.visits; e.visitors += r.visitors; e.pv += r.pv; e.clicks += r.clicks;
  }
  const chRows = Object.values(chMap);
  const totalCh = chRows.reduce((s, r) => s + r.visits, 0);

  // разбор по меткам
  const metric = { visits: (r) => r.visits, clicks: (r) => r.clicks, conv: (r) => r.conv };
  const utm = utmRows.filter((r) => sel.has(r.site_key)).map((r) => ({ ...r, conv: r.visits ? (r.clicks / r.visits) * 100 : 0 }));
  const utmSorted = [...utm].sort((a, b) => metric[sortUtm](b) - metric[sortUtm](a));
  const maxUtm = Math.max(1, ...utmSorted.map(metric[sortUtm]));
  const hl = { color: 'var(--brass)' };
  const bar = (active, w, content, primary) => (active
    ? <td className="n barcell"><span className="bg" style={{ width: w + '%' }} /><span className="fg">{content}</span></td>
    : <td className={'n' + (primary ? '' : ' muted')}>{content}</td>);

  return (
    <div className="grid">
      <Card>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="dim" style={{ fontSize: 12, marginRight: 2 }}>сайт:</span>
          <button className={'chip' + (allOn ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => setSel(new Set(allKeys))}>Все</button>
          {sites.map((s) => (
            <button key={s.key} className={'chip' + (!allOn && sel.has(s.key) ? ' on' : '')} style={{ cursor: 'pointer' }} onClick={() => clickSite(s.key)}>{s.name}</button>
          ))}
          <span className="dim" style={{ fontSize: 12, marginLeft: 'auto' }}>фильтр применяется ко всем таблицам ниже</span>
        </div>
      </Card>

      <Card title="Каналы захода" hint="реклама, органика, соцсети, прямые; сортировка по клику. Переходы и конверсия это клик к провайдеру">
        {chRows.length === 0 ? <Empty /> : <ChannelTable rows={chRows} totalVisits={totalCh} />}
      </Card>

      <Card title="Разбор по меткам" hint="source / medium / campaign / content / term; сортировка по клику">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span className="dim" style={{ fontSize: 12, alignSelf: 'center', marginRight: 2 }}>сортировать:</span>
          {[['visits', 'Заходы'], ['clicks', 'Переходы'], ['conv', 'Конверсия']].map(([k, l]) => (
            <button key={k} onClick={() => setSortUtm(k)} className={'chip' + (sortUtm === k ? ' on' : '')} style={{ cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        {utmSorted.length === 0 ? <Empty text="За период не было визитов с метками по выбранным сайтам" /> : (
          <div className="scroll tall">
            <table>
              <thead>
                <tr>
                  <th>Сайт</th><th>source</th><th>medium</th><th>campaign</th><th>content</th><th>term</th>
                  <th className="n" style={sortUtm === 'visits' ? hl : undefined}>Заходы</th>
                  <th className="n" style={sortUtm === 'clicks' ? hl : undefined}>Переходы</th>
                  <th className="n" style={sortUtm === 'conv' ? hl : undefined}>Конверсия</th>
                  <th className="n">С кликом рекламы</th>
                </tr>
              </thead>
              <tbody>
                {utmSorted.map((r, i) => {
                  const w = Math.max(2, Math.round((metric[sortUtm](r) / maxUtm) * 100));
                  return (
                    <tr key={i}>
                      <td className="muted">{r.site_name}</td>
                      <td>{dash(r.utm_source)}</td>
                      <td>{dash(r.utm_medium)}</td>
                      <td><span className="trunc">{dash(r.utm_campaign)}</span></td>
                      <td><span className="trunc">{dash(r.utm_content)}</span></td>
                      <td><span className="trunc">{dash(r.utm_term)}</span></td>
                      {bar(sortUtm === 'visits', w, num(r.visits), true)}
                      {bar(sortUtm === 'clicks', w, num(r.clicks), false)}
                      {bar(sortUtm === 'conv', w, fp(r.conv), false)}
                      <td className="n dim">{num(r.paid)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
