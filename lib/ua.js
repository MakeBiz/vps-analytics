/**
 * Разбор User-Agent без внешних библиотек: нужен грубый уровень
 * (устройство, ОС, браузер), а не точная версия. Плюс отсев роботов
 */

const BOT = /(bot|crawl|spider|slurp|bingpreview|yandex(?!browser)|mail\.ru_bot|ahrefs|semrush|mj12|dotbot|petalbot|facebookexternalhit|headless|phantomjs|python-requests|curl\/|wget|go-http|node-fetch|axios|monitoring|uptime|pingdom|lighthouse|gtmetrix|screaming|dataforseo|serpstat|megaindex|linkpad)/i;

export function isBot(ua = '') {
  return BOT.test(ua);
}

export function device(ua = '') {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return 'Планшет';
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(ua)) return 'Смартфон';
  if (/smart-?tv|appletv|googletv|hbbtv/i.test(ua)) return 'ТВ';
  return 'Компьютер';
}

export function os(ua = '') {
  if (/windows nt 10/i.test(ua)) return 'Windows 10/11';
  if (/windows nt/i.test(ua)) return 'Windows';
  if (/android[ /]?([\d.]+)?/i.test(ua)) return 'Android';
  if (/(iphone|ipad|ipod).*os ([\d_]+)/i.test(ua)) return 'iOS';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Другая';
}

export function browser(ua = '') {
  if (/yabrowser/i.test(ua)) return 'Яндекс.Браузер';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Другой';
}

const COUNTRY_RU = {
  RU: 'Россия', UA: 'Украина', BY: 'Беларусь', KZ: 'Казахстан', UZ: 'Узбекистан',
  AE: 'ОАЭ', DE: 'Германия', NL: 'Нидерланды', FI: 'Финляндия', US: 'США',
  GB: 'Великобритания', PL: 'Польша', TR: 'Турция', FR: 'Франция', IT: 'Италия',
  ES: 'Испания', CZ: 'Чехия', LT: 'Литва', LV: 'Латвия', EE: 'Эстония',
  GE: 'Грузия', AM: 'Армения', AZ: 'Азербайджан', KG: 'Киргизия', MD: 'Молдавия',
  IL: 'Израиль', CA: 'Канада', IN: 'Индия', CN: 'Китай', SG: 'Сингапур',
  TH: 'Таиланд', VN: 'Вьетнам', ID: 'Индонезия', BR: 'Бразилия', RS: 'Сербия',
  BG: 'Болгария', RO: 'Румыния', SE: 'Швеция', NO: 'Норвегия', CH: 'Швейцария',
  AT: 'Австрия', BE: 'Бельгия', PT: 'Португалия', GR: 'Греция', HU: 'Венгрия',
  SK: 'Словакия', IE: 'Ирландия', DK: 'Дания', AU: 'Австралия', JP: 'Япония',
  KR: 'Южная Корея', MX: 'Мексика', AR: 'Аргентина', EG: 'Египет', SA: 'Саудовская Аравия',
  QA: 'Катар', KW: 'Кувейт', TJ: 'Таджикистан', TM: 'Туркмения', MN: 'Монголия',
};

export function countryName(code) {
  if (!code) return 'Не определена';
  return COUNTRY_RU[code] || code;
}
