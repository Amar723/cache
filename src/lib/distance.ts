/**
 * Haversine great-circle distance between two WGS-84 coordinates.
 * Returns metres. Used by the proximity engine to bucket stashes into tiers.
 */
const EARTH_RADIUS_M = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Proximity tier thresholds, in metres. */
export const TIER_1_RADIUS_M = 100; // "You made it"
export const TIER_2_RADIUS_M = 1_000; // "today looks like a great day"

export type ProximityTier = 'arrived' | 'nearby' | 'far';

/** Classify a distance into a notification tier. */
export function classifyTier(distanceMeters: number): ProximityTier {
  if (distanceMeters <= TIER_1_RADIUS_M) {
    return 'arrived';
  }
  if (distanceMeters <= TIER_2_RADIUS_M) {
    return 'nearby';
  }
  return 'far';
}
