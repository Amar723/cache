import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState} from 'react-native';
import {createClient} from '@supabase/supabase-js';

import {ENV} from './config';

/**
 * Single shared Supabase client.
 *
 * Session persistence is delegated to AsyncStorage and Supabase's own
 * auto-refresh, exactly as the auth requirements specify.
 *
 * The client is intentionally left untyped (no `<Database>` generic): we model
 * the rows in `database.types.ts` and apply those types at every read/write
 * boundary (`data as Stash[]`, the `StashInsert` payloads). This keeps full
 * domain typing in app code while avoiding the generated-types coupling, and it
 * is trivial to switch to `createClient<Database>` once you run
 * `supabase gen types`.
 */
export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // React Native has no URL bar, so there is no session to detect in a URL.
    detectSessionInUrl: false,
  },
});

/**
 * Supabase recommends pausing/resuming the auto-refresh timer with the app's
 * foreground state so tokens refresh promptly when the user returns.
 */
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export const STORAGE_BUCKET = 'avatars';
