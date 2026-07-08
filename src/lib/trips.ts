import type {Region} from 'react-native-maps';

import type {Stash, TripStashEntry} from '../types';

/**
 * Pure trip helpers: grouping a trip's entries by day, merging trip pins into
 * the main map, and formatting the destination-local schedule strings.
 *
 * `scheduled_date`/`scheduled_time` are wall-clock strings ('YYYY-MM-DD' /
 * 'HH:MM:SS'). They are never parsed with `new Date(string)` — that treats
 * date-only strings as UTC midnight, which shifts the day in any timezone
 * behind UTC.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface TripDaySection {
  /** 'YYYY-MM-DD', or null for the trailing "Unscheduled" section. */
  date: string | null;
  entries: TripStashEntry[];
}

/**
 * Group a trip's entries into dated sections (ascending), with unscheduled
 * entries last. Within a day, date-only entries come before timed ones, timed
 * ones sort by time; place name breaks ties so the order is stable.
 */
export function groupEntriesByDate(
  entries: TripStashEntry[],
): TripDaySection[] {
  const byDate = new Map<string | null, TripStashEntry[]>();
  for (const entry of entries) {
    const key = entry.scheduledDate;
    const bucket = byDate.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      byDate.set(key, [entry]);
    }
  }

  const compareWithinDay = (a: TripStashEntry, b: TripStashEntry): number => {
    if (a.scheduledTime === null && b.scheduledTime !== null) {
      return -1;
    }
    if (a.scheduledTime !== null && b.scheduledTime === null) {
      return 1;
    }
    if (a.scheduledTime !== null && b.scheduledTime !== null) {
      // 'HH:MM:SS' compares correctly as a string.
      const byTime = a.scheduledTime.localeCompare(b.scheduledTime);
      if (byTime !== 0) {
        return byTime;
      }
    }
    return a.stash.place_name.localeCompare(b.stash.place_name);
  };

  const sections: TripDaySection[] = [];
  const dates = [...byDate.keys()]
    .filter((d): d is string => d !== null)
    .sort(); // 'YYYY-MM-DD' compares correctly as a string.
  for (const date of dates) {
    const bucket = byDate.get(date);
    if (bucket) {
      sections.push({date, entries: bucket.sort(compareWithinDay)});
    }
  }
  const unscheduled = byDate.get(null);
  if (unscheduled) {
    sections.push({date: null, entries: unscheduled.sort(compareWithinDay)});
  }
  return sections;
}

/** A stash to render on the main map, with the trip it belongs to (if any). */
export interface MapPin {
  stash: Stash;
  tripLabel: string | null;
  /** Who added it to that trip (attribution for pins that aren't yours). */
  addedBy: TripStashEntry['addedBy'];
}

/**
 * The main map's pins: your own stashes plus every stash in your trips,
 * deduped by stash id. Your own store's copy wins (it carries fresh
 * `visited_at` after local mutations); a stash in several trips gets the
 * alphabetically-first trip's name to keep the label deterministic.
 */
export function buildMapPins(
  ownStashes: Stash[],
  entries: TripStashEntry[],
  tripNameById: Map<string, string>,
): MapPin[] {
  const labelByStash = new Map<string, string>();
  const entryByStash = new Map<string, TripStashEntry>();
  for (const entry of entries) {
    const name = tripNameById.get(entry.itineraryId);
    if (name === undefined) {
      continue; // Entry from a trip we haven't loaded; skip its label.
    }
    const existing = labelByStash.get(entry.stash.id);
    if (existing === undefined || name.localeCompare(existing) < 0) {
      labelByStash.set(entry.stash.id, name);
      entryByStash.set(entry.stash.id, entry);
    }
  }

  const pins: MapPin[] = [];
  const seen = new Set<string>();
  for (const stash of ownStashes) {
    seen.add(stash.id);
    pins.push({
      stash,
      tripLabel: labelByStash.get(stash.id) ?? null,
      addedBy: null, // Your own pin needs no attribution.
    });
  }
  for (const entry of entries) {
    if (seen.has(entry.stash.id)) {
      continue;
    }
    seen.add(entry.stash.id);
    pins.push({
      stash: entry.stash,
      tripLabel: labelByStash.get(entry.stash.id) ?? null,
      addedBy: entryByStash.get(entry.stash.id)?.addedBy ?? entry.addedBy,
    });
  }
  return pins;
}

/**
 * A region that fits all the given stashes with a little padding, or null when
 * there are none (callers fall back to the user's location).
 */
export function regionForStashes(stashes: Stash[]): Region | null {
  if (stashes.length === 0) {
    return null;
  }
  let minLat = stashes[0].lat;
  let maxLat = stashes[0].lat;
  let minLng = stashes[0].lng;
  let maxLng = stashes[0].lng;
  for (const s of stashes) {
    minLat = Math.min(minLat, s.lat);
    maxLat = Math.max(maxLat, s.lat);
    minLng = Math.min(minLng, s.lng);
    maxLng = Math.max(maxLng, s.lng);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
  };
}

/** "Sat, Jul 11" from 'YYYY-MM-DD'. Parsed as calendar parts, never UTC. */
export function formatTripDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) {
    return date;
  }
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${weekday}, ${MONTHS[m - 1]} ${d}`;
}

/** "3:30 PM" from 'HH:MM:SS' (or 'HH:MM'). */
export function formatTripTime(time: string): string {
  const [h, min] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(min)) {
    return time;
  }
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(min).padStart(2, '0')} ${suffix}`;
}
