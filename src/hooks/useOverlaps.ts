import {Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {supabase} from '../lib/supabase';
import {createStore} from '../lib/store';
import {computeOverlaps, friendLabel} from '../lib/overlap';
import type {FriendStashRow} from '../lib/overlap';
import {currentUserId} from './useAuth';
import {getStashesSnapshot} from './useStashes';
import {getAcceptedFriends} from './useFriends';
import type {Profile, Stash} from '../types';

/**
 * Friend place-overlap engine: which of *your* saved places a friend has also
 * saved. The pure matching lives in lib/overlap.ts; this file owns the store,
 * the Supabase read, notification bookkeeping, and the React hooks.
 *
 * Only places a friend has shared at `friends` visibility participate — RLS
 * already restricts what we can read, so a private pin never leaks into an
 * overlap. The result powers a badge on the map pin and an "Also saved by …"
 * row in the detail sheet, plus a celebratory in-app alert the first time each
 * overlap is seen — which is how *both* people find out: the saver the moment
 * they save, their friend the next time they open the app.
 */
const SEEN_KEY = 'overlaps:notified';
const EMPTY: Profile[] = [];

interface OverlapState {
  /** Keyed by *your* stash id → the friends who also saved that place. */
  byStashId: Record<string, Profile[]>;
}

const store = createStore<OverlapState>({byStashId: {}});

let inFlight = false;

/**
 * Recompute overlaps against the latest friend pins and alert about any newly
 * discovered ones. Cheap to call often (guards against concurrent runs); safe
 * to call when signed out or with no friends — it just clears the overlap set.
 */
export async function reconcileFriendOverlaps(): Promise<void> {
  const myId = currentUserId();
  if (!myId || inFlight) {
    if (!myId) {
      store.setState({byStashId: {}});
    }
    return;
  }
  inFlight = true;
  try {
    const mine = getStashesSnapshot();
    const friends = getAcceptedFriends();
    if (mine.length === 0 || friends.length === 0) {
      store.setState({byStashId: {}});
      return;
    }

    const friendIds = friends.map(f => f.profile.id);
    const {data, error} = await supabase
      .from('stashes')
      .select('user_id, place_id, lat, lng')
      .in('user_id', friendIds)
      .in('visibility', ['friends', 'public']);
    if (error) {
      return;
    }

    const profileById = new Map(friends.map(f => [f.profile.id, f.profile]));
    const byStashId = computeOverlaps(
      mine,
      (data as FriendStashRow[]) ?? [],
      profileById,
    );
    store.setState({byStashId});
    await alertNewOverlaps(byStashId, mine);
  } finally {
    inFlight = false;
  }
}

/** First-time alerts for overlaps we haven't surfaced before. */
async function alertNewOverlaps(
  byStashId: Record<string, Profile[]>,
  mine: Stash[],
): Promise<void> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(SEEN_KEY);
  } catch {
    return;
  }
  // First ever run: adopt the current overlaps as the baseline silently, so we
  // don't dump a pile of pre-existing matches on the user the first time.
  const firstRun = raw === null;
  const seen = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  const stashById = new Map(mine.map(s => [s.id, s]));

  const fresh: {place: string; profiles: Profile[]}[] = [];
  for (const [stashId, profiles] of Object.entries(byStashId)) {
    const stash = stashById.get(stashId);
    if (!stash) {
      continue;
    }
    const unseen = profiles.filter(p => !seen.has(`${stashId}:${p.id}`));
    if (unseen.length > 0) {
      fresh.push({place: stash.place_name, profiles: unseen});
    }
    for (const p of profiles) {
      seen.add(`${stashId}:${p.id}`);
    }
  }

  try {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Best-effort; a failed write just means we might re-alert later.
  }

  if (firstRun || fresh.length === 0) {
    return;
  }
  Alert.alert('You crossed paths! 📍', overlapMessage(fresh));
}

/** Human-readable summary of one or more fresh overlaps. */
function overlapMessage(fresh: {place: string; profiles: Profile[]}[]): string {
  if (fresh.length === 1) {
    const {place, profiles} = fresh[0];
    return `You and ${friendLabel(profiles)} both saved ${place}.`;
  }
  const places = fresh.map(f => f.place);
  const head = places.slice(0, 3).join(', ');
  const more = places.length > 3 ? `, and ${places.length - 3} more` : '';
  return `You and your friends have both saved ${head}${more}.`;
}

/** Reset on sign-out. */
export function clearOverlaps(): void {
  store.setState({byStashId: {}});
}

/** React hook: the friends who also saved a given stash (stable empty array). */
export function useStashOverlap(stashId: string | null): Profile[] {
  return store.useSelector(s =>
    stashId ? s.byStashId[stashId] ?? EMPTY : EMPTY,
  );
}

/** React hook: the whole overlap map, for the pins on the map screen. */
export function useOverlapMap(): Record<string, Profile[]> {
  return store.useSelector(s => s.byStashId);
}
