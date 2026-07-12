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
  // The user's home city, chosen at onboarding: a display label plus its
  // coordinates. Lets a friend's map center on their city with no geocoding.
  default_city: string | null;
  default_city_lat: number | null;
  default_city_lng: number | null;
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
  // The source video link (TikTok or Instagram). Null when the place was saved
  // without a link.
  video_url: string | null;
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

export type ProfileInsert = Omit<
  ProfileRow,
  'created_at' | 'default_city' | 'default_city_lat' | 'default_city_lng'
> & {
  created_at?: string;
  default_city?: string | null;
  default_city_lat?: number | null;
  default_city_lng?: number | null;
};

export type PushPlatform = 'ios' | 'android';

export interface PushTokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: PushPlatform;
  created_at: string;
  updated_at: string;
}

export type PushTokenInsert = Omit<
  PushTokenRow,
  'id' | 'created_at' | 'updated_at'
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
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
      push_tokens: {
        Row: PushTokenRow;
        Insert: PushTokenInsert;
        Update: Partial<PushTokenInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
