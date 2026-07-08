import React, {useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors, fonts, radius, spacing} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import {AppText, PrimaryButton} from '../components/Themed';

/**
 * Shown after a password-reset code is confirmed (see `confirmPasswordResetCode`).
 * The user is already recovery-authenticated, so this just sets a new password
 * and then drops back into the app.
 */
export function UpdatePasswordScreen(): React.JSX.Element {
  const {completePasswordReset} = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Choose a password of at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await completePasswordReset(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update password.');
    } finally {
      setBusy(false);
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
            <AppText variant="serifLarge">Set a new password</AppText>
            <AppText variant="body" style={styles.tagline}>
              Choose a new password to finish resetting your account.
            </AppText>
          </View>

          <View style={styles.form}>
            <AppText variant="bold" style={styles.label}>
              New password
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

            <PrimaryButton
              title="Update password"
              onPress={submit}
              loading={busy}
              style={styles.submit}
            />
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
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.sm,
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
  submit: {
    marginTop: spacing.xl,
  },
});
