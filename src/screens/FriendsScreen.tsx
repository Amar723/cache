import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {colors, radius, spacing} from '../lib/theme';
import {useFriends} from '../hooks/useFriends';
import {AppText} from '../components/Themed';
import {Icon} from '../components/Icon';
import type {Profile, RootStackParamList} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * The friend graph: search people by username, respond to incoming requests, and
 * open a friend's shared map. Refreshes whenever the tab regains focus.
 */
export function FriendsScreen(): React.JSX.Element {
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

  /** What relationship, if any, the viewer already has with a searched user. */
  const relationOf = (
    userId: string,
  ): 'friend' | 'outgoing' | 'incoming' | null => {
    if (friends.some(f => f.profile.id === userId)) {
      return 'friend';
    }
    if (outgoing.some(r => r.profile.id === userId)) {
      return 'outgoing';
    }
    if (incoming.some(r => r.profile.id === userId)) {
      return 'incoming';
    }
    return null;
  };

  const openFriendMap = (profile: Profile) =>
    navigation.navigate('FriendMap', {
      friendId: profile.id,
      username: profile.username,
    });

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
          <Icon name="user" size={18} color={colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find people by username"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {searching ? <ActivityIndicator color={colors.inkMuted} /> : null}
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
                onPress={() => openFriendMap(friend.profile)}>
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
  const initial = (profile.display_name ?? profile.username)
    .charAt(0)
    .toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({pressed}) => [
        styles.row,
        pressed && onPress ? styles.rowPressed : null,
      ]}>
      {profile.avatar_url ? (
        <Image source={{uri: profile.avatar_url}} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <AppText variant="bold">{initial}</AppText>
        </View>
      )}
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
  return (
    <View style={styles.tag}>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
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
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.ink,
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
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    borderColor: colors.border,
  },
  actionPrimary: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  actionMuted: {
    backgroundColor: colors.background,
  },
  actionPressed: {opacity: 0.7},
  actionTextPrimary: {color: colors.background},
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
});
