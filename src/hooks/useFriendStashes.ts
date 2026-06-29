import {useEffect, useState} from 'react';

import {supabase} from '../lib/supabase';
import type {Stash} from '../types';

interface UseFriendStashesResult {
  stashes: Stash[];
  loading: boolean;
  error: string | null;
}

/**
 * A single friend's shareable pins, for the read-only friend map. Kept local
 * (not in a global store) since it's scoped to one screen.
 *
 * RLS already limits rows to `('friends','public')` for accepted friends — the
 * explicit `visibility` filter is belt-and-suspenders, never the sole guard.
 */
export function useFriendStashes(friendId: string): UseFriendStashesResult {
  const [stashes, setStashes] = useState<Stash[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
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
        setStashes((data as Stash[]) ?? []);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [friendId]);

  return {stashes, loading, error};
}
