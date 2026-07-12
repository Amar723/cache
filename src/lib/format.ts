/** Human-friendly date helpers used across the detail sheet and list rows. */

import {NativeModules, Platform} from 'react-native';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "Jun 15, 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Best-effort device region (e.g. "US", "GB") read straight from the platform,
 * with no extra dependency. Returns '' when it can't be determined.
 */
function deviceRegion(): string {
  try {
    let locale = 'en-US';
    if (Platform.OS === 'ios') {
      const settings = NativeModules.SettingsManager?.settings;
      locale = settings?.AppleLocale || settings?.AppleLanguages?.[0] || locale;
    } else {
      locale = NativeModules.I18nManager?.localeIdentifier || locale;
    }
    // Pull the 2-letter region out of "en-US" / "en_US" / "zh-Hant-TW".
    const match = /[-_]([A-Za-z]{2})\b/.exec(String(locale));
    return match ? match[1].toUpperCase() : '';
  } catch {
    return '';
  }
}

/** Regions that measure road distance in miles. */
const IMPERIAL_REGIONS = new Set(['US', 'GB', 'MM', 'LR']);

/** Whether this device should see miles/feet instead of kilometres/metres. */
export const IMPERIAL = IMPERIAL_REGIONS.has(deviceRegion());

/**
 * A compact distance label, e.g. "280 m", "2.3 km", "340 ft", "1.4 mi".
 * Unit system defaults to the device locale but can be forced (used in tests).
 */
export function formatDistance(
  meters: number,
  imperial: boolean = IMPERIAL,
): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '';
  }
  if (imperial) {
    const miles = meters / 1609.344;
    if (miles < 0.1) {
      const feet = meters * 3.28084;
      return `${Math.round(feet / 10) * 10} ft`;
    }
    return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
  }
  if (meters < 1000) {
    const rounded =
      meters < 10 ? Math.round(meters) : Math.round(meters / 10) * 10;
    return `${rounded} m`;
  }
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/**
 * A compact relative time, e.g. "just now", "5m ago", "3h ago", "3d ago",
 * "2w ago", "4mo ago", "1y ago". Returns '' for null/invalid input.
 * `nowMs` is injectable for testing.
 */
export function timeAgo(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (!iso) {
    return '';
  }
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) {
    return '';
  }
  const seconds = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (seconds < 60) {
    return 'just now';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  if (days < 30) {
    return `${Math.floor(days / 7)}w ago`;
  }
  if (days < 365) {
    return `${Math.max(1, Math.floor(days / 30))}mo ago`;
  }
  return `${Math.floor(days / 365)}y ago`;
}
