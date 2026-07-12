import React, {useCallback, useMemo, useState} from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';

import {
  radius,
  spacing,
  useAppTheme,
  type AppColors,
  type AppTheme,
} from '../lib/theme';
import {formatDistance, timeAgo} from '../lib/format';
import {haversineMeters} from '../lib/distance';
import {refreshStashes, useStashes, useThumbnailUri} from '../hooks/useStashes';
import {useLocation} from '../hooks/useLocation';
import {navigationRef} from '../navigation/navigationRef';
import {useTabBarVisibility} from '../navigation/tabBarVisibility';
import {StashBottomSheet} from '../components/StashBottomSheet';
import {AppText} from '../components/Themed';
import {CATEGORY_ICON, Icon} from '../components/Icon';
import type {Stash} from '../types';

type Tab = 'all' | 'visited';
type SortMode = 'closest' | 'recent';

/** A stash paired with its distance from the user (null when unknown). */
type StashRowItem = {stash: Stash; distance: number | null};

/**
 * The list view of every saved place. Tapping a row opens the very same sheet
 * the map pins use.
 */
export function SavedScreen(): React.JSX.Element {
  const {colors, elevation} = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, elevation),
    [colors, elevation],
  );
  const {stashes, loading} = useStashes();
  const {location} = useLocation();
  const {setVisible: setTabBarVisible} = useTabBarVisibility();
  const [tab, setTab] = useState<Tab>('all');
  const [sort, setSort] = useState<SortMode>('closest');
  const [selected, setSelected] = useState<Stash | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshStashes();
      return () => setTabBarVisible(true);
    }, [setTabBarVisible]),
  );

  const handleSheetClose = useCallback(() => {
    setSelected(null);
    setTabBarVisible(true);
  }, [setTabBarVisible]);

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      setTabBarVisible(!open);
    },
    [setTabBarVisible],
  );

  // The store arrives newest-first (created_at desc). We filter by tab, attach a
  // distance to each row, then sort by distance when "Closest" is picked and a
  // location is known — otherwise we keep the newest-first order (this is both
  // the "Recent" view and the graceful fallback when location is unavailable).
  const data = useMemo<StashRowItem[]>(() => {
    const filtered =
      tab === 'visited' ? stashes.filter(s => s.visited_at != null) : stashes;
    const items = filtered.map(stash => ({
      stash,
      distance: location
        ? haversineMeters(location, {lat: stash.lat, lng: stash.lng})
        : null,
    }));
    if (sort === 'closest' && location) {
      items.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }
    return items;
  }, [stashes, tab, sort, location]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">Saved</AppText>
        <Pressable
          onPress={() => navigationRef.navigate('AddStash')}
          style={({pressed}) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add a place">
          <Icon name="plus" size={22} color={colors.primary} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.tabs}>
          <TabButton
            label="All"
            active={tab === 'all'}
            onPress={() => setTab('all')}
          />
          <TabButton
            label="Visited"
            active={tab === 'visited'}
            onPress={() => setTab('visited')}
          />
        </View>
        <SortToggle sort={sort} onChange={setSort} />
      </View>

      <FlatList
        data={data}
        keyExtractor={item => item.stash.id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <StashRow
            stash={item.stash}
            distance={item.distance}
            onPress={() => setSelected(item.stash)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshStashes}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon
                name={tab === 'visited' ? 'check' : 'bookmark'}
                size={28}
                color={colors.textMuted}
              />
            </View>
            <AppText variant="serif" style={styles.emptyTitle}>
              {tab === 'visited' ? 'No visits yet' : 'Nothing cached yet'}
            </AppText>
            <AppText variant="medium" style={styles.emptyText}>
              {tab === 'visited'
                ? 'Places you mark as visited will show up here.'
                : 'Share a TikTok or Reel to Cache to save your first place.'}
            </AppText>
          </View>
        }
      />

      <StashBottomSheet
        stash={selected}
        onClose={handleSheetClose}
        onOpenChange={handleSheetOpenChange}
      />
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const {colors, elevation} = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, elevation),
    [colors, elevation],
  );

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.tab,
        active && styles.tabActive,
        pressed && !active && styles.tabPressed,
      ]}
      accessibilityRole="tab"
      accessibilityState={{selected: active}}>
      <AppText
        variant={active ? 'bold' : 'medium'}
        style={active && styles.tabTextActive}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Compact two-segment control that picks how the list is ordered. */
