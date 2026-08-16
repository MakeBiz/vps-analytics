'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Кнопка «Обновить оплаты» — перечитывает опубликованный снимок оплат.
 * Данные партнёров обновляются по запросу (выгрузки кладутся в папку вручную и
 * пересобираются движком), поэтому кнопка подтягивает последний опубликованный
 * снимок и ставит отметку времени проверки. Живым фидом станет, когда поднимем
 * эндпоинт приёма слоя оплат.
 */
export default function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState('');

  function refresh() {
    setBusy(true);
    start(() => {
      router.refresh();
      const t = new Intl.DateTimeFormat('ru-RU', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).format(new Date());
      setChecked(t);
      setBusy(false);
    });
  }

  const loading = busy || pending;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        onClick={refresh}
        disabled={loading}
        style={{
          background: loading ? '#26313d' : '#c6a15b',
          color: loading ? '#93a0ae' : '#141a20',
          border: '1px solid var(--line)',
          borderRadius: 8,
          padding: '8px 14px',
          fontWeight: 600,
          fontSize: 13.5,
          cursor: loading ? 'default' : 'pointer',
        }}
      >
        {loading ? 'Обновляю…' : 'Обновить оплаты'}
      </button>
      {checked ? <span className="dim" style={{ fontSize: 12.5 }}>проверено в {checked}</span> : null}
    </div>
  );
}
