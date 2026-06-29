import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import MapView, {
  type MapStyleElement,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';

import {
  colors,
  elevation,
  radius,
  RETRO_MAP_STYLE,
  spacing,
} from '../lib/theme';
import {useStashes, getStashById, refreshStashes} from '../hooks/useStashes';
import {useLocation} from '../hooks/useLocation';
import {reconcileFriendOverlaps, useOverlapMap} from '../hooks/useOverlaps';
import {
  consumePendingStash,
  subscribeOpenStash,
} from '../navigation/navigationRef';
import {StashPin} from '../components/StashPin';
import {StashBottomSheet} from '../components/StashBottomSheet';
import {AppText} from '../components/Themed';
import {Icon} from '../components/Icon';
import type {Stash} from '../types';

// Last-resort region, only used if we get neither a location nor any pins
// within a few seconds (e.g. permission denied on a fresh install).
const NEUTRAL_FALLBACK: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
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

/**
 * Full-screen retro map. Renders every stash as a custom pin and hosts the
 * shared detail sheet. Also the landing point for notification deep links.
 */
export function MapScreen(): React.JSX.Element {
  const {stashes} = useStashes();
  const {location} = useLocation();
  const overlaps = useOverlapMap();
  const mapRef = useRef<MapView>(null);
  const didInitialCenter = useRef(false);
  const [selected, setSelected] = useState<Stash | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // The region the map first lays out at. Held until we can open *at the user*
  // (cached or live location) or at their first pin — rather than flashing a
  // default city. Stays null (showing a "Finding your location…" state) only
  // for the brief window before any of those are available.
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const regionDecided = useRef(false);

  const decideRegion = useCallback((region: Region) => {
    if (regionDecided.current) {
      return;
    }
    regionDecided.current = true;
    setInitialRegion(region);
  }, []);

  // Prefer the user's location (the `location` from useLocation is seeded from
  // the cached last-known fix, so this resolves almost immediately on return
  // visits); fall back to the first pin if we have stashes but no location yet.
  useEffect(() => {
    if (location) {
      decideRegion(regionFor(location));
    } else if (stashes.length > 0) {
      decideRegion(regionFor(stashes[0]));
    }
  }, [location, stashes, decideRegion]);

  // Don't sit on the "Finding your location…" state forever if location is
  // unavailable (denied / no cache / no pins).
  useEffect(() => {
    const timer = setTimeout(() => decideRegion(NEUTRAL_FALLBACK), 5000);
    return () => clearTimeout(timer);
  }, [decideRegion]);

  // Keep data fresh whenever the map regains focus, then re-check friend
  // overlaps (this is what notifies you right after you save a new place).
  useFocusEffect(
    useCallback(() => {
      refreshStashes().then(() => reconcileFriendOverlaps());
    }, []),
  );

  // Notification deep links: live events + cold-start pending id.
  useEffect(() => {
    const unsubscribe = subscribeOpenStash(id => setPendingId(id));
    const cold = consumePendingStash();
    if (cold) {
      setPendingId(cold);
    }
    return unsubscribe;
  }, []);

  // Resolve a pending deep-link id once the stash is in memory.
  useEffect(() => {
    if (!pendingId) {
      return;
    }
    const target = getStashById(pendingId);
    if (target) {
      setSelected(target);
      mapRef.current?.animateToRegion(
        {
          latitude: target.lat,
          longitude: target.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        600,
      );
      setPendingId(null);
    } else {
      // Not loaded yet — pull fresh data, the effect re-runs when stashes change.
      refreshStashes();
    }
  }, [pendingId, stashes]);

  // On first open, center the map on the user's current location as soon as we
  // get a fix. `initialRegion` can't do this because the fix arrives async,
  // after the first render. We center exactly once so later position updates
  // don't yank the map while the user is panning, and we yield to a notification
  // deep link that's already focusing a specific stash.
  useEffect(() => {
    if (didInitialCenter.current || !location) {
      return;
    }
    didInitialCenter.current = true;
    if (pendingId || selected) {
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      500,
    );
  }, [location, pendingId, selected]);

  const recenter = useCallback(() => {
    if (location) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        500,
      );
    }
  }, [location]);

  return (
    <View style={styles.container}>
      {initialRegion ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          customMapStyle={RETRO_MAP_STYLE as MapStyleElement[]}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}>
          {stashes.map(stash => (
            <StashPin
              key={stash.id}
              stash={stash}
              onPress={setSelected}
              friendCount={overlaps[stash.id]?.length ?? 0}
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.locating}>
          <ActivityIndicator color={colors.ink} />
          <AppText variant="caption" style={styles.locatingText}>
            Finding your location…
          </AppText>
        </View>
      )}

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.titlePill}>
            <AppText variant="serif" style={styles.titleText}>
              Your Cache
            </AppText>
            <AppText variant="caption">
              {stashes.length} {stashes.length === 1 ? 'place' : 'places'}
            </AppText>
          </View>
        </View>

        <View style={styles.bottomControls} pointerEvents="box-none">
          <Pressable
            onPress={recenter}
            style={({pressed}) => [
              styles.recenter,
              pressed && styles.recenterPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Center on my location">
            <Icon name="locate" size={24} color={colors.ink} />
          </Pressable>
        </View>
      </SafeAreaView>

      {stashes.length === 0 && (
        <View style={styles.emptyHint} pointerEvents="none">
          <View style={styles.emptyPill}>
            <View style={styles.emptyIcon}>
              <Icon name="pin" size={20} color={colors.accent} />
            </View>
            <AppText variant="medium" style={styles.emptyText}>
              Share a TikTok or Reel to Cache to drop your first pin.
            </AppText>
          </View>
        </View>
      )}

      <StashBottomSheet stash={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  locating: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  locatingText: {
    color: colors.inkMuted,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    alignItems: 'flex-start',
  },
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
  bottomControls: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: 96, // clear the floating tab bar
  },
  recenter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.low,
  },
  recenterPressed: {
    opacity: 0.85,
    transform: [{scale: 0.96}],
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...elevation.low,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    flexShrink: 1,
  },
});
