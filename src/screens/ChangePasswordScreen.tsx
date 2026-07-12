import React, {useMemo, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {
  fonts,
  radius,
  spacing,
  useAppTheme,
  type AppColors,
} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import {AppText, PrimaryButton} from '../components/Themed';
import type {RootStackParamList} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Signed-in password change. The hook reauthenticates with the current password
 * before updating so a live app session alone is not enough to change it.
 */
export function ChangePasswordScreen(): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const {changePassword} = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Choose a password of at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your password has been changed.', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
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
            <AppText variant="serifLarge">Change password</AppText>
            <AppText variant="body" style={styles.tagline}>
              Confirm your current password before choosing a new one.
            </AppText>
          </View>

          <View style={styles.form}>
            <AppText variant="bold" style={styles.label}>
              Current password
            </AppText>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              textContentType="password"
              style={styles.input}
            />

            <AppText variant="bold" style={[styles.label, styles.spaced]}>
              New password
            </AppText>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              textContentType="newPassword"
              style={styles.input}
            />

            <AppText variant="bold" style={[styles.label, styles.spaced]}>
              Confirm new password
            </AppText>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              textContentType="newPassword"
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

            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.cancel}
              accessibilityRole="button">
              <AppText variant="medium" style={styles.cancelText}>
                Cancel
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.background},
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
      color: c.textMuted,
      textAlign: 'center',
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
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.md,
      fontFamily: fonts.regular,
      fontSize: 15,
      color: c.text,
    },
    error: {
      color: c.danger,
      marginTop: spacing.lg,
    },
    submit: {
      marginTop: spacing.xl,
    },
    cancel: {
      marginTop: spacing.lg,
      alignItems: 'center',
    },
    cancelText: {
      color: c.textMuted,
    },
  });
}
