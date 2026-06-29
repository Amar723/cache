import {formatDate} from '../format';

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
