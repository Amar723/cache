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
  // True between confirming a password-reset code and setting a new password;
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

export type SignUpResult = 'signedIn' | 'confirmEmail';

export async function signUp(
  email: string,
  password: string,
): Promise<SignUpResult> {
  const {data, error} = await supabase.auth.signUp({
    email: email.trim(),
    password,
  });
  if (error) {
    throw new Error(error.message);
  }
  // If confirmations are on, there is no session yet; the user needs to
  // confirm their email before logging in.
  if (!data.session) {
    return 'confirmEmail';
  }
  return 'signedIn';
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Send a password-reset email containing a one-time code (Supabase's "Reset
 * Password" email template must use `{{ .Token }}` rather than the magic-link
 * button — magic links get silently consumed by mail-provider link scanners
 * before the user ever clicks them).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const {error} = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Confirm the one-time code emailed by `requestPasswordReset`. Establishes
 * the recovery session and flips the app into recovery mode so the user can
 * set a new password.
 */
export async function confirmPasswordResetCode(
  email: string,
  code: string,
): Promise<void> {
  const {error} = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'recovery',
  });
  if (error) {
    throw new Error(error.message);
  }
  store.setState({recovering: true});
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

async function getCurrentSession(): Promise<Session | null> {
  const stored = store.getState().session;
  if (stored) {
    return stored;
  }

  const {data, error} = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }
  return data.session;
}

async function restoreSession(session: Session): Promise<void> {
  const {access_token, refresh_token} = session;
  if (!access_token || !refresh_token) {
    return;
  }
  await supabase.auth.setSession({access_token, refresh_token});
}

/** Change a signed-in user's password after verifying their current password. */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (!currentPassword) {
    throw new Error('Enter your current password.');
  }
  if (newPassword.length < 6) {
    throw new Error('Choose a password of at least 6 characters.');
  }

  const session = await getCurrentSession();
  const email = session?.user.email?.trim();
  if (!session || !email) {
    throw new Error('Your session expired. Please log in again.');
  }

  const {data, error} = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (error) {
    throw new Error('Current password is incorrect.');
  }
  if (data.user?.id !== session.user.id) {
    await restoreSession(session);
    throw new Error('Could not verify this account. Please log in again.');
  }

  const {error: updateError} = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    throw new Error(updateError.message);
  }
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
    confirmPasswordResetCode,
    completePasswordReset,
    changePassword,
    deleteAccount,
  };
}
