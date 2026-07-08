import React, {useMemo, useState} from 'react';
import {Alert, Image, ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {colors, spacing} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import {useStashes} from '../hooks/useStashes';
import {AppText, Card, PrimaryButton} from '../components/Themed';
import {Icon} from '../components/Icon';
import type {RootStackParamList} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Profile: avatar, identity, stash/visited counts, sign out. Counts derive from
 * the live stash store so they stay in sync with "mark as visited".
 */
export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {profile, signOut, deleteAccount} = useAuth();
  const {stashes} = useStashes();
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account, every saved place, and your ' +
        'friend connections. This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
            } catch (e) {
              setDeleting(false);
              Alert.alert(
                'Could not delete account',
                e instanceof Error ? e.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  const {total, visited} = useMemo(
    () => ({
      total: stashes.length,
      visited: stashes.filter(s => s.visited_at != null).length,
    }),
    [stashes],
  );

  const initials = (profile?.display_name ?? profile?.username ?? '?')
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          {profile?.avatar_url ? (
            <Image source={{uri: profile.avatar_url}} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <AppText variant="serifTitle">{initials}</AppText>
            </View>
          )}
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
              <Icon name="bookmark" size={18} color={colors.ink} />
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
          title="Change password"
          variant="secondary"
          onPress={() => navigation.navigate('ChangePassword')}
          style={styles.changePassword}
        />

        <PrimaryButton
          title="Sign out"
          variant="secondary"
          onPress={() => signOut()}
          style={styles.signOut}
        />

        <PrimaryButton
          title="Delete account"
          variant="danger"
          onPress={confirmDelete}
          loading={deleting}
          style={styles.deleteAccount}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  content: {
    padding: spacing.xl,
    flexGrow: 1,
  },
  identity: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  changePassword: {
    marginTop: spacing.sm,
  },
  signOut: {
    marginTop: spacing.md,
  },
  deleteAccount: {
    marginTop: spacing.md,
  },
  footer: {
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: spacing.xxl,
  },
});
