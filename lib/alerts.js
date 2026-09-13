import { q } from './db';

/**
 * Что показывает колокольчик. Только настоящие сигналы, считанные по данным:
 * выдуманных уведомлений в панели нет, иначе на них перестают смотреть.
 *
 *  1. площадка молчит — событий нет три дня и больше (обычно отвалился счётчик);
 *  2. визиты просели — неделя к неделе минус 30% и больше на заметном объёме;
 *  3. снимок кабинетов устарел — коннектор не отрабатывал двое суток.
 *
 * Любая ошибка здесь гасится: колокольчик не имеет права уронить панель.
 */
const DAY = 86400000;

function ruToIso(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(s || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

export async function buildAlerts(snapshot) {
  const out = [];

  try {
    const rows = await q(`
      select s.key, s.name,
             max(se.started_at) as last_at,
             count(se.id) filter (where se.started_at >= now() - interval '7 days')::int as w1,
             count(se.id) filter (where se.started_at >= now() - interval '14 days'
                                    and se.started_at <  now() - interval '7 days')::int as w0
        from sites s
        left join sessions se on se.site_id = s.id and se.is_bot = false
       where s.archived = false and s.key <> 'serverselection'
       group by 1, 2
       order by 2`);

    for (const r of rows) {
      if (!r.last_at) {
        out.push({
          level: 'bad', title: r.name, href: '/sites',
          text: 'ни одного визита: проверьте счётчик и перезапись /px на сайте',
        });
        continue;
      }
      const quiet = Math.floor((Date.now() - new Date(r.last_at).getTime()) / DAY);
      if (quiet >= 3) {
        out.push({
          level: 'bad', title: r.name, href: '/sites',
          text: `молчит ${quiet} дн.: событий не приходит, счётчик мог отвалиться`,
        });
        continue;
      }
      if (r.w0 >= 20 && r.w1 < r.w0 * 0.7) {
        out.push({
          level: 'warn', title: r.name, href: `/?site=${r.key}&d=30d`,
          text: `визиты упали на ${Math.round((1 - r.w1 / r.w0) * 100)}% неделя к неделе: ${r.w0} → ${r.w1}`,
        });
      }
    }
  } catch (e) {
    // тишина намеренная: без сигналов панель работает, со сломанной шапкой нет
  }

  const iso = ruToIso(snapshot && snapshot.generated);
  if (iso) {
    const age = Math.floor((Date.now() - Date.parse(iso + 'T00:00:00Z')) / DAY);
    if (age >= 2) {
      out.push({
        level: 'warn', title: 'Снимок кабинетов устарел', href: '/direct',
        text: `собран ${snapshot.generated}, это ${age} дн. назад: запустите обновление коннектора`,
      });
    }
  }

  return out;
}
