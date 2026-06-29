import React from 'react';
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

import {colors, elevation, fonts, radius, spacing} from '../lib/theme';

/**
 * Typed text + button atoms so every surface uses DMSans / Lora and the
 * parchment palette. Screens never reach for the raw `<Text>` default font.
 */

type TextVariant =
  | 'body'
  | 'medium'
  | 'bold'
  | 'caption'
  | 'serif'
  | 'serifTitle'
  | 'serifLarge';

const VARIANT_STYLES: Record<TextVariant, TextStyle> = {
  body: {fontFamily: fonts.regular, fontSize: 15, color: colors.ink},
  medium: {fontFamily: fonts.medium, fontSize: 15, color: colors.ink},
  bold: {fontFamily: fonts.bold, fontSize: 15, color: colors.ink},
  caption: {fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted},
  serif: {fontFamily: fonts.serif, fontSize: 17, color: colors.ink},
  serifTitle: {fontFamily: fonts.serifBold, fontSize: 22, color: colors.ink},
  serifLarge: {fontFamily: fonts.serifBold, fontSize: 30, color: colors.ink},
};

interface AppTextProps extends TextProps {
  variant?: TextVariant;
}

export function AppText({
  variant = 'body',
  style,
  ...rest
}: AppTextProps): React.JSX.Element {
  return <Text {...rest} style={[VARIANT_STYLES[variant], style]} />;
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
  const isDisabled = disabled || loading;

  const palette: Record<
    ButtonVariant,
    {bg: string; fg: string; border: string}
  > = {
    primary: {bg: colors.accent, fg: colors.onAccent, border: colors.accent},
    secondary: {
      bg: 'transparent',
      fg: colors.ink,
      border: colors.border,
    },
    danger: {bg: 'transparent', fg: colors.danger, border: colors.danger},
  };

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

/** A simple parchment card surface. */
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}): React.JSX.Element {
  return <View style={[styles.card, style]}>{children}</View>;
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
    fontSize: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...elevation.low,
  },
});
