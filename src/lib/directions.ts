import {Linking, Platform} from 'react-native';

/**
 * Open the platform maps app with directions to a place.
 *
 * We pass a *destination only* — never an origin. This is deliberate: it means
 * directions work identically whether or not the user has shared their
 * location, because the maps app supplies the starting point itself (the
 * device's current location when available, or a point the user picks). So this
 * is safe to offer even when Cache has no location permission.
 *
 * iOS opens Apple Maps via the `maps://` scheme; Android uses the `geo:` intent,
 * which Google Maps (and any other installed maps app) handles. Both fall back
 * to a universal https URL if the native scheme can't be opened.
 */
export async function openDirections(place: {
  lat: number;
  lng: number;
  name?: string | null;
}): Promise<void> {
  const {lat, lng, name} = place;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  const label = encodeURIComponent(name?.trim() || 'Destination');
  const nativeUrl =
    Platform.OS === 'ios'
      ? `maps://?daddr=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
  const webUrl =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  try {
    const canOpenNative = await Linking.canOpenURL(nativeUrl);
    await Linking.openURL(canOpenNative ? nativeUrl : webUrl);
  } catch {
    // The native scheme reported openable but still failed, or canOpenURL threw.
    // Try the universal web URL once more before giving up.
    try {
      await Linking.openURL(webUrl);
    } catch {
      // Nothing more we can do.
    }
  }
}
