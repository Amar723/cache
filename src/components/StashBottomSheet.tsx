import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {colors, radius, spacing} from '../lib/theme';
import {formatDate} from '../lib/format';
import {lightImpact} from '../lib/haptics';
import {openVideo} from '../lib/tiktok';
import {useStash, useStashes, useThumbnailUri} from '../hooks/useStashes';
import {useStashOverlap} from '../hooks/useOverlaps';
import {friendLabel} from '../lib/overlap';
import {navigationRef} from '../navigation/navigationRef';
import type {Profile, Stash} from '../types';
import {AppText, PrimaryButton} from './Themed';
import {CATEGORY_ICON, Icon} from './Icon';

interface StashBottomSheetProps {
  /** The stash to display, or null to keep the sheet closed. */
  stash: Stash | null;
  onClose: () => void;
  /** A friend's pin: show details + "Watch", but no owner actions. */
  readOnly?: boolean;
  /** Called after one of the user's places is successfully marked visited. */
  onVisited?: (stashId: string) => void;
  /** Called when the sheet enters or leaves an open snap point. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * The shared detail sheet used by both the map pin and the saved list. A single
 * implementation guarantees the two entry points are pixel-identical, which the
 * spec calls for explicitly.
 */
export function StashBottomSheet({
  stash,
  onClose,
  readOnly = false,
  onVisited,
  onOpenChange,
}: StashBottomSheetProps): React.JSX.Element {
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const {markVisited, deleteStash} = useStashes();
  const liveStash = useStash(!readOnly ? stash?.id ?? null : null);
  const activeStash = liveStash ?? stash;
  const alsoSaved = useStashOverlap(activeStash?.id ?? null);
  const {uri: thumbUri, onError: handleThumbError} =
    useThumbnailUri(activeStash);
  const visitScale = useRef(new Animated.Value(1)).current;
  const freshVisitedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [freshVisitedId, setFreshVisitedId] = useState<string | null>(null);
  const openRef = useRef(false);
  const onOpenChangeRef = useRef(onOpenChange);

  const snapPoints = useMemo(() => ['55%', '85%'], []);
  const contentContainerStyle = useMemo(
    () => [
      styles.content,
      {
        paddingBottom: spacing.xxl + insets.bottom,
      },
    ],
    [insets.bottom],
  );

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const notifyOpenChange = useCallback((open: boolean) => {
    if (openRef.current === open) {
      return;
    }
    openRef.current = open;
    onOpenChangeRef.current?.(open);
  }, []);

  // Open when a stash is selected, close when cleared.
  useEffect(() => {
    if (stash) {
      notifyOpenChange(true);
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [notifyOpenChange, stash]);

  useEffect(
    () => () => {
      if (freshVisitedTimer.current) {
        clearTimeout(freshVisitedTimer.current);
      }
      onOpenChangeRef.current?.(false);
    },
    [],
  );

  const handleChange = useCallback(
    (index: number) => {
      notifyOpenChange(index >= 0);
      if (index === -1 && stash) {
        onClose();
      }
    },
    [notifyOpenChange, onClose, stash],
  );

  const handleMarkVisited = useCallback(async () => {
    if (!activeStash) {
      return;
    }
    setSaving(true);
    try {
      await markVisited(activeStash.id);
      lightImpact();
      setFreshVisitedId(activeStash.id);
      onVisited?.(activeStash.id);

      visitScale.setValue(1);
      Animated.sequence([
        Animated.timing(visitScale, {
          toValue: 1.04,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.spring(visitScale, {
          toValue: 1,
          friction: 5,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();

      if (freshVisitedTimer.current) {
        clearTimeout(freshVisitedTimer.current);
      }
      freshVisitedTimer.current = setTimeout(
        () => setFreshVisitedId(null),
        700,
      );
    } finally {
      setSaving(false);
    }
  }, [activeStash, markVisited, onVisited, visitScale]);

  const handleEdit = useCallback(() => {
    if (!stash) {
      return;
    }
    // Close the sheet, then push the form in edit mode over the current tab.
    onClose();
    navigationRef.navigate('AddStash', {stashId: stash.id});
  }, [onClose, stash]);

  const handleDelete = useCallback(() => {
    if (!stash) {
      return;
    }
    Alert.alert(
      'Delete this place?',
      `"${stash.place_name}" will be removed from your Cache. This can't be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteStash(stash.id);
              onClose();
            } catch (e) {
              Alert.alert(
                'Could not delete',
                e instanceof Error ? e.message : 'Please try again.',
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [deleteStash, onClose, stash]);

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

  const visited = activeStash?.visited_at != null;
  const freshVisited = freshVisitedId === activeStash?.id;

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
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}>
        {activeStash && (
          <>
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel="Open original video"
              onPress={() => openVideo(activeStash.tiktok_url)}
              style={styles.thumbWrap}>
              {thumbUri ? (
                <Image
                  source={{uri: thumbUri}}
                  style={styles.thumb}
                  resizeMode="cover"
                  onError={handleThumbError}
                />
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Icon name="play" size={28} color={colors.inkMuted} />
                  <AppText
                    variant="caption"
                    numberOfLines={2}
                    style={styles.thumbFallbackText}>
                    {activeStash.tiktok_url}
                  </AppText>
                </View>
              )}
              <View style={styles.playHint}>
                <Icon name="play" size={13} color={colors.background} />
                <AppText style={styles.playHintText}>Watch</AppText>
              </View>
            </Pressable>

            <View style={styles.headerRow}>
              <AppText variant="serifTitle" style={styles.title}>
                {activeStash.place_name}
              </AppText>
              {activeStash.category && (
                <View style={styles.categoryChip}>
                  <Icon
                    name={CATEGORY_ICON[activeStash.category]}
                    size={14}
                    color={colors.onAccent}
                    strokeWidth={1.9}
                  />
                  <AppText variant="caption" style={styles.categoryText}>
                    {activeStash.category}
                  </AppText>
                </View>
              )}
            </View>

            {activeStash.address ? (
              <AppText variant="caption" style={styles.address}>
                {activeStash.address}
              </AppText>
            ) : null}

            {activeStash.notes ? (
              <AppText variant="body" style={styles.notes}>
                {activeStash.notes}
              </AppText>
            ) : null}

            <AppText variant="caption" style={styles.savedDate}>
              Saved {formatDate(activeStash.created_at)}
            </AppText>

            {alsoSaved.length > 0 && (
              <View style={styles.alsoSaved}>
                <View style={styles.avatarStack}>
                  {alsoSaved.slice(0, 3).map((p, i) => (
                    <FriendAvatar key={p.id} profile={p} overlap={i > 0} />
                  ))}
                </View>
                <AppText variant="medium" style={styles.alsoSavedText}>
                  Also saved by {friendLabel(alsoSaved)}
                </AppText>
              </View>
            )}

            {!readOnly && (
              <View style={styles.actions}>
                {visited ? (
                  <Animated.View
                    style={[
                      styles.visitedPill,
                      freshVisited && styles.visitedPillFresh,
                      {transform: [{scale: visitScale}]},
                    ]}>
                    <Icon
                      name="check"
                      size={18}
                      color={freshVisited ? colors.background : colors.success}
                    />
                    <AppText
                      variant="bold"
                      style={[
                        styles.visitedText,
                        freshVisited && styles.visitedTextFresh,
                      ]}>
                      {freshVisited
                        ? 'Visited'
                        : `Visited ${formatDate(activeStash.visited_at)}`}
                    </AppText>
                  </Animated.View>
                ) : (
                  <PrimaryButton
                    title="Mark as Visited"
                    onPress={handleMarkVisited}
                    loading={saving}
                  />
                )}

                <View style={styles.secondaryRow}>
                  <PrimaryButton
                    title="Edit"
                    variant="secondary"
                    onPress={handleEdit}
                    disabled={deleting}
                    style={styles.secondaryButton}
                  />
                  <PrimaryButton
                    title="Delete"
                    variant="danger"
                    onPress={handleDelete}
                    loading={deleting}
                    style={styles.secondaryButton}
                  />
                </View>
              </View>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

/** A small round avatar (photo, or initial fallback) for the overlap stack. */
function FriendAvatar({
  profile,
  overlap,
}: {
  profile: Profile;
  overlap: boolean;
}): React.JSX.Element {
  const initial = (profile.display_name ?? profile.username)
    .charAt(0)
    .toUpperCase();
  return (
    <View style={[styles.avatar, overlap && styles.avatarOverlap]}>
      {profile.avatar_url ? (
        <Image source={{uri: profile.avatar_url}} style={styles.avatarImage} />
      ) : (
        <AppText variant="bold" style={styles.avatarInitial}>
          {initial}
        </AppText>
      )}
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
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  thumbFallbackText: {
    textAlign: 'center',
  },
  playHint: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(63,53,38,0.78)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  playHintText: {
    color: colors.background,
    fontSize: 12.5,
    fontWeight: '600',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  categoryText: {
    color: colors.onAccent,
  },
  address: {
    marginTop: spacing.xs,
  },
  notes: {
    marginTop: spacing.md,
    lineHeight: 21,
  },
  savedDate: {
    marginTop: spacing.md,
  },
  alsoSaved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarOverlap: {
    marginLeft: -8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    color: colors.onAccent,
    fontSize: 12,
  },
  alsoSavedText: {
    flexShrink: 1,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
  },
  visitedPill: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.success,
    backgroundColor: 'rgba(127,168,106,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  visitedPillFresh: {
    backgroundColor: colors.success,
  },
  visitedText: {
    color: colors.success,
  },
  visitedTextFresh: {
    color: colors.background,
  },
});
