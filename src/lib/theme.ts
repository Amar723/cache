import React, {createContext, useContext, useMemo} from 'react';
import {
  useColorScheme,
  type ColorSchemeName,
  type StatusBarStyle,
} from 'react-native';

export type AppColorScheme = 'light' | 'dark';

export type AppColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  /** Tertiary / metadata text (quietest legible tier). */
  textFaint: string;
  border: string;
  primary: string;
  /** Pressed / active state for primary interactive elements. */
  primaryPressed: string;
  /** Soft primary tint for low-emphasis surfaces (e.g. the add-place circle). */
  primarySoft: string;
  accent: string;
  highlight: string;
  success: string;
  warning: string;
  danger: string;
  onPrimary: string;
  onAccent: string;
  onHighlight: string;
  onSuccess: string;
  onWarning: string;
  onDanger: string;
  overlay: string;
  glass: string;
  glassBorder: string;
  shadow: string;
  scrim: string;
  /**
   * Brand gradient stops (electric blue -> indigo), consistent top-left ->
   * bottom-right direction. Reserved for brand moments ("Cache it", selected
   * markers, key moments); use `primary` for ordinary interactive states.
   */
  gradient: readonly [string, string];
  /** Compatibility aliases while screens migrate away from the original names. */
  ink: string;
  inkMuted: string;
};

/** Brand gradient stops, shared across schemes. Top-left -> bottom-right. */
export const BRAND_GRADIENT = ['#3B6EF6', '#4338CA'] as const;

export const lightColors: AppColors = {
  // Warm neutral ramp: nothing pure-white or cold-grey. Neutrals carry a brown
  // undertone (espresso text, taupe secondary, tan tertiary) so the UI reads
  // warm and hand-made rather than clinical, while the blue accent keeps it
  // modern. Cards sit only slightly lighter than the app background.
  background: '#F4F1EA',
  surface: '#FAF6EC',
  surfaceElevated: '#EFE9DC',
  text: '#2C2318',
  textMuted: '#847A69',
  textFaint: '#A99E8B',
  border: '#E4DBCB',
  primary: '#2E6BEA',
  primaryPressed: '#2456C4',
  primarySoft: '#D8E6FB',
  accent: '#00C2A8',
  highlight: '#FF4D7D',
  success: '#4A9E5F',
  warning: '#E0A32B',
  danger: '#D64A3B',
  onPrimary: '#FFFFFF',
  onAccent: '#061915',
  onHighlight: '#FFFFFF',
  onSuccess: '#FFFFFF',
  onWarning: '#241B08',
  onDanger: '#FFFFFF',
  overlay: 'rgba(250,246,236,0.9)',
  glass: 'rgba(250,246,236,0.82)',
  glassBorder: 'rgba(44,35,24,0.08)',
  shadow: '#2C2318',
  scrim: 'rgba(44,35,24,0.42)',
  gradient: BRAND_GRADIENT,
  ink: '#2C2318',
  inkMuted: '#847A69',
};

export const darkColors: AppColors = {
  // Warm charcoal, not pure-black/cold-grey. Same blue brand accent, same
  // warm hue family as light so the two schemes don't diverge.
  background: '#1A1815',
  surface: '#242017',
  surfaceElevated: '#2C2820',
  text: '#F3EFE7',
  textMuted: '#ABA08E',
  textFaint: '#847C6E',
  border: '#3A352C',
  primary: '#5E90FF',
  primaryPressed: '#3E6BE0',
  primarySoft: 'rgba(94,144,255,0.20)',
  accent: '#2EE6C6',
  highlight: '#FF5C8A',
  success: '#55B571',
  warning: '#E7B54A',
  danger: '#E85C4E',
  onPrimary: '#FFFFFF',
  onAccent: '#061915',
  onHighlight: '#FFFFFF',
  onSuccess: '#08120B',
  onWarning: '#241B08',
  onDanger: '#230808',
  overlay: 'rgba(35,32,25,0.9)',
  glass: 'rgba(35,32,25,0.78)',
  glassBorder: 'rgba(243,239,231,0.1)',
  shadow: '#000000',
  scrim: 'rgba(0,0,0,0.58)',
  gradient: BRAND_GRADIENT,
  ink: '#F3EFE7',
  inkMuted: '#A8A399',
};

