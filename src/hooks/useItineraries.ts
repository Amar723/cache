import {supabase} from '../lib/supabase';
import {createStore} from '../lib/store';
import {currentUserId} from './useAuth';
import type {
  ItineraryInsert,
  ItineraryMemberInsert,
  ItineraryMemberStatus,
} from '../lib/database.types';
import type {Itinerary, Profile, Trip, TripInvite, TripMember} from '../types';

/**
 * Trips (Phase 3): shared itineraries. Mirrors useFriends — a single external
 * store plus async actions that read `currentUserId()` and talk to Supabase.
 * The Trips screen, the tab badge, and the map's trip labels all read from
 * here.
 *
 * RLS scopes the itineraries query to trips the viewer owns, has accepted, or
 * is invited to; we split those into `trips` and `invites` client-side.
 */
interface ItinerariesState {
  trips: Trip[];
  invites: TripInvite[];
  loading: boolean;
  error: string | null;
}

const store = createStore<ItinerariesState>({
  trips: [],
  invites: [],
  loading: false,
  error: null,
});

/** Everyone in a trip beyond the owner, capped client-side. */
export const MAX_TRIP_MEMBERS = 20;

/** An itineraries row with the owner + member profiles embedded. */
interface TripJoinRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  owner: Profile | null;
  members: {
    id: string;
    user_id: string;
    status: ItineraryMemberStatus;
    profile: Profile | null;
  }[];
}

const TRIP_SELECT =
  '*, owner:profiles!owner_id(*), ' +
  'members:itinerary_members(id, user_id, status, profile:profiles!user_id(*))';

/**
 * Split raw itinerary rows into the viewer's trips and pending invites. Pure
 * and exported for unit testing. A row is an invite when the viewer's own
 * member row is still 'pending'; the owner never has a member row.
 */
export function partitionTrips(
  rows: TripJoinRow[],
  myId: string,
): Pick<ItinerariesState, 'trips' | 'invites'> {
  const trips: Trip[] = [];
  const invites: TripInvite[] = [];

  for (const row of rows) {
    if (!row.owner) {
      continue; // The owner's profile went missing; skip rather than crash.
    }
    const itinerary: Itinerary = {
      id: row.id,
      owner_id: row.owner_id,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
    const isOwner = row.owner_id === myId;
    const myMembership = row.members.find(m => m.user_id === myId);

    if (!isOwner && myMembership?.status === 'pending') {
      invites.push({memberId: myMembership.id, itinerary, owner: row.owner});
      continue;
    }

    const members: TripMember[] = [];
    for (const m of row.members) {
      if (m.profile) {
        members.push({memberId: m.id, profile: m.profile, status: m.status});
      }
    }
    trips.push({itinerary, owner: row.owner, members, isOwner});
  }

  return {trips, invites};
}

/** Load every trip the current user owns, belongs to, or is invited to. */
export async function refreshItineraries(): Promise<void> {
  const myId = currentUserId();
  if (!myId) {
    clearItineraries();
    return;
  }

  store.setState({loading: true, error: null});

  const {data, error} = await supabase
    .from('itineraries')
    .select(TRIP_SELECT)
    .order('created_at', {ascending: false});

  if (error) {
    store.setState({loading: false, error: error.message});
    return;
  }

  const parts = partitionTrips((data as unknown as TripJoinRow[]) ?? [], myId);
  store.setState({...parts, loading: false});
}

/** Reset on sign-out. */
export function clearItineraries(): void {
  store.setState({trips: [], invites: [], loading: false, error: null});
}

/** Create a trip owned by the current user. Returns the new itinerary. */
export async function createTrip(name: string): Promise<Itinerary> {
  const myId = currentUserId();
  if (!myId) {
    throw new Error('You must be signed in.');
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Give your trip a name.');
  }

  const payload: ItineraryInsert = {owner_id: myId, name: trimmed};
  const {data, error} = await supabase
    .from('itineraries')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
  await refreshItineraries();
  return data as Itinerary;
}

/** Rename a trip (owner only — enforced by RLS). */
export async function renameTrip(
  itineraryId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Give your trip a name.');
  }
  const {error} = await supabase
    .from('itineraries')
    .update({name: trimmed})
    .eq('id', itineraryId);
  if (error) {
    throw new Error(error.message);
  }
  await refreshItineraries();
}

