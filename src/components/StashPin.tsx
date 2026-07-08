import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Marker} from 'react-native-maps';

import {colors, fonts, radius} from '../lib/theme';
import {useThumbnailUri} from '../hooks/useStashes';
import {CATEGORY_ICON, Icon} from './Icon';
import type {Stash} from '../types';

interface StashPinProps {
  stash: Stash;
  onPress: (stash: Stash) => void;
  /** How many friends have also saved this place (0 = none). */
  friendCount?: number;
  /** Incremented by the map to play a one-shot visited confirmation pulse. */
  visitedPulseKey?: number;
}

/**
 * A custom map marker: the TikTok thumbnail as a small rounded square, with
 * the saved place's name in a small label underneath.
 *  - Unvisited → neutral border.
 *  - Visited   → green border around the thumbnail, tail, and label.
 *
 * `tracksViewChanges` is expensive to leave on, but on iOS the marker image is
 * blank if we disable it before the thumbnail finishes loading. We therefore
 * track changes until the image has loaded (or failed), then turn it off.
 */
export function StashPin({
  stash,
  onPress,
  friendCount = 0,
  visitedPulseKey = 0,
}: StashPinProps): React.JSX.Element {
  const visited = stash.visited_at !== null;
  const {uri, onError} = useThumbnailUri(stash);
  const pulse = useRef(new Animated.Value(0)).current;
  const [imageSettled, setImageSettled] = useState(uri === null);
  const [pulseActive, setPulseActive] = useState(false);

  useEffect(() => {
    if (visitedPulseKey === 0) {
      return;
    }

    setPulseActive(true);
    pulse.setValue(0);
    Animated.timing(pulse, {
      toValue: 1,
      duration: 760,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => setPulseActive(false));
  }, [pulse, visitedPulseKey]);

  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0.55, 0.18, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.95, 1.9],
        }),
      },
    ],
  };

  return (
    <Marker
      coordinate={{latitude: stash.lat, longitude: stash.lng}}
      onPress={() => onPress(stash)}
      tracksViewChanges={
        // A friend badge changes the rendered marker, so keep tracking until the
        // image settles regardless of platform when one is present.
        pulseActive ||
        (Platform.OS === 'ios' || friendCount > 0 ? !imageSettled : false)
      }
      // The view now extends well below the thumbnail (tail + name label), so
      // anchoring at the vertical center (0.5) would drag the thumbnail away
      // from the actual coordinate. ~0.32 keeps the thumbnail straddling the
      // pin location, with the tail and label hanging below it as a caption.
      anchor={{x: 0.5, y: 0.32}}>
      <View style={styles.pin}>
        {friendCount > 0 && (
          <View style={styles.friendBadge}>
            <Icon
              name="user"
              size={11}
              color={colors.onAccent}
              strokeWidth={2.4}
            />
            {friendCount > 1 && (
              <Text style={styles.friendBadgeCount}>{friendCount}</Text>
            )}
          </View>
        )}
        <View style={styles.thumbCluster}>
          {pulseActive && (
            <Animated.View
              pointerEvents="none"
              style={[styles.pulseRing, pulseStyle]}
            />
          )}
          <View style={[styles.thumbWrap, visited && styles.thumbWrapVisited]}>
            {uri ? (
              <Image
                source={{uri}}
                style={styles.thumb}
                onLoadEnd={() => setImageSettled(true)}
                onError={onError}
              />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Icon
                  name={CATEGORY_ICON[stash.category ?? 'Other']}
                  size={22}
                  color={colors.inkMuted}
                />
              </View>
            )}
          </View>
        </View>
        {/* The little pointer "tail" under the square. */}
        <View style={[styles.tail, visited && styles.tailVisited]} />
        <View style={[styles.labelWrap, visited && styles.labelWrapVisited]}>
          <Text style={styles.label} numberOfLines={1}>
            {stash.place_name}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: {
    alignItems: 'center',
  },
  thumbCluster: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: 'rgba(127,168,106,0.12)',
  },
  thumbWrap: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: colors.background,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
  },
  thumbWrapVisited: {
    borderColor: colors.success,
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
  tail: {
    width: 10,
    height: 10,
    backgroundColor: colors.background,
    transform: [{rotate: '45deg'}],
    marginTop: -6,
    borderRightWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: colors.background,
  },
  tailVisited: {
    borderColor: colors.success,
  },
  labelWrap: {
    marginTop: 4,
    maxWidth: 96,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  labelWrapVisited: {
    borderColor: colors.success,
  },
  label: {
    fontFamily: fonts.serif,
    fontSize: 11,
    color: colors.ink,
    textAlign: 'center',
  },
  friendBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    zIndex: 2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  friendBadgeCount: {
    color: colors.onAccent,
    fontSize: 10,
    fontWeight: '700',
  },
});
