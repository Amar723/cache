import {ENV} from './config';
import type {OpeningHours} from '../types';
import type {VideoLocation} from './tiktok';

export interface PlaceSelection {
  placeId: string | null;
  address: string;
  lat: number;
  lng: number;
  openingHours: OpeningHours | null;
}

const FUNCTIONS_BASE = `${ENV.SUPABASE_URL}/functions/v1/places`;
const HEADERS = {
  Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
  apikey: ENV.SUPABASE_ANON_KEY,
};

/**
 * Resolve a location scraped from a video's page into a real Google place —
 * gives an auto-detected pin the same place_id/formatted address/opening
 * hours a manual search would produce, so it dedupes and geofences exactly
 * like one. Falls back to the raw scraped name/coordinates (no place_id) if
 * Google can't find a confident match, since the rough location is still
 * better than nothing. Never throws: a failed lookup just means the user
 * falls back to the existing manual address search.
 */
export async function resolveDetectedPlace(
  loc: VideoLocation,
): Promise<PlaceSelection | null> {
  try {
    const findParams = new URLSearchParams({
      input: loc.name,
      inputtype: 'textquery',
      fields: 'place_id,formatted_address,geometry',
      locationbias: `circle:200@${loc.lat},${loc.lng}`,
    });
    const findRes = await fetch(
      `${FUNCTIONS_BASE}/place/findplacefromtext/json?${findParams.toString()}`,
      {headers: HEADERS},
    );
    if (findRes.ok) {
      const findJson = await findRes.json();
      const candidate = findJson?.candidates?.[0];
      if (candidate?.place_id) {
        return await fetchPlaceDetails(candidate.place_id, loc);
      }
    }
  } catch {
    // Fall through to the raw scraped coordinates below.
  }

  return {
    placeId: null,
    address: loc.address ?? loc.name,
    lat: loc.lat,
    lng: loc.lng,
    openingHours: null,
  };
}

async function fetchPlaceDetails(
  placeId: string,
  loc: VideoLocation,
): Promise<PlaceSelection> {
  const fallback: PlaceSelection = {
    placeId,
    address: loc.address ?? loc.name,
    lat: loc.lat,
    lng: loc.lng,
    openingHours: null,
  };

  try {
    const detailsParams = new URLSearchParams({
      place_id: placeId,
      fields: 'geometry,formatted_address,opening_hours,utc_offset',
    });
    const detailsRes = await fetch(
      `${FUNCTIONS_BASE}/place/details/json?${detailsParams.toString()}`,
      {headers: HEADERS},
    );
    if (!detailsRes.ok) {
      return fallback;
    }
    const detailsJson = await detailsRes.json();
    const result = detailsJson?.result;
    const location = result?.geometry?.location;
    if (!location) {
      return fallback;
    }
    const periods = result?.opening_hours?.periods;
    return {
      placeId,
      address: result?.formatted_address ?? fallback.address,
      lat: location.lat,
      lng: location.lng,
      openingHours:
        periods && periods.length > 0
          ? {periods, utc_offset_minutes: result?.utc_offset ?? 0}
          : null,
    };
  } catch {
    return fallback;
  }
}
