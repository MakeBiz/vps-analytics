import { passwordSet } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }) {
  const sp = await searchParams;
  const bad = sp?.e === '1';
  if (!passwordSet()) {
    return (
      <div className="login">
        <div className="card">
          <h2>Пароль не задан</h2>
          <p className="note">
            Добавьте в проект Vercel переменную окружения <code>ADMIN_PASSWORD</code> и сделайте Redeploy.
            Пока её нет, панель закрыта для всех.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="login">
      <div className="card">
        <h2>Вход в панель</h2>
        <form action="/api/login" method="post">
          <input
            type="password"
            name="password"
            placeholder="Пароль"
            autoFocus
            style={{ width: '100%', marginBottom: 10 }}
          />
          <button type="submit" style={{ width: '100%' }}>Войти</button>
        </form>
        {bad ? <div className="err">Пароль не подошёл</div> : null}
      </div>
    </div>
  );
}
