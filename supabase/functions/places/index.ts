// Supabase Edge Function: Google Places proxy.
//
// Keeps the Places API key OUT of the app binary. The key lives only as a
// function secret (GOOGLE_PLACES_API_KEY); the React Native client points the
// autocomplete component's `requestUrl` here and never sees it.
//
// Deploy:
//   supabase secrets set GOOGLE_PLACES_API_KEY=your-places-key
//   supabase functions deploy places
//
// The client (react-native-google-places-autocomplete) appends the Google path
// after the function URL, e.g. .../functions/v1/places/place/autocomplete/json.
// JWT verification stays ON (Supabase default), so callers must present the
// app's anon key — the client sends it in the Authorization header.

const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api';

// Only the two endpoints the client actually uses are proxied.
const ALLOWED_PATHS = new Set([
  '/place/autocomplete/json',
  '/place/details/json',
]);

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // Strip the Supabase mount prefix (/functions/v1/places) down to the Google
  // path the client appended.
  const start = url.pathname.indexOf('/place/');
  const path = start === -1 ? '' : url.pathname.slice(start);
  if (!ALLOWED_PATHS.has(path)) {
    return new Response('Not found', {status: 404});
  }

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) {
    return new Response('GOOGLE_PLACES_API_KEY is not configured', {
      status: 500,
    });
  }

  // Forward the client's params, but force our server-side key (overwriting the
  // empty placeholder the client sends).
  const params = new URLSearchParams(url.search);
  params.set('key', apiKey);

  const googleRes = await fetch(`${GOOGLE_BASE}${path}?${params.toString()}`);
  const body = await googleRes.text();

  return new Response(sortClosestFirst(path, body), {
    status: googleRes.status,
    headers: {'content-type': 'application/json'},
  });
});

/**
 * When the client passed an `origin`, Google attaches `distance_meters` to each
 * autocomplete prediction. Re-order predictions closest-first so the picker
 * shows nearby places at the top. No-op for other endpoints, missing distances,
 * or unparseable bodies (we return the original text untouched).
 */
function sortClosestFirst(path: string, body: string): string {
  if (path !== '/place/autocomplete/json') {
    return body;
  }
  try {
    const json = JSON.parse(body);
    const predictions = json?.predictions;
    if (
      !Array.isArray(predictions) ||
      !predictions.some(p => typeof p?.distance_meters === 'number')
    ) {
      return body;
    }
    predictions.sort((a, b) => {
      const da =
        typeof a?.distance_meters === 'number' ? a.distance_meters : Infinity;
      const db =
        typeof b?.distance_meters === 'number' ? b.distance_meters : Infinity;
      return da - db;
    });
    return JSON.stringify(json);
  } catch {
    return body;
  }
}
