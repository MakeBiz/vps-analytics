import Link from 'next/link';
import { parseFilters, qs } from '@/lib/filters';
import { fmtDateTime, num } from '@/lib/format';
import { countryName } from '@/lib/ua';
import { logRows, providerNames } from '@/lib/query';
import { Card, Empty } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TYPES = [
  ['', 'Все события'],
  ['out', 'Переходы к провайдерам'],
  ['pv', 'Просмотры страниц'],
  ['ev', 'Свои события'],
  ['end', 'Уход со страницы'],
];

const TYPE_LABEL = { pv: 'просмотр', out: 'переход', ev: 'событие', end: 'уход' };

const one = (sp, k) => (Array.isArray(sp?.[k]) ? sp[k][0] : sp?.[k] || '');

export default async function Log({ searchParams }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  const type = one(sp, 'type');
  const provider = one(sp, 'provider');
  const search = one(sp, 'q');
  const page = Math.max(0, parseInt(one(sp, 'page') || '0', 10) || 0);
  const per = 100;

  const [{ rows, total }, names] = await Promise.all([
    logRows(f, { page, per, type, provider, search }),
    providerNames(),
  ]);

  const pageLink = (n) => '/log' + qs(f, { type, provider, q: search, page: n || '' });
  const exportHref = '/api/export' + qs(f, { type, provider, q: search });
  const lastPage = Math.max(0, Math.ceil(total / per) - 1);

  return (
    <div className="grid">
      <Card
        title="Журнал событий"
        hint={`${num(total)} записей за период, время показано в ${f.tz}`}
      >
        <form method="get" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input type="hidden" name="tz" value={f.tz} />
          <input type="hidden" name="site" value={f.site} />
          <input type="hidden" name="bots" value={f.bots ? '1' : ''} />
          {f.range === 'custom' ? (
            <>
              <input type="hidden" name="from" value={f.from} />
              <input type="hidden" name="to" value={f.to} />
            </>
          ) : (
            <input type="hidden" name="d" value={f.range} />
          )}
          <select name="type" defaultValue={type}>
            {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input type="text" name="provider" defaultValue={provider} placeholder="провайдер (слаг)" size={16} />
          <input type="search" name="q" defaultValue={search} placeholder="поиск: страница, метка, кнопка" size={28} />
          <button type="submit">Показать</button>
          <a className="btn ghost" href={exportHref}>Выгрузить CSV</a>
        </form>

        {rows.length === 0 ? <Empty /> : (
          <div className="scroll" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Дата и время</th>
                  <th>Сайт</th>
                  <th>Событие</th>
                  <th>Страница</th>
                  <th>Провайдер</th>
                  <th>Кнопка / место</th>
                  <th>Метки</th>
                  <th>Гео</th>
                  <th>Устройство</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(new Date(r.ts), f.tz)}</td>
                    <td className="muted">{r.site}</td>
                    <td>
                      <span className={'tag' + (r.type === 'out' ? ' b' : '')}>
                        {TYPE_LABEL[r.type] || r.type}{r.name ? ': ' + r.name : ''}
                      </span>
                      {r.is_bot ? <span className="tag s" style={{ marginLeft: 4 }}>робот</span> : null}
                    </td>
                    <td className="mono"><span className="trunc" title={r.path}>{r.path}</span></td>
                    <td>
                      {r.provider ? (
                        <Link href={'/providers' + qs(f, { provider: r.provider })}>{names.get(r.provider) || r.provider}</Link>
                      ) : <span className="dim">—</span>}
                      {r.target_host ? <div className="dim mono" style={{ fontSize: 11 }}>{r.target_host}</div> : null}
                    </td>
                    <td>
                      <span className="trunc" title={r.label}>{r.label || <span className="dim">—</span>}</span>
                      {r.placement ? <div><span className="tag">{r.placement}</span></div> : null}
                    </td>
                    <td>
                      {r.utm_source || r.utm_campaign ? (
                        <span className="mono trunc" title={`${r.utm_source} / ${r.utm_medium} / ${r.utm_campaign} / ${r.utm_content}`}>
                          {[r.utm_source, r.utm_medium, r.utm_campaign, r.utm_content].filter(Boolean).join(' / ')}
                        </span>
                      ) : r.referrer_host ? (
                        <span className="mono trunc dim" title={r.referrer_host}>реферер: {r.referrer_host}</span>
                      ) : <span className="dim">прямой (без реферера)</span>}
                      {r.click_id ? <div><span className="tag s">реклама{r.click_id_type ? ' · ' + r.click_id_type : ''}</span></div> : null}
                    </td>
                    <td className="muted">
                      {countryName(r.country)}{r.city ? <div className="dim">{r.city}</div> : null}
                    </td>
                    <td className="muted">{r.device}<div className="dim">{r.browser}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > per ? (
          <div className="pager">
            {page > 0 ? <Link className="btn ghost" href={pageLink(page - 1)}>Назад</Link> : null}
            <span className="muted">Страница {page + 1} из {lastPage + 1}</span>
            {page < lastPage ? <Link className="btn ghost" href={pageLink(page + 1)}>Дальше</Link> : null}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
