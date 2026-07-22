import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type TextProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import {
  fonts,
  fontWeights,
  radius,
  spacing,
  useAppTheme,
  type AppColors,
} from '../lib/theme';

/**
 * Typed text + button atoms so every surface uses the app theme and the native
 * system font. Screens never reach for the raw `<Text>` default font.
 */

type TextVariant =
  | 'body'
  | 'medium'
  | 'bold'
  | 'caption'
  | 'serif'
  | 'serifTitle'
  | 'serifLarge';

function variantStyles(c: AppColors): Record<TextVariant, TextStyle> {
  return {
    body: {
      fontFamily: fonts.regular,
      fontWeight: fontWeights.regular,
      fontSize: 15,
      color: c.text,
    },
    medium: {
      fontFamily: fonts.medium,
      fontWeight: fontWeights.medium,
      fontSize: 15,
      color: c.text,
    },
    bold: {
      fontFamily: fonts.bold,
      fontWeight: fontWeights.bold,
      fontSize: 15,
      color: c.text,
    },
    caption: {
      fontFamily: fonts.regular,
      fontWeight: fontWeights.regular,
      fontSize: 12.5,
      color: c.textMuted,
    },
    serif: {
      fontFamily: fonts.serif,
      fontWeight: fontWeights.serif,
      fontSize: 17,
      color: c.text,
    },
    serifTitle: {
      fontFamily: fonts.serifBold,
      fontWeight: fontWeights.serifBold,
      fontSize: 22,
      color: c.text,
    },
    serifLarge: {
      fontFamily: fonts.serifBold,
      fontWeight: fontWeights.serifBold,
      fontSize: 30,
      color: c.text,
    },
  };
}

interface AppTextProps extends TextProps {
  variant?: TextVariant;
}

// `AppText` is the most-rendered component in the app; recomputing its full
// variant-style map on every render (dozens per screen) is a constant, needless
// allocation. The theme `colors` object is stable, so cache one style map per
// palette and reuse it across every instance.
const variantStyleCache = new WeakMap<
  AppColors,
  Record<TextVariant, TextStyle>
>();

function getVariantStyles(c: AppColors): Record<TextVariant, TextStyle> {
  let cached = variantStyleCache.get(c);
  if (!cached) {
    cached = variantStyles(c);
    variantStyleCache.set(c, cached);
  }
  return cached;
}

export function AppText({
  variant = 'body',
  style,
  ...rest
}: AppTextProps): React.JSX.Element {
  const {colors} = useAppTheme();
  return <Text {...rest} style={[getVariantStyles(colors)[variant], style]} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  style?: ViewStyle;
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: PrimaryButtonProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const isDisabled = disabled || loading;

  const palette = useMemo<
    Record<ButtonVariant, {bg: string; fg: string; border: string}>
  >(
    () => ({
      primary: {
        bg: colors.primary,
        fg: colors.onPrimary,
        border: colors.primary,
      },
      secondary: {bg: colors.surface, fg: colors.text, border: colors.border},
      danger: {bg: colors.surface, fg: colors.danger, border: colors.danger},
    }),
    [colors],
  );

  const p = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled: isDisabled}}
      onPress={isDisabled ? undefined : onPress}
      style={({pressed}) => [
        styles.button,
        {
          backgroundColor: p.bg,
          borderColor: p.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
          transform: [{scale: pressed && !isDisabled ? 0.98 : 1}],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <Text style={[styles.buttonText, {color: p.fg}]}>{title}</Text>
      )}
    </Pressable>
  );
}

/** A simple elevated card surface. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}): React.JSX.Element {
  const {colors, elevation} = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          ...elevation.low,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontWeight: fontWeights.bold,
    fontSize: 16,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
});
