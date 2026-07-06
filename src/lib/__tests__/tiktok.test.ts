import {
  extractInstagramShortcode,
  extractUrl,
  findTikTokItemLocation,
  isSupportedVideoUrl,
  isTikTokUrl,
} from '../tiktok';

describe('extractUrl', () => {
  it('returns a bare URL unchanged', () => {
    expect(
      extractUrl('https://www.tiktok.com/@nba/video/7234567890123456789'),
    ).toBe('https://www.tiktok.com/@nba/video/7234567890123456789');
  });

  it('pulls the first URL out of surrounding caption text', () => {
    expect(
      extractUrl('Check this out https://vm.tiktok.com/ZMabc123/ 🔥'),
    ).toBe('https://vm.tiktok.com/ZMabc123/');
  });

  it('returns null for nullish or link-free input', () => {
    expect(extractUrl(null)).toBeNull();
    expect(extractUrl(undefined)).toBeNull();
    expect(extractUrl('')).toBeNull();
    expect(extractUrl('no link in here')).toBeNull();
  });
});

describe('isTikTokUrl', () => {
  it('matches TikTok hosts including short links', () => {
    expect(isTikTokUrl('https://www.tiktok.com/@u/video/123')).toBe(true);
    expect(isTikTokUrl('https://vm.tiktok.com/ZMabc/')).toBe(true);
    expect(isTikTokUrl('https://vt.tiktok.com/ZSabc/')).toBe(true);
  });

  it('does not match Instagram or other hosts', () => {
    expect(isTikTokUrl('https://www.instagram.com/reel/abc/')).toBe(false);
    expect(isTikTokUrl('https://youtube.com/watch?v=x')).toBe(false);
  });
});

describe('isSupportedVideoUrl', () => {
  it('accepts TikTok links', () => {
    expect(isSupportedVideoUrl('https://www.tiktok.com/@u/video/123')).toBe(
      true,
    );
    expect(isSupportedVideoUrl('https://vm.tiktok.com/ZMabc/')).toBe(true);
  });

  it('accepts every Instagram Reel URL variant', () => {
    expect(isSupportedVideoUrl('https://www.instagram.com/reel/Cabc123/')).toBe(
      true,
    );
    expect(
      isSupportedVideoUrl('https://www.instagram.com/reels/Cabc123/'),
    ).toBe(true);
    expect(isSupportedVideoUrl('https://www.instagram.com/p/Cabc123/')).toBe(
      true,
    );
    expect(
      isSupportedVideoUrl('https://instagram.com/share/reel/Cabc123'),
    ).toBe(true);
    expect(isSupportedVideoUrl('https://instagr.am/p/Cabc123/')).toBe(true);
  });

  it('rejects unsupported hosts', () => {
    expect(isSupportedVideoUrl('https://example.com/video')).toBe(false);
    expect(isSupportedVideoUrl('https://youtube.com/watch?v=x')).toBe(false);
    expect(isSupportedVideoUrl('https://www.instagram.com/someuser')).toBe(
      false,
    );
  });
});

describe('extractInstagramShortcode', () => {
  it('pulls the shortcode out of reel, reels, and post URLs', () => {
    expect(
      extractInstagramShortcode('https://www.instagram.com/reel/Cabc123/'),
    ).toBe('Cabc123');
    expect(
      extractInstagramShortcode('https://www.instagram.com/reels/Cabc123/'),
    ).toBe('Cabc123');
    expect(
      extractInstagramShortcode('https://www.instagram.com/p/Cabc123/'),
    ).toBe('Cabc123');
  });

  it('ignores a trailing query string', () => {
    expect(
      extractInstagramShortcode(
        'https://www.instagram.com/reel/Cabc123/?utm_source=ig_web',
      ),
    ).toBe('Cabc123');
  });

  it('returns null for URLs without a shortcode', () => {
    expect(
      extractInstagramShortcode('https://www.instagram.com/someuser/'),
    ).toBeNull();
    expect(
      extractInstagramShortcode('https://www.tiktok.com/@u/video/123'),
    ).toBeNull();
  });
});

describe('findTikTokItemLocation', () => {
  it('reads a top-level poi object', () => {
    expect(
      findTikTokItemLocation({
        poi: {
          poiName: "Joe's Pizza",
          address: '7 Carmine St, New York, NY',
          latitude: 40.7307,
          longitude: -74.0023,
        },
      }),
    ).toEqual({
      name: "Joe's Pizza",
      address: '7 Carmine St, New York, NY',
      lat: 40.7307,
      lng: -74.0023,
    });
  });

  it('reads a POI anchor with JSON-encoded extraInfo', () => {
    expect(
      findTikTokItemLocation({
        anchors: [
          {type: 'hashtag', extraInfo: '{"not":"a place"}'},
          {
            type: 'poi',
            extraInfo: JSON.stringify({
              name: 'Golden Gate Park',
              lat: 37.7694,
              lng: -122.4862,
            }),
          },
        ],
      }),
    ).toEqual({
      name: 'Golden Gate Park',
      address: null,
      lat: 37.7694,
      lng: -122.4862,
    });
  });

  it('returns null when nothing place-shaped is present', () => {
    expect(findTikTokItemLocation({})).toBeNull();
    expect(findTikTokItemLocation({locationCreated: 'US'})).toBeNull();
    expect(
      findTikTokItemLocation({anchors: [{type: 'hashtag', extraInfo: '{}'}]}),
    ).toBeNull();
  });
});
