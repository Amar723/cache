import type {
  Category,
  FriendshipStatus,
  ItineraryMemberStatus,
  ItineraryRow,
  OpeningHours,
  ProfileRow,
  StashRow,
  Visibility,
} from './lib/database.types';

export type {
  Category,
  FriendshipStatus,
  ItineraryMemberStatus,
  OpeningHours,
  Visibility,
};

/** A saved place. Alias of the DB row so screens never import db types directly. */
export type Stash = StashRow;
export type Profile = ProfileRow;
export type Itinerary = ItineraryRow;

/**
 * An accepted friend, or a pending request. `profile` is always the *other*
 * person; `friendshipId` lets the UI accept/decline/remove the relationship.
 */
export interface Friend {
  friendshipId: string;
  profile: Profile;
}

export interface FriendRequest {
  friendshipId: string;
  profile: Profile;
}

/** Someone invited to / part of a trip. `memberId` = itinerary_members.id. */
export interface TripMember {
  memberId: string;
  profile: Profile;
  status: ItineraryMemberStatus;
}

/** A trip the viewer owns or has accepted. The owner is not in `members`. */
export interface Trip {
  itinerary: Itinerary;
  owner: Profile;
  members: TripMember[];
  isOwner: boolean;
}

/** A pending invitation to someone else's trip, from the viewer's POV. */
export interface TripInvite {
  memberId: string;
  itinerary: Itinerary;
  owner: Profile;
}

/**
 * A stash shared into a trip, joined with its stash row and the profile of
 * whoever added it. `scheduledDate`/`scheduledTime` are destination
 * wall-clock strings ('YYYY-MM-DD' / 'HH:MM:SS'), never Date objects.
 */
export interface TripStashEntry {
  entryId: string;
  itineraryId: string;
  stash: Stash;
  addedBy: Profile | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
}

/** Ordered category options for the picker. */
export const CATEGORIES: Category[] = [
  'Food',
  'Cafe',
  'Bar',
  'Experience',
  'Shopping',
  'Other',
];

/** Payload collected by AddStashForm before it is persisted. */
export interface StashDraft {
  place_name: string;
  address: string;
  lat: number;
  lng: number;
  category: Category;
  notes: string;
  tiktok_url: string;
  thumbnail_url: string | null;
  opening_hours: OpeningHours | null;
  place_id: string | null;
  visibility: Visibility;
}

/**
 * Navigation param lists. Centralised so the notification deep-link layer and
 * the screens agree on the shape of `{stashId}` params.
 */
export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  UpdatePassword: undefined;
  Tabs: {screen?: keyof TabParamList} | undefined;
  // `sharedUrl` from a share; `stashId` opens the form in edit mode. Neither =
  // manual add.
  AddStash: {sharedUrl?: string; stashId?: string} | undefined;
  // A friend's read-only map.
  FriendMap: {friendId: string; username: string};
};

export type TabParamList = {
  Map: {focusStashId?: string} | undefined;
  Saved: {focusStashId?: string} | undefined;
  Friends: undefined;
  Profile: undefined;
};
