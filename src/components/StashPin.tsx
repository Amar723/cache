import React, {useState} from 'react';
import {Image, Platform, StyleSheet, Text, View} from 'react-native';
import {Marker} from 'react-native-maps';

import {colors} from '../lib/theme';
import {useThumbnailUri} from '../hooks/useStashes';
import {CATEGORY_ICON, Icon} from './Icon';
import type {Stash} from '../types';

interface StashPinProps {
  stash: Stash;
  onPress: (stash: Stash) => void;
  /** How many friends have also saved this place (0 = none). */
  friendCount?: number;
}

/**
 * A custom map marker: the TikTok thumbnail as a small rounded square.
 *  - Unvisited → full opacity.
 *  - Visited   → 0.5 opacity with a ✓ badge in the bottom-right corner.
 *
 * `tracksViewChanges` is expensive to leave on, but on iOS the marker image is
 * blank if we disable it before the thumbnail finishes loading. We therefore
 * track changes until the image has loaded (or failed), then turn it off.
 */
export function StashPin({
  stash,
  onPress,
  friendCount = 0,
}: StashPinProps): React.JSX.Element {
  const visited = stash.visited_at !== null;
  const {uri, onError} = useThumbnailUri(stash);
  const [imageSettled, setImageSettled] = useState(uri === null);

  return (
    <Marker
      coordinate={{latitude: stash.lat, longitude: stash.lng}}
      onPress={() => onPress(stash)}
      tracksViewChanges={
        // A friend badge changes the rendered marker, so keep tracking until the
        // image settles regardless of platform when one is present.
        Platform.OS === 'ios' || friendCount > 0 ? !imageSettled : false
      }
      anchor={{x: 0.5, y: 0.5}}>
      <View style={[styles.pin, visited && styles.pinVisited]}>
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
        <View style={styles.thumbWrap}>
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
        {visited && (
          <View style={styles.badge}>
            <Icon
              name="check"
              size={12}
              color={colors.background}
              strokeWidth={2.5}
            />
          </View>
        )}
        {/* The little pointer "tail" under the square. */}
        <View style={[styles.tail, visited && styles.tailVisited]} />
      </View>
    </Marker>
  );
}

// Rendered as a static checkmark via text would require font tracking; using a
// drawn tick keeps the marker crisp regardless of tracksViewChanges timing.
const styles = StyleSheet.create({
  pin: {
    alignItems: 'center',
  },
  pinVisited: {
    opacity: 0.7,
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
    backgroundColor: colors.background,
  },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
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
