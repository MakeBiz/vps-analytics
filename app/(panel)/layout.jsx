import { Suspense } from 'react';
import Nav from '@/components/Nav';
import TopBar from '@/components/TopBar';
import Icon from '@/components/icons';
import { requireAuth } from '@/lib/auth';
import { hasDb } from '@/lib/db';
import { sites, providerList, lastEventAt } from '@/lib/query';
import { buildAlerts } from '@/lib/alerts';
import snapshot from '@/data/marketing.json';

export const dynamic = 'force-dynamic';

const TZ = 'Asia/Dubai';
const ymd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

// «Данные обновлены» в колонтитуле: время последнего события, а не время сборки
// страницы. Показывать время рендера было бы враньём: оно всегда свежее.
function fmtWhen(ts) {
  if (!ts) return 'событий ещё не было';
  const d = new Date(ts);
  const time = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(d);
  if (ymd(d) === ymd(new Date())) return `сегодня в ${time}`;
  const dm = new Intl.DateTimeFormat('ru-RU', { timeZone: TZ, day: 'numeric', month: 'short' }).format(d);
  return `${dm} в ${time}`;
}

export default async function PanelLayout({ children }) {
  await requireAuth();
  let list = [];
  let provs = [];
  let alerts = [];
  let last = null;
  let dbError = '';
  if (hasDb) {
    try {
      const [all, pl, lt] = await Promise.all([sites(), providerList(), lastEventAt()]);
      list = all.filter((s) => !s.archived);
      provs = pl.map((p) => ({ slug: p.slug, name: p.name }));
      last = lt;
    } catch (e) {
      dbError = e.message || String(e);
    }
    alerts = await buildAlerts(snapshot);
  }
  const ok = hasDb && !dbError;

  return (
    <div className="app">
      <Suspense fallback={<aside className="side" />}>
        <Nav />
      </Suspense>
      <div className="main">
        <Suspense fallback={<div className="top" />}>
          <TopBar sites={list} providers={provs} alerts={alerts} />
        </Suspense>
        <div className="wrap">
          {!hasDb ? (
            <div className="card">
              <h2>База не подключена</h2>
              <p className="note">
                В проекте Vercel не задана переменная <code>DATABASE_URL</code>. Панель уже развёрнута,
                но складывать события некуда. Заведите базу Postgres (Neon в маркетплейсе Vercel,
                бесплатный тариф) и подключите её к проекту, после чего нажмите Redeploy.
              </p>
            </div>
          ) : dbError ? (
            <div className="card">
              <h2>База отвечает ошибкой</h2>
              <pre>{dbError}</pre>
            </div>
          ) : (
            children
          )}
        </div>
        <div className="foot">
          <span><b>Сквозная аналитика</b> v3.0</span>
          <span className="bullet">|</span>
          <span>данные обновлены {fmtWhen(last)}</span>
          <span className="bullet">|</span>
          <span className={'lamp' + (ok ? '' : ' off')}>
            <i />{ok ? 'Все системы работают' : 'База не отвечает'}
          </span>
          <span className="bullet">|</span>
          <span>Помогаем зарабатывать на трафике</span>
          <span className="wave"><Icon name="wave" size={28} /></span>
        </div>
      </div>
    </div>
  );
}
