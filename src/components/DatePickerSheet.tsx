import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import {colors, radius, spacing} from '../lib/theme';
import {addMonths, monthMatrix, monthTitle, todayString} from '../lib/calendar';
import {AppText, PrimaryButton} from './Themed';
import {Icon} from './Icon';

interface DatePickerSheetProps {
  visible: boolean;
  title: string;
  date: string | null;
  time: string | null;
  onClose: () => void;
  onSave: (date: string | null, time: string | null) => Promise<void> | void;
  allowClear?: boolean;
  requireDate?: boolean;
  showTime?: boolean;
  errorTitle?: string;
}

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * A custom month-grid date picker with an optional time, in the app's own
 * parchment style (no native picker dependency). Dates and times are
 * destination wall-clock strings, so nothing here touches timezones.
 */
export function DatePickerSheet({
  visible,
  title,
  date: currentDate,
  time: currentTime,
  onClose,
  onSave,
  allowClear = true,
  requireDate = false,
  showTime = true,
  errorTitle = 'Could not save schedule',
}: DatePickerSheetProps): React.JSX.Element {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['72%'], []);

  const [view, setView] = useState(() => {
    const today = todayString();
    return {year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7))};
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [hour, setHour] = useState(12); // 0-23
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  // Seed the sheet each time it opens.
  useEffect(() => {
    if (!visible) {
      sheetRef.current?.close();
      return;
    }
    const seedDate = currentDate ?? todayString();
    setView({
      year: Number(seedDate.slice(0, 4)),
      month: Number(seedDate.slice(5, 7)),
    });
    setSelectedDate(currentDate ?? (requireDate ? seedDate : null));
    if (showTime && currentTime) {
      const [h, m] = currentTime.split(':').map(Number);
      setTimeEnabled(true);
      setHour(Number.isNaN(h) ? 12 : h);
      setMinute(Number.isNaN(m) ? 0 : m);
    } else {
      setTimeEnabled(false);
      setHour(12);
      setMinute(0);
    }
    sheetRef.current?.snapToIndex(0);
  }, [currentDate, currentTime, requireDate, showTime, visible]);

  const handleChange = useCallback(
    (index: number) => {
      if (index === -1 && visible) {
        onClose();
      }
    },
    [onClose, visible],
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

  const save = async (date: string | null, time: string | null) => {
    if (!visible) {
      return;
    }
    if (requireDate && date === null) {
      Alert.alert(errorTitle, 'Choose a date.');
      return;
    }
    setSaving(true);
    try {
      await onSave(date, time);
      onClose();
    } catch (e) {
      Alert.alert(
        errorTitle,
        e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDone = () =>
    save(
      selectedDate,
      selectedDate && showTime && timeEnabled
        ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(
            2,
            '0',
          )}:00`
        : null,
    );

  const weeks = monthMatrix(view.year, view.month);
  const today = todayString();
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

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
        {visible && (
          <>
            <AppText variant="serifTitle" numberOfLines={1}>
              {title}
            </AppText>

            {/* Month header */}
            <View style={styles.monthHeader}>
              <MonthArrow
                direction="back"
                onPress={() => setView(v => addMonths(v.year, v.month, -1))}
              />
              <AppText variant="bold">
                {monthTitle(view.year, view.month)}
              </AppText>
              <MonthArrow
                direction="forward"
                onPress={() => setView(v => addMonths(v.year, v.month, 1))}
              />
            </View>

            {/* Day grid */}
            <View style={styles.weekRow}>
              {WEEKDAY_HEADERS.map((label, i) => (
                <View key={`h${i}`} style={styles.dayCell}>
                  <AppText variant="caption">{label}</AppText>
                </View>
              ))}
            </View>
            {weeks.map((week, wi) => (
              <View key={`w${wi}`} style={styles.weekRow}>
                {week.map((date, di) =>
                  date === null ? (
                    <View key={`e${di}`} style={styles.dayCell} />
                  ) : (
                    <Pressable
                      key={date}
                      onPress={() =>
                        setSelectedDate(d =>
                          d === date && !requireDate ? null : date,
                        )
                      }
                      style={[
                        styles.dayCell,
                        date === selectedDate && styles.daySelected,
                        date === today &&
                          date !== selectedDate &&
                          styles.dayToday,
                      ]}
                      accessibilityRole="button">
                      <AppText
                        variant={date === selectedDate ? 'bold' : 'body'}
                        style={
                          date === selectedDate
                            ? styles.daySelectedText
                            : undefined
                        }>
                        {Number(date.slice(8, 10))}
                      </AppText>
                    </Pressable>
                  ),
                )}
              </View>
            ))}

            {showTime && (
              <View style={styles.timeRow}>
                <Pressable
                  onPress={() => setTimeEnabled(t => !t)}
                  disabled={!selectedDate}
                  style={[
                    styles.timeToggle,
                    timeEnabled && selectedDate !== null
                      ? styles.timeToggleOn
                      : null,
                    !selectedDate && styles.timeToggleDisabled,
                  ]}
                  accessibilityRole="switch"
                  accessibilityState={{checked: timeEnabled}}>
                  <Icon
                    name="clock"
                    size={16}
                    color={
                      timeEnabled && selectedDate ? colors.onAccent : colors.ink
                    }
                  />
                  <AppText
                    variant="medium"
                    style={
                      timeEnabled && selectedDate
                        ? styles.timeToggleTextOn
                        : undefined
                    }>
                    {timeEnabled ? 'Time' : 'Add a time'}
                  </AppText>
                </Pressable>

                {timeEnabled && selectedDate && (
                  <View style={styles.steppers}>
                    <Stepper
                      label={String(hour12)}
                      onStep={dir => setHour(h => (h + dir + 24) % 24)}
                    />
                    <AppText variant="bold">:</AppText>
                    <Stepper
                      label={String(minute).padStart(2, '0')}
                      onStep={dir => setMinute(m => (m + dir * 15 + 60) % 60)}
                    />
                    <Pressable
                      onPress={() => setHour(h => (h + 12) % 24)}
                      style={styles.ampm}
                      accessibilityRole="button">
                      <AppText variant="bold">
                        {hour < 12 ? 'AM' : 'PM'}
                      </AppText>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            <View style={styles.buttons}>
              {allowClear &&
                (currentDate !== null || selectedDate !== null) && (
                  <PrimaryButton
                    title="Clear"
                    variant="secondary"
                    onPress={() => save(null, null)}
                    disabled={saving}
                    style={styles.button}
                  />
                )}
              <PrimaryButton
                title="Done"
                onPress={handleDone}
                loading={saving}
                style={styles.button}
              />
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

function MonthArrow({
  direction,
  onPress,
}: {
  direction: 'back' | 'forward';
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.monthArrow,
        direction === 'back' ? styles.arrowBack : styles.arrowForward,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        direction === 'back' ? 'Previous month' : 'Next month'
      }>
      <Icon name="chevron-down" size={18} color={colors.ink} />
    </Pressable>
  );
}

/** A tap-to-increment value with a long label; taps step forward, the small
 * chevron steps back. */
function Stepper({
  label,
  onStep,
}: {
  label: string;
  onStep: (direction: 1 | -1) => void;
}): React.JSX.Element {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onStep(-1)} hitSlop={8} style={styles.stepBtn}>
        <View style={styles.arrowUp}>
          <Icon name="chevron-down" size={14} color={colors.inkMuted} />
        </View>
      </Pressable>
      <AppText variant="bold" style={styles.stepValue}>
        {label}
      </AppText>
      <Pressable onPress={() => onStep(1)} hitSlop={8} style={styles.stepBtn}>
        <Icon name="chevron-down" size={14} color={colors.inkMuted} />
      </Pressable>
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
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  monthArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  arrowBack: {transform: [{rotate: '90deg'}]},
  arrowForward: {transform: [{rotate: '-90deg'}]},
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  daySelected: {
    backgroundColor: colors.accent,
  },
  daySelectedText: {
    color: colors.onAccent,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    minHeight: 44,
  },
  timeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  timeToggleOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timeToggleDisabled: {
    opacity: 0.4,
  },
  timeToggleTextOn: {
    color: colors.onAccent,
  },
  steppers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepper: {
    alignItems: 'center',
    gap: 2,
  },
  stepBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowUp: {
    transform: [{rotate: '180deg'}],
  },
  stepValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 17,
  },
  ampm: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  button: {
    flex: 1,
  },
});
