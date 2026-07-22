import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import MapView, {
  type MapStyleElement,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  radius,
  spacing,
  useAppTheme,
  type AppColors,
  type AppTheme,
} from '../lib/theme';
import {useFriendStashes} from '../hooks/useFriendStashes';
import {useLocation} from '../hooks/useLocation';
import {StashPin} from '../components/StashPin';
import {StashBottomSheet} from '../components/StashBottomSheet';
import {AppText} from '../components/Themed';
import {Icon} from '../components/Icon';
import type {RootStackParamList, Stash} from '../types';

// Last-resort neutral region, only reached if the friend has neither a default
// city nor any shared pins. After the default-city backfill this is rarely hit.
// Melbourne CBD — the home of Cache.
const DEFAULT_REGION: Region = {
  latitude: -37.8136,
  longitude: 144.9631,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function regionFor(point: {lat: number; lng: number}, delta = 0.05): Region {
  return {
    latitude: point.lat,
    longitude: point.lng,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

// See MapScreen: re-type the clustering wrapper (bundled types model it as a
// bare class) so it accepts MapView props plus the clustering options we set.
type ClusterOptions = {
  clusteringEnabled?: boolean;
  radius?: number;
  minPoints?: number;
  clusterColor?: string;
  clusterTextColor?: string;
};
const ClusteredMap = ClusteredMapView as unknown as React.ComponentType<
  React.ComponentProps<typeof MapView> & ClusterOptions
>;

type Props = NativeStackScreenProps<RootStackParamList, 'FriendMap'>;

/**
 * A friend's shared pins on a read-only map. Reuses StashPin and
 * StashBottomSheet (in read-only mode) — only the data source differs from the
 * user's own MapScreen.
 */
export function FriendMapScreen({route, navigation}: Props): React.JSX.Element {
  const {colors, elevation, mapStyle} = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, elevation),
    [colors, elevation],
  );
  const {friendId, username, defaultCityLat, defaultCityLng} = route.params;
  const {stashes, loading} = useFriendStashes(friendId);
  const {location, permission} = useLocation();
  const [selected, setSelected] = useState<Stash | null>(null);

  // Where to open if we can't get the user's own location: the friend's home
  // city (known synchronously from nav params), then their first shared pin,
  // then a neutral region.
  const fallbackRegion = useCallback(
    (): Region =>
      defaultCityLat != null && defaultCityLng != null
        ? regionFor({lat: defaultCityLat, lng: defaultCityLng}, 0.12)
        : stashes.length > 0
        ? regionFor(stashes[0], 0.08)
        : DEFAULT_REGION,
    [defaultCityLat, defaultCityLng, stashes],
  );

  // Open at the user's *own* current location so they can look around from where
  // they are (the friend's pins may be anywhere). `initialRegion` is uncontrolled,
  // so after this one-time center the user pans and zooms freely.
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const regionDecided = useRef(false);
  const decideRegion = useCallback((region: Region) => {
    if (regionDecided.current) {
      return;
    }
    regionDecided.current = true;
    setInitialRegion(region);
  }, []);

  // `location` is seeded from the cached last-known fix, so this usually resolves
  // within a frame; only give up on it once permission is actually denied.
  useEffect(() => {
    if (location) {
      decideRegion(regionFor(location));
    } else if (permission === 'denied') {
      decideRegion(fallbackRegion());
    }
  }, [location, permission, decideRegion, fallbackRegion]);

  // Backstop: never sit on the spinner forever (e.g. permission stuck 'unknown').
  useEffect(() => {
    const timer = setTimeout(() => decideRegion(fallbackRegion()), 5000);
    return () => clearTimeout(timer);
  }, [decideRegion, fallbackRegion]);

  return (
    <View style={styles.container}>
      {initialRegion ? (
        <ClusteredMap
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          customMapStyle={mapStyle as unknown as MapStyleElement[]}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          clusteringEnabled={false}>
          {stashes.map(stash => (
            <StashPin
              key={stash.id}
              stash={stash}
              coordinate={{latitude: stash.lat, longitude: stash.lng}}
              onPress={setSelected}
            />
          ))}
        </ClusteredMap>
      ) : (
        <View style={styles.locating}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption" style={styles.locatingText}>
            Finding your location…
          </AppText>
        </View>
      )}

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
            <Icon name="close" size={22} color={colors.text} />
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

function createStyles(c: AppColors, appElevation: AppTheme['elevation']) {
  return StyleSheet.create({
    container: {flex: 1, backgroundColor: c.background},
    locating: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: c.background,
    },
    locatingText: {
      color: c.textMuted,
    },
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
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      ...appElevation.low,
    },
    backPressed: {opacity: 0.85},
    titlePill: {
      backgroundColor: c.glass,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.glassBorder,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      ...appElevation.low,
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
      backgroundColor: c.glass,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.glassBorder,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...appElevation.low,
    },
  });
}
