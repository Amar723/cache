import {NativeModules, Platform} from 'react-native';
import type {Session} from '@supabase/supabase-js';

/**
 * Bridges the Supabase session into the App Group container so the iOS Share
 * Extension can save a stash as the logged-in user (see ios/Cache/SharedSession
 * and the ShareExtension target). The extension is a separate process and can't
 * read the app's AsyncStorage, so the session has to be handed across explicitly.
 *
 * Everything here is a safe no-op off iOS or when the native module isn't linked,
 * so wiring it into the auth flow never risks the build or a plain app run.
 */
interface SharedSessionModule {
  setSession(json: string): void;
  clearSession(): void;
  getSession(): Promise<string | null>;
}

const SharedSession = NativeModules.SharedSession as
  | SharedSessionModule
  | undefined;

export interface SharedTokens {
  access_token: string;
  refresh_token: string;
}

/**
 * Mirror the current session (or clear it on sign-out) into the shared store.
 * Called from the single auth funnel, so it also tracks token refreshes.
 */
export function persistSharedSession(session: Session | null): void {
  if (Platform.OS !== 'ios' || !SharedSession) {
    return;
  }
  if (!session?.access_token || !session?.refresh_token) {
    SharedSession.clearSession();
    return;
  }
  const tokens: SharedTokens = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };
  SharedSession.setSession(JSON.stringify(tokens));
}

/** Read the shared tokens back — used by the extension to rehydrate its client. */
export async function readSharedSession(): Promise<SharedTokens | null> {
  if (Platform.OS !== 'ios' || !SharedSession) {
    return null;
  }
  const json = await SharedSession.getSession();
  if (!json) {
    return null;
  }
  try {
    const parsed = JSON.parse(json) as Partial<SharedTokens>;
    if (parsed.access_token && parsed.refresh_token) {
      return {
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      };
    }
  } catch {
    // Corrupt/partial blob — treat as no session.
  }
  return null;
}
