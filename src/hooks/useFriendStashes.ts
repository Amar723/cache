import {useEffect, useState} from 'react';

import {supabase} from '../lib/supabase';
import type {Stash} from '../types';

interface UseFriendStashesResult {
  stashes: Stash[];
  loading: boolean;
  error: string | null;
}

// A tiny per-friend cache. A fresh screen instance mounts on every navigation
// into a friend's map, so without this each visit refetches from scratch. We
// serve the cached pins immediately (stale-while-revalidate) and only show the
// spinner when there is nothing cached to show.
const FRIEND_STASH_STALE_MS = 60_000;
const cache = new Map<string, {stashes: Stash[]; fetchedAt: number}>();

/**
 * A single friend's shareable pins, for the read-only friend map. Kept local
 * (not in a global store) since it's scoped to one screen.
 *
 * RLS already limits rows to `('friends','public')` for accepted friends — the
 * explicit `visibility` filter is belt-and-suspenders, never the sole guard.
 */
export function useFriendStashes(friendId: string): UseFriendStashesResult {
  const cached = cache.get(friendId);
  const [stashes, setStashes] = useState<Stash[]>(cached?.stashes ?? []);
  const [loading, setLoading] = useState(cached == null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const entry = cache.get(friendId);
    if (entry) {
      // Paint the cached pins right away; only hit the network if they're stale.
      setStashes(entry.stashes);
      setLoading(false);
      if (Date.now() - entry.fetchedAt < FRIEND_STASH_STALE_MS) {
        return;
      }
    } else {
      setLoading(true);
    }

    let active = true;
    setError(null);

    supabase
      .from('stashes')
      .select('*')
      .eq('user_id', friendId)
      .in('visibility', ['friends', 'public'])
      .order('created_at', {ascending: false})
      .then(({data, error: err}) => {
        if (!active) {
          return;
        }
        if (err) {
          setError(err.message);
          setLoading(false);
          return;
        }
        const rows = (data as Stash[]) ?? [];
        cache.set(friendId, {stashes: rows, fetchedAt: Date.now()});
        setStashes(rows);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [friendId]);

  return {stashes, loading, error};
}
