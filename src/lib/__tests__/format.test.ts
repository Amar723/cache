import {formatDate, formatDistance, timeAgo} from '../format';

describe('formatDate', () => {
  it('formats an ISO date as "Mon D, YYYY"', () => {
    // Round-trip a locally-constructed date so the assertion is timezone-safe.
    const iso = new Date(2026, 5, 15).toISOString(); // June 15, 2026, local
    expect(formatDate(iso)).toBe('Jun 15, 2026');
  });

  it('returns an empty string for nullish input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
  });

  it('returns an empty string for an unparseable date', () => {
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('formatDistance (metric)', () => {
  it('rounds sub-kilometre distances to the nearest 10 m', () => {
    expect(formatDistance(284, false)).toBe('280 m');
    expect(formatDistance(6, false)).toBe('6 m');
    expect(formatDistance(999, false)).toBe('1000 m');
  });

  it('shows one decimal below 10 km and whole km above', () => {
    expect(formatDistance(2300, false)).toBe('2.3 km');
    expect(formatDistance(1000, false)).toBe('1.0 km');
    expect(formatDistance(14200, false)).toBe('14 km');
  });
});

describe('formatDistance (imperial)', () => {
  it('shows feet under a tenth of a mile', () => {
    expect(formatDistance(30, true)).toBe('100 ft');
  });

  it('shows one decimal below 10 mi and whole mi above', () => {
    expect(formatDistance(2253, true)).toBe('1.4 mi');
    expect(formatDistance(32187, true)).toBe('20 mi');
  });
});

describe('formatDistance (guards)', () => {
  it('returns an empty string for invalid input', () => {
    expect(formatDistance(NaN)).toBe('');
    expect(formatDistance(-5)).toBe('');
    expect(formatDistance(Infinity)).toBe('');
  });
});

describe('timeAgo', () => {
  const now = new Date(2026, 6, 12, 12, 0, 0).getTime();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const SEC = 1000;
  const MIN = 60 * SEC;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it('covers each bucket', () => {
    expect(timeAgo(ago(5 * SEC), now)).toBe('just now');
    expect(timeAgo(ago(5 * MIN), now)).toBe('5m ago');
    expect(timeAgo(ago(3 * HOUR), now)).toBe('3h ago');
    expect(timeAgo(ago(3 * DAY), now)).toBe('3d ago');
    expect(timeAgo(ago(14 * DAY), now)).toBe('2w ago');
    expect(timeAgo(ago(120 * DAY), now)).toBe('4mo ago');
    expect(timeAgo(ago(400 * DAY), now)).toBe('1y ago');
  });

  it('clamps future timestamps to "just now"', () => {
    expect(timeAgo(ago(-10 * MIN), now)).toBe('just now');
  });

  it('returns an empty string for null/invalid input', () => {
    expect(timeAgo(null, now)).toBe('');
    expect(timeAgo(undefined, now)).toBe('');
    expect(timeAgo('not-a-date', now)).toBe('');
  });
});
