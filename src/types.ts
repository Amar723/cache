import type {
  Category,
  FriendshipStatus,
  OpeningHours,
  ProfileRow,
  StashRow,
  Visibility,
} from './lib/database.types';

export type {Category, FriendshipStatus, OpeningHours, Visibility};

/** A saved place. Alias of the DB row so screens never import db types directly. */
export type Stash = StashRow;
export type Profile = ProfileRow;

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
  ChangePassword: undefined;
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
