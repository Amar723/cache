import {useEffect, useRef, useState} from 'react';

import {supabase} from '../lib/supabase';
import {createStore} from '../lib/store';
import {fetchTikTokThumbnail, isTikTokUrl} from '../lib/tiktok';
import {currentUserId} from './useAuth';
import type {StashInsert} from '../lib/database.types';
import type {Stash, StashDraft} from '../types';

/**
 * The single source of truth for the user's saved places. Map, Saved, and
 * Profile all read from this store, so a "mark as visited" in the bottom sheet
 * instantly updates the pin, the list row, and the profile counts.
 */
interface StashState {
  stashes: Stash[];
  loading: boolean;
  error: string | null;
}

const store = createStore<StashState>({
  stashes: [],
  loading: false,
  error: null,
});

/** Fetch all of the current user's stashes, newest first. */
export async function refreshStashes(): Promise<void> {
  const userId = currentUserId();
  if (!userId) {
    store.setState({stashes: [], loading: false});
    return;
  }

  store.setState({loading: true, error: null});

  const {data, error} = await supabase
    .from('stashes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', {ascending: false});

  if (error) {
    store.setState({loading: false, error: error.message});
    return;
  }

  store.setState({stashes: (data as Stash[]) ?? [], loading: false});
}

/** Clear local state on sign-out. */
export function clearStashes(): void {
  store.setState({stashes: [], loading: false, error: null});
}

/**
 * Persist a new stash and optimistically prepend it. The form chooses a
 * `visibility` (default 'private'); we send it so friends maps (Phase 2) can
 * share the right pins.
 */
export async function createStash(draft: StashDraft): Promise<Stash> {
  const userId = currentUserId();
  if (!userId) {
    throw new Error('You must be signed in to save a place.');
  }

  const payload: StashInsert = {
    user_id: userId,
    place_name: draft.place_name,
    address: draft.address,
    lat: draft.lat,
    lng: draft.lng,
    category: draft.category,
    notes: draft.notes.length > 0 ? draft.notes : null,
    tiktok_url: draft.tiktok_url,
    thumbnail_url: draft.thumbnail_url,
    opening_hours: draft.opening_hours,
    place_id: draft.place_id,
    visibility: draft.visibility,
  };

  const {data, error} = await supabase
    .from('stashes')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const created = data as Stash;
  store.setState(prev => ({stashes: [created, ...prev.stashes]}));
  return created;
}

/**
 * Update an existing stash's editable fields and replace it in local state.
 * Takes the same draft shape the create form produces.
 */
export async function updateStash(
  stashId: string,
  draft: StashDraft,
): Promise<Stash> {
  const payload: Partial<StashInsert> = {
    place_name: draft.place_name,
    address: draft.address,
    lat: draft.lat,
    lng: draft.lng,
    category: draft.category,
    notes: draft.notes.length > 0 ? draft.notes : null,
    tiktok_url: draft.tiktok_url,
    thumbnail_url: draft.thumbnail_url,
    opening_hours: draft.opening_hours,
    place_id: draft.place_id,
    visibility: draft.visibility,
  };

  const {data, error} = await supabase
    .from('stashes')
    .update(payload)
    .eq('id', stashId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const updated = data as Stash;
  store.setState(prev => ({
    stashes: prev.stashes.map(s => (s.id === stashId ? updated : s)),
  }));
  return updated;
}

/** Permanently delete a stash and drop it from local state. */
export async function deleteStash(stashId: string): Promise<void> {
  const {error} = await supabase.from('stashes').delete().eq('id', stashId);

  if (error) {
    throw new Error(error.message);
  }

  store.setState(prev => ({
    stashes: prev.stashes.filter(s => s.id !== stashId),
  }));
}

/**
 * TikTok's oEmbed thumbnail is a signed CDN URL that expires after a while,
 * so a pin saved in the past can end up with a dead `thumbnail_url`. Called
 * when an <Image> fails to load; re-fetches a fresh URL from oEmbed (keyed
 * off the permanent `tiktok_url`) and persists it so future loads succeed.
 */
export async function refreshThumbnail(stash: Stash): Promise<string | null> {
  if (!isTikTokUrl(stash.tiktok_url)) {
    return null;
  }

  const {thumbnail_url} = await fetchTikTokThumbnail(stash.tiktok_url);
  if (!thumbnail_url) {
    return null;
  }

  const {data, error} = await supabase
    .from('stashes')
    .update({thumbnail_url})
    .eq('id', stash.id)
    .select()
    .single();

  if (error) {
    return thumbnail_url;
  }

  const updated = data as Stash;
  store.setState(prev => ({
    stashes: prev.stashes.map(s => (s.id === stash.id ? updated : s)),
  }));
  return thumbnail_url;
}

/**
 * The URI a thumbnail <Image> should render, with one automatic retry: if
 * the stored URL fails to load, fetch a fresh one and persist it. Shared by
 * every place a stash thumbnail is rendered (map pin, list row, detail sheet).
 */
export function useThumbnailUri(stash: Stash | null): {
  uri: string | null;
  onError: () => void;
} {
  const [uri, setUri] = useState<string | null>(stash?.thumbnail_url ?? null);
  const retried = useRef(false);

  useEffect(() => {
    setUri(stash?.thumbnail_url ?? null);
    retried.current = false;
  }, [stash?.thumbnail_url]);

  const onError = () => {
    if (retried.current || !stash) {
      setUri(null);
      return;
    }
    retried.current = true;
    refreshThumbnail(stash).then(fresh => setUri(fresh));
  };

  return {uri, onError};
}

/** Mark a stash visited (idempotent). Updates local state in place. */
export async function markVisited(stashId: string): Promise<void> {
  const visitedAt = new Date().toISOString();

  const {data, error} = await supabase
    .from('stashes')
    .update({visited_at: visitedAt})
    .eq('id', stashId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const updated = data as Stash;
  store.setState(prev => ({
    stashes: prev.stashes.map(s => (s.id === stashId ? updated : s)),
  }));
}

/** React hook: the full list + status + actions. */
export function useStashes() {
  const stashes = store.useSelector(s => s.stashes);
  const loading = store.useSelector(s => s.loading);
  const error = store.useSelector(s => s.error);

  return {
    stashes,
    loading,
    error,
    refreshStashes,
    createStash,
    updateStash,
    deleteStash,
    markVisited,
  };
}

/** React hook: a single stash by id (or null). */
export function useStash(stashId: string | null): Stash | null {
  return store.useSelector(s =>
    stashId ? s.stashes.find(st => st.id === stashId) ?? null : null,
  );
}

/** Read a stash synchronously outside React (deep-link resolution). */
export function getStashById(stashId: string): Stash | null {
  return store.getState().stashes.find(s => s.id === stashId) ?? null;
}

/** Read the full list synchronously outside React (the overlap engine). */
export function getStashesSnapshot(): Stash[] {
  return store.getState().stashes;
}
