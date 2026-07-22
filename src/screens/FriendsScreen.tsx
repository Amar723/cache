import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {radius, spacing, useAppTheme, type AppColors} from '../lib/theme';
import {useFriends} from '../hooks/useFriends';
import {AppText} from '../components/Themed';
import {Avatar} from '../components/Avatar';
import {Icon} from '../components/Icon';
import type {Profile, RootStackParamList} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The friend graph: search people by username, respond to incoming requests, and
 * open a friend's shared map. Refreshes whenever the tab regains focus.
 */
export function FriendsScreen(): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const {
    friends,
    incoming,
    outgoing,
    refreshFriends,
    searchUsers,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  } = useFriends();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshFriends();
    }, [refreshFriends]),
  );

  // Debounced username search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      const found = await searchUsers(q);
      setResults(found);
      setSearching(false);
    }, 350);
    return () => clearTimeout(handle);
  }, [query, searchUsers]);

  // Precompute id sets once per graph change so the per-result relationship
  // lookup below is O(1) instead of three linear scans per search result.
  const friendIds = useMemo(
    () => new Set(friends.map(f => f.profile.id)),
    [friends],
  );
  const outgoingIds = useMemo(
    () => new Set(outgoing.map(r => r.profile.id)),
    [outgoing],
  );
  const incomingIds = useMemo(
    () => new Set(incoming.map(r => r.profile.id)),
    [incoming],
  );

  /** What relationship, if any, the viewer already has with a searched user. */
  const relationOf = useCallback(
    (userId: string): 'friend' | 'outgoing' | 'incoming' | null => {
      if (friendIds.has(userId)) {
        return 'friend';
      }
      if (outgoingIds.has(userId)) {
        return 'outgoing';
      }
      if (incomingIds.has(userId)) {
        return 'incoming';
      }
      return null;
    },
    [friendIds, outgoingIds, incomingIds],
  );

  const openFriendProfile = (profile: Profile) =>
    navigation.navigate('FriendProfile', {friendId: profile.id});

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">Friends</AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {/* Search */}
        <View style={styles.searchBox}>
          <Icon name="user" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find people by username"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {searching ? <ActivityIndicator color={colors.primary} /> : null}
        </View>

        {query.trim().length >= 2 ? (
          <Section title="Results">
            {results.length === 0 && !searching ? (
              <AppText variant="caption" style={styles.empty}>
                No one found for “{query.trim()}”.
              </AppText>
            ) : (
              results.map(profile => {
                const relation = relationOf(profile.id);
                return (
                  <PersonRow key={profile.id} profile={profile}>
                    {relation === 'friend' ? (
                      <Tag label="Friends" />
                    ) : relation === 'outgoing' ? (
                      <Tag label="Requested" />
                    ) : relation === 'incoming' ? (
                      <Tag label="Responds below" />
                    ) : (
                      <Action
                        label="Add"
                        onPress={() => sendRequest(profile.id)}
                      />
                    )}
                  </PersonRow>
                );
              })
            )}
          </Section>
        ) : null}

        {/* Incoming requests */}
        {incoming.length > 0 ? (
          <Section title={`Requests (${incoming.length})`}>
            {incoming.map(req => (
              <PersonRow key={req.friendshipId} profile={req.profile}>
                <Action
                  label="Accept"
                  onPress={() => acceptRequest(req.friendshipId)}
                />
                <Action
                  label="Decline"
                  variant="muted"
                  onPress={() => declineRequest(req.friendshipId)}
                />
              </PersonRow>
            ))}
          </Section>
        ) : null}

        {/* Friends */}
        <Section title={`Your friends (${friends.length})`}>
          {friends.length === 0 ? (
            <AppText variant="caption" style={styles.empty}>
              Search for a username above to send your first friend request.
            </AppText>
          ) : (
            friends.map(friend => (
              <PersonRow
                key={friend.friendshipId}
                profile={friend.profile}
                onPress={() => openFriendProfile(friend.profile)}>
                <Action
                  label="Remove"
                  variant="muted"
                  onPress={() => removeFriend(friend.friendshipId)}
                />
              </PersonRow>
            ))
          )}
        </Section>

        {/* Outgoing (pending) */}
        {outgoing.length > 0 ? (
          <Section title="Sent requests">
            {outgoing.map(req => (
              <PersonRow key={req.friendshipId} profile={req.profile}>
                <Action
                  label="Cancel"
                  variant="muted"
                  onPress={() => removeFriend(req.friendshipId)}
                />
              </PersonRow>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.section}>
      <AppText variant="bold" style={styles.sectionTitle}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function PersonRow({
  profile,
  onPress,
  children,
}: {
  profile: Profile;
  onPress?: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({pressed}) => [
        styles.row,
        pressed && onPress ? styles.rowPressed : null,
      ]}>
      <Avatar
        uri={profile.avatar_url}
        name={profile.display_name ?? profile.username}
        size={44}
      />
      <View style={styles.rowText}>
        <AppText variant="medium" numberOfLines={1}>
          {profile.display_name ?? profile.username}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          @{profile.username}
        </AppText>
      </View>
      <View style={styles.actions}>{children}</View>
    </Pressable>
  );
}

function Action({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'muted';
}): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.action,
        variant === 'primary' ? styles.actionPrimary : styles.actionMuted,
        pressed && styles.actionPressed,
      ]}
      accessibilityRole="button">
      <AppText
        variant="medium"
        style={variant === 'primary' ? styles.actionTextPrimary : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Tag({label}: {label: string}): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.tag}>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.background},
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    content: {
      paddingHorizontal: spacing.xl,
      paddingBottom: 120,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      backgroundColor: c.surface,
      marginBottom: spacing.lg,
    },
    searchInput: {
      flex: 1,
      paddingVertical: spacing.md,
      color: c.text,
      fontSize: 15,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      marginBottom: spacing.sm,
    },
    empty: {
      paddingVertical: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    rowPressed: {opacity: 0.6},
    rowText: {
      flex: 1,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    action: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
    },
    actionPrimary: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    actionMuted: {
      backgroundColor: c.surface,
    },
    actionPressed: {opacity: 0.7},
    actionTextPrimary: {color: c.onPrimary},
    tag: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: c.surfaceElevated,
    },
  });
}
