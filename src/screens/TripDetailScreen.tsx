import React, {useCallback, useMemo, useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import MapView, {
  type MapStyleElement,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  colors,
  elevation,
  radius,
  RETRO_MAP_STYLE,
  spacing,
} from '../lib/theme';
import {
  formatTripDate,
  formatTripTime,
  groupEntriesByDate,
  regionForStashes,
} from '../lib/trips';
import {refreshItineraries, useTrip} from '../hooks/useItineraries';
import {
  refreshTripStashes,
  removeEntry,
  setEntrySchedule,
  useTripEntries,
} from '../hooks/useTripStashes';
import {useThumbnailUri} from '../hooks/useStashes';
import {useLocation} from '../hooks/useLocation';
import {currentUserId} from '../hooks/useAuth';
import {StashPin} from '../components/StashPin';
import {StashBottomSheet} from '../components/StashBottomSheet';
import {StashPickerSheet} from '../components/StashPickerSheet';
import {DatePickerSheet} from '../components/DatePickerSheet';
import {TripMembersSheet} from '../components/TripMembersSheet';
import {AppText} from '../components/Themed';
import {CATEGORY_ICON, Icon} from '../components/Icon';
import type {RootStackParamList, TripStashEntry} from '../types';

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type Props = NativeStackScreenProps<RootStackParamList, 'TripDetail'>;

/**
 * One trip: its own small map up top, the date-grouped list of stops below,
 * and the member/add/schedule flows in sheets. Reuses StashPin and
 * StashBottomSheet so pins and details match the main map exactly.
 */
export function TripDetailScreen({
  route,
  navigation,
}: Props): React.JSX.Element {
  const {itineraryId} = route.params;
  const myId = currentUserId();
  const trip = useTrip(itineraryId);
  const {entries, loading} = useTripEntries(itineraryId);
  const {location} = useLocation();

  const [selected, setSelected] = useState<TripStashEntry | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scheduling, setScheduling] = useState<TripStashEntry | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshItineraries();
      refreshTripStashes();
    }, []),
  );

  const sections = useMemo(
    () =>
      groupEntriesByDate(entries).map(section => ({
        title: section.date ? formatTripDate(section.date) : 'Unscheduled',
        data: section.entries,
      })),
    [entries],
  );

  const region = useMemo((): Region => {
    const fitted = regionForStashes(entries.map(e => e.stash));
    if (fitted) {
      return fitted;
    }
    if (location) {
      return {
        ...DEFAULT_REGION,
        latitude: location.lat,
        longitude: location.lng,
      };
    }
    return DEFAULT_REGION;
  }, [entries, location]);

  const canRemove = (entry: TripStashEntry): boolean =>
    trip?.isOwner === true || entry.addedBy?.id === myId;

  const handleRemove = (entry: TripStashEntry) => {
    Alert.alert(
      'Remove from trip?',
      `"${entry.stash.place_name}" will be taken off ${
        trip?.itinerary.name ?? 'this trip'
      }. The place itself stays saved.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeEntry(entry.entryId);
            } catch (e) {
              Alert.alert(
                'Could not remove',
                e instanceof Error ? e.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  const memberCount =
    1 + (trip?.members.filter(m => m.status === 'accepted').length ?? 0);
  const tripSchedule = trip
    ? `${formatTripRange(
        trip.itinerary.trip_date,
        trip.itinerary.trip_end_date,
      )}${
        trip.itinerary.trip_time
          ? ` · ${formatTripTime(trip.itinerary.trip_time)}`
          : ''
      }`
    : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* The trip's own small map. Remount when the fitted region changes
          meaningfully (count) so initialRegion refits after adds/removals. */}
      <View style={styles.mapWrap}>
        <MapView
          key={`trip-map-${entries.length}`}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          customMapStyle={RETRO_MAP_STYLE as MapStyleElement[]}
          initialRegion={region}
          showsMyLocationButton={false}
          toolbarEnabled={false}>
          {entries.map(entry => (
            <StashPin
              key={entry.entryId}
              stash={entry.stash}
              onPress={() => setSelected(entry)}
            />
          ))}
        </MapView>

        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable
            onPress={() => navigation.goBack()}
            style={({pressed}) => [styles.back, pressed && styles.backPressed]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back">
            <Icon name="close" size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.titlePill}>
            <AppText variant="serif" style={styles.titleText} numberOfLines={1}>
              {trip?.itinerary.name ?? 'Trip'}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {tripSchedule
                ? `${tripSchedule} · ${entries.length} ${
                    entries.length === 1 ? 'place' : 'places'
                  }`
                : `${entries.length} ${
                    entries.length === 1 ? 'place' : 'places'
                  }`}
            </AppText>
          </View>
        </View>
      </View>

      {/* Toolbar: members + the two add flows. */}
      <View style={styles.toolbar}>
        <ToolbarButton
          icon="users"
          label={`${memberCount}`}
          onPress={() => setMembersOpen(true)}
        />
        <View style={styles.toolbarSpacer} />
        <ToolbarButton
          icon="bookmark"
          label="Add a place"
          onPress={() => setPickerOpen(true)}
        />
        <ToolbarButton
          icon="plus"
          label="New place"
          accent
          onPress={() =>
            navigation.navigate('AddStash', {addToItineraryId: itineraryId})
          }
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.entryId}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({section}) => (
          <AppText variant="bold" style={styles.sectionTitle}>
            {section.title}
          </AppText>
        )}
        renderItem={({item}) => (
          <EntryRow
            entry={item}
            isMine={item.addedBy?.id === myId}
            removable={canRemove(item)}
            onPress={() => setSelected(item)}
            onSchedule={() => setScheduling(item)}
            onRemove={() => handleRemove(item)}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="suitcase" size={28} color={colors.inkMuted} />
              </View>
              <AppText variant="serif" style={styles.emptyTitle}>
                No places yet
              </AppText>
              <AppText variant="medium" style={styles.emptyText}>
                Add stops from your saved places, or create a new one.
              </AppText>
            </View>
          ) : null
        }
      />

      <StashBottomSheet
        stash={selected?.stash ?? null}
        onClose={() => setSelected(null)}
        readOnly={selected?.stash.user_id !== myId}
        addedBy={
          selected && selected.addedBy?.id !== myId ? selected.addedBy : null
        }
      />
      <StashPickerSheet
        itineraryId={pickerOpen ? itineraryId : null}
        onClose={() => setPickerOpen(false)}
      />
      <DatePickerSheet
        visible={scheduling !== null}
        title={scheduling?.stash.place_name ?? ''}
        date={scheduling?.scheduledDate ?? null}
        time={scheduling?.scheduledTime ?? null}
        onSave={(date, time) =>
          scheduling
            ? setEntrySchedule(scheduling.entryId, date, time)
            : undefined
        }
        onClose={() => setScheduling(null)}
      />
      <TripMembersSheet
        trip={membersOpen ? trip : null}
        onClose={() => setMembersOpen(false)}
        onTripGone={() => {
          setMembersOpen(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

function ToolbarButton({
  icon,
  label,
  accent = false,
  onPress,
}: {
  icon: 'users' | 'bookmark' | 'plus';
  label: string;
  accent?: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [
        styles.toolbarBtn,
        accent && styles.toolbarBtnAccent,
        pressed && styles.toolbarBtnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Icon
        name={icon}
        size={16}
        color={accent ? colors.onAccent : colors.ink}
        strokeWidth={2}
      />
      <AppText
        variant="medium"
        style={accent ? styles.toolbarBtnAccentText : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

function EntryRow({
  entry,
  isMine,
  removable,
  onPress,
  onSchedule,
  onRemove,
}: {
  entry: TripStashEntry;
  isMine: boolean;
  removable: boolean;
  onPress: () => void;
  onSchedule: () => void;
  onRemove: () => void;
}): React.JSX.Element {
  const {uri, onError} = useThumbnailUri(entry.stash);
  const scheduleLabel = entry.scheduledTime
    ? formatTripTime(entry.scheduledTime)
    : entry.scheduledDate
    ? 'Add time'
    : 'Schedule';

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button">
      {uri ? (
        <Image source={{uri}} style={styles.thumb} onError={onError} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Icon
            name={CATEGORY_ICON[entry.stash.category ?? 'Other']}
            size={20}
            color={colors.inkMuted}
          />
        </View>
      )}

      <View style={styles.rowBody}>
        <AppText variant="serif" numberOfLines={1} style={styles.rowTitle}>
          {entry.stash.place_name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {entry.stash.category ?? 'Other'}
          {entry.stash.address ? `  ·  ${entry.stash.address}` : ''}
        </AppText>
        {!isMine && entry.addedBy && (
          <AppText variant="caption" numberOfLines={1} style={styles.addedBy}>
            Added by @{entry.addedBy.username}
          </AppText>
        )}
      </View>

      <View style={styles.rowActions}>
        <Pressable
          onPress={onSchedule}
          hitSlop={6}
          style={({pressed}) => [
            styles.scheduleChip,
            pressed && styles.rowPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Set date and time">
          <Icon name="calendar" size={13} color={colors.ink} />
          <AppText variant="caption" style={styles.scheduleText}>
            {scheduleLabel}
          </AppText>
        </Pressable>
        {removable && (
          <Pressable
            onPress={onRemove}
            hitSlop={8}
            style={({pressed}) => pressed && styles.rowPressed}
            accessibilityRole="button"
            accessibilityLabel="Remove from trip">
            <Icon name="close" size={16} color={colors.inkMuted} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function formatTripRange(startDate: string, endDate: string): string {
  return startDate === endDate
    ? formatTripDate(startDate)
    : `${formatTripDate(startDate)} - ${formatTripDate(endDate)}`;
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  mapWrap: {
    height: '34%',
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.low,
  },
  backPressed: {opacity: 0.85},
  titlePill: {
    flexShrink: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...elevation.low,
  },
  titleText: {
    fontSize: 18,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  toolbarSpacer: {flex: 1},
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  toolbarBtnAccent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toolbarBtnAccentText: {
    color: colors.onAccent,
  },
  toolbarBtnPressed: {opacity: 0.7},
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
  },
  sectionTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
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
    gap: spacing.md,
    ...elevation.low,
  },
  rowPressed: {opacity: 0.7},
  thumb: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  thumbFallback: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    marginBottom: 2,
  },
  addedBy: {
    marginTop: 2,
    color: colors.inkMuted,
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  scheduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  scheduleText: {
    color: colors.ink,
  },
  empty: {
    paddingTop: spacing.xxl,
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
