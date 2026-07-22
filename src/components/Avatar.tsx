import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import FastImage from '@d11/react-native-fast-image';

import {useAppTheme} from '../lib/theme';
import {AppText} from './Themed';

interface AvatarProps {
  uri?: string | null;
  /** Fallback initial: first character, uppercased. */
  name?: string | null;
  /** Square size in points; borderRadius is always size / 2. */
  size?: number;
  /** Custom fallback content (e.g. a camera prompt) instead of the initial. */
  placeholder?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * A profile picture with an initial fallback, shared by every surface that
 * shows a person (profile, friends list, onboarding, friend profile).
 */
export function Avatar({
  uri,
  name,
  size = 96,
  placeholder,
  style,
}: AvatarProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const shape: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: size >= 64 ? 2 : 1,
    borderColor: colors.border,
  };

  if (uri) {
    // The circle shape (all View props) is equally valid on an image.
    return (
      <FastImage
        source={{uri, cache: FastImage.cacheControl.immutable}}
        style={
          [shape, style] as React.ComponentProps<typeof FastImage>['style']
        }
        resizeMode={FastImage.resizeMode.cover}
      />
    );
  }

  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      style={[
        shape,
        styles.fallback,
        {backgroundColor: colors.surface},
        style,
      ]}>
      {placeholder ?? (
        <AppText variant="bold" style={{fontSize: size * 0.34}}>
          {initial}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
