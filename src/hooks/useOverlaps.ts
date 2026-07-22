import AsyncStorage from '@react-native-async-storage/async-storage';

import {supabase} from '../lib/supabase';
import {createStore} from '../lib/store';
import {computeOverlaps, friendLabel} from '../lib/overlap';
import type {FriendStashRow} from '../lib/overlap';
import {
  overlapMessageMultiple,
  overlapMessageSingle,
  overlapTitle,
} from '../lib/overlapMessages';
import {currentUserId} from './useAuth';
import {getStashesSnapshot} from './useStashes';
import {getAcceptedFriends} from './useFriends';
import type {Category, Profile, Stash} from '../types';

/**
 * Friend place-overlap engine: which of *your* saved places a friend has also
 * saved. The pure matching lives in lib/overlap.ts; this file owns the store,
 * the Supabase read, notification bookkeeping, and the React hooks.
 *
 * Only places a friend has shared at `friends` visibility participate — RLS
 * already restricts what we can read, so a private pin never leaks into an
 * overlap. The result powers a badge on the map pin and an "Also saved by …"
 * row in the detail sheet, plus a celebratory in-app dialog the first time each
 * overlap is seen — which is how *both* people find out: the saver the moment
 * they save, their friend the next time they open the app.
 *
 * The dialog is store state rendered by `<OverlapAlertDialog>` at the app
 * root rather than an imperative `Alert.alert` call: `reconcileFriendOverlaps`
 * runs on the sign-in effect, which can fire before the native root view has
 * finished presenting, and `Alert.alert` called that early is silently
 * dropped on iOS. That path — cold launch, no other trigger — is exactly the
 * friend's "next time they open the app" case, so it needs a dialog that just
 * paints whenever this state says so, no matter how early it's set.
 */
const SEEN_KEY = 'overlaps:notified';
const EMPTY: Profile[] = [];

/** A pending "you and a friend both saved this" notification. */
export interface OverlapAlert {
  title: string;
  message: string;
}

interface OverlapState {
  /** Keyed by *your* stash id → the friends who also saved that place. */
  byStashId: Record<string, Profile[]>;
  /** The notification queued for display, if any. */
  pendingAlert: OverlapAlert | null;
}

const store = createStore<OverlapState>({byStashId: {}, pendingAlert: null});

let inFlight = false;
// Rate-limit: this runs on every app foreground and every map focus. Without a
// guard, quick app switches fire a fresh friend-pin query each time. Reset on
// sign-out.
const RECONCILE_STALE_MS = 15_000;
let lastReconciledAt = 0;

/** Structural equality over overlap maps (same stash ids → same friend ids). */
function sameOverlapMap(
  a: Record<string, Profile[]>,
  b: Record<string, Profile[]>,
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) {
    return false;
  }
  for (const key of aKeys) {
    const av = a[key];
    const bv = b[key];
    if (!bv || av.length !== bv.length) {
      return false;
    }
    for (let i = 0; i < av.length; i++) {
      if (av[i].id !== bv[i].id) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Replace the overlap map only when it actually changed. `computeOverlaps`
 * returns a fresh object every run, so committing it unconditionally re-renders
 * the map screen — and every pin reads a new `friendCount` reference — even when
 * nothing about the overlaps changed.
 */
function setOverlapMap(byStashId: Record<string, Profile[]>): void {
  if (sameOverlapMap(store.getState().byStashId, byStashId)) {
    return;
  }
  store.setState({byStashId});
}

/**
 * Recompute overlaps against the latest friend pins and alert about any newly
 * discovered ones. Cheap to call often (guards against concurrent runs); safe
 * to call when signed out or with no friends — it just clears the overlap set.
 */
export async function reconcileFriendOverlaps(options?: {
  force?: boolean;
}): Promise<void> {
  const myId = currentUserId();
  if (!myId || inFlight) {
    if (!myId) {
      setOverlapMap({});
    }
    return;
  }
  if (!options?.force && Date.now() - lastReconciledAt < RECONCILE_STALE_MS) {
    return;
  }
  inFlight = true;
  lastReconciledAt = Date.now();
  try {
    const mine = getStashesSnapshot();
    const friends = getAcceptedFriends();
    if (mine.length === 0 || friends.length === 0) {
      setOverlapMap({});
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
    setOverlapMap(byStashId);
    await queueNewOverlapAlert(byStashId, mine);
  } finally {
    inFlight = false;
  }
}

/** Queues a first-time notification for overlaps we haven't surfaced before. */
async function queueNewOverlapAlert(
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

  const fresh: {
    place: string;
    category: Category | null;
    profiles: Profile[];
  }[] = [];
  for (const [stashId, profiles] of Object.entries(byStashId)) {
    const stash = stashById.get(stashId);
    if (!stash) {
      continue;
    }
    const unseen = profiles.filter(p => !seen.has(`${stashId}:${p.id}`));
    if (unseen.length > 0) {
      fresh.push({
        place: stash.place_name,
        category: stash.category,
        profiles: unseen,
      });
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
  store.setState({
    pendingAlert: {
      title: overlapTitle(),
      message: overlapMessage(fresh),
    },
  });
}

/** A fun, randomized summary of one or more fresh overlaps. */
function overlapMessage(
  fresh: {place: string; category: Category | null; profiles: Profile[]}[],
): string {
  if (fresh.length === 1) {
    const {place, category, profiles} = fresh[0];
    return overlapMessageSingle(category, friendLabel(profiles), place);
  }
  return overlapMessageMultiple(fresh.map(f => f.place));
}

/** Reset on sign-out. */
export function clearOverlaps(): void {
  lastReconciledAt = 0;
  store.setState({byStashId: {}, pendingAlert: null});
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

/** React hook: the currently queued overlap notification, if any. */
export function useOverlapAlert(): OverlapAlert | null {
  return store.useSelector(s => s.pendingAlert);
}

/** Dismiss the currently displayed overlap notification. */
export function dismissOverlapAlert(): void {
  store.setState({pendingAlert: null});
}
