/**
 * Pure calendar math for the trip date picker. Everything works on
 * 'YYYY-MM-DD' strings and local calendar parts — no UTC parsing anywhere,
 * so a date never shifts by a day across timezones.
 */

/** Zero-pad to 'YYYY-MM-DD'. `month` is 1-12. */
export function toDateString(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/** Today's local date as 'YYYY-MM-DD'. */
export function todayString(now: Date = new Date()): string {
  return toDateString(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Days in a month. `month` is 1-12; handles leap years. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * A month laid out as weeks (rows of 7), Sunday-first, each cell either a
 * 'YYYY-MM-DD' string or null padding. `month` is 1-12.
 */
export function monthMatrix(year: number, month: number): (string | null)[][] {
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const total = daysInMonth(year, month);

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= total; day++) {
    cells.push(toDateString(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

/** Shift a (year, month) pair by `delta` months. `month` is 1-12. */
export function addMonths(
  year: number,
  month: number,
  delta: number,
): {year: number; month: number} {
  const zeroBased = year * 12 + (month - 1) + delta;
  return {
    year: Math.floor(zeroBased / 12),
    month: (((zeroBased % 12) + 12) % 12) + 1,
  };
}

/** "July 2026" month header. `month` is 1-12. */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function monthTitle(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
