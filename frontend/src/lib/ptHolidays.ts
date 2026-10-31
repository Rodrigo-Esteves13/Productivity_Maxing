// Feriados nacionais de Portugal, para os mostrar na grelha do horario.
// Copia da regra do backend (common/pt-holidays.util.ts), que e quem tira
// os turnos dos locais que nao trabalham em feriados; os dois testes
// cobrem os mesmos anos.

export interface PtHoliday {
  /** YYYY-MM-DD */
  date: string;
  /** Traduz-se por `holiday.<key>`. */
  key: string;
}

const FIXED: ReadonlyArray<[month: number, day: number, key: string]> = [
  [1, 1, 'newYear'],
  [4, 25, 'freedom'],
  [5, 1, 'labour'],
  [6, 10, 'portugal'],
  [8, 15, 'assumption'],
  [10, 5, 'republic'],
  [11, 1, 'allSaints'],
  [12, 1, 'independence'],
  [12, 8, 'immaculate'],
  [12, 25, 'christmas'],
];

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Domingo de Pascoa (calendario gregoriano, algoritmo anonimo de Meeus). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function shifted(base: Date, days: number): string {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ptHolidaysOfYear(year: number): PtHoliday[] {
  const easter = easterSunday(year);
  return [
    ...FIXED.map(([m, d, name]) => ({ date: key(year, m, d), key: name })),
    { date: shifted(easter, -2), key: 'goodFriday' },
    { date: shifted(easter, 0), key: 'easter' },
    { date: shifted(easter, 60), key: 'corpusChristi' },
  ].sort((x, y) => x.date.localeCompare(y.date));
}

/** Datas (YYYY-MM-DD) de feriado entre duas chaves, inclusive. */
export function ptHolidayKeysBetween(
  fromKey: string,
  toKey: string,
): Set<string> {
  const from = Number(fromKey.slice(0, 4));
  const to = Number(toKey.slice(0, 4));
  const keys = new Set<string>();
  for (let year = from; year <= to; year++) {
    for (const holiday of ptHolidaysOfYear(year)) {
      if (holiday.date >= fromKey && holiday.date <= toKey)
        keys.add(holiday.date);
    }
  }
  return keys;
}

/** Feriado de um dia (YYYY-MM-DD), ou undefined. */
export function ptHolidayOn(dayKey: string): PtHoliday | undefined {
  return ptHolidaysOfYear(Number(dayKey.slice(0, 4))).find((h) => h.date === dayKey);
}
