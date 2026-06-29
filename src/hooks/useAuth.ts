import type {Session} from '@supabase/supabase-js';

import {supabase} from '../lib/supabase';
import {createStore} from '../lib/store';
import {uploadAvatar, type AvatarUpload} from '../lib/storage';
import type {ProfileInsert} from '../lib/database.types';
import type {Profile} from '../types';

/**
 * Authentication + profile state.
 *
 * Status drives the root navigator:
 *   loading         — restoring the persisted session
 *   signedOut       — show Auth
 *   needsOnboarding — signed in but no profile row yet → show Onboarding
 *   ready           — signed in with a profile → show Tabs
 */
export type AuthStatus = 'loading' | 'signedOut' | 'needsOnboarding' | 'ready';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  // True between opening a password-recovery link and setting a new password;
  // the RootNavigator shows the update-password screen while it is set.
  recovering: boolean;
}

const store = createStore<AuthState>({
  status: 'loading',
  session: null,
  profile: null,
  recovering: false,
});

/** PostgREST returns this code when `.single()` matches zero rows. */
const NO_ROWS = 'PGRST116';

async function fetchProfile(userId: string): Promise<Profile | null> {
  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === NO_ROWS) {
      return null;
    }
    throw error;
  }
  return data as Profile;
}

async function applySession(session: Session | null): Promise<void> {
  if (!session) {
    store.setState({status: 'signedOut', session: null, profile: null});
    return;
  }

  try {
    const profile = await fetchProfile(session.user.id);
    store.setState({
      session,
      profile,
      status: profile ? 'ready' : 'needsOnboarding',
    });
  } catch {
    // If the profile lookup fails (offline), keep the session but treat the
    // user as needing onboarding so they aren't stranded on a blank screen.
    store.setState({session, profile: null, status: 'needsOnboarding'});
  }
}

let initialised = false;

/** Wire up the auth listener once, at app start. */
export async function initAuth(): Promise<void> {
  if (initialised) {
    return;
  }
  initialised = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session);
  });

  const {
    data: {session},
  } = await supabase.auth.getSession();
  await applySession(session);
}

export async function signIn(email: string, password: string): Promise<void> {
  const {error} = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export async function signUp(email: string, password: string): Promise<void> {
  const {data, error} = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) {
    throw new Error(error.message);
  }
  // With email confirmations disabled (recommended for this MVP — see README),
  // signUp returns a live session and onAuthStateChange takes over. If
  // confirmations are on, there is no session yet; surface a clear message.
  if (!data.session) {
    throw new Error(
      'Check your email to confirm your account, then log in. ' +
        '(Disable "Confirm email" in Supabase Auth settings to skip this.)',
    );
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Send a password-reset email. The link opens the app at
 * `cache://auth/recovery` (allow this URL in Supabase → Auth → URL
 * Configuration → Redirect URLs), which `handleRecoveryLink` then completes.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const {error} = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'cache://auth/recovery',
  });
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Handle a `cache://auth/recovery#access_token=…&refresh_token=…` deep link.
 * Establishes the recovery session and flips the app into recovery mode so the
 * user can set a new password. Returns true if it was a recovery link.
 */
export async function handleRecoveryLink(url: string): Promise<boolean> {
  if (!url.startsWith('cache://auth/recovery')) {
    return false;
  }
  const fragment = url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) {
    return false;
  }
  const {error} = await supabase.auth.setSession({access_token, refresh_token});
  if (error) {
    return false;
  }
  store.setState({recovering: true});
  return true;
}

/** Set a new password while in recovery mode, then leave recovery. */
export async function completePasswordReset(
  newPassword: string,
): Promise<void> {
  const {error} = await supabase.auth.updateUser({password: newPassword});
  if (error) {
    throw new Error(error.message);
  }
  store.setState({recovering: false});
}

/** Permanently delete the account and all its data, then sign out. */
export async function deleteAccount(): Promise<void> {
  const {error} = await supabase.rpc('delete_account');
  if (error) {
    throw new Error(error.message);
  }
  await supabase.auth.signOut();
}

export interface OnboardingInput {
  displayName: string;
  username: string;
  avatar?: AvatarUpload | null;
}

/** Create the profile row that flips the user from onboarding → ready. */
export async function completeOnboarding(
  input: OnboardingInput,
): Promise<void> {
  const session = store.getState().session;
  if (!session) {
    throw new Error('Your session expired. Please log in again.');
  }
  const userId = session.user.id;

  let avatarUrl: string | null = null;
  if (input.avatar) {
    avatarUrl = await uploadAvatar(userId, input.avatar);
  }

  const username = input.username.trim().toLowerCase();

  const payload: ProfileInsert = {
    id: userId,
    username,
    display_name: input.displayName.trim(),
    avatar_url: avatarUrl,
  };

  const {data, error} = await supabase
    .from('profiles')
    .upsert(payload)
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation on the username column.
    if (error.code === '23505') {
      throw new Error('That username is already taken. Try another.');
    }
    throw new Error(error.message);
  }

  store.setState({profile: data as Profile, status: 'ready'});
}

/** Re-read the current profile (after editing avatar/name, etc.). */
export async function refreshProfile(): Promise<void> {
  const session = store.getState().session;
  if (!session) {
    return;
  }
  const profile = await fetchProfile(session.user.id);
  store.setState({profile, status: profile ? 'ready' : 'needsOnboarding'});
}

/** Read the current user id outside React (used by the stash layer). */
export function currentUserId(): string | null {
  return store.getState().session?.user.id ?? null;
}

/** React hook. */
export function useAuth() {
  const status = store.useSelector(s => s.status);
  const session = store.useSelector(s => s.session);
  const profile = store.useSelector(s => s.profile);
  const recovering = store.useSelector(s => s.recovering);

  return {
    status,
    session,
    profile,
    recovering,
    signIn,
    signUp,
    signOut,
    completeOnboarding,
    refreshProfile,
    requestPasswordReset,
    completePasswordReset,
    deleteAccount,
  };
}
