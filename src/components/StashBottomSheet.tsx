import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Image, Pressable, StyleSheet, View} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import {colors, radius, spacing} from '../lib/theme';
import {formatDate} from '../lib/format';
import {openDirections} from '../lib/directions';
import {openVideo} from '../lib/tiktok';
import {useStashes, useThumbnailUri} from '../hooks/useStashes';
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
}: StashBottomSheetProps): React.JSX.Element {
  const sheetRef = useRef<BottomSheet>(null);
  const {markVisited, deleteStash} = useStashes();
  const alsoSaved = useStashOverlap(stash?.id ?? null);
  const {uri: thumbUri, onError: handleThumbError} = useThumbnailUri(stash);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const snapPoints = useMemo(() => ['55%', '85%'], []);

  // Open when a stash is selected, close when cleared.
  useEffect(() => {
    if (stash) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [stash]);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1 && stash) {
        onClose();
      }
    },
    [onClose, stash],
  );

  const handleMarkVisited = useCallback(async () => {
    if (!stash) {
      return;
    }
    setSaving(true);
    try {
      await markVisited(stash.id);
    } finally {
      setSaving(false);
    }
  }, [markVisited, stash]);

  const handleGetDirections = useCallback(() => {
    if (!stash) {
      return;
    }
    openDirections({
      lat: stash.lat,
      lng: stash.lng,
      label: stash.place_name,
    });
  }, [stash]);

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

  const visited = stash?.visited_at != null;

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
      <BottomSheetView style={styles.content}>
        {stash && (
          <>
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel="Open original video"
              disabled={stash.tiktok_url === null}
              onPress={() => stash.tiktok_url && openVideo(stash.tiktok_url)}
              style={styles.thumbWrap}>
              {thumbUri ? (
                <Image
                  source={{uri: thumbUri}}
                  style={styles.thumb}
                  resizeMode="cover"
                  onError={handleThumbError}
                />
              ) : stash.tiktok_url ? (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Icon name="play" size={28} color={colors.inkMuted} />
                  <AppText
                    variant="caption"
                    numberOfLines={2}
                    style={styles.thumbFallbackText}>
                    {stash.tiktok_url}
                  </AppText>
                </View>
              ) : (
                <View style={[styles.thumb, styles.thumbFallback]}>
                  <Icon
                    name={CATEGORY_ICON[stash.category ?? 'Other']}
                    size={34}
                    color={colors.inkMuted}
                  />
                </View>
              )}
              {stash.tiktok_url !== null && (
                <View style={styles.playHint}>
                  <Icon name="play" size={13} color={colors.background} />
                  <AppText style={styles.playHintText}>Watch</AppText>
                </View>
              )}
            </Pressable>

            <View style={styles.headerRow}>
              <AppText variant="serifTitle" style={styles.title}>
                {stash.place_name}
              </AppText>
              {stash.category && (
                <View style={styles.categoryChip}>
                  <Icon
                    name={CATEGORY_ICON[stash.category]}
                    size={14}
                    color={colors.onAccent}
                    strokeWidth={1.9}
                  />
                  <AppText variant="caption" style={styles.categoryText}>
                    {stash.category}
                  </AppText>
                </View>
              )}
            </View>

            {stash.address ? (
              <AppText variant="caption" style={styles.address}>
                {stash.address}
              </AppText>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get directions"
              onPress={handleGetDirections}
              style={styles.directionsRow}>
              <Icon name="directions" size={16} color={colors.ink} />
              <AppText variant="bold" style={styles.directionsText}>
                Get Directions
              </AppText>
            </Pressable>

            {stash.notes ? (
              <AppText variant="body" style={styles.notes}>
                {stash.notes}
              </AppText>
            ) : null}

            <AppText variant="caption" style={styles.savedDate}>
              Saved {formatDate(stash.created_at)}
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
                  <View style={styles.visitedPill}>
                    <Icon name="check" size={18} color={colors.success} />
                    <AppText variant="bold" style={styles.visitedText}>
                      Visited {formatDate(stash.visited_at)}
                    </AppText>
                  </View>
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
      </BottomSheetView>
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
    paddingBottom: spacing.xxl,
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
  directionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  directionsText: {
    color: colors.ink,
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
  visitedText: {
    color: colors.success,
  },
});
