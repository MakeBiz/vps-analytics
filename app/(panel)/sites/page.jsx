import { headers } from 'next/headers';
import { providerList, sites } from '@/lib/query';
import { Card } from '@/components/ui';
import { addSite, saveProvider, saveSite } from './actions';

export const dynamic = 'force-dynamic';

export default async function Sites() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'panel.example';
  const origin = `https://${host}`;
  const [list, provs] = await Promise.all([sites(), providerList()]);

  return (
    <div className="grid">
      <Card title="Сайты" hint="ключ подставляется в счётчик, по нему события попадают в нужный сайт">
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Название</th><th>Домен</th><th>Ключ</th><th>В архиве</th><th /></tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td colSpan={5} style={{ padding: 0, borderBottom: '1px solid var(--line-soft)' }}>
                    <form action={saveSite} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 9px', flexWrap: 'wrap' }}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="text" name="name" defaultValue={s.name} size={20} />
                      <input type="text" name="domain" defaultValue={s.domain} size={22} />
                      <code className="tag">{s.key}</code>
                      <label className="muted" style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 12.5 }}>
                        <input type="checkbox" name="archived" defaultChecked={s.archived} /> архив
                      </label>
                      <button className="ghost" type="submit">Сохранить</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={addSite} style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <input type="text" name="name" placeholder="Название нового сайта" size={22} required />
          <input type="text" name="domain" placeholder="домен, например vpsdeals.ru" size={22} />
          <input type="text" name="key" placeholder="ключ (необязательно)" size={16} />
          <button type="submit">Добавить сайт</button>
        </form>
      </Card>

      <Card title="Как подключить сайт" hint="две правки, ни одна не ломает вёрстку">
        <p className="note">
          <b>Шаг 1.</b> В <code>vercel.json</code> сайта добавьте раздел <code>rewrites</code>. Он делает сборщик
          первопартийным: браузер обращается к адресу самого сайта, поэтому блокировщики рекламы и политика
          <code> connect-src &apos;self&apos;</code> его не трогают.
        </p>
        <pre>{`"rewrites": [
  { "source": "/px/:path*", "destination": "${origin}/px/:path*" }
]`}</pre>
        <p className="note">
          <b>Шаг 2.</b> В <code>&lt;head&gt;</code> каждой страницы добавьте одну строку, подставив ключ нужного сайта:
        </p>
        <pre>{`<script defer src="/px/t.js" data-site="КЛЮЧ_САЙТА"></script>`}</pre>
        <p className="note">
          Дальше счётчик всё делает сам: визиты, страницы, переходы по внешним ссылкам с определением провайдера,
          текстом кнопки и меткой места. Дополнительно из кода сайта можно слать свои события:
        </p>
        <pre>{`window.px && window.px.event('calc_result', { task: 'сайты' });`}</pre>
        <p className="note">
          Проверить подключение просто: откройте сайт, затем раздел «Журнал событий» — записи появляются сразу.
        </p>
      </Card>

      <Card title="Справочник провайдеров" hint="по хосту назначения переход подписывается провайдером; новые хосты добавляются сюда сами">
        <div className="scroll tall">
          <table>
            <thead><tr><th>Слаг</th><th>Название</th><th>Хосты назначения</th><th /></tr></thead>
            <tbody>
              {provs.map((p) => (
                <tr key={p.slug}>
                  <td colSpan={4} style={{ padding: 0, borderBottom: '1px solid var(--line-soft)' }}>
                    <form action={saveProvider} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 9px', flexWrap: 'wrap' }}>
                      <input type="hidden" name="slug" value={p.slug} />
                      <code className="tag" style={{ minWidth: 90 }}>{p.slug}</code>
                      <input type="text" name="name" defaultValue={p.name} size={18} />
                      <input type="text" name="hosts" defaultValue={(p.hosts || []).join(', ')} size={40} />
                      <button className="ghost" type="submit">Сохранить</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
