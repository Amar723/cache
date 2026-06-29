import {urlFromDeepLink} from '../share';

/** Build a deep link the way both the iOS extension and Android MainActivity do. */
function deepLink(payload: string): string {
  return `cache://share?url=${encodeURIComponent(payload)}`;
}

describe('urlFromDeepLink', () => {
  it('extracts a TikTok URL from a well-formed share link', () => {
    expect(urlFromDeepLink(deepLink('https://vm.tiktok.com/ZMabc123/'))).toBe(
      'https://vm.tiktok.com/ZMabc123/',
    );
  });

  it('extracts an Instagram Reel URL', () => {
    expect(
      urlFromDeepLink(deepLink('https://www.instagram.com/reel/Cabc123/')),
    ).toBe('https://www.instagram.com/reel/Cabc123/');
  });

  it('pulls the URL out of a shared caption (Android passes raw EXTRA_TEXT)', () => {
    expect(
      urlFromDeepLink(
        deepLink('Look at this https://www.tiktok.com/@u/video/9 wow'),
      ),
    ).toBe('https://www.tiktok.com/@u/video/9');
  });

  it('returns null for nullish input', () => {
    expect(urlFromDeepLink(null)).toBeNull();
    expect(urlFromDeepLink(undefined)).toBeNull();
    expect(urlFromDeepLink('')).toBeNull();
  });

  it('returns null when the link has no url parameter', () => {
    expect(urlFromDeepLink('cache://share')).toBeNull();
    expect(urlFromDeepLink('cache://other?foo=bar')).toBeNull();
  });

  it('returns null when the url parameter contains no real link', () => {
    expect(urlFromDeepLink(deepLink('just some text, no link'))).toBeNull();
  });
});
