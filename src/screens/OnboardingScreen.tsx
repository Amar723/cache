import React, {useState} from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {launchImageLibrary} from 'react-native-image-picker';

import {colors, fonts, radius, spacing} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import type {AvatarUpload} from '../lib/storage';
import {AppText, PrimaryButton} from '../components/Themed';
import {Icon} from '../components/Icon';

/**
 * Profile setup: display name, unique username, optional avatar. Completing this
 * creates the profile row and flips auth status to "ready".
 */
export function OnboardingScreen(): React.JSX.Element {
  const {completeOnboarding, signOut} = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<AvatarUpload | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickAvatar = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.8,
    });
    if (result.didCancel || !result.assets || result.assets.length === 0) {
      return;
    }
    const asset = result.assets[0];
    if (!asset.base64) {
      setError('Could not read that image. Try another.');
      return;
    }
    setAvatar({
      base64: asset.base64,
      mimeType: asset.type ?? 'image/jpeg',
      fileName: asset.fileName ?? null,
    });
    setAvatarPreview(asset.uri ?? null);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    const cleanUsername = username.trim().toLowerCase();

    if (displayName.trim().length === 0) {
      setError('Please enter a display name.');
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      setError('Username must be 3–20 chars: letters, numbers, underscores.');
      return;
    }

    setBusy(true);
    try {
      await completeOnboarding({
        displayName,
        username: cleanUsername,
        avatar,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish setup.');
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
          <AppText variant="serifTitle" style={styles.title}>
            Set up your profile
          </AppText>
          <AppText variant="body" style={styles.subtitle}>
            This is just for you right now — friends maps come later.
          </AppText>

          <Pressable
            onPress={pickAvatar}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="Choose profile photo">
            {avatarPreview ? (
              <Image source={{uri: avatarPreview}} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Icon name="camera" size={26} color={colors.inkMuted} />
                <AppText variant="caption" style={styles.avatarHint}>
                  Add photo
                </AppText>
              </View>
            )}
          </Pressable>

          <AppText variant="bold" style={styles.label}>
            Display name
          </AppText>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Amar Singh"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
          />

          <AppText variant="bold" style={[styles.label, styles.spaced]}>
            Username
          </AppText>
          <View style={styles.usernameRow}>
            <AppText variant="medium" style={styles.at}>
              @
            </AppText>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="amar"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.usernameInput]}
            />
          </View>

          {error ? (
            <AppText variant="medium" style={styles.error}>
              {error}
            </AppText>
          ) : null}

          <PrimaryButton
            title="Start caching"
            onPress={submit}
            loading={busy}
            style={styles.submit}
          />

          <Pressable onPress={() => signOut()} style={styles.signOut}>
            <AppText variant="medium" style={styles.signOutText}>
              Sign out
            </AppText>
          </Pressable>
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
    padding: spacing.xl,
  },
  title: {
    marginTop: spacing.lg,
  },
  subtitle: {
    color: colors.inkMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: colors.border,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  avatarHint: {
    color: colors.inkMuted,
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
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  at: {
    fontSize: 18,
    marginRight: spacing.sm,
    color: colors.inkMuted,
  },
  usernameInput: {
    flex: 1,
  },
  error: {
    color: colors.danger,
    marginTop: spacing.lg,
  },
  submit: {
    marginTop: spacing.xl,
  },
  signOut: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  signOutText: {
    color: colors.inkMuted,
  },
});
