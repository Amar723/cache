import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {spacing, useAppTheme, type AppColors} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import {useStashes} from '../hooks/useStashes';
import {AppText, Card, PrimaryButton} from '../components/Themed';
import {Avatar} from '../components/Avatar';
import {Icon} from '../components/Icon';
import type {RootStackParamList} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Profile: avatar, identity, stash/visited counts. Counts derive from the live
 * stash store so they stay in sync with "mark as visited". Account management
 * (password, sign out, delete) lives behind the gear in Settings.
 */
export function ProfileScreen(): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const {profile} = useAuth();
  const {stashes} = useStashes();

  const {total, visited} = useMemo(
    () => ({
      total: stashes.length,
      visited: stashes.filter(s => s.visited_at != null).length,
    }),
    [stashes],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">Profile</AppText>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          hitSlop={12}
          style={({pressed}) => [styles.gear, pressed && styles.gearPressed]}
          accessibilityRole="button"
          accessibilityLabel="Settings">
          <Icon name="settings" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar
            uri={profile?.avatar_url}
            name={profile?.display_name ?? profile?.username}
            size={96}
            style={styles.avatar}
          />
          <AppText variant="serifTitle" style={styles.displayName}>
            {profile?.display_name ?? 'Your profile'}
          </AppText>
          <AppText variant="caption">
            @{profile?.username ?? 'username'}
          </AppText>
        </View>

        <View style={styles.stats}>
          <Card style={styles.statCard}>
            <View style={styles.statIcon}>
              <Icon name="bookmark" size={18} color={colors.primary} />
            </View>
            <AppText variant="serifLarge">{total}</AppText>
            <AppText variant="caption">Cached</AppText>
          </Card>
          <Card style={styles.statCard}>
            <View style={styles.statIcon}>
              <Icon name="check" size={18} color={colors.success} />
            </View>
            <AppText variant="serifLarge">{visited}</AppText>
            <AppText variant="caption">Visited</AppText>
          </Card>
        </View>

        <PrimaryButton
          title="Edit profile"
          variant="secondary"
          onPress={() => navigation.navigate('EditProfile')}
          style={styles.editProfile}
        />
      </ScrollView>
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
    gear: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gearPressed: {
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
    stats: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
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
    editProfile: {
      marginTop: spacing.sm,
    },
  });
}
