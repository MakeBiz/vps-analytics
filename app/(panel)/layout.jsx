import { Suspense } from 'react';
import Nav from '@/components/Nav';
import TopBar from '@/components/TopBar';
import { requireAuth } from '@/lib/auth';
import { hasDb } from '@/lib/db';
import { sites } from '@/lib/query';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }) {
  await requireAuth();
  let list = [];
  let dbError = '';
  if (hasDb) {
    try {
      list = (await sites()).filter((s) => !s.archived);
    } catch (e) {
      dbError = e.message || String(e);
    }
  }
  return (
    <div className="app">
      <Suspense fallback={<aside className="side" />}>
        <Nav />
      </Suspense>
      <div className="main">
        <Suspense fallback={<div className="top" />}>
          <TopBar sites={list} />
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
      </div>
    </div>
  );
}
