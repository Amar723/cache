// Supabase Edge Function: Instagram oEmbed proxy.
//
// Unlike TikTok's tokenless oEmbed, Instagram's requires a Meta access token
// (`app_id|app_secret`). This function holds that secret server-side; the
// client posts a video URL here instead of calling Meta directly.
//
// Falls back to scraping the public og:image meta tag if the Graph API fails.
//
// Deploy:
//   supabase secrets set INSTAGRAM_APP_ID=your-app-id
//   supabase secrets set INSTAGRAM_APP_SECRET=your-app-secret
//   supabase functions deploy instagram-oembed

const GRAPH_OEMBED_ENDPOINT =
  'https://graph.facebook.com/v22.0/instagram_oembed';

const JSON_HEADERS = {'content-type': 'application/json'};

function extractShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|reels|p)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {status: 405});
  }

  let videoUrl: unknown;
  let debug = false;
  try {
    const payload = await req.json();
    videoUrl = payload?.url;
    debug = payload?.debug === true;
  } catch {
    return new Response('Invalid JSON body', {status: 400});
  }

  if (typeof videoUrl !== 'string' || videoUrl.length === 0) {
    return new Response('Missing "url"', {status: 400});
  }

  const debugInfo: Record<string, unknown> = {};

  // ── 1. Try Meta Graph API oEmbed ──────────────────────────────────────────
  const appId = Deno.env.get('INSTAGRAM_APP_ID');
  const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET');
  debugInfo.hasCredentials = !!(appId && appSecret);

  if (appId && appSecret) {
    try {
      const params = new URLSearchParams({
        url: videoUrl,
        access_token: `${appId}|${appSecret}`,
        fields: 'thumbnail_url,title,author_name',
      });
      const metaRes = await fetch(`${GRAPH_OEMBED_ENDPOINT}?${params.toString()}`);
      const body = await metaRes.text();
      debugInfo.graphApiStatus = metaRes.status;
      debugInfo.graphApiBody = body.slice(0, 500);

      if (metaRes.ok) {
        const json = JSON.parse(body);
        if (json?.thumbnail_url) {
          return new Response(debug ? JSON.stringify({...json, _debug: debugInfo}) : body, {
            status: 200,
            headers: JSON_HEADERS,
          });
        }
      } else {
        console.error('[instagram-oembed] Graph API error', metaRes.status, body);
      }
    } catch (err) {
      debugInfo.graphApiError = String(err);
      console.error('[instagram-oembed] Graph API fetch failed', err);
    }
  }

  // ── 2. Fallback: scrape og:image from the public page ────────────────────
  const shortcode = extractShortcode(videoUrl);
  debugInfo.shortcode = shortcode;

  if (shortcode) {
    try {
      const pageRes = await fetch(
        `https://www.instagram.com/p/${shortcode}/`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml',
          },
        },
      );
      const html = await pageRes.text();
      debugInfo.scrapeStatus = pageRes.status;
      debugInfo.scrapeHtmlSnippet = html.slice(0, 300);

      if (pageRes.ok) {
        const match = html.match(/<meta property="og:image" content="([^"]+)"/);
        debugInfo.ogImageFound = !!match;
        if (match?.[1]) {
          const result = {thumbnail_url: match[1], title: null, author_name: null};
          return new Response(
            JSON.stringify(debug ? {...result, _debug: debugInfo} : result),
            {status: 200, headers: JSON_HEADERS},
          );
        }
      } else {
        console.error('[instagram-oembed] og:image scrape failed', pageRes.status);
      }
    } catch (err) {
      debugInfo.scrapeError = String(err);
      console.error('[instagram-oembed] og:image scrape error', err);
    }
  }

  const empty = {thumbnail_url: null, title: null, author_name: null};
  return new Response(
    JSON.stringify(debug ? {...empty, _debug: debugInfo} : empty),
    {status: 200, headers: JSON_HEADERS},
  );
});
