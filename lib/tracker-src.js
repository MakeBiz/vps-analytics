/**
 * Исходник счётчика. Отдаётся маршрутом /px/t.js.
 * Держим здесь строкой, чтобы обновление счётчика было одной публикацией
 * панели, а не переизданием всех четырёх сайтов.
 *
 * Внутри намеренно нет шаблонных строк и стрелок: код должен без сборки
 * работать в любом браузере и не конфликтовать со String.raw
 */
export const TRACKER = String.raw`
(function () {
  var d = document, w = window, nv = navigator;
  var el = d.currentScript;
  // Тег могли вставить динамически (next/script, менеджер тегов): тогда
  // currentScript не помогает и тег берётся по признакам. Важно: если на странице
  // есть лишний первопартийный тег без data-endpoint (стоит выше по DOM), он не должен
  // перебивать рабочий кросс-доменный тег — поэтому сначала ищем тег С data-endpoint.
  if (!el || !el.getAttribute('data-site') || !el.getAttribute('data-endpoint')) {
    el = d.querySelector('script[data-site][data-endpoint][src*="/px/"]')
      || d.querySelector('script[data-site][src*="/px/"]')
      || el;
  }
  var KEY = el && el.getAttribute('data-site');
  if (!KEY) return;
  var BASE = (el && el.getAttribute('data-endpoint')) || '/px';
  var DBG = el && el.getAttribute('data-debug') === '1';
  if (w.__px) return;

  var mem = {};
  function get(k) { try { return w.localStorage.getItem(k); } catch (e) { return mem[k] || null; } }
  function set(k, v) { try { w.localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }

  function uuid() {
    try { if (w.crypto && w.crypto.randomUUID) return w.crypto.randomUUID(); } catch (e) {}
    var s = '', h = '0123456789abcdef';
    for (var i = 0; i < 32; i++) s += h[Math.floor(Math.random() * 16)];
    return s;
  }

  var HALF_HOUR = 30 * 60 * 1000;
  var vid = get('px_vid'); if (!vid) { vid = uuid(); set('px_vid', vid); }
  var sid = get('px_sid');
  var last = parseInt(get('px_sat') || '0', 10);
  var fresh = false;
  if (!sid || !last || (Date.now() - last) > HALF_HOUR) { sid = uuid(); fresh = true; }
  set('px_sid', sid); set('px_sat', String(Date.now()));

  function touch() { set('px_sat', String(Date.now())); }

  function qp(name) {
    try { return new URL(w.location.href).searchParams.get(name) || ''; } catch (e) { return ''; }
  }

  function firstTouch() {
    var ids = ['yclid', 'gclid', 'ysclid', 'fbclid', 'ymclid', 'wbraid', 'gbraid', 'msclkid'];
    var cid = '', ctype = '';
    for (var i = 0; i < ids.length; i++) { var vv = qp(ids[i]); if (vv) { cid = vv; ctype = ids[i]; break; } }
    return {
      us: qp('utm_source'), um: qp('utm_medium'), uc: qp('utm_campaign'),
      un: qp('utm_content'), ut: qp('utm_term'),
      ci: cid, ct: ctype,
      r: d.referrer || '',
      lp: path(),
      lang: (nv.language || ''),
      tz: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })(),
      sw: (w.screen && w.screen.width) || 0
    };
  }

  function path() {
    return (w.location.pathname || '/') + (w.location.search || '');
  }

  function send(body, beacon) {
    body.k = KEY; body.v = vid; body.s = sid;
    if (fresh) { body.n = 1; body.f = firstTouch(); }
    var url = BASE + '/e';
    var txt = JSON.stringify(body);
    if (DBG && w.console) w.console.log('[px]', body);
    var sent = false;
    if (beacon && nv.sendBeacon) {
      try { sent = nv.sendBeacon(url, new Blob([txt], { type: 'text/plain;charset=UTF-8' })); } catch (e) { sent = false; }
    }
    if (!sent) {
      try {
        fetch(url, { method: 'POST', body: txt, keepalive: true, credentials: 'omit',
          headers: { 'Content-Type': 'text/plain;charset=UTF-8' } })['catch'](function () {});
      } catch (e) {
        try { var x = new XMLHttpRequest(); x.open('POST', url, true); x.send(txt); } catch (e2) {}
      }
    }
    if (fresh) fresh = false;
    touch();
  }

  var lastPath = '', started = Date.now();

  function pageview(force) {
    var p = path();
    if (!force && p === lastPath) return;
    if (lastPath) endPage();
    lastPath = p; started = Date.now();
    send({ t: 'pv', u: p, ti: (d.title || '').slice(0, 200), r: d.referrer || '' }, false);
  }

  function endPage() {
    var sec = Math.round((Date.now() - started) / 1000);
    if (sec < 1 || sec > 3600) return;
    send({ t: 'end', u: lastPath, m: { sec: sec } }, true);
  }

  function attr(node, name) {
    try { return node.getAttribute(name) || ''; } catch (e) { return ''; }
  }

  function closestAttr(node, name) {
    var n = node;
    while (n && n.nodeType === 1) {
      var v = attr(n, name);
      if (v) return v;
      n = n.parentNode;
    }
    return '';
  }

  function onClick(ev) {
    var n = ev.target;
    while (n && n.nodeType === 1 && n.tagName !== 'A') n = n.parentNode;
    if (!n || n.tagName !== 'A') return;
    var raw = n.getAttribute('href') || '';
    if (!raw || raw.charAt(0) === '#' || /^(mailto|tel|javascript):/i.test(raw)) return;
    var u;
    try { u = new URL(n.href, w.location.href); } catch (e) { return; }
    if (u.hostname === w.location.hostname) return;
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return;

    var text = (n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    send({
      t: 'out',
      u: path(),
      ti: (d.title || '').slice(0, 200),
      h: u.href.slice(0, 500),
      hh: u.hostname,
      pr: u.searchParams.get('utm_content') || attr(n, 'data-provider') || '',
      pl: u.searchParams.get('utm_campaign') || closestAttr(n, 'data-px-place') || '',
      lb: text,
      m: { rel: attr(n, 'rel'), blk: closestAttr(n, 'data-px-block') }
    }, true);
  }

  d.addEventListener('click', onClick, true);
  d.addEventListener('auxclick', function (e) { if (e.button === 1) onClick(e); }, true);

  // Переходы внутри одностраничной навигации Next.js
  ['pushState', 'replaceState'].forEach(function (m) {
    var orig = history[m];
    if (typeof orig !== 'function') return;
    history[m] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(function () { pageview(false); }, 0);
      return r;
    };
  });
  w.addEventListener('popstate', function () { setTimeout(function () { pageview(false); }, 0); });
  w.addEventListener('pagehide', function () { endPage(); });
  d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') endPage(); });

  w.__px = {
    event: function (name, params) {
      if (!name) return;
      send({ t: 'ev', en: String(name).slice(0, 80), u: path(), m: params || null }, false);
    },
    pageview: function () { pageview(true); },
    id: function () { return { visitor: vid, session: sid }; }
  };
  w.px = w.__px;

  pageview(true);
})();
`;
