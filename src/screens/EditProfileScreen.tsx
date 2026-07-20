import React, {useEffect, useMemo, useRef, useState} from 'react';
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
import type {NavigationAction} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

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
import {ConfirmDialog} from '../components/ConfirmDialog';
import {Icon} from '../components/Icon';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

/**
 * Edit the fields created at onboarding: avatar, display name, username, home
 * city. Seeds from the live profile; leaving with unsaved changes asks first.
 */
export function EditProfileScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {profile, updateProfile} = useAuth();

  const initialCity = useMemo<City | null>(
    () =>
      profile?.default_city != null &&
      profile.default_city_lat != null &&
      profile.default_city_lng != null
        ? {
            name: profile.default_city,
            lat: profile.default_city_lat,
            lng: profile.default_city_lng,
          }
        : null,
    [profile],
  );

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [city, setCity] = useState<City | null>(initialCity);
  const [avatar, setAvatar] = useState<AvatarUpload | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile?.avatar_url ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dirty =
    displayName !== (profile?.display_name ?? '') ||
    username !== (profile?.username ?? '') ||
    avatar != null ||
    city?.name !== initialCity?.name ||
    city?.lat !== initialCity?.lat ||
    city?.lng !== initialCity?.lng;

  // The beforeRemove listener must read the latest dirty flag without
  // re-subscribing on every keystroke.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const allowLeave = useRef(false);
  const pendingAction = useRef<NavigationAction | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (allowLeave.current || !dirtyRef.current) {
        return;
      }
      e.preventDefault();
      pendingAction.current = e.data.action;
      setConfirmDiscard(true);
    });
    return unsubscribe;
  }, [navigation]);

  const discardAndLeave = () => {
    setConfirmDiscard(false);
    allowLeave.current = true;
    if (pendingAction.current) {
      navigation.dispatch(pendingAction.current);
    } else {
      navigation.goBack();
    }
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

    setSubmitting(true);
    try {
      await updateProfile({
        displayName,
        username: cleanUsername,
        avatar,
        defaultCity: city?.name ?? null,
        defaultCityLat: city?.lat ?? null,
        defaultCityLng: city?.lng ?? null,
      });
      allowLeave.current = true;
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">Edit profile</AppText>
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
          <Pressable
            onPress={choosePhoto}
            style={styles.avatarWrap}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo">
            <Avatar
              uri={avatarPreview}
              name={profile?.display_name ?? profile?.username}
              size={112}
            />
            <View style={styles.cameraBadge}>
              <Icon name="camera" size={16} color={colors.onPrimary} />
            </View>
          </Pressable>

          <AppText variant="bold" style={styles.label}>
            Display name
          </AppText>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
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
              placeholder="username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.usernameInput]}
            />
          </View>

          <AppText variant="bold" style={[styles.label, styles.spaced]}>
            City
          </AppText>
          <CityPicker
            value={city}
            onSelect={selected => {
              setCity(selected);
              setError(null);
            }}
          />

          {error ? (
            <AppText variant="medium" style={styles.error}>
              {error}
            </AppText>
          ) : null}

          <PrimaryButton
            title="Save changes"
            onPress={submit}
            loading={submitting}
            disabled={!dirty}
            style={styles.submit}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={confirmDiscard}
        title="Discard changes?"
        message="Your edits haven't been saved."
        confirmLabel="Discard"
        onConfirm={discardAndLeave}
        onCancel={() => {
          pendingAction.current = null;
          setConfirmDiscard(false);
        }}
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
    avatarWrap: {
      alignSelf: 'center',
      marginBottom: spacing.xl,
    },
    cameraBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.primary,
      borderWidth: 2,
      borderColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
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
  });
}
