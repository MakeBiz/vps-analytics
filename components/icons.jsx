/**
 * Иконки одной линией. Рисуем сами, а не тянем набор: панель должна открываться
 * без внешних запросов, а линейных иконок тут два десятка, библиотека избыточна.
 * Все пути в сетке 24×24, толщина и цвет наследуются от текста.
 */
const P = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  funnel: 'M4 5h16l-6 7v6l-4 2v-8z',
  tag: 'M4 4h7l9 9-7 7-9-9zM8 8h.01',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.4 2.5 15.6 0 18M12 3c-2.5 2.4-2.5 15.6 0 18',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  ads: 'M4 10v4h3l6 4V6l-6 4zM18 9a4 4 0 010 6',
  wallet: 'M3 7h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zM16 12h3',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM8 7.5h.01M8 16.5h.01',
  cursor: 'M6 3l12 8-5 1.5L15 19l-2.5 1-2-6.5L6 16z',
  coins: 'M4 8c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM4 8v8c0 1.7 3.1 3 7 3s7-1.3 7-3V8',
  link: 'M9.5 14.5l5-5M8 12l-2 2a3.5 3.5 0 005 5l2-2M16 12l2-2a3.5 3.5 0 00-5-5l-2 2',
  list: 'M4 6h16M4 12h16M4 18h16',
  plug: 'M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0zM12 17v4',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  users: 'M8 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a5.5 5.5 0 0111 0M16 11a3 3 0 100-6 3 3 0 000 6zM15 15.5a5 5 0 016.5 4.5',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0',
  eye: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3.5 2',
  bell: 'M18 15V10a6 6 0 10-12 0v5l-2 3h16zM10 21h4',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  chart: 'M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6',
  money: 'M7 5h5a4 4 0 010 8H7M7 10h8M7 13v6',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z',
  wave: 'M2 12h3l2-5 3 10 3-12 3 9 2-2h4',
  chevron: 'M7 10l5 5 5-5',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
};

export default function Icon({ name, size = 16 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] || P.chart} />
    </svg>
  );
}