function SortToggle({
  sort,
  onChange,
}: {
  sort: SortMode;
  onChange: (next: SortMode) => void;
}): React.JSX.Element {
  const {colors, elevation} = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, elevation),
    [colors, elevation],
  );
  const segments: {mode: SortMode; label: string}[] = [
    {mode: 'closest', label: 'Closest'},
    {mode: 'recent', label: 'Recent'},
  ];
  return (
    <View style={styles.sortToggle}>
      {segments.map(({mode, label}) => {
        const active = sort === mode;
        return (
          <Pressable
            key={mode}
            onPress={() => onChange(mode)}
            style={[styles.sortSegment, active && styles.sortSegmentActive]}
            accessibilityRole="button"
            accessibilityState={{selected: active}}>
            <AppText
              variant={active ? 'bold' : 'caption'}
              style={
                active ? styles.sortSegmentTextActive : styles.sortSegmentText
              }>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function StashRow({
  stash,
  distance,
  onPress,
}: {
  stash: Stash;
  distance: number | null;
  onPress: () => void;
}): React.JSX.Element {
  const {colors, elevation} = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, elevation),
    [colors, elevation],
  );
  const visited = stash.visited_at != null;
  const {uri, onError} = useThumbnailUri(stash);
  const cached = timeAgo(stash.created_at);
  const meta = [
    distance != null ? formatDistance(distance) : '',
    cached ? `cached ${cached}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button">
      <View style={styles.thumbWrap}>
        {uri ? (
          <Image source={{uri}} style={styles.thumb} onError={onError} />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]}>
            <Icon
              name={CATEGORY_ICON[stash.category ?? 'Other']}
              size={22}
              color={colors.textMuted}
            />
          </View>
        )}
        {visited && (
          <View style={styles.thumbBadge}>
            <Icon
              name="check"
              size={11}
              color={colors.onSuccess}
              strokeWidth={2.5}
            />
          </View>
        )}
      </View>

      <View style={styles.rowBody}>
        <AppText variant="serif" numberOfLines={1} style={styles.rowTitle}>
          {stash.place_name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {stash.category ?? 'Other'}
          {stash.address ? `  ·  ${stash.address}` : ''}
        </AppText>
        {meta ? (
          <AppText variant="caption" numberOfLines={1} style={styles.meta}>
            {meta}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(c: AppColors, appElevation: AppTheme['elevation']) {
  return StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.background},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    addButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addButtonPressed: {
      opacity: 0.9,
      transform: [{scale: 0.96}],
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    tabs: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tab: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    tabActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    tabPressed: {
      backgroundColor: c.surfaceElevated,
    },
    tabTextActive: {
      color: c.onPrimary,
    },
    sortToggle: {
      flexDirection: 'row',
      backgroundColor: c.surfaceElevated,
      borderRadius: radius.pill,
      padding: 2,
    },
    sortSegment: {
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    sortSegmentActive: {
      backgroundColor: c.primary,
    },
    sortSegmentText: {
      color: c.textMuted,
    },
    sortSegmentTextActive: {
      color: c.onPrimary,
    },
    list: {
      paddingHorizontal: spacing.lg,
      paddingBottom: 120,
    },
    row: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.md,
      marginBottom: spacing.md,
      alignItems: 'center',
      ...appElevation.low,
    },
    rowPressed: {
      opacity: 0.9,
      transform: [{scale: 0.99}],
    },
    thumbWrap: {
      width: 64,
      height: 64,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: c.surfaceElevated,
    },
    thumb: {
      width: '100%',
      height: '100%',
    },
    thumbFallback: {
      backgroundColor: c.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbBadge: {
      position: 'absolute',
      right: 3,
      bottom: 3,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.success,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.surface,
    },
    rowBody: {
      flex: 1,
      marginLeft: spacing.md,
    },
    rowTitle: {
      marginBottom: 2,
    },
    meta: {
      marginTop: spacing.xs,
      color: c.textFaint,
    },
    empty: {
      paddingTop: spacing.xxl * 2,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      marginBottom: spacing.xs,
    },
    emptyText: {
      textAlign: 'center',
      color: c.textMuted,
    },
  });
}
