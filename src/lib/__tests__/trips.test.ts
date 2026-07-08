import {
  buildMapPins,
  formatTripDate,
  formatTripTime,
  groupEntriesByDate,
  regionForStashes,
} from '../trips';
import type {Stash, TripStashEntry} from '../../types';

function stash(id: string, overrides: Partial<Stash> = {}): Stash {
  return {
    id,
    user_id: 'me',
    place_name: `Place ${id}`,
    address: null,
    lat: 0,
    lng: 0,
    category: 'Food',
    notes: null,
    tiktok_url: null,
    thumbnail_url: null,
    opening_hours: null,
    place_id: null,
    visibility: 'friends',
    visited_at: null,
    created_at: '2026-07-01',
    ...overrides,
  };
}

function entry(
  id: string,
  overrides: Partial<TripStashEntry> & {stash?: Stash} = {},
): TripStashEntry {
  return {
    entryId: id,
    itineraryId: 't1',
    stash: stash(`s_${id}`),
    addedBy: null,
    scheduledDate: null,
    scheduledTime: null,
    ...overrides,
  };
}

describe('groupEntriesByDate', () => {
  it('orders dated sections ascending with Unscheduled last', () => {
    const sections = groupEntriesByDate([
      entry('a', {scheduledDate: '2026-07-12'}),
      entry('b'),
      entry('c', {scheduledDate: '2026-07-10'}),
    ]);
    expect(sections.map(s => s.date)).toEqual([
      '2026-07-10',
      '2026-07-12',
      null,
    ]);
  });

  it('puts date-only entries before timed ones, then sorts by time', () => {
    const sections = groupEntriesByDate([
      entry('late', {scheduledDate: '2026-07-10', scheduledTime: '19:00:00'}),
      entry('early', {scheduledDate: '2026-07-10', scheduledTime: '09:30:00'}),
      entry('allday', {scheduledDate: '2026-07-10'}),
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].entries.map(e => e.entryId)).toEqual([
      'allday',
      'early',
      'late',
    ]);
  });
});

describe('buildMapPins', () => {
  const names = new Map([
    ['t1', 'Sydney trip'],
    ['t2', 'Amsterdam'],
  ]);

  it('dedupes a stash that is both mine and in a trip, my copy winning', () => {
    const mine = stash('s1', {visited_at: '2026-07-05'});
    const staleCopy = stash('s1'); // The join's copy hasn't seen the visit.
    const pins = buildMapPins([mine], [entry('e1', {stash: staleCopy})], names);
    expect(pins).toHaveLength(1);
    expect(pins[0].stash).toBe(mine);
    expect(pins[0].tripLabel).toBe('Sydney trip');
  });

  it("includes another member's stash with the trip label and attribution", () => {
    const friend = {
      id: 'u2',
      username: 'alex',
      display_name: 'Alex',
      avatar_url: null,
      created_at: '2026-01-01',
    };
    const theirs = stash('s2', {user_id: 'u2'});
    const pins = buildMapPins(
      [stash('s1')],
      [entry('e1', {stash: theirs, addedBy: friend})],
      names,
    );
    expect(pins).toHaveLength(2);
    const tripPin = pins.find(p => p.stash.id === 's2');
    expect(tripPin?.tripLabel).toBe('Sydney trip');
    expect(tripPin?.addedBy).toEqual(friend);
  });

  it('labels a stash in several trips with the alphabetically-first name', () => {
    const shared = stash('s1');
    const pins = buildMapPins(
      [],
      [
        entry('e1', {stash: shared, itineraryId: 't1'}),
        entry('e2', {stash: shared, itineraryId: 't2'}),
      ],
      names,
    );
    expect(pins).toHaveLength(1);
    expect(pins[0].tripLabel).toBe('Amsterdam');
  });
});

describe('regionForStashes', () => {
  it('returns null for no stashes', () => {
    expect(regionForStashes([])).toBeNull();
  });

  it('centers on a single stash with a minimum delta', () => {
    const region = regionForStashes([stash('s1', {lat: -33.87, lng: 151.21})]);
    expect(region).toEqual({
      latitude: -33.87,
      longitude: 151.21,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  });

  it('fits spread-out stashes around their midpoint with padding', () => {
    const region = regionForStashes([
      stash('a', {lat: 0, lng: 0}),
      stash('b', {lat: 1, lng: 2}),
    ]);
    expect(region?.latitude).toBeCloseTo(0.5);
    expect(region?.longitude).toBeCloseTo(1);
    expect(region?.latitudeDelta).toBeCloseTo(1.5);
    expect(region?.longitudeDelta).toBeCloseTo(3);
  });
});

describe('schedule formatting', () => {
  it('formats a date as local calendar parts (no UTC day shift)', () => {
    expect(formatTripDate('2026-07-11')).toBe('Sat, Jul 11');
    expect(formatTripDate('2026-01-01')).toBe('Thu, Jan 1');
  });

  it('formats times as 12-hour with AM/PM', () => {
    expect(formatTripTime('15:30:00')).toBe('3:30 PM');
    expect(formatTripTime('00:05:00')).toBe('12:05 AM');
    expect(formatTripTime('12:00:00')).toBe('12:00 PM');
  });
});
