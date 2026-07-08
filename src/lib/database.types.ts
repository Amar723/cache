/**
 * Hand-maintained typing of the Supabase schema. Mirrors `supabase/schema.sql`.
 *
 * If you later adopt the Supabase CLI you can regenerate this file with
 * `supabase gen types typescript --project-id <ref>` and delete the hand
 * version — the rest of the app only imports the named row/insert types below.
 */
export type Category =
  | 'Food'
  | 'Cafe'
  | 'Bar'
  | 'Experience'
  | 'Shopping'
  | 'Other';

/**
 * Visibility is an open string in the DB (text, default 'private'). Phase 2
 * introduces 'friends'; keeping it a union here means the moment we add that
 * value the friends-map reads type-check without a schema migration.
 */
export type Visibility = 'private' | 'friends' | 'public';

export interface ProfileRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

/** Phase 2: the lifecycle of a mutual friend relationship. */
export type FriendshipStatus = 'pending' | 'accepted' | 'declined';

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export type FriendshipInsert = {
  requester_id: string;
  addressee_id: string;
  status?: FriendshipStatus;
};

/** A single open→close span. `day` is 0 (Sunday)..6, `time` is "HHMM". */
export interface OpeningPeriod {
  open: {day: number; time: string};
  close?: {day: number; time: string};
}

/**
 * Regular weekly opening hours, captured from Google Places at save time. A 24/7
 * place is a single period (open day 0, time "0000", no `close`); closed days
 * are simply omitted. `utc_offset_minutes` lets the native geofence evaluate
 * "open now" in the place's local time, not the device's.
 */
export interface OpeningHours {
  periods: OpeningPeriod[];
  utc_offset_minutes: number;
}

export interface StashRow {
  id: string;
  user_id: string;
  place_name: string;
  address: string | null;
  lat: number;
  lng: number;
  category: Category | null;
  notes: string | null;
  tiktok_url: string | null;
  thumbnail_url: string | null;
  opening_hours: OpeningHours | null;
  place_id: string | null;
  visibility: Visibility;
  visited_at: string | null;
  created_at: string;
}

export type StashInsert = Omit<
  StashRow,
  'id' | 'created_at' | 'visited_at' | 'visibility'
> & {
  id?: string;
  created_at?: string;
  visited_at?: string | null;
  visibility?: Visibility;
};

export type ProfileInsert = Omit<ProfileRow, 'created_at'> & {
  created_at?: string;
};

/**
 * Phase 3 (trips): the invite lifecycle of an itinerary member. Declining an
 * invite deletes the row, so there is no 'declined' state; the owner has no
 * row at all (ownership is implicit membership).
 */
export type ItineraryMemberStatus = 'pending' | 'accepted';

export interface ItineraryRow {
  id: string;
  owner_id: string;
  name: string;
  trip_date: string;
  trip_end_date: string;
  trip_time: string | null;
  created_at: string;
  updated_at: string;
}

export type ItineraryInsert = {
  owner_id: string;
  name: string;
  trip_date: string;
  trip_end_date: string;
  trip_time?: string | null;
  id?: string;
};

export interface ItineraryMemberRow {
  id: string;
  itinerary_id: string;
  user_id: string;
  status: ItineraryMemberStatus;
  created_at: string;
  updated_at: string;
}

export type ItineraryMemberInsert = {
  itinerary_id: string;
  user_id: string;
  status?: ItineraryMemberStatus;
};

/**
 * A stash shared into a trip. `scheduled_date` ('YYYY-MM-DD') and
 * `scheduled_time` ('HH:MM:SS') are destination wall-clock — never convert
 * them through Date/UTC or the day can shift.
 */
export interface ItineraryStashRow {
  id: string;
  itinerary_id: string;
  stash_id: string;
  added_by: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  created_at: string;
}

export type ItineraryStashInsert = {
  itinerary_id: string;
  stash_id: string;
  added_by: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      stashes: {
        Row: StashRow;
        Insert: StashInsert;
        Update: Partial<StashInsert>;
        Relationships: [];
      };
      friendships: {
        Row: FriendshipRow;
        Insert: FriendshipInsert;
        Update: Partial<FriendshipInsert>;
        Relationships: [];
      };
      itineraries: {
        Row: ItineraryRow;
        Insert: ItineraryInsert;
        Update: Partial<ItineraryInsert>;
        Relationships: [];
      };
      itinerary_members: {
        Row: ItineraryMemberRow;
        Insert: ItineraryMemberInsert;
        Update: Partial<ItineraryMemberInsert>;
        Relationships: [];
      };
      itinerary_stashes: {
        Row: ItineraryStashRow;
        Insert: ItineraryStashInsert;
        Update: Partial<ItineraryStashInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
