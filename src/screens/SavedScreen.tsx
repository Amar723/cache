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

import {colors, elevation, radius, spacing} from '../lib/theme';
import {formatDate} from '../lib/format';
import {refreshStashes, useStashes, useThumbnailUri} from '../hooks/useStashes';
import {navigationRef} from '../navigation/navigationRef';
import {useTabBarVisibility} from '../navigation/tabBarVisibility';
import {StashBottomSheet} from '../components/StashBottomSheet';
import {AppText} from '../components/Themed';
import {CATEGORY_ICON, Icon} from '../components/Icon';
import type {Stash} from '../types';

type Tab = 'all' | 'visited';

/**
 * The list view of every saved place. Tapping a row opens the very same sheet
 * the map pins use.
 */
export function SavedScreen(): React.JSX.Element {
  const {stashes, loading} = useStashes();
  const {setVisible: setTabBarVisible} = useTabBarVisibility();
  const [tab, setTab] = useState<Tab>('all');
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

  // Store is already ordered newest-first; we only filter here.
  const data = useMemo(
    () =>
      tab === 'visited' ? stashes.filter(s => s.visited_at != null) : stashes,
    [stashes, tab],
  );

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
          <Icon name="plus" size={22} color={colors.onAccent} strokeWidth={2} />
        </Pressable>
      </View>

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

      <FlatList
        data={data}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({item}) => (
          <StashRow stash={item} onPress={() => setSelected(item)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refreshStashes}
            tintColor={colors.ink}
            colors={[colors.ink]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon
                name={tab === 'visited' ? 'check' : 'bookmark'}
                size={28}
                color={colors.inkMuted}
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

function StashRow({
  stash,
  onPress,
}: {
  stash: Stash;
  onPress: () => void;
}): React.JSX.Element {
  const visited = stash.visited_at != null;
  const {uri, onError} = useThumbnailUri(stash);
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
              color={colors.inkMuted}
            />
          </View>
        )}
        {visited && (
          <View style={styles.thumbBadge}>
            <Icon
              name="check"
              size={11}
              color={colors.background}
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
        <AppText
          variant="caption"
          style={[
            styles.status,
            visited ? styles.statusVisited : styles.statusUnvisited,
          ]}>
          {visited
            ? `Visited ${formatDate(stash.visited_at)}`
            : 'Not visited yet'}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
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
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.low,
  },
  addButtonPressed: {
    opacity: 0.9,
    transform: [{scale: 0.96}],
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tabPressed: {
    backgroundColor: colors.surface,
  },
  tabTextActive: {
    color: colors.onAccent,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    ...elevation.low,
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
    backgroundColor: colors.border,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    backgroundColor: colors.surface,
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
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  rowBody: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rowTitle: {
    marginBottom: 2,
  },
  status: {
    marginTop: spacing.xs,
  },
  statusVisited: {
    color: colors.success,
  },
  statusUnvisited: {
    color: colors.inkMuted,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.inkMuted,
  },
});