/** Compatibility export for code that still imports static colors. */
export const colors = lightColors;

// The native platform UI font: San Francisco on iOS, the system default on
// Android. `'System'` resolves to San Francisco on iOS; a single system family
// name can't encode weight the way the bundled DMSans/Lora files did, so weight
// is applied separately via `fontWeights` at every call site.
export const fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  /** Heading roles keep the `serif*` names; they now render in the system font. */
  serif: 'System',
  serifBold: 'System',
} as const;

/**
 * Weights paired with the system font so the old weight hierarchy survives the
 * switch away from per-weight font files. `serif` (place names) is semibold to
 * match native iOS list titles; `serifBold` (screen titles) is bold.
 */
export const fontWeights = {
  regular: '400',
  medium: '500',
  bold: '700',
  serif: '600',
  serifBold: '700',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const createElevation = (c: AppColors) =>
  ({
    low: {
      shadowColor: c.shadow,
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: {width: 0, height: 4},
      elevation: 4,
    },
    high: {
      shadowColor: c.shadow,
      shadowOpacity: 0.18,
      shadowRadius: 22,
      shadowOffset: {width: 0, height: 12},
      elevation: 12,
    },
  } as const);

/** Compatibility export for static StyleSheet call sites. */
export const elevation = createElevation(lightColors);

export const MODERN_MAP_STYLE_LIGHT = [
  // Warm, muted map that bridges the old beige map and the stock Google one:
  // warm off-white land, desaturated blue-grey water, muted sage parks, and
  // toned-down road shields so saved-place markers stay the loudest thing.
  {
    featureType: 'all',
    elementType: 'geometry',
    stylers: [{color: '#F1ECE2'}],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{color: '#F1ECE2'}],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{color: '#EFE9DE'}],
  },
  // Roads: warm grey, reduced saturation; minor roads recede toward the land
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{color: '#E7E1D5'}],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{color: '#DCD5C6'}],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{color: '#E3DBCB'}],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{color: '#D6CDBB'}],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{color: '#EBE5D9'}],
  },
  // Water: muted desaturated blue-grey, low saturation
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{color: '#C7D4D6'}],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{color: '#8A9BA0'}],
  },
  // Parks / green space: muted sage, desaturated
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{color: '#DCE3D2'}],
  },
  {
    featureType: 'poi.medical',
    elementType: 'geometry',
    stylers: [{color: '#E7DDD6'}],
  },
  {
    featureType: 'poi.attraction',
    elementType: 'geometry',
    stylers: [{color: '#E9E1D2'}],
  },
  // --- Declutter: keep it a "place" map, not a navigation map ---
  // Hide small residential street names (biggest source of clutter)
  {
    featureType: 'road.local',
    elementType: 'labels',
    stylers: [{visibility: 'off'}],
  },
  // Drop route-number shields on arterials for a cleaner look
  {
    featureType: 'road.arterial',
    elementType: 'labels.icon',
    stylers: [{visibility: 'off'}],
  },
  // Tone down the bright blue interstate/highway shields so they stop dominating
  {
    featureType: 'road.highway',
    elementType: 'labels.icon',
    stylers: [{saturation: -80}, {lightness: 20}],
  },
  // Hide every POI label first...
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{visibility: 'off'}],
  },
  // ...then bring back only store/business names (text, no icons)...
  {
    featureType: 'poi.business',
    elementType: 'labels.text',
    stylers: [{visibility: 'on'}],
  },
  // ...and park names
  {
    featureType: 'poi.park',
    elementType: 'labels.text',
    stylers: [{visibility: 'on'}],
  },
  // Remove transit lines, stations and labels entirely
  {
    featureType: 'transit',
    stylers: [{visibility: 'off'}],
  },
  // Hide noisy parcel outlines/labels
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{visibility: 'off'}],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{color: '#D8D0C0'}],
  },
  // Text labels: warm grey-brown, lighter, with a soft warm halo
  {
    featureType: 'all',
    elementType: 'labels.text.fill',
    stylers: [{color: '#6F6B62'}],
  },
  {
    featureType: 'all',
    elementType: 'labels.text.stroke',
    stylers: [{color: '#F4F1EA'}, {weight: 2}],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{color: '#8A8478'}],
  },
] as const;

