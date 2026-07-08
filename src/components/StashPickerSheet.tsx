import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Image, Pressable, StyleSheet, View} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import {colors, radius, spacing} from '../lib/theme';
import {useStashes, useThumbnailUri} from '../hooks/useStashes';
import {addStashToTrip, useTripEntries} from '../hooks/useTripStashes';
import {AppText} from './Themed';
import {CATEGORY_ICON, Icon} from './Icon';
import type {Stash} from '../types';

interface StashPickerSheetProps {
  /** The trip to add places to, or null to keep the sheet closed. */
  itineraryId: string | null;
  onClose: () => void;
}

/**
 * "Add a place" picker: your saved stashes that aren't already in the trip.
 * Stays open after each add so a whole day can be planned in one sitting —
 * added rows simply disappear from the list.
 */
export function StashPickerSheet({
  itineraryId,
  onClose,
}: StashPickerSheetProps): React.JSX.Element {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['75%'], []);
  const {stashes} = useStashes();
  const {entries} = useTripEntries(itineraryId ?? '');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (itineraryId) {
      setQuery('');
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [itineraryId]);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1 && itineraryId) {
        onClose();
      }
    },
    [itineraryId, onClose],
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

  const candidates = useMemo(() => {
    const inTrip = new Set(entries.map(e => e.stash.id));
    const q = query.trim().toLowerCase();
    return stashes.filter(
      s =>
        !inTrip.has(s.id) &&
        (q.length === 0 || s.place_name.toLowerCase().includes(q)),
    );
  }, [entries, query, stashes]);

  const handleAdd = async (stash: Stash) => {
    if (!itineraryId) {
      return;
    }
    setBusyId(stash.id);
    try {
      await addStashToTrip(itineraryId, stash.id);
    } catch (e) {
      Alert.alert(
        'Could not add place',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBusyId(null);
    }
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
      <View style={styles.header}>
        <AppText variant="serifTitle">Add a place</AppText>
        <BottomSheetTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your saved places"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.search}
        />
      </View>
      <BottomSheetFlatList
        data={candidates}
        keyExtractor={(item: Stash) => item.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({item}: {item: Stash}) => (
          <PickerRow
            stash={item}
            busy={busyId === item.id}
            onAdd={() => handleAdd(item)}
          />
        )}
        ListEmptyComponent={
          <AppText variant="caption" style={styles.empty}>
            {stashes.length === 0
              ? 'You have no saved places yet.'
              : query.trim().length > 0
              ? `Nothing matches “${query.trim()}”.`
              : 'All of your saved places are already in this trip.'}
          </AppText>
        }
      />
    </BottomSheet>
  );
}

function PickerRow({
  stash,
  busy,
  onAdd,
}: {
  stash: Stash;
  busy: boolean;
  onAdd: () => void;
}): React.JSX.Element {
  const {uri, onError} = useThumbnailUri(stash);
  return (
    <Pressable
      onPress={onAdd}
      disabled={busy}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${stash.place_name}`}>
      {uri ? (
        <Image source={{uri}} style={styles.thumb} onError={onError} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Icon
            name={CATEGORY_ICON[stash.category ?? 'Other']}
            size={18}
            color={colors.inkMuted}
          />
        </View>
      )}
      <View style={styles.rowBody}>
        <AppText variant="medium" numberOfLines={1}>
          {stash.place_name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {stash.category ?? 'Other'}
          {stash.address ? `  ·  ${stash.address}` : ''}
        </AppText>
      </View>
      <View style={styles.addBtn}>
        <Icon name="plus" size={16} color={colors.onAccent} strokeWidth={2.2} />
      </View>
    </Pressable>
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
  header: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  search: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  empty: {
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: {opacity: 0.6},
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  thumbFallback: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
