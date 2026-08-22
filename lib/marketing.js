/**
 * Слой маркетинга: снимок из коннектора Яндекса (Директ, Метрика, Вебмастер, Wordstat).
 *
 * Коннектор живёт на Маке (токены только там), панель в облаке к нему вживую не ходит.
 * Поэтому это СНИМОК с датой сборки: по запросу гоняем коннектор, кладём data/marketing.json
 * и публикуем. Обновление ручное, как у оплат и роялти, а не по расписанию.
 */
import fs from 'node:fs';
import path from 'node:path';

let cache = null;
export function loadMarketing() {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), 'data', 'marketing.json');
    cache = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    cache = null;
  }
  return cache;
}
