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

import {radius, spacing, useAppTheme, type AppColors} from '../lib/theme';
import {formatDate} from '../lib/format';
import {lightImpact} from '../lib/haptics';
import {isSupportedVideoUrl, openVideo} from '../lib/tiktok';
import {useStash, useStashes, useThumbnailUri} from '../hooks/useStashes';
import {useStashOverlap} from '../hooks/useOverlaps';
import {friendLabel} from '../lib/overlap';
import {navigationRef} from '../navigation/navigationRef';
import type {Profile, Stash} from '../types';
import {ConfirmDialog} from './ConfirmDialog';
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
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const {markVisited, unmarkVisited, deleteStash} = useStashes();
  const liveStash = useStash(!readOnly ? stash?.id ?? null : null);
  const activeStash = liveStash ?? stash;
  const alsoSaved = useStashOverlap(activeStash?.id ?? null);
  const {uri: thumbUri, onError: handleThumbError} =
    useThumbnailUri(activeStash);
  const visitScale = useRef(new Animated.Value(1)).current;
  const freshVisitedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingUnmark, setConfirmingUnmark] = useState(false);
  const [unmarking, setUnmarking] = useState(false);
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
    [insets.bottom, styles],
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
    setConfirmingDelete(true);
  }, [stash]);

  const cancelDelete = useCallback(() => {
    setConfirmingDelete(false);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!stash) {
      return;
    }
    setDeleting(true);
    try {
      await deleteStash(stash.id);
      setConfirmingDelete(false);
      onClose();
    } catch (e) {
      setConfirmingDelete(false);
      Alert.alert(
        'Could not delete',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setDeleting(false);
    }
  }, [deleteStash, onClose, stash]);

  const handleUnmarkPress = useCallback(() => {
    if (!activeStash) {
      return;
    }
    setConfirmingUnmark(true);
  }, [activeStash]);

  const cancelUnmark = useCallback(() => setConfirmingUnmark(false), []);

  const confirmUnmark = useCallback(async () => {
    if (!activeStash) {
      return;
    }
    setUnmarking(true);
    try {
      await unmarkVisited(activeStash.id);
      lightImpact();
      setConfirmingUnmark(false);
    } catch (e) {
      setConfirmingUnmark(false);
      Alert.alert(
        'Could not unmark',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setUnmarking(false);
    }
  }, [activeStash, unmarkVisited]);

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
  // Places saved without a link have a null `video_url`. Without a video
  // there's nothing to open, so hide the whole thumbnail block — otherwise the
  // "Watch" badge would show and tapping would open a blank Safari tab.
  const hasVideo = isSupportedVideoUrl(activeStash?.video_url ?? '');

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
            {hasVideo && (
              <Pressable
                accessibilityRole="imagebutton"
                accessibilityLabel="Open original video"
                onPress={() => openVideo(activeStash.video_url)}
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
                    <Icon name="play" size={28} color={colors.textMuted} />
                    <AppText
                      variant="caption"
                      numberOfLines={2}
                      style={styles.thumbFallbackText}>
                      {activeStash.video_url}
                    </AppText>
                  </View>
                )}
                <View style={styles.playHint}>
                  <Icon name="play" size={13} color={colors.onPrimary} />
                  <AppText style={styles.playHintText}>Watch</AppText>
                </View>
              </Pressable>
            )}

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
                  <Pressable
                    onPress={handleUnmarkPress}
                    disabled={freshVisited || unmarking}
                    accessibilityRole="button"
                    accessibilityLabel={`Visited ${formatDate(
                      activeStash.visited_at,
                    )}. Tap to unmark.`}>
                    <Animated.View
                      style={[
                        styles.visitedPill,
                        freshVisited && styles.visitedPillFresh,
                        {transform: [{scale: visitScale}]},
                      ]}>
                      <Icon
                        name="check"
                        size={18}
                        color={freshVisited ? colors.onSuccess : colors.success}
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
                      {!freshVisited && (
                        <View style={styles.unmarkHint}>
                          <Icon name="close" size={16} color={colors.success} />
                        </View>
                      )}
                    </Animated.View>
                  </Pressable>
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

      {activeStash && (
        <ConfirmDialog
          visible={confirmingDelete}
          title="Delete this place?"
          message={`"${activeStash.place_name}" will be removed from your Cache. This can't be undone.`}
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      {activeStash && (
        <ConfirmDialog
          visible={confirmingUnmark}
          title="Unmark as visited?"
          message={`"${activeStash.place_name}" will move back to your saved places and can notify you when you're nearby again.`}
          confirmLabel="Unmark"
          destructive={false}
          loading={unmarking}
          onConfirm={confirmUnmark}
          onCancel={cancelUnmark}
        />
      )}
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
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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

function createStyles(c: AppColors) {
  return StyleSheet.create({
    sheetBackground: {
      backgroundColor: c.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
    handle: {
      backgroundColor: c.border,
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
      borderColor: c.border,
      backgroundColor: c.surfaceElevated,
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
      backgroundColor: c.scrim,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    playHintText: {
      color: c.onPrimary,
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
      backgroundColor: c.accent,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    categoryText: {
      color: c.onAccent,
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
      backgroundColor: c.surfaceElevated,
      borderWidth: 1,
      borderColor: c.border,
    },
    avatarStack: {
      flexDirection: 'row',
    },
    avatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.highlight,
      borderWidth: 1.5,
      borderColor: c.surface,
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
      color: c.onHighlight,
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
    unmarkHint: {
      position: 'absolute',
      right: spacing.md,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    visitedPill: {
      minHeight: 50,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.success,
      backgroundColor: `${c.success}24`,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    visitedPillFresh: {
      backgroundColor: c.success,
    },
    visitedText: {
      color: c.success,
    },
    visitedTextFresh: {
      color: c.onSuccess,
    },
  });
}
