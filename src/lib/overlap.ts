import {haversineMeters} from './distance';
import type {Profile, Stash} from '../types';

/**
 * Pure friend place-overlap matching. Kept free of React/native imports so it
 * can be unit-tested in isolation; the stateful engine lives in
 * hooks/useOverlaps.ts.
 *
 * Two pins are "the same place" when they share a Google `place_id`; when either
 * lacks one we fall back to a tight proximity match.
 */
export const OVERLAP_RADIUS_M = 60;

/** The subset of a friend's stash the matcher needs. */
export interface FriendStashRow {
  user_id: string;
  place_id: string | null;
  lat: number;
  lng: number;
}

/** Whether two places are the same: same Google id, else within ~60 m. */
export function samePlace(
  a: {place_id: string | null; lat: number; lng: number},
  b: {place_id: string | null; lat: number; lng: number},
): boolean {
  if (a.place_id && b.place_id) {
    return a.place_id === b.place_id;
  }
  return (
    haversineMeters({lat: a.lat, lng: a.lng}, {lat: b.lat, lng: b.lng}) <=
    OVERLAP_RADIUS_M
  );
}

/**
 * For each of my stashes, collect the distinct friends whose visible stashes
 * match the same place. Returns a map keyed by *my* stash id.
 */
export function computeOverlaps(
  mine: Pick<Stash, 'id' | 'place_id' | 'lat' | 'lng'>[],
  friendStashes: FriendStashRow[],
  profileById: Map<string, Profile>,
): Record<string, Profile[]> {
  const byStashId: Record<string, Profile[]> = {};
  for (const m of mine) {
    const seen = new Set<string>();
    const matches: Profile[] = [];
    for (const f of friendStashes) {
      if (seen.has(f.user_id)) {
        continue;
      }
      if (samePlace(m, f)) {
        const profile = profileById.get(f.user_id);
        if (profile) {
          matches.push(profile);
          seen.add(f.user_id);
        }
      }
    }
    if (matches.length > 0) {
      byStashId[m.id] = matches;
    }
  }
  return byStashId;
}

/** "@alex", "@alex and @sam", or "@alex and 2 others". */
export function friendLabel(profiles: Profile[]): string {
  const name = (p: Profile) => p.display_name || `@${p.username}`;
  if (profiles.length === 1) {
    return name(profiles[0]);
  }
  if (profiles.length === 2) {
    return `${name(profiles[0])} and ${name(profiles[1])}`;
  }
  return `${name(profiles[0])} and ${profiles.length - 1} others`;
}
