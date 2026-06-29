import {supabase} from '../lib/supabase';
import {createStore} from '../lib/store';
import {currentUserId} from './useAuth';
import type {FriendshipInsert, FriendshipStatus} from '../lib/database.types';
import type {Friend, FriendRequest, Profile} from '../types';

/**
 * The friend graph (Phase 2). Mirrors useStashes: a single external store plus
 * async actions that read `currentUserId()` and talk to Supabase. The Friends
 * screen and the tab badge both read from here.
 *
 * One `friendships` row models a pair. We surface it three ways from the
 * viewer's perspective: accepted = friend, pending you received = incoming,
 * pending you sent = outgoing.
 */
interface FriendsState {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  loading: boolean;
  error: string | null;
}

const store = createStore<FriendsState>({
  friends: [],
  incoming: [],
  outgoing: [],
  loading: false,
  error: null,
});

/** A friendships row with both profiles embedded (the shape refreshFriends reads). */
interface FriendshipJoinRow {
  id: string;
  status: FriendshipStatus;
  requester_id: string;
  addressee_id: string;
  requester: Profile | null;
  addressee: Profile | null;
}

const JOIN_SELECT =
  'id, status, requester_id, addressee_id, ' +
  'requester:profiles!requester_id(*), addressee:profiles!addressee_id(*)';

/**
 * Split raw friendship rows into the viewer's friends / incoming / outgoing.
 * Pure and exported for unit testing. `profile` is always the *other* person.
 */
export function partitionFriendships(
  rows: FriendshipJoinRow[],
  myId: string,
): Pick<FriendsState, 'friends' | 'incoming' | 'outgoing'> {
  const friends: Friend[] = [];
  const incoming: FriendRequest[] = [];
  const outgoing: FriendRequest[] = [];

  for (const row of rows) {
    const other = row.requester_id === myId ? row.addressee : row.requester;
    if (!other) {
      continue; // A profile row went missing; skip rather than crash.
    }
    const entry = {friendshipId: row.id, profile: other};

    if (row.status === 'accepted') {
      friends.push(entry);
    } else if (row.status === 'pending') {
      if (row.addressee_id === myId) {
        incoming.push(entry);
      } else {
        outgoing.push(entry);
      }
    }
    // 'declined' rows are intentionally dropped from the UI.
  }

  return {friends, incoming, outgoing};
}

/** Load every relationship the current user is part of. */
export async function refreshFriends(): Promise<void> {
  const myId = currentUserId();
  if (!myId) {
    clearFriends();
    return;
  }

  store.setState({loading: true, error: null});

  const {data, error} = await supabase
    .from('friendships')
    .select(JOIN_SELECT)
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);

  if (error) {
    store.setState({loading: false, error: error.message});
    return;
  }

  const parts = partitionFriendships(
    (data as unknown as FriendshipJoinRow[]) ?? [],
    myId,
  );
  store.setState({...parts, loading: false});
}

/** Reset on sign-out. */
export function clearFriends(): void {
  store.setState({
    friends: [],
    incoming: [],
    outgoing: [],
    loading: false,
    error: null,
  });
}

/** Find people by username (excludes yourself). Returns matches, not stored. */
export async function searchUsers(query: string): Promise<Profile[]> {
  const q = query.trim();
  const myId = currentUserId();
  if (q.length < 2 || !myId) {
    return [];
  }
  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', `%${q}%`)
    .neq('id', myId)
    .limit(20);

  if (error) {
    return [];
  }
  return (data as Profile[]) ?? [];
}

/** Send a friend request to another user. */
export async function sendRequest(addresseeId: string): Promise<void> {
  const myId = currentUserId();
  if (!myId) {
    throw new Error('You must be signed in.');
  }
  const payload: FriendshipInsert = {
    requester_id: myId,
    addressee_id: addresseeId,
    status: 'pending',
  };
  const {error} = await supabase.from('friendships').insert(payload);
  if (error) {
    // 23505 = the unique pair index — a relationship already exists.
    if (error.code === '23505') {
      throw new Error('You already have a connection with this person.');
    }
    throw new Error(error.message);
  }
  await refreshFriends();
}

/** Accept an incoming request. */
export async function acceptRequest(friendshipId: string): Promise<void> {
  await updateStatus(friendshipId, 'accepted');
}

/** Decline an incoming request (kept as 'declined' so it doesn't re-prompt). */
export async function declineRequest(friendshipId: string): Promise<void> {
  await updateStatus(friendshipId, 'declined');
}

async function updateStatus(
  friendshipId: string,
  status: FriendshipStatus,
): Promise<void> {
  const {error} = await supabase
    .from('friendships')
    .update({status})
    .eq('id', friendshipId);
  if (error) {
    throw new Error(error.message);
  }
  await refreshFriends();
}

/** Remove a friend or cancel an outgoing request (deletes the row). */
export async function removeFriend(friendshipId: string): Promise<void> {
  const {error} = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);
  if (error) {
    throw new Error(error.message);
  }
  await refreshFriends();
}

/** React hook: the full friend graph + actions. */
export function useFriends() {
  const friends = store.useSelector(s => s.friends);
  const incoming = store.useSelector(s => s.incoming);
  const outgoing = store.useSelector(s => s.outgoing);
  const loading = store.useSelector(s => s.loading);
  const error = store.useSelector(s => s.error);

  return {
    friends,
    incoming,
    outgoing,
    loading,
    error,
    refreshFriends,
    searchUsers,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  };
}

/** React hook: just the incoming-request count, for the tab badge. */
export function useIncomingRequestCount(): number {
  return store.useSelector(s => s.incoming.length);
}

/** Accepted friends, read synchronously outside React (the overlap engine). */
export function getAcceptedFriends(): Friend[] {
  return store.getState().friends;
}
