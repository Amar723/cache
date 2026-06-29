import {Linking} from 'react-native';

/**
 * TikTok / Reel helpers: oEmbed thumbnail fetching and deep-linking.
 */

export interface TikTokOEmbed {
  thumbnail_url: string | null;
  title: string | null;
  author_name: string | null;
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
 * True only for TikTok links. TikTok is the one host with a tokenless oEmbed
 * endpoint, so this gates the thumbnail fetch — Instagram has no equivalent.
 * Covers the short-link domains share sheets emit (vm./vt.tiktok.com).
 */
export function isTikTokUrl(url: string): boolean {
  return /tiktok\.com/i.test(url);
}

/**
 * True for the URLs Cache understands — TikTok and Instagram Reels. We are
 * permissive: short-link and share-link forms count too, since share sheets
 * pass them (vm.tiktok.com, instagr.am, instagram.com/share/…).
 */
export function isSupportedVideoUrl(url: string): boolean {
  return /tiktok\.com|instagr\.am|instagram\.com\/(?:reel|reels|share|p)\//i.test(
    url,
  );
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
