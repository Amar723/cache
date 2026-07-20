import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {spacing, useAppTheme, type AppColors} from '../lib/theme';
import {useFriends} from '../hooks/useFriends';
import {useFriendStashes} from '../hooks/useFriendStashes';
import {AppText, Card, PrimaryButton} from '../components/Themed';
import {Avatar} from '../components/Avatar';
import {Icon} from '../components/Icon';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'FriendProfile'>;

/**
 * A friend's profile: identity, home city, and how many places they share with
 * you, with the way through to their map. The profile itself comes from the
 * already-loaded friends store; only the stash count needs a query (RLS lets
 * accepted friends read each other's visible stashes).
 */
export function FriendProfileScreen({
  route,
  navigation,
}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {friendId} = route.params;
  const {friends} = useFriends();
  const profile = friends.find(f => f.profile.id === friendId)?.profile ?? null;
  const {stashes, loading} = useFriendStashes(friendId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">
          {profile ? `@${profile.username}` : 'Profile'}
        </AppText>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({pressed}) => [styles.close, pressed && styles.closePressed]}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Icon name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      {profile ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.identity}>
            <Avatar
              uri={profile.avatar_url}
              name={profile.display_name ?? profile.username}
              size={96}
              style={styles.avatar}
            />
            <AppText variant="serifTitle" style={styles.displayName}>
              {profile.display_name ?? profile.username}
            </AppText>
            <AppText variant="caption">@{profile.username}</AppText>
            {profile.default_city ? (
              <View style={styles.cityRow}>
                <Icon name="pin" size={14} color={colors.textMuted} />
                <AppText variant="caption">{profile.default_city}</AppText>
              </View>
            ) : null}
          </View>

          <Card style={styles.statCard}>
            <View style={styles.statIcon}>
              <Icon name="bookmark" size={18} color={colors.primary} />
            </View>
            <AppText variant="serifLarge">
              {loading ? '—' : stashes.length}
            </AppText>
            <AppText variant="caption">
              {stashes.length === 1
                ? 'Place shared with you'
                : 'Places shared with you'}
            </AppText>
          </Card>

          <PrimaryButton
            title="View their map"
            onPress={() =>
              navigation.navigate('FriendMap', {
                friendId: profile.id,
                username: profile.username,
                defaultCityLat: profile.default_city_lat,
                defaultCityLng: profile.default_city_lng,
              })
            }
            style={styles.viewMap}
          />
        </ScrollView>
      ) : (
        // The friendship ended (or the deep link is stale) — nothing to show.
        <View style={styles.missing}>
          <AppText variant="caption">
            This person is no longer in your friends.
          </AppText>
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.background},
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
      padding: spacing.xl,
      paddingTop: spacing.sm,
      flexGrow: 1,
    },
    identity: {
      alignItems: 'center',
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
    },
    avatar: {
      marginBottom: spacing.md,
    },
    displayName: {
      marginBottom: 2,
    },
    cityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    statCard: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    statIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.sm,
    },
    viewMap: {
      marginTop: spacing.sm,
    },
    missing: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
  });
}
