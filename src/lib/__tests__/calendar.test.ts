import {
  addMonths,
  daysInMonth,
  monthMatrix,
  monthTitle,
  toDateString,
} from '../calendar';

describe('toDateString', () => {
  it('zero-pads month and day', () => {
    expect(toDateString(2026, 7, 8)).toBe('2026-07-08');
    expect(toDateString(2026, 12, 31)).toBe('2026-12-31');
  });
});

describe('daysInMonth', () => {
  it('knows month lengths and leap years', () => {
    expect(daysInMonth(2026, 7)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
  });
});

describe('monthMatrix', () => {
  it('aligns July 2026 to its weekdays (the 1st is a Wednesday)', () => {
    const weeks = monthMatrix(2026, 7);
    expect(weeks.every(w => w.length === 7)).toBe(true);
    expect(weeks[0]).toEqual([
      null,
      null,
      null,
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
    ]);
    const days = weeks.flat().filter(d => d !== null);
    expect(days).toHaveLength(31);
    expect(days[days.length - 1]).toBe('2026-07-31');
  });

  it('fits February 2026 (starts on a Sunday) in exactly four weeks', () => {
    const weeks = monthMatrix(2026, 2);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2026-02-01');
    expect(weeks[3][6]).toBe('2026-02-28');
  });
});

describe('addMonths', () => {
  it('wraps across year boundaries in both directions', () => {
    expect(addMonths(2026, 1, -1)).toEqual({year: 2025, month: 12});
    expect(addMonths(2026, 12, 1)).toEqual({year: 2027, month: 1});
    expect(addMonths(2026, 7, -19)).toEqual({year: 2024, month: 12});
  });
});

describe('monthTitle', () => {
  it('names the month in full', () => {
    expect(monthTitle(2026, 7)).toBe('July 2026');
  });
});