export const MODERN_MAP_STYLE_DARK = [
  // Warm-charcoal counterpart to the light map: warm dark land, muted
  // blue-grey water, desaturated sage parks. Same declutter + toned shields.
  {
    featureType: 'all',
    elementType: 'geometry',
    stylers: [{color: '#211E18'}],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{color: '#1E1B15'}],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{color: '#252118'}],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{color: '#332E24'}],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{color: '#1C1912'}],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{color: '#3B3527'}],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{color: '#2B2720'}],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{color: '#25333A'}],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{color: '#5E7178'}],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{color: '#2A3324'}],
  },
  // --- Declutter: keep it a "place" map, not a navigation map ---
  // Hide small residential street names (biggest source of clutter)
  {
    featureType: 'road.local',
    elementType: 'labels',
    stylers: [{visibility: 'off'}],
  },
  // Drop route-number shields on arterials for a cleaner look
  {
    featureType: 'road.arterial',
    elementType: 'labels.icon',
    stylers: [{visibility: 'off'}],
  },
  // Tone down the highway shields so they stop dominating
  {
    featureType: 'road.highway',
    elementType: 'labels.icon',
    stylers: [{saturation: -70}, {lightness: -10}],
  },
  // Hide every POI label first...
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{visibility: 'off'}],
  },
  // ...then bring back only store/business names (text, no icons)...
  {
    featureType: 'poi.business',
    elementType: 'labels.text',
    stylers: [{visibility: 'on'}],
  },
  // ...and park names
  {
    featureType: 'poi.park',
    elementType: 'labels.text',
    stylers: [{visibility: 'on'}],
  },
  // Remove transit lines, stations and labels entirely
  {
    featureType: 'transit',
    stylers: [{visibility: 'off'}],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{visibility: 'off'}],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{color: '#3A342A'}],
  },
  {
    featureType: 'all',
    elementType: 'labels.text.fill',
    stylers: [{color: '#A8A399'}],
  },
  {
    featureType: 'all',
    elementType: 'labels.text.stroke',
    stylers: [{color: '#161310'}, {weight: 2}],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{color: '#8F897C'}],
  },
] as const;

export type AppTheme = {
  colorScheme: AppColorScheme;
  isDark: boolean;
  colors: AppColors;
  elevation: ReturnType<typeof createElevation>;
  mapStyle: typeof MODERN_MAP_STYLE_LIGHT | typeof MODERN_MAP_STYLE_DARK;
  statusBarStyle: StatusBarStyle;
};

function resolveScheme(scheme: ColorSchemeName): AppColorScheme {
  return scheme === 'dark' ? 'dark' : 'light';
}

/**
 * Master switch for dark mode. Disabled for now: the app is locked to light
 * regardless of the OS appearance setting, and there is no user-facing toggle.
 * The dark palette (`darkColors`), dark map style (`MODERN_MAP_STYLE_DARK`) and
 * all theming machinery are intentionally kept in place — flip this to `true`
 * to bring dark mode back with no other changes.
 */
const DARK_MODE_ENABLED = false;

const fallbackTheme: AppTheme = {
  colorScheme: 'light',
  isDark: false,
  colors: lightColors,
  elevation: createElevation(lightColors),
  mapStyle: MODERN_MAP_STYLE_LIGHT,
  statusBarStyle: 'dark-content',
};

const ThemeContext = createContext<AppTheme>(fallbackTheme);

export function CacheThemeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  // We still read the OS scheme so the wiring stays live, but ignore it while
  // dark mode is disabled so the app always resolves to the light theme.
  const systemScheme = resolveScheme(useColorScheme());
  const colorScheme: AppColorScheme = DARK_MODE_ENABLED ? systemScheme : 'light';

  const value = useMemo<AppTheme>(() => {
    const isDark = colorScheme === 'dark';
    const activeColors = isDark ? darkColors : lightColors;

    return {
      colorScheme,
      isDark,
      colors: activeColors,
      elevation: createElevation(activeColors),
      mapStyle: isDark ? MODERN_MAP_STYLE_DARK : MODERN_MAP_STYLE_LIGHT,
      statusBarStyle: isDark ? 'light-content' : 'dark-content',
    };
  }, [colorScheme]);

  return React.createElement(ThemeContext.Provider, {value}, children);
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext);
}
