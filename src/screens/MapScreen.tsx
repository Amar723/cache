import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';
import MapView, {
  type MapStyleElement,
  PROVIDER_GOOGLE,
  type Region,
} from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';

import {
  radius,
  spacing,
  useAppTheme,
  type AppColors,
  type AppTheme,
} from '../lib/theme';
import {useStashes, getStashById, refreshStashes} from '../hooks/useStashes';
import {useLocation} from '../hooks/useLocation';
import {useAuth} from '../hooks/useAuth';
import {reconcileFriendOverlaps, useOverlapMap} from '../hooks/useOverlaps';
import {
  consumePendingStash,
  subscribeOpenStash,
} from '../navigation/navigationRef';
import {useSetTabBarVisible} from '../navigation/tabBarVisibility';
import {StashPin} from '../components/StashPin';
import {StashBottomSheet} from '../components/StashBottomSheet';
import {AppText} from '../components/Themed';
import {Icon} from '../components/Icon';
import type {Stash} from '../types';

// Truly-last-resort region, only reached when the user has no location, no
// saved pins, and no home city on their profile (e.g. permission denied on a
// brand-new account). See `fallbackRegion` for the ordered preference list.
// Melbourne CBD — the home of Cache.
const NEUTRAL_FALLBACK: Region = {
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

// The clustering wrapper forwards its ref to the underlying react-native-maps
// MapView and accepts every MapView prop plus a few clustering options, but its
// bundled types model it as a bare class. Re-type it here so the call site gets
// a correctly-typed ref (for `animateToRegion`) and prop-checking.
type ClusterOptions = {
  clusteringEnabled?: boolean;
  radius?: number;
  minPoints?: number;
  clusterColor?: string;
  clusterTextColor?: string;
};
const ClusteredMap =
  ClusteredMapView as unknown as React.ForwardRefExoticComponent<
    Omit<React.ComponentProps<typeof MapView>, 'ref'> &
      ClusterOptions &
      React.RefAttributes<MapView>
  >;

/**
 * Full-screen map. Renders every stash as a custom pin and hosts the
 * shared detail sheet. Also the landing point for notification deep links.
 */
export function MapScreen(): React.JSX.Element {
  const {colors, elevation, mapStyle} = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, elevation),
    [colors, elevation],
  );
  const {stashes} = useStashes();
  const {location, permission} = useLocation();
  const {profile} = useAuth();
  const setTabBarVisible = useSetTabBarVisible();

  // The home city the user picked at onboarding, used to center the map when we
  // have no location fix. Null only if the profile predates that field.
  const homeCity = useMemo(
    () =>
      profile?.default_city_lat != null && profile?.default_city_lng != null
        ? {lat: profile.default_city_lat, lng: profile.default_city_lng}
        : null,
    [profile?.default_city_lat, profile?.default_city_lng],
  );
  const overlaps = useOverlapMap();
  const mapRef = useRef<MapView>(null);
  const didInitialCenter = useRef(false);
  const pendingVisitedPulse = useRef<string | null>(null);
  const [selected, setSelected] = useState<Stash | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [visitedPulse, setVisitedPulse] = useState<{
    stashId: string;
    key: number;
  } | null>(null);

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

  // Where to center the map when the user's own location is unavailable (denied
  // permission, or a fix that never arrives). The candidates are ordered by
  // preference — reorder these two lines to change the fallback behavior.
  const fallbackRegion = useCallback((): Region => {
    const candidates = [
      stashes[0], // 1. their most recent saved pin
      homeCity, // 2. the home city they set at onboarding
    ];
    const hit = candidates.find(c => c != null);
    return hit ? regionFor(hit) : NEUTRAL_FALLBACK; // 3. neutral last resort
  }, [stashes, homeCity]);

  // Prefer the user's location (the `location` from useLocation is seeded from
  // the cached last-known fix, so this resolves almost immediately on return
  // visits). Otherwise open at the fallback region as soon as we have something
  // to show or we know location was denied — no need to wait on the backstop.
  useEffect(() => {
    if (location) {
      decideRegion(regionFor(location));
    } else if (stashes.length > 0 || permission === 'denied') {
      decideRegion(fallbackRegion());
    }
  }, [location, stashes, permission, decideRegion, fallbackRegion]);

  // Don't sit on the "Finding your location…" state forever if location is
  // slow or unavailable (e.g. iOS never reports 'denied', so a refused user
  // reaches the fallback only here).
  useEffect(() => {
    const timer = setTimeout(() => decideRegion(fallbackRegion()), 5000);
    return () => clearTimeout(timer);
  }, [decideRegion, fallbackRegion]);

  // Keep data fresh whenever the map regains focus, then re-check friend
  // overlaps (this is what notifies you right after you save a new place).
  useFocusEffect(
    useCallback(() => {
      refreshStashes().then(() => reconcileFriendOverlaps());
      return () => setTabBarVisible(true);
    }, [setTabBarVisible]),
  );

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      setTabBarVisible(!open);
    },
    [setTabBarVisible],
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
      // Not loaded yet — pull fresh data (bypass the staleness guard so a
      // deep-linked pin always resolves); the effect re-runs when stashes change.
      refreshStashes({force: true});
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
    // Center on the live location when we have one; otherwise re-frame on the
    // same fallback the map opened at (pin / home city) so the button still does
    // something useful for users who haven't shared their location.
    const target = location
      ? {
          latitude: location.lat,
          longitude: location.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      : fallbackRegion();
    mapRef.current?.animateToRegion(target, 500);
  }, [location, fallbackRegion]);

  const handleVisited = useCallback((stashId: string) => {
    pendingVisitedPulse.current = stashId;
  }, []);

  const handleSheetClose = useCallback(() => {
    const pulseId = pendingVisitedPulse.current;
    pendingVisitedPulse.current = null;
    setSelected(null);
    setTabBarVisible(true);

    if (pulseId) {
      setVisitedPulse(prev => ({
        stashId: pulseId,
        key: (prev?.key ?? 0) + 1,
      }));
    }
  }, [setTabBarVisible]);

  return (
    <View style={styles.container}>
      {initialRegion ? (
        <ClusteredMap
          ref={mapRef}
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
              friendCount={overlaps[stash.id]?.length ?? 0}
              visitedPulseKey={
                visitedPulse?.stashId === stash.id ? visitedPulse.key : 0
              }
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
            <Icon name="locate" size={24} color={colors.text} />
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

      <StashBottomSheet
        stash={selected}
        onClose={handleSheetClose}
        onVisited={handleVisited}
        onOpenChange={handleSheetOpenChange}
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
      justifyContent: 'space-between',
    },
    topBar: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      alignItems: 'flex-start',
    },
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
    bottomControls: {
      alignItems: 'flex-end',
      paddingHorizontal: spacing.lg,
      paddingBottom: 96, // clear the floating tab bar
    },
    recenter: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.glass,
      borderWidth: 1,
      borderColor: c.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
      ...appElevation.low,
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
      backgroundColor: c.glass,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: c.glassBorder,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...appElevation.low,
    },
    emptyIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyText: {
      flexShrink: 1,
    },
  });
}
