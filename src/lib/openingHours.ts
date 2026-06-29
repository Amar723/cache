import type {OpeningHours} from '../types';

const WEEK_MINUTES = 7 * 1440;

/**
 * Is the place open at `now`, judged in the place's own timezone?
 *
 * Fail-OPEN: when hours are unknown (null / empty) we return true, so a stash
 * without captured opening hours still nudges. This mirrors the native check in
 * ios/Cache/Geofencing/RNGeofencing.m — keep the two in sync.
 */
export function isOpenNow(
  hours: OpeningHours | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!hours || !hours.periods || hours.periods.length === 0) {
    return true; // unknown hours → allow the notification
  }

  // "Now" in the place's local time, as minutes since Sunday 00:00. We shift the
  // timestamp by the place's UTC offset and then read it with UTC getters.
  const placeNow = new Date(now.getTime() + hours.utc_offset_minutes * 60_000);
  const nowMin =
    placeNow.getUTCDay() * 1440 +
    placeNow.getUTCHours() * 60 +
    placeNow.getUTCMinutes();

  for (const period of hours.periods) {
    if (!period.open) {
      continue;
    }
    const openMin = dayTimeToMinutes(period.open.day, period.open.time);
    if (!period.close) {
      return true; // open with no close → Google's 24/7 representation
    }
    let closeMin = dayTimeToMinutes(period.close.day, period.close.time);
    if (closeMin <= openMin) {
      closeMin += WEEK_MINUTES; // interval wraps past Saturday → Sunday
    }
    if (
      (nowMin >= openMin && nowMin < closeMin) ||
      (nowMin + WEEK_MINUTES >= openMin && nowMin + WEEK_MINUTES < closeMin)
    ) {
      return true;
    }
  }
  return false;
}

/** (day 0..6, "HHMM") → minutes since Sunday 00:00. */
function dayTimeToMinutes(day: number, time: string): number {
  const hhmm = parseInt(time, 10) || 0;
  return day * 1440 + Math.floor(hhmm / 100) * 60 + (hhmm % 100);
}
