import { Pool } from 'pg';

/**
 * Единственная точка доступа к базе.
 * Пул держим в globalThis, чтобы горячая перезагрузка и переиспользование
 * лямбды на Vercel не плодили соединения. Схема создаётся лениво при первом
 * запросе: отдельной команды миграции нет, чтобы не было шага, который легко забыть
 */

const CONN = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

export const hasDb = Boolean(CONN);

function makePool() {
  return new Pool({
    connectionString: CONN,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: CONN.includes('sslmode=') ? undefined : { rejectUnauthorized: false },
  });
}

function pool() {
  if (!CONN) throw new Error('DATABASE_URL не задан');
  if (!globalThis.__pxPool) globalThis.__pxPool = makePool();
  return globalThis.__pxPool;
}

const SCHEMA = `
create table if not exists sites (
  id serial primary key,
  key text unique not null,
  name text not null,
  domain text not null default '',
  created_at timestamptz not null default now(),
  archived boolean not null default false
);

create table if not exists providers (
  slug text primary key,
  name text not null,
  hosts text[] not null default '{}'
);

create table if not exists partner_publish (
  slug text primary key,
  pub jsonb not null default '{}',
  weight int not null default 0,
  verified boolean not null default false,
  reminder text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  site_id int not null references sites(id) on delete cascade,
  visitor_id text not null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  landing_path text not null default '',
  referrer text not null default '',
  referrer_host text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  utm_term text not null default '',
  click_id text not null default '',
  click_id_type text not null default '',
  country text not null default '',
  city text not null default '',
  device text not null default '',
  os text not null default '',
  browser text not null default '',
  lang text not null default '',
  is_bot boolean not null default false,
  pageviews int not null default 0,
  outclicks int not null default 0
);

create table if not exists events (
  id bigserial primary key,
  site_id int not null references sites(id) on delete cascade,
  session_id text not null default '',
  visitor_id text not null default '',
  ts timestamptz not null default now(),
  type text not null,
  name text not null default '',
  path text not null default '',
  title text not null default '',
  provider text not null default '',
  target_host text not null default '',
  target_url text not null default '',
  placement text not null default '',
  label text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  utm_term text not null default '',
  click_id text not null default '',
  country text not null default '',
  city text not null default '',
  device text not null default '',
  browser text not null default '',
  os text not null default '',
  referrer_host text not null default '',
  is_bot boolean not null default false,
  meta jsonb
);

create index if not exists events_site_ts_idx on events (site_id, ts desc);
create index if not exists events_type_ts_idx on events (type, ts desc);
create index if not exists events_ts_idx on events (ts desc);
create index if not exists events_provider_idx on events (provider) where provider <> '';
create index if not exists sessions_site_started_idx on sessions (site_id, started_at desc);
create index if not exists sessions_started_idx on sessions (started_at desc);
`;

let ready = null;

