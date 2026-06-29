import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MapView, {
  type MapStyleElement,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  colors,
  elevation,
  radius,
  RETRO_MAP_STYLE,
  spacing,
} from '../lib/theme';
import {useFriendStashes} from '../hooks/useFriendStashes';
import {StashPin} from '../components/StashPin';
import {StashBottomSheet} from '../components/StashBottomSheet';
import {AppText} from '../components/Themed';
import {Icon} from '../components/Icon';
import type {RootStackParamList, Stash} from '../types';

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

type Props = NativeStackScreenProps<RootStackParamList, 'FriendMap'>;

/**
 * A friend's shared pins on a read-only map. Reuses StashPin, the retro map
 * style, and StashBottomSheet (in read-only mode) — only the data source
 * differs from the user's own MapScreen.
 */
export function FriendMapScreen({route, navigation}: Props): React.JSX.Element {
  const {friendId, username} = route.params;
  const {stashes, loading} = useFriendStashes(friendId);
  const [selected, setSelected] = useState<Stash | null>(null);

  const initialRegion: Region =
    stashes.length > 0
      ? {
          latitude: stashes[0].lat,
          longitude: stashes[0].lng,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }
      : DEFAULT_REGION;

  return (
    <View style={styles.container}>
      <MapView
        // Remount once the first pin's region is known so the map lands on it.
        key={stashes.length > 0 ? stashes[0].id : 'empty'}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        customMapStyle={RETRO_MAP_STYLE as MapStyleElement[]}
        initialRegion={initialRegion}
        showsMyLocationButton={false}
        toolbarEnabled={false}>
        {stashes.map(stash => (
          <StashPin key={stash.id} stash={stash} onPress={setSelected} />
        ))}
      </MapView>

      <SafeAreaView
        style={styles.overlay}
        pointerEvents="box-none"
        edges={['top']}>
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
            <AppText variant="serif" style={styles.titleText}>
              @{username}
            </AppText>
            <AppText variant="caption">
              {stashes.length} {stashes.length === 1 ? 'place' : 'places'}
            </AppText>
          </View>
        </View>
      </SafeAreaView>

      {!loading && stashes.length === 0 ? (
        <View style={styles.emptyHint} pointerEvents="none">
          <View style={styles.emptyPill}>
            <AppText variant="medium">
              @{username} hasn’t shared any places yet.
            </AppText>
          </View>
        </View>
      ) : null}

      <StashBottomSheet
        stash={selected}
        onClose={() => setSelected(null)}
        readOnly
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
  emptyHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 140,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyPill: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...elevation.low,
  },
});
