import {Linking} from 'react-native';

import {extractUrl} from './tiktok';

/**
 * Receives videos shared into Cache from the iOS share sheet.
 *
 * The native Share Extension (ios/ShareExtension) hands us the shared link as a
 * `cache://share?url=<encoded>` deep link rather than through an App Group —
 * App Groups need a paid Apple Developer account, a URL scheme does not. So here
 * we just listen on the Linking API and pull the original video URL back out.
 */
type ShareCallback = (url: string) => void;

/**
 * Extract the original video URL from a `cache://share?url=…` deep link.
 * Exported for unit testing — this is the parse both platforms funnel through.
 */
export function urlFromDeepLink(
  link: string | null | undefined,
): string | null {
  if (!link) {
    return null;
  }
  const match = link.match(/[?&]url=([^&]+)/);
  if (!match) {
    return null;
  }
  try {
    return extractUrl(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

/** Resolve a share that cold-started the app, if any. */
export function handleInitialShare(callback: ShareCallback): void {
  Linking.getInitialURL().then(link => {
    const url = urlFromDeepLink(link);
    if (url) {
      callback(url);
    }
  });
}

/** Subscribe to shares that arrive while the app is already running. */
export function subscribeToShares(callback: ShareCallback): () => void {
  const subscription = Linking.addEventListener('url', ({url: link}) => {
    const url = urlFromDeepLink(link);
    if (url) {
      callback(url);
    }
  });
  return () => subscription.remove();
}