export function ensureSchema() {
  if (!ready) {
    ready = (async () => {
      const p = pool();
      await p.query(SCHEMA);
      await seed(p);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

const SEED_SITES = [
  ['servercalc-ru', 'ServerCalc.ru', 'servercalc.ru'],
  ['servercalc-com', 'ServerCalc.com', 'servercalc.com'],
  ['servercalc-online', 'ServerCalc.online', 'servercalc.online'],
  ['serverselection', 'ServerSelection', 'serverselection.online'],
  ['podborvps', 'ПодборVPS', 'podborvps.ru'],
];

// Соответствие «хост назначения → провайдер» на случай ссылок без меток
// (у части партнёрок параметры ломают трекинг, такие ссылки уходят голыми)
const SEED_PROVIDERS = [
  ['timeweb', 'Timeweb Cloud', ['timeweb.cloud', 'timeweb.com', 'timeweb.ru']],
  ['adminvps', 'AdminVPS', ['adminvps.ru', 'my.adminvps.ru']],
  ['hostman', 'Hostman', ['hostman.com']],
  ['ishosting', 'is*hosting', ['ishosting.com', 'ishosting.io']],
  ['aeserver', 'AEserver', ['aeserver.com', 'my.aeserver.com']],
  ['datapacket', 'DataPacket', ['datapacket.net', 'portal.datapacket.net']],
  ['truehost', 'Truehost', ['truehost.cloud']],
  ['ultahost', 'UltaHost', ['ultahost.com']],
  ['vpsorg', 'VPS.org', ['vps.org']],
  ['regru', 'Reg.ru', ['reg.ru', 'www.reg.ru']],
  ['fornex', 'Fornex', ['fornex.com', 'ru.fornex.com']],
  ['vdsina', 'VDSina', ['vdsina.ru', 'vdsina.com']],
  ['ruvds', 'RUVDS', ['ruvds.com']],
  ['firstvds', 'FirstVDS', ['firstvds.ru']],
  ['cloud4box', 'Cloud4Box', ['cloud4box.com']],
  ['serverspace', 'Serverspace', ['serverspace.ru', 'serverspace.io']],
  ['alphavps', 'AlphaVPS', ['alphavps.com']],
  ['aeza', 'Aeza', ['aeza.net', 'my.aeza.net']],
  ['beget', 'Beget', ['beget.com', 'beget.ru', 'cp.beget.com']],
  ['selectel', 'Selectel', ['selectel.ru', 'my.selectel.ru']],
  ['profitserver', 'ProfitServer', ['profitserver.ru', 'profitserver.pro', 'ps.profitserver.pro']],
  ['cherryservers', 'Cherry Servers', ['cherryservers.com', 'portal.cherryservers.com']],
  ['ethernetservers', 'EthernetServers', ['ethernetservers.com']],
  ['racknerd', 'RackNerd', ['racknerd.com', 'my.racknerd.com']],
];

async function seed(p) {
  for (const [key, name, domain] of SEED_SITES) {
    await p.query(
      'insert into sites (key, name, domain) values ($1,$2,$3) on conflict (key) do nothing',
      [key, name, domain]
    );
  }
  for (const [slug, name, hosts] of SEED_PROVIDERS) {
    await p.query(
      'insert into providers (slug, name, hosts) values ($1,$2,$3) on conflict (slug) do nothing',
      [slug, name, hosts]
    );
  }
  // servercalc.online выведен из аналитики (решение Антона, 18.08.2026): архивируем,
  // чтобы он не светился в обзоре, фильтрах и списках. Данные остаются в базе, просто скрыт.
  await p.query("update sites set archived = true where key = 'servercalc-online' and archived = false");
  // serverselection.online выведен из аналитики (решение Антона, 24.08.2026): больше не используем.
  // Архивируем — скрыт во всех отчётах, но история остаётся в базе.
  await p.query("update sites set archived = true where key = 'serverselection' and archived = false");

  // Разовая чистка дублей провайдеров вида <база>-<цифра> (alphavps-1, selectel-3…),
  // появившихся раньше из меток мест (utm_content). Сводим к базовому слагу, если он есть
  // в справочнике. Дёшево: гейт по маленькой таблице providers, после первого прогона нечего чистить.
  const dup = await p.query("select 1 from providers where slug ~ '-[0-9]+$' limit 1");
  if (dup.rows.length) {
    await p.query(
      `update events e set provider = regexp_replace(e.provider, '-[0-9]+$', '')
        where e.provider ~ '-[0-9]+$'
          and exists (select 1 from providers pp where pp.slug = regexp_replace(e.provider, '-[0-9]+$', ''))`
    );
    await p.query(
      `delete from providers d
        where d.slug ~ '-[0-9]+$'
          and exists (select 1 from providers b where b.slug = regexp_replace(d.slug, '-[0-9]+$', ''))`
    );
  }
}

export async function q(text, params = []) {
  await ensureSchema();
  const res = await pool().query(text, params);
  return res.rows;
}

// Быстрый путь для сборщика: схему трогаем только один раз за жизнь процесса
export async function qRaw(text, params = []) {
  const res = await pool().query(text, params);
  return res.rows;
}
