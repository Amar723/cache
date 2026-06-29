import {Platform} from 'react-native';
import Config from 'react-native-config';

/**
 * Centralised, typed access to environment values.
 *
 * Every secret is sourced from the native `.env` file through
 * react-native-config so nothing is hard-coded in the JS bundle. Missing keys
 * fail loudly during development rather than producing confusing runtime errors
 * deep inside the SDKs.
 */
function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    if (__DEV__) {
      console.warn(
        `[config] Missing required env var "${name}". ` +
          'Copy .env.example to .env and fill it in, then rebuild the app.',
      );
    }
    return '';
  }
  return value;
}

export const ENV = {
  SUPABASE_URL: required('SUPABASE_URL', Config.SUPABASE_URL),
  SUPABASE_ANON_KEY: required('SUPABASE_ANON_KEY', Config.SUPABASE_ANON_KEY),
  // Maps SDK key (native map rendering). Per-platform because a Google Cloud key
  // can be locked to only ONE platform type (iOS bundle id OR Android package +
  // SHA-1), so iOS and Android each get their own restricted key. The native map
  // reads these directly (iOS: GMSServices in AppDelegate; Android: @string in
  // the manifest); this mirror exists only so a missing key fails loudly in dev.
  // The Places key is intentionally NOT here — address autocomplete is proxied
  // through the `places` Supabase Edge Function so that key never ships.
  GOOGLE_MAPS_API_KEY: required(
    Platform.OS === 'ios'
      ? 'GOOGLE_MAPS_API_KEY_IOS'
      : 'GOOGLE_MAPS_API_KEY_ANDROID',
    Platform.OS === 'ios'
      ? Config.GOOGLE_MAPS_API_KEY_IOS
      : Config.GOOGLE_MAPS_API_KEY_ANDROID,
  ),
  // Optional: crash/error reporting. Unset (the default) keeps Sentry off.
  SENTRY_DSN: Config.SENTRY_DSN ?? '',
};
