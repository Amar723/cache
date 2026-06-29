import {isOpenNow} from '../openingHours';
import type {OpeningHours} from '../../types';

// Jan 5 2026 is a Monday; Jan 4 2026 is a Sunday (both in UTC).
const MON_12_00 = new Date(Date.UTC(2026, 0, 5, 12, 0));
const MON_20_00 = new Date(Date.UTC(2026, 0, 5, 20, 0));
const SUN_01_00 = new Date(Date.UTC(2026, 0, 4, 1, 0));

function hours(
  periods: OpeningHours['periods'],
  utcOffsetMinutes = 0,
): OpeningHours {
  return {periods, utc_offset_minutes: utcOffsetMinutes};
}

describe('isOpenNow', () => {
  it('fails open when hours are unknown', () => {
    expect(isOpenNow(null, MON_12_00)).toBe(true);
    expect(isOpenNow(undefined, MON_12_00)).toBe(true);
    expect(isOpenNow(hours([]), MON_12_00)).toBe(true);
  });

  it('treats an open period with no close as 24/7', () => {
    expect(isOpenNow(hours([{open: {day: 0, time: '0000'}}]), MON_20_00)).toBe(
      true,
    );
  });

  it('is open inside a weekday window and closed outside it', () => {
    const monNineToFive = hours([
      {open: {day: 1, time: '0900'}, close: {day: 1, time: '1700'}},
    ]);
    expect(isOpenNow(monNineToFive, MON_12_00)).toBe(true); // noon
    expect(isOpenNow(monNineToFive, MON_20_00)).toBe(false); // 8pm
  });

  it('handles a window that wraps past midnight into the next day', () => {
    // Sat 22:00 → Sun 02:00.
    const lateNight = hours([
      {open: {day: 6, time: '2200'}, close: {day: 0, time: '0200'}},
    ]);
    expect(isOpenNow(lateNight, SUN_01_00)).toBe(true); // Sun 01:00
  });

  it('judges open-ness in the place’s timezone, not the device’s', () => {
    // Open Mon 09:00–17:00 local; place is UTC+10. At 20:00 UTC Monday it's
    // 06:00 Tuesday locally → closed.
    const local = hours(
      [{open: {day: 1, time: '0900'}, close: {day: 1, time: '1700'}}],
      600,
    );
    expect(isOpenNow(local, MON_20_00)).toBe(false);
  });
});
