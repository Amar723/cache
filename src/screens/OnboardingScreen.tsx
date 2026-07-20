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

import {
  fonts,
  radius,
  spacing,
  useAppTheme,
  type AppColors,
} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import {pickAvatar} from '../lib/pickAvatar';
import type {AvatarUpload} from '../lib/storage';
import {AppText, PrimaryButton} from '../components/Themed';
import {Avatar} from '../components/Avatar';
import {CityPicker, type City} from '../components/CityPicker';
import {Icon} from '../components/Icon';

/**
 * Profile setup: display name, unique username, optional avatar. Completing this
 * creates the profile row and flips auth status to "ready".
 */
export function OnboardingScreen(): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {completeOnboarding, signOut} = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<AvatarUpload | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCitySelected = (selected: City) => {
    setCity(selected);
    setError(null);
  };

  const choosePhoto = async () => {
    try {
      const picked = await pickAvatar();
      if (!picked) {
        return;
      }
      setAvatar(picked.upload);
      setAvatarPreview(picked.previewUri);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that image.');
    }
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
    if (!city) {
      setError('Please choose your city.');
      return;
    }

    setBusy(true);
    try {
      await completeOnboarding({
        displayName,
        username: cleanUsername,
        avatar,
        defaultCity: city.name,
        defaultCityLat: city.lat,
        defaultCityLng: city.lng,
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
            onPress={choosePhoto}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="Choose profile photo">
            <Avatar
              uri={avatarPreview}
              size={112}
              placeholder={
                <View style={styles.avatarPlaceholder}>
                  <Icon name="camera" size={26} color={colors.textMuted} />
                  <AppText variant="caption" style={styles.avatarHint}>
                    Add photo
                  </AppText>
                </View>
              }
            />
          </Pressable>

          <AppText variant="bold" style={styles.label}>
            Display name
          </AppText>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Amar Singh"
            placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.usernameInput]}
            />
          </View>

          <AppText variant="bold" style={[styles.label, styles.spaced]}>
            City
          </AppText>
          <CityPicker value={city} onSelect={handleCitySelected} />

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

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.background},
    flex: {flex: 1},
    content: {
      flexGrow: 1,
      padding: spacing.xl,
    },
    title: {
      marginTop: spacing.lg,
    },
    subtitle: {
      color: c.textMuted,
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
    avatarWrap: {
      alignSelf: 'center',
      marginBottom: spacing.xl,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      gap: 2,
    },
    avatarHint: {
      color: c.textMuted,
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
    usernameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    at: {
      fontSize: 18,
      marginRight: spacing.sm,
      color: c.textMuted,
    },
    usernameInput: {
      flex: 1,
    },
    error: {
      color: c.danger,
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
      color: c.textMuted,
    },
  });
}
