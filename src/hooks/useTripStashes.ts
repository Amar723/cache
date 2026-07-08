import {useMemo} from 'react';

import {supabase} from '../lib/supabase';
import {createStore} from '../lib/store';
import {currentUserId} from './useAuth';
import type {ItineraryStashInsert} from '../lib/database.types';
import type {Profile, Stash, TripStashEntry} from '../types';

/**
 * Every stash shared into any of the viewer's trips, in one global store
 * (RLS scopes the query to trips they belong to). Both the TripDetail screen
 * (one trip's entries) and the main map (trip labels on the union of pins)
 * read from here.
 */
interface TripStashState {
  entries: TripStashEntry[];
  loading: boolean;
  error: string | null;
}

const store = createStore<TripStashState>({
  entries: [],
  loading: false,
  error: null,
});

/** An itinerary_stashes row with the stash + adder's profile embedded. */
interface EntryJoinRow {
  id: string;
  itinerary_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  stash: Stash | null;
  added_by_profile: Profile | null;
}

const ENTRY_SELECT =
  'id, itinerary_id, scheduled_date, scheduled_time, ' +
  'stash:stashes!stash_id(*), added_by_profile:profiles!added_by(*)';

function toEntry(row: EntryJoinRow): TripStashEntry | null {
  if (!row.stash) {
    return null; // The stash was deleted between reads; skip.
  }
  return {
    entryId: row.id,
    itineraryId: row.itinerary_id,
    stash: row.stash,
    addedBy: row.added_by_profile,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
  };
}

/** Load every entry across all trips the current user belongs to. */
export async function refreshTripStashes(): Promise<void> {
  const myId = currentUserId();
  if (!myId) {
    clearTripStashes();
    return;
  }

  store.setState({loading: true, error: null});

  const {data, error} = await supabase
    .from('itinerary_stashes')
    .select(ENTRY_SELECT)
    .order('created_at', {ascending: false});

  if (error) {
    store.setState({loading: false, error: error.message});
    return;
  }

  const entries: TripStashEntry[] = [];
  for (const row of (data as unknown as EntryJoinRow[]) ?? []) {
    const entry = toEntry(row);
    if (entry) {
      entries.push(entry);
    }
  }
  store.setState({entries, loading: false});
}

/** Reset on sign-out. */
export function clearTripStashes(): void {
  store.setState({entries: [], loading: false, error: null});
}

/** Share one of your stashes into a trip. */
export async function addStashToTrip(
  itineraryId: string,
  stashId: string,
): Promise<void> {
  const myId = currentUserId();
  if (!myId) {
    throw new Error('You must be signed in.');
  }

  const payload: ItineraryStashInsert = {
    itinerary_id: itineraryId,
    stash_id: stashId,
    added_by: myId,
  };
  const {error} = await supabase.from('itinerary_stashes').insert(payload);
  if (error) {
    // 23505 = the unique (itinerary_id, stash_id) index.
    if (error.code === '23505') {
      throw new Error('This place is already in the trip.');
    }
    throw new Error(error.message);
  }
  await refreshTripStashes();
}

/** Take an entry off a trip (your own additions, or any if you're the owner). */
export async function removeEntry(entryId: string): Promise<void> {
  const {error} = await supabase
    .from('itinerary_stashes')
    .delete()
    .eq('id', entryId);
  if (error) {
    throw new Error(error.message);
  }
  store.setState(prev => ({
    entries: prev.entries.filter(e => e.entryId !== entryId),
  }));
}

/**
 * Set or clear an entry's schedule. `date` is 'YYYY-MM-DD', `time` is
 * 'HH:MM:SS'; clearing the date always clears the time too (mirrors the DB
 * check constraint).
 */
export async function setEntrySchedule(
  entryId: string,
  date: string | null,
  time: string | null,
): Promise<void> {
  const scheduled_time = date === null ? null : time;
  const {error} = await supabase
    .from('itinerary_stashes')
    .update({scheduled_date: date, scheduled_time})
    .eq('id', entryId);
  if (error) {
    throw new Error(error.message);
  }
  store.setState(prev => ({
    entries: prev.entries.map(e =>
      e.entryId === entryId
        ? {...e, scheduledDate: date, scheduledTime: scheduled_time}
        : e,
    ),
  }));
}

/** React hook: one trip's entries + load state. */
export function useTripEntries(itineraryId: string): {
  entries: TripStashEntry[];
  loading: boolean;
  error: string | null;
} {
  // Select the stable array, filter in a memo — a filtering selector would
  // return a fresh array every getSnapshot call and loop useSyncExternalStore.
  const all = store.useSelector(s => s.entries);
  const loading = store.useSelector(s => s.loading);
  const error = store.useSelector(s => s.error);
  const entries = useMemo(
    () => all.filter(e => e.itineraryId === itineraryId),
    [all, itineraryId],
  );
  return {entries, loading, error};
}

/** React hook: every entry across all trips (the main map's union). */
export function useAllTripEntries(): TripStashEntry[] {
  return store.useSelector(s => s.entries);
}
