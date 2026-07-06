import {Linking} from 'react-native';

/**
 * TikTok / Reel helpers: oEmbed thumbnail fetching and deep-linking.
 */

export interface TikTokOEmbed {
  thumbnail_url: string | null;
  title: string | null;
  author_name: string | null;
}

/** A creator-tagged location pulled from a video's page, before it's been
 * resolved against Google Places. */
export interface VideoLocation {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
}

const OEMBED_ENDPOINT = 'https://www.tiktok.com/oembed';

/**
 * Fetch the thumbnail (and a little metadata) for a shared video URL.
 *
 * Returns `{thumbnail_url: null}` on any failure so the form can fall back to a
 * plain placeholder showing the raw URL, exactly as the spec requires. We never
 * throw — a flaky oEmbed call must not block the user from saving a place.
 */
export async function fetchTikTokThumbnail(
  videoUrl: string,
): Promise<TikTokOEmbed> {
  const empty: TikTokOEmbed = {
    thumbnail_url: null,
    title: null,
    author_name: null,
  };

  try {
    const url = `${OEMBED_ENDPOINT}?url=${encodeURIComponent(videoUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: 'GET',
      headers: {Accept: 'application/json'},
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return empty;
    }

    const json = (await res.json()) as Partial<TikTokOEmbed>;
    return {
      thumbnail_url:
        typeof json.thumbnail_url === 'string' && json.thumbnail_url.length > 0
          ? json.thumbnail_url
          : null,
      title: typeof json.title === 'string' ? json.title : null,
      author_name:
        typeof json.author_name === 'string' ? json.author_name : null,
    };
  } catch {
    return empty;
  }
}

const TIKTOK_UNIVERSAL_DATA_RE =
  /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/;

/**
 * Best-effort extraction of a creator-tagged location from a TikTok video.
 * TikTok's oEmbed endpoint (used for the thumbnail above) never includes
 * location, so this fetches the full video page instead and parses the
 * embedded `__UNIVERSAL_DATA_FOR_REHYDRATION__` JSON for a POI tag. That
 * schema is undocumented and TikTok aggressively captcha-walls non-device
 * traffic, so a null result is expected and common — it means "couldn't
 * tell", not "no location", and the caller must treat this as a bonus on top
 * of the manual address search, never a replacement for it.
 */
export async function fetchTikTokLocation(
  videoUrl: string,
): Promise<VideoLocation | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(videoUrl, {
      headers: {Accept: 'text/html'},
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    const match = html.match(TIKTOK_UNIVERSAL_DATA_RE);
    if (!match) {
      return null;
    }

    const data = JSON.parse(match[1]);
    const item =
      data?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
    return item ? findTikTokItemLocation(item) : null;
  } catch {
    return null;
  }
}

/**
 * TikTok doesn't document the location-tag schema, and we can't probe a
 * live tagged video from a server-side environment (it gets captcha-walled
 * before the JSON ever loads). This checks the candidate shapes reported by
 * the wider scraping community — a top-level `poi` object, or a POI anchor
 * inside `anchors` with its details JSON-encoded in `extraInfo` — and gives
 * up rather than guess if neither matches.
 */
export function findTikTokItemLocation(item: unknown): VideoLocation | null {
  const fromPoi = toVideoLocation((item as {poi?: unknown})?.poi);
  if (fromPoi) {
    return fromPoi;
  }

  const anchors = (item as {anchors?: unknown[]})?.anchors;
  if (Array.isArray(anchors)) {
    for (const anchor of anchors) {
      const extraInfo = (anchor as {extraInfo?: unknown})?.extraInfo;
      if (typeof extraInfo === 'string') {
        try {
          const fromAnchor = toVideoLocation(JSON.parse(extraInfo));
          if (fromAnchor) {
            return fromAnchor;
          }
        } catch {
          // Not a POI-shaped anchor; keep looking.
        }
      }
    }
  }

  return null;
}

function toVideoLocation(obj: unknown): VideoLocation | null {
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  const o = obj as Record<string, unknown>;
  const name = o.poiName ?? o.name ?? o.title;
  const lat = o.latitude ?? o.lat;
  const lng = o.longitude ?? o.lng ?? o.lon;
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    typeof lat !== 'number' ||
    typeof lng !== 'number'
  ) {
    return null;
  }
  const address = o.address ?? o.poiAddress;
  return {
    name,
    address: typeof address === 'string' ? address : null,
    lat,
    lng,
  };
}

/**
 * Fetch the thumbnail for a shared Instagram Reel/post URL, via the
 * `instagram-oembed` edge function (Instagram's oEmbed needs a Meta access
 * token, so the client never calls Meta directly — see that function for why).
 *
 * Same never-throw contract as `fetchTikTokThumbnail`: any failure returns
 * `{thumbnail_url: null}` so the form falls back to the plain placeholder.
 */
export async function fetchInstagramThumbnail(
  videoUrl: string,
): Promise<TikTokOEmbed> {
  const empty: TikTokOEmbed = {
    thumbnail_url: null,
    title: null,
    author_name: null,
  };

  try {
    // Lazy require: `supabase.ts` pulls in RN-native deps (AsyncStorage, the
    // URL polyfill) that Jest can't transform, which would break this file's
    // pure URL-matching functions (isTikTokUrl, extractUrl, ...) under test.

    const {supabase} = require('./supabase') as typeof import('./supabase');
    const {data, error} = await supabase.functions.invoke('instagram-oembed', {
      body: {url: videoUrl},
    });

    if (error || !data) {
      return empty;
    }

    const json = data as Partial<TikTokOEmbed>;
    return {
      thumbnail_url:
        typeof json.thumbnail_url === 'string' && json.thumbnail_url.length > 0
          ? json.thumbnail_url
          : null,
      title: typeof json.title === 'string' ? json.title : null,
      author_name:
        typeof json.author_name === 'string' ? json.author_name : null,
    };
  } catch {
    return empty;
  }
}

// Instagram's web app's own public client id, sent by every logged-out
// visitor to instagram.com — not a secret, just an identifier the GraphQL
// endpoint requires on the request.
const IG_APP_ID = '936619743392459';
// The GraphQL query Instagram's own web client uses to load a single post by
// shortcode. Undocumented and rotated periodically as an anti-scraping
// measure (no warning, no deprecation notice) — if Instagram location
// detection silently stops working, re-discovering this value (via a
// browser's network tab on an actual post page) is the first thing to check.
const IG_POST_DOC_ID = '10015901848480474';

export function extractInstagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|reels|p)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

/**
 * Best-effort extraction of a creator-tagged location from an Instagram
 * Reel/post, via Instagram's own (undocumented, unofficial) GraphQL endpoint
 * — there is no oEmbed field or official API for this. Expect this to need
 * periodic upkeep as Instagram changes `IG_POST_DOC_ID`; until then it
 * degrades to null exactly like every other lookup in this file, so a break
 * here never blocks saving a stash.
 */
export async function fetchInstagramLocation(
  videoUrl: string,
): Promise<VideoLocation | null> {
  const shortcode = extractInstagramShortcode(videoUrl);
  if (!shortcode) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const body = new URLSearchParams({
      doc_id: IG_POST_DOC_ID,
      variables: JSON.stringify({shortcode}),
    });
    const res = await fetch('https://www.instagram.com/graphql/query/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-ig-app-id': IG_APP_ID,
      },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    const location = json?.data?.shortcode_media?.location;
    const name = location?.name;
    const lat = location?.lat;
    const lng = location?.lng;
    if (typeof name !== 'string' || name.length === 0) {
      return null;
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return null;
    }
    return {name, address: null, lat, lng};
  } catch {
    return null;
  }
}

/**
 * Pull the first http(s) URL out of arbitrary shared text. Share sheets often
 * deliver a caption like "Check this out https://vm.tiktok.com/abc/" rather
 * than a bare URL, so we extract it defensively.
 */
export function extractUrl(shared: string | null | undefined): string | null {
  if (!shared) {
    return null;
  }
  const match = shared.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

/**
 * True only for TikTok links. TikTok exposes a tokenless oEmbed endpoint, so
 * these go straight to `fetchTikTokThumbnail`. Covers the short-link domains
 * share sheets emit (vm./vt.tiktok.com).
 */
export function isTikTokUrl(url: string): boolean {
  return /tiktok\.com/i.test(url);
}

/**
 * True for Instagram Reel/post links. Instagram's oEmbed endpoint requires a
 * Meta access token, so these route through `fetchInstagramThumbnail` (which
 * proxies to the `instagram-oembed` edge function) rather than calling Meta
 * directly from the client.
 */
export function isInstagramUrl(url: string): boolean {
  return /instagr\.am|instagram\.com\/(?:reel|reels|share|p)\//i.test(url);
}

/**
 * True for the URLs Cache understands — TikTok and Instagram Reels. We are
 * permissive: short-link and share-link forms count too, since share sheets
 * pass them (vm.tiktok.com, instagr.am, instagram.com/share/…).
 */
export function isSupportedVideoUrl(url: string): boolean {
  return isTikTokUrl(url) || isInstagramUrl(url);
}

/**
 * Open a video in its native app when installed, otherwise the browser.
 *
 * iOS/Android both resolve the universal https link; if the TikTok/Instagram
 * app is installed it intercepts the link, otherwise the OS opens it in a
 * browser. `Linking.openURL` already implements exactly that fallback, so we
 * simply guard against malformed URLs.
 */
export async function openVideo(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // Last-ditch: strip everything to a plain https link and retry once.
    const safe = url.startsWith('http') ? url : `https://${url}`;
    try {
      await Linking.openURL(safe);
    } catch {
      // Nothing more we can do; the user can long-press the thumbnail's URL.
    }
  }
}
