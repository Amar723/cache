// Supabase Edge Function: Instagram oEmbed proxy.
//
// Unlike TikTok's tokenless oEmbed, Instagram's requires a Meta access token
// (`app_id|app_secret`). This function holds that secret server-side; the
// client posts a video URL here instead of calling Meta directly.
//
// Deploy:
//   supabase secrets set INSTAGRAM_APP_ID=your-app-id
//   supabase secrets set INSTAGRAM_APP_SECRET=your-app-secret
//   supabase functions deploy instagram-oembed

const GRAPH_OEMBED_ENDPOINT =
  'https://graph.facebook.com/v18.0/instagram_oembed';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {status: 405});
  }

  const appId = Deno.env.get('INSTAGRAM_APP_ID');
  const appSecret = Deno.env.get('INSTAGRAM_APP_SECRET');
  if (!appId || !appSecret) {
    return new Response('Instagram credentials are not configured', {
      status: 500,
    });
  }

  let videoUrl: unknown;
  try {
    const payload = await req.json();
    videoUrl = payload?.url;
  } catch {
    return new Response('Invalid JSON body', {status: 400});
  }

  if (typeof videoUrl !== 'string' || videoUrl.length === 0) {
    return new Response('Missing "url"', {status: 400});
  }

  const params = new URLSearchParams({
    url: videoUrl,
    access_token: `${appId}|${appSecret}`,
    fields: 'thumbnail_url,title,author_name',
  });

  const metaRes = await fetch(`${GRAPH_OEMBED_ENDPOINT}?${params.toString()}`);
  const body = await metaRes.text();

  return new Response(body, {
    status: metaRes.status,
    headers: {'content-type': 'application/json'},
  });
});
