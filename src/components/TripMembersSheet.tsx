import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import {colors, radius, spacing} from '../lib/theme';
import {
  deleteTrip,
  inviteToTrip,
  leaveTrip,
  removeMember,
  renameTrip,
} from '../hooks/useItineraries';
import {refreshFriends, useFriends} from '../hooks/useFriends';
import {currentUserId} from '../hooks/useAuth';
import {AppText, PrimaryButton} from './Themed';
import type {Profile, Trip} from '../types';

interface TripMembersSheetProps {
  /** The trip whose members to show, or null to keep the sheet closed. */
  trip: Trip | null;
  onClose: () => void;
  /** Called after the trip stops existing for the viewer (deleted / left). */
  onTripGone: () => void;
}

/**
 * The trip's people and settings: the member list, plus (for the owner)
 * rename, invite-friends, and delete; (for a member) leave.
 */
export function TripMembersSheet({
  trip,
  onClose,
  onTripGone,
}: TripMembersSheetProps): React.JSX.Element {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['70%'], []);
  const myId = currentUserId();
  const {friends} = useFriends();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (trip) {
      setName(trip.itinerary.name);
      refreshFriends(); // Keep the invitable list fresh.
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [trip?.itinerary.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1 && trip) {
        onClose();
      }
    },
    [onClose, trip],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.35}
        pressBehavior="close"
      />
    ),
    [],
  );

  // Accepted friends who aren't on the trip yet (and aren't the owner).
  const invitable = useMemo(() => {
    if (!trip) {
      return [];
    }
    const taken = new Set(trip.members.map(m => m.profile.id));
    taken.add(trip.owner.id);
    return friends.filter(f => !taken.has(f.profile.id));
  }, [friends, trip]);

  const run = async (action: () => Promise<void>, failTitle: string) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      Alert.alert(
        failTitle,
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRename = () => {
    if (!trip || name.trim() === trip.itinerary.name) {
      return;
    }
    run(() => renameTrip(trip.itinerary.id, name), 'Could not rename trip');
  };

  const handleDelete = () => {
    if (!trip) {
      return;
    }
    Alert.alert(
      'Delete this trip?',
      `"${trip.itinerary.name}" will be deleted for everyone. The places themselves stay saved.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await deleteTrip(trip.itinerary.id);
              onTripGone();
            }, 'Could not delete trip'),
        },
      ],
    );
  };

  const handleLeave = () => {
    const membership = trip?.members.find(m => m.profile.id === myId);
    if (!trip || !membership) {
      return;
    }
    Alert.alert(
      'Leave this trip?',
      'Places you added will be removed from it too.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              await leaveTrip(membership.memberId);
              onTripGone();
            }, 'Could not leave trip'),
        },
      ],
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleChange}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBackground}>
      <BottomSheetScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {trip && (
          <>
            {trip.isOwner ? (
              <View style={styles.renameRow}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onEndEditing={handleRename}
                  maxLength={60}
                  style={styles.renameInput}
                  placeholder="Trip name"
                  placeholderTextColor={colors.inkMuted}
                />
              </View>
            ) : (
              <AppText variant="serifTitle" numberOfLines={1}>
                {trip.itinerary.name}
              </AppText>
            )}

            <Section title="On this trip">
              <PersonRow profile={trip.owner}>
                <Tag label="Owner" />
              </PersonRow>
              {trip.members.map(member => (
                <PersonRow key={member.memberId} profile={member.profile}>
                  {member.status === 'pending' && <Tag label="Invited" />}
                  {trip.isOwner && (
                    <Action
                      label="Remove"
                      variant="muted"
                      onPress={() =>
                        run(
                          () => removeMember(member.memberId),
                          'Could not remove member',
                        )
                      }
                    />
                  )}
                </PersonRow>
              ))}
            </Section>

            {trip.isOwner && (
              <Section title="Invite friends">
                {invitable.length === 0 ? (
                  <AppText variant="caption" style={styles.empty}>
                    {friends.length === 0
                      ? 'Add friends on the Friends tab to invite them.'
                      : 'All of your friends are already on this trip.'}
                  </AppText>
                ) : (
                  invitable.map(friend => (
                    <PersonRow
                      key={friend.friendshipId}
                      profile={friend.profile}>
                      <Action
                        label="Invite"
                        onPress={() =>
                          run(
                            () =>
                              inviteToTrip(
                                trip.itinerary.id,
                                friend.profile.id,
                              ),
                            'Could not invite',
                          )
                        }
                      />
                    </PersonRow>
                  ))
                )}
              </Section>
            )}

            <View style={styles.footer}>
              {trip.isOwner ? (
                <PrimaryButton
                  title="Delete trip"
                  variant="danger"
                  onPress={handleDelete}
                  loading={busy}
                />
              ) : (
                <PrimaryButton
                  title="Leave trip"
                  variant="danger"
                  onPress={handleLeave}
                  loading={busy}
                />
              )}
            </View>
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
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
  children,
}: {
  profile: Profile;
  children?: React.ReactNode;
}): React.JSX.Element {
  const initial = (profile.display_name ?? profile.username)
    .charAt(0)
    .toUpperCase();
  return (
    <View style={styles.row}>
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
    </View>
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
  sheetBackground: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  handle: {
    backgroundColor: colors.border,
    width: 44,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  renameRow: {
    marginBottom: spacing.sm,
  },
  renameInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: 17,
    backgroundColor: colors.background,
  },
  section: {
    marginTop: spacing.lg,
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
  rowText: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
  footer: {
    marginTop: spacing.xl,
  },
});