/** Delete a trip, its memberships, and its entries (owner only). */
export async function deleteTrip(itineraryId: string): Promise<void> {
  const {error} = await supabase
    .from('itineraries')
    .delete()
    .eq('id', itineraryId);
  if (error) {
    throw new Error(error.message);
  }
  await refreshItineraries();
}

/**
 * Invite an accepted friend to a trip (owner only — RLS also verifies the
 * friendship). They see the trip immediately, but not its places until they
 * accept.
 */
export async function inviteToTrip(
  itineraryId: string,
  userId: string,
): Promise<void> {
  const trip = store.getState().trips.find(t => t.itinerary.id === itineraryId);
  if (trip && trip.members.length >= MAX_TRIP_MEMBERS) {
    throw new Error(`Trips are capped at ${MAX_TRIP_MEMBERS} people.`);
  }

  const payload: ItineraryMemberInsert = {
    itinerary_id: itineraryId,
    user_id: userId,
    status: 'pending',
  };
  const {error} = await supabase.from('itinerary_members').insert(payload);
  if (error) {
    // 23505 = the unique (itinerary_id, user_id) index.
    if (error.code === '23505') {
      throw new Error('They are already invited or a member of this trip.');
    }
    throw new Error(error.message);
  }
  await refreshItineraries();
}

/** Accept an invitation to someone else's trip. */
export async function acceptInvite(memberId: string): Promise<void> {
  const {error} = await supabase
    .from('itinerary_members')
    .update({status: 'accepted'})
    .eq('id', memberId);
  if (error) {
    throw new Error(error.message);
  }
  await refreshItineraries();
}

/** Decline an invitation (deletes the row, so the owner can re-invite). */
export async function declineInvite(memberId: string): Promise<void> {
  await deleteMembership(memberId);
}

/** Leave a trip you previously accepted. Your added places go with you. */
export async function leaveTrip(memberId: string): Promise<void> {
  await deleteMembership(memberId);
}

/** Remove a member (owner only). Their added places go with them. */
export async function removeMember(memberId: string): Promise<void> {
  await deleteMembership(memberId);
}

async function deleteMembership(memberId: string): Promise<void> {
  const {error} = await supabase
    .from('itinerary_members')
    .delete()
    .eq('id', memberId);
  if (error) {
    throw new Error(error.message);
  }
  await refreshItineraries();
}

/** React hook: trips + invites + actions. */
export function useItineraries() {
  const trips = store.useSelector(s => s.trips);
  const invites = store.useSelector(s => s.invites);
  const loading = store.useSelector(s => s.loading);
  const error = store.useSelector(s => s.error);

  return {
    trips,
    invites,
    loading,
    error,
    refreshItineraries,
    createTrip,
    renameTrip,
    deleteTrip,
    inviteToTrip,
    acceptInvite,
    declineInvite,
    leaveTrip,
    removeMember,
  };
}

/** React hook: a single trip by itinerary id (or null). */
export function useTrip(itineraryId: string | null): Trip | null {
  return store.useSelector(s =>
    itineraryId
      ? s.trips.find(t => t.itinerary.id === itineraryId) ?? null
      : null,
  );
}

/** React hook: just the pending-invite count, for the tab badge. */
export function useTripInviteCount(): number {
  return store.useSelector(s => s.invites.length);
}

/** Read trips synchronously outside React. */
export function getTripsSnapshot(): Trip[] {
  return store.getState().trips;
}
