import React, {useCallback, useState} from 'react';
import {
  Alert,
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
import {useItineraries} from '../hooks/useItineraries';
import {currentUserId} from '../hooks/useAuth';
import {friendLabel} from '../lib/overlap';
import {todayString} from '../lib/calendar';
import {formatTripDate, formatTripTime} from '../lib/trips';
import {DatePickerSheet} from '../components/DatePickerSheet';
import {AppText} from '../components/Themed';
import {Icon} from '../components/Icon';
import type {Profile, RootStackParamList, Trip} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DatePickerTarget = 'start' | 'end';

/**
 * Your shared itineraries: pending invites up top, then every trip you own or
 * joined. Refreshes whenever the tab regains focus, like the Friends screen.
 */
export function TripsScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {
    trips,
    invites,
    refreshItineraries,
    createTrip,
    acceptInvite,
    declineInvite,
  } = useItineraries();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [tripStartDate, setTripStartDate] = useState(() => todayString());
  const [tripEndDate, setTripEndDate] = useState(() => todayString());
  const [tripTime, setTripTime] = useState<string | null>(null);
  const [datePickerTarget, setDatePickerTarget] =
    useState<DatePickerTarget | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshItineraries();
    }, [refreshItineraries]),
  );

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const created = await createTrip(
        trimmed,
        tripStartDate,
        tripEndDate,
        tripTime,
      );
      setName('');
      const today = todayString();
      setTripStartDate(today);
      setTripEndDate(today);
      setTripTime(null);
      setCreating(false);
      navigation.navigate('TripDetail', {itineraryId: created.id});
    } catch (e) {
      Alert.alert(
        'Could not create trip',
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">Trips</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New trip"
          onPress={() => setCreating(c => !c)}
          style={({pressed}) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}>
          <Icon
            name={creating ? 'close' : 'plus'}
            size={20}
            color={colors.onAccent}
            strokeWidth={2.2}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {creating && (
          <View style={styles.createPanel}>
            <View style={styles.createRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Trip name, e.g. Sydney trip"
                placeholderTextColor={colors.inkMuted}
                autoFocus
                maxLength={60}
                onSubmitEditing={handleCreate}
                returnKeyType="done"
                style={styles.createInput}
              />
              <Action
                label={saving ? 'Creating…' : 'Create'}
                onPress={handleCreate}
              />
            </View>
            <View style={styles.dateControls}>
              <Pressable
                onPress={() => setDatePickerTarget('start')}
                style={({pressed}) => [
                  styles.dateButton,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Set trip start date and time">
                <Icon name="calendar" size={16} color={colors.ink} />
                <AppText variant="medium" style={styles.dateButtonText}>
                  Start {formatTripDate(tripStartDate)}
                </AppText>
                {tripTime && (
                  <>
                    <AppText variant="caption">·</AppText>
                    <Icon name="clock" size={15} color={colors.inkMuted} />
                    <AppText variant="medium">
                      {formatTripTime(tripTime)}
                    </AppText>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => setDatePickerTarget('end')}
                style={({pressed}) => [
                  styles.dateButton,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Set trip end date">
                <Icon name="calendar" size={16} color={colors.ink} />
                <AppText variant="medium" style={styles.dateButtonText}>
                  End {formatTripDate(tripEndDate)}
                </AppText>
              </Pressable>
            </View>
          </View>
        )}

        {invites.length > 0 && (
          <Section title={`Invites (${invites.length})`}>
            {invites.map(invite => (
              <View key={invite.memberId} style={styles.row}>
                <TripAvatars profiles={[invite.owner]} />
                <View style={styles.rowText}>
                  <AppText variant="medium" numberOfLines={1}>
                    {invite.itinerary.name}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    {formatTripRange(
                      invite.itinerary.trip_date,
                      invite.itinerary.trip_end_date,
                      invite.itinerary.trip_time,
                    )}{' '}
                    · from @{invite.owner.username}
                  </AppText>
                </View>
                <View style={styles.actions}>
                  <Action
                    label="Accept"
                    onPress={() => acceptInvite(invite.memberId)}
                  />
                  <Action
                    label="Decline"
                    variant="muted"
                    onPress={() => declineInvite(invite.memberId)}
                  />
                </View>
              </View>
            ))}
          </Section>
        )}

        <Section title={`Your trips (${trips.length})`}>
          {trips.length === 0 ? (
            <AppText variant="caption" style={styles.empty}>
              Plan somewhere with friends — tap + to start your first trip.
            </AppText>
          ) : (
            trips.map(trip => (
              <TripRow
                key={trip.itinerary.id}
                trip={trip}
                onPress={() =>
                  navigation.navigate('TripDetail', {
                    itineraryId: trip.itinerary.id,
                  })
                }
              />
            ))
          )}
        </Section>
      </ScrollView>

      <DatePickerSheet
        visible={datePickerTarget !== null}
        title={datePickerTarget === 'end' ? 'End date' : 'Start date'}
        date={datePickerTarget === 'end' ? tripEndDate : tripStartDate}
        time={datePickerTarget === 'start' ? tripTime : null}
        requireDate
        allowClear={false}
        showTime={datePickerTarget === 'start'}
        errorTitle={
          datePickerTarget === 'end'
            ? 'Could not set end date'
            : 'Could not set start date'
        }
        onSave={(date, time) => {
          if (!date) {
            return;
          }
          if (datePickerTarget === 'end') {
            if (date < tripStartDate) {
              throw new Error('End date must be on or after the start date.');
            }
            setTripEndDate(date);
          } else {
            setTripStartDate(date);
            if (tripEndDate < date) {
              setTripEndDate(date);
            }
            setTripTime(time);
          }
        }}
        onClose={() => setDatePickerTarget(null)}
      />
    </SafeAreaView>
  );
}

function TripRow({
  trip,
  onPress,
}: {
  trip: Trip;
  onPress: () => void;
}): React.JSX.Element {
  const myId = currentUserId();
  // Everyone on the trip except the viewer: the owner plus accepted members.
  const companions: Profile[] = [];
  if (trip.owner.id !== myId) {
    companions.push(trip.owner);
  }
  for (const member of trip.members) {
    if (member.status === 'accepted' && member.profile.id !== myId) {
      companions.push(member.profile);
    }
  }
  const pending = trip.members.filter(m => m.status === 'pending').length;
  const caption =
    companions.length > 0
      ? `with ${friendLabel(companions)}`
      : pending > 0
      ? `${pending} invited`
      : 'Just you so far';
  const schedule = formatTripRange(
    trip.itinerary.trip_date,
    trip.itinerary.trip_end_date,
    trip.itinerary.trip_time,
  );

  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
      <TripAvatars profiles={companions} />
      <View style={styles.rowText}>
        <AppText variant="medium" numberOfLines={1}>
          {trip.itinerary.name}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {schedule} · {caption}
        </AppText>
      </View>
      <View style={styles.chevronRight}>
        <Icon name="chevron-down" size={18} color={colors.inkMuted} />
      </View>
    </Pressable>
  );
}

function formatTripRange(
  startDate: string,
  endDate: string,
  time: string | null,
): string {
  const dateLabel =
    startDate === endDate
      ? formatTripDate(startDate)
      : `${formatTripDate(startDate)} - ${formatTripDate(endDate)}`;
  return time ? `${dateLabel} · ${formatTripTime(time)}` : dateLabel;
}

/** A small stacked-avatar cluster; falls back to a suitcase tile when alone. */
function TripAvatars({profiles}: {profiles: Profile[]}): React.JSX.Element {
  if (profiles.length === 0) {
    return (
      <View style={[styles.avatar, styles.avatarFallback]}>
        <Icon name="suitcase" size={20} color={colors.inkMuted} />
      </View>
    );
  }
  return (
    <View style={styles.avatarStack}>
      {profiles.slice(0, 3).map((profile, i) => {
        const initial = (profile.display_name ?? profile.username)
          .charAt(0)
          .toUpperCase();
        return (
          <View
            key={profile.id}
            style={[
              styles.avatar,
              styles.avatarSmall,
              i > 0 && styles.avatarOverlap,
            ]}>
            {profile.avatar_url ? (
              <Image
                source={{uri: profile.avatar_url}}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <AppText variant="bold">{initial}</AppText>
              </View>
            )}
          </View>
        );
      })}
    </View>
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

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {opacity: 0.7},
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
  },
  createPanel: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  createInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontSize: 15,
    backgroundColor: colors.background,
  },
  dateButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    flexShrink: 1,
  },
  dateButtonText: {
    marginLeft: 2,
  },
  dateControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  avatarStack: {
    flexDirection: 'row',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarOverlap: {
    marginLeft: -14,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
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
  chevronRight: {
    transform: [{rotate: '-90deg'}],
  },
});
