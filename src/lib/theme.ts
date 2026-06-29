/**
 * Cache design tokens. The whole app pulls colour, type, and spacing from here
 * so the "parchment / retro map" vibe stays consistent and there is never a
 * default white or grey surface.
 */
export const colors = {
  /** Parchment background. */
  background: '#f5f0e8',
  /** Ink — primary text. */
  ink: '#6b5c45',
  /** Roads / borders. */
  border: '#d4c9a8',
  /** Water / accent. */
  accent: '#a8c4bc',
  /** Park green, reused for the "visited" success state. */
  success: '#7fa86a',
  /** Slightly deeper parchment for raised surfaces (cards, sheets). */
  surface: '#efe7d8',
  /** Muted ink for secondary text. */
  inkMuted: '#9a8a70',
  /** A warm terracotta used sparingly for destructive / unvisited emphasis. */
  danger: '#b5654a',
  /** Pure ink-on-parchment for text drawn over the accent buttons. */
  onAccent: '#3f3526',
} as const;

export const fonts = {
  /** UI / body text. */
  regular: 'DMSans-Regular',
  medium: 'DMSans-Medium',
  bold: 'DMSans-Bold',
  /** Headings & place names. */
  serif: 'Lora-Regular',
  serifBold: 'Lora-Bold',
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
  pill: 999,
} as const;

/**
 * One shadow recipe for every raised parchment surface (pills, cards, the tab
 * bar, floating controls). Spread `elevation.low`/`elevation.high` instead of
 * re-declaring shadow values per component so depth stays consistent.
 */
export const elevation = {
  low: {
    shadowColor: '#3f3526',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 3,
  },
  high: {
    shadowColor: '#3f3526',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
} as const;

/**
 * The exact retro Google Maps style supplied in the spec, kept here so both the
 * map screen and any future read-only friend map share one source of truth.
 */
export const RETRO_MAP_STYLE = [
  {
    featureType: 'all',
    elementType: 'geometry',
    stylers: [{color: '#f5f0e8'}],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{color: '#d4c9a8'}],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{color: '#a8c4bc'}],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{color: '#c8d8b0'}],
  },
  {
    featureType: 'all',
    elementType: 'labels.text.fill',
    stylers: [{color: '#6b5c45'}],
  },
];
