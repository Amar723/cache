// Supabase Edge Function: push-notify a friend the moment you both save the
// same place, even if their app isn't open.
//
// The in-app "You crossed paths!" dialog (see src/hooks/useOverlaps.ts) only
// reaches whoever has the app open — the other friend finds out next time
// *they* launch it. This function closes that gap: the client calls it
// right after a successful create/update in src/hooks/useStashes.ts, passing
// only the id of the stash it just wrote. Everything else — who the owner
// is, which friends match, whether they've already been notified — is
// re-derived server-side so a caller can't be tricked (or trick us) into
// notifying an arbitrary user.
//
// Deploy:
//   supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat service-account.json)"
//   supabase functions deploy notify-overlap
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically into every Edge Function — no need to set those.)
//
// The service-role client below deliberately bypasses RLS: that's what lets
// this function read a *friend's* push_tokens row, which no ordinary user
// (including the caller) is allowed to do — see supabase/push_notifications.sql.

import {createClient} from 'npm:@supabase/supabase-js@2';

const OVERLAP_RADIUS_M = 60;

interface StashLite {
  id: string;
  user_id: string;
  place_id: string | null;
  lat: number;
  lng: number;
}

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function haversineMeters(
  a: {lat: number; lng: number},
  b: {lat: number; lng: number},
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Mirrors src/lib/overlap.ts's samePlace(): same Google place_id, else ~60m. */
function samePlace(a: StashLite, b: StashLite): boolean {
  if (a.place_id && b.place_id) {
    return a.place_id === b.place_id;
  }
  return haversineMeters(a, b) <= OVERLAP_RADIUS_M;
}

// Short, push-sized variants of src/lib/overlapMessages.ts's voice — kept
// separate (not imported) so this function has zero dependency on the RN
// client tree, but written to feel like the same product.
const PUSH_TITLES = [
  'You crossed paths! 📍',
  'Great minds strike again.',
  'Well, this is a coincidence.',
  'Someone else gets it.',
];

const PUSH_BODIES = [
  (place: string) => `A friend also saved ${place}.`,
  (place: string) => `Turns out you're both into ${place}.`,
  (place: string) => `${place} is now a two-person thing.`,
  (place: string) =>
    `A friend beat you to saving ${place}. Or did you beat them?`,
];

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
}

function pemToBytes(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Cached for the lifetime of this warm function instance so a burst of saves
// doesn't mint a fresh OAuth token per request.
let cachedToken: {token: string; expiresAt: number} | null = null;

/** Exchanges the FCM service account for a short-lived OAuth2 access token. */
async function getFcmAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({alg: 'RS256', typ: 'JWT'})),
  );
  const claims = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(account.private_key),
    {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`FCM auth failed: ${JSON.stringify(json)}`);
  }
  cachedToken = {token: json.access_token, expiresAt: now + json.expires_in};
  return cachedToken.token;
}

/** Sends one FCM v1 push. Returns whether the send succeeded. */
async function sendFcmMessage(
  account: ServiceAccount,
  token: string,
  notification: {title: string; body: string},
  data: Record<string, string>,
): Promise<boolean> {
  const accessToken = await getFcmAccessToken(account);
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({message: {token, notification, data}}),
    },
  );
  return res.ok;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', {status: 405});
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Missing Authorization header', {status: 401});
  }

  let stashId: string | undefined;
  try {
    ({stashId} = await req.json());
  } catch {
    return new Response('Invalid JSON body', {status: 400});
  }
  if (!stashId) {
    return new Response('stashId is required', {status: 400});
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // As the caller: just enough to resolve who they are.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: {headers: {Authorization: authHeader}},
  });
  const {
    data: {user},
  } = await asCaller.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', {status: 401});
  }

  // Elevated: reads across users to find matches and their push tokens.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const {data: stash} = await admin
    .from('stashes')
    .select('id, user_id, place_id, lat, lng, place_name, visibility')
    .eq('id', stashId)
    .maybeSingle();

  // Only the owner can trigger a check for their own stash, and a private
  // pin never surfaces to anyone — same rule RLS already enforces for reads.
  if (!stash || stash.user_id !== user.id || stash.visibility === 'private') {
    return new Response(JSON.stringify({notified: 0}), {status: 200});
  }

  const {data: friendships} = await admin
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const friendIds = (friendships ?? []).map((f: any) =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id,
  );
  if (friendIds.length === 0) {
    return new Response(JSON.stringify({notified: 0}), {status: 200});
  }

  const {data: friendStashes} = await admin
    .from('stashes')
    .select('id, user_id, place_id, lat, lng')
    .in('user_id', friendIds)
    .in('visibility', ['friends', 'public']);

  const matches = ((friendStashes ?? []) as StashLite[]).filter(f =>
    samePlace(stash as StashLite, f),
  );
  if (matches.length === 0) {
    return new Response(JSON.stringify({notified: 0}), {status: 200});
  }

  const serviceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) {
    return new Response('FCM_SERVICE_ACCOUNT_JSON is not configured', {
      status: 500,
    });
  }
  const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);

  let notified = 0;
  for (const match of matches) {
    // Dedupe on the unordered pair: the unique index in
    // supabase/push_notifications.sql rejects a repeat insert, so a second
    // save/edit of either stash never re-notifies the same pair.
    const {error: insertError} = await admin
      .from('overlap_notifications')
      .insert({stash_id_a: stash.id, stash_id_b: match.id});
    if (insertError) {
      continue;
    }

    const {data: tokens} = await admin
      .from('push_tokens')
      .select('token')
      .eq('user_id', match.user_id);

    for (const {token} of tokens ?? []) {
      const ok = await sendFcmMessage(
        serviceAccount,
        token,
        {
          title: pickRandom(PUSH_TITLES),
          body: pickRandom(PUSH_BODIES)(stash.place_name),
        },
        {stashId: match.id},
      );
      if (ok) {
        notified++;
      }
    }
  }

  return new Response(JSON.stringify({notified}), {status: 200});
});
