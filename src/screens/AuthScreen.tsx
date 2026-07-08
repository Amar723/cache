import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors, fonts, radius, spacing} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import {AppText, PrimaryButton} from '../components/Themed';

type Mode = 'login' | 'signup';

/**
 * Email/password auth. A successful sign-in/up flips the auth store status,
 * and the RootNavigator swaps this screen for Onboarding or Tabs — so this
 * screen never navigates imperatively.
 */
export function AuthScreen(): React.JSX.Element {
  const {signIn, signUp, requestPasswordReset} = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setInfo(null);
    if (!email.includes('@') || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        const result = await signUp(email, password);
        if (result === 'confirmEmail') {
          setPassword('');
          setMode('login');
          setInfo('Check your email to confirm your account, then log in.');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.includes('@')) {
      setError('Enter your email above first, then tap “Forgot password”.');
      return;
    }
    try {
      await requestPasswordReset(email);
      setInfo('Check your email for a link to reset your password.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send reset email.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppText variant="serifLarge">Cache</AppText>
            <AppText variant="body" style={styles.tagline}>
              Save places you find. Find them again.
            </AppText>
          </View>

          <View style={styles.form}>
            <AppText variant="bold" style={styles.label}>
              Email
            </AppText>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />

            <AppText variant="bold" style={[styles.label, styles.spaced]}>
              Password
            </AppText>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.inkMuted}
              secureTextEntry
              style={styles.input}
            />

            {error ? (
              <AppText variant="medium" style={styles.error}>
                {error}
              </AppText>
            ) : null}
            {info ? (
              <AppText variant="medium" style={styles.info}>
                {info}
              </AppText>
            ) : null}

            <PrimaryButton
              title={mode === 'login' ? 'Log in' : 'Create account'}
              onPress={submit}
              loading={busy}
              style={styles.submit}
            />

            {mode === 'login' ? (
              <Pressable onPress={forgotPassword} style={styles.forgot}>
                <AppText variant="medium" style={styles.switchText}>
                  Forgot password?
                </AppText>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
                setInfo(null);
              }}
              style={styles.switch}>
              <AppText variant="medium" style={styles.switchText}>
                {mode === 'login'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Log in'}
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  flex: {flex: 1},
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  tagline: {
    marginTop: spacing.sm,
    color: colors.inkMuted,
  },
  form: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.sm,
  },
  spaced: {
    marginTop: spacing.lg,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.lg,
  },
  info: {
    color: colors.success,
    marginTop: spacing.lg,
  },
  submit: {
    marginTop: spacing.xl,
  },
  forgot: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  switch: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  switchText: {
    color: colors.inkMuted,
  },
});
