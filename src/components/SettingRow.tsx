import React, {useMemo} from 'react';
import {Pressable, StyleSheet} from 'react-native';

import {radius, spacing, useAppTheme, type AppColors} from '../lib/theme';
import {AppText} from './Themed';
import {Icon, type IconName} from './Icon';

interface SettingRowProps {
  icon?: IconName;
  label: string;
  /** Secondary text on the right (e.g. the account email). */
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  /** Trailing chevron; defaults to on for pressable rows. */
  chevron?: boolean;
}

/** One row in a settings list: icon, label, optional value, chevron when it navigates. */
export function SettingRow({
  icon,
  label,
  value,
  onPress,
  destructive = false,
  chevron,
}: SettingRowProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const showChevron = chevron ?? onPress != null;
  const labelColor = destructive ? colors.danger : colors.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({pressed}) => [styles.row, pressed && onPress && styles.pressed]}>
      {icon ? <Icon name={icon} size={19} color={labelColor} /> : null}
      <AppText variant="medium" style={[styles.label, {color: labelColor}]}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="caption" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {showChevron ? (
        <Icon name="chevron-right" size={17} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    row: {
      minHeight: 50,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    pressed: {
      opacity: 0.7,
    },
    label: {
      flex: 1,
    },
    value: {
      flexShrink: 1,
    },
  });
}
