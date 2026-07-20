import React, {useMemo, useState} from 'react';
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
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  fonts,
  radius,
  spacing,
  useAppTheme,
  type AppColors,
} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import {useStashes} from '../hooks/useStashes';
import {useFriends} from '../hooks/useFriends';
import {AppText, PrimaryButton} from '../components/Themed';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {Icon} from '../components/Icon';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

/**
 * The last stop before deletion: spells out what is destroyed (with live
 * counts), requires the account password, and double-confirms. On success
 * `deleteAccount` signs out and RootNavigator swaps to the Auth tree — no
 * navigation happens here.
 */
export function DeleteAccountScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {deleteAccount} = useAuth();
  const {stashes} = useStashes();
  const {friends} = useFriends();

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const places = stashes.length;
  const connections = friends.length;

  const runDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(password);
      // Signed out — the navigator tears this screen down.
    } catch (e) {
      setConfirming(false);
      setDeleting(false);
      setError(e instanceof Error ? e.message : 'Could not delete account.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">Delete account</AppText>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({pressed}) => [styles.close, pressed && styles.closePressed]}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Icon name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <AppText variant="body" style={styles.warning}>
            This permanently deletes your account, your {places} saved{' '}
            {places === 1 ? 'place' : 'places'}, and your {connections} friend{' '}
            {connections === 1 ? 'connection' : 'connections'}. This cannot be
            undone.
          </AppText>

          <AppText variant="bold" style={styles.label}>
            Confirm your password
          </AppText>
          <TextInput
            value={password}
            onChangeText={value => {
              setPassword(value);
              setError(null);
            }}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            textContentType="password"
            style={styles.input}
          />

          {error ? (
            <AppText variant="medium" style={styles.error}>
              {error}
            </AppText>
          ) : null}

          <PrimaryButton
            title="Delete my account"
            variant="danger"
            onPress={() => setConfirming(true)}
            disabled={password.length === 0}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirming}
        title="Delete account?"
        message="This is permanent and cannot be undone."
        confirmLabel="Delete forever"
        destructive
        loading={deleting}
        onConfirm={runDelete}
        onCancel={() => setConfirming(false)}
      />
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.background},
    flex: {flex: 1},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    close: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closePressed: {
      opacity: 0.6,
    },
    content: {
      flexGrow: 1,
      padding: spacing.xl,
      paddingTop: spacing.lg,
    },
    warning: {
      color: c.textMuted,
      marginBottom: spacing.xl,
    },
    label: {
      marginBottom: spacing.sm,
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
  });
}
