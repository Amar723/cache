import React from 'react';
import Svg, {Circle, Line, Path, Polygon, Polyline} from 'react-native-svg';

import {colors} from '../lib/theme';
import type {Category} from '../types';

/**
 * The app's single icon set. Every glyph is hand-drawn on a 24×24 grid in a
 * consistent stroke style (round caps/joins, ~1.75 stroke) so the whole UI reads
 * as one deliberate line-art family rather than a grab-bag of emoji. Colour and
 * weight are inherited from the parent <Svg>, so a screen only sets `color`.
 */
export type IconName =
  // Tabs
  | 'map'
  | 'bookmark'
  | 'user'
  | 'users'
  // Categories
  | 'utensils'
  | 'coffee'
  | 'glass'
  | 'ticket'
  | 'bag'
  | 'pin'
  // UI
  | 'chevron-down'
  | 'check'
  | 'play'
  | 'locate'
  | 'directions'
  | 'camera'
  | 'close'
  | 'plus';

/** One source of truth mapping each place category to its glyph. */
export const CATEGORY_ICON: Record<Category, IconName> = {
  Food: 'utensils',
  Cafe: 'coffee',
  Bar: 'glass',
  Experience: 'ticket',
  Shopping: 'bag',
  Other: 'pin',
};

/**
 * Inner geometry per icon. Presentation attributes (stroke, width, caps) live on
 * the <Svg> root and are inherited, so paths only carry shape. A handful of
 * glyphs opt into a fill and say so explicitly.
 */
const PATHS: Record<IconName, React.ReactNode> = {
  map: (
    <>
      <Polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <Line x1={8} y1={2} x2={8} y2={18} />
      <Line x1={16} y1={6} x2={16} y2={22} />
    </>
  ),
  bookmark: <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  user: (
    <>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </>
  ),
  users: (
    <>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  utensils: (
    <>
      <Path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2" />
      <Line x1={5} y1={11} x2={5} y2={22} />
      <Path d="M17 2a4 4 0 0 0-4 4v6a2 2 0 0 0 2 2h2V2z" />
      <Line x1={17} y1={14} x2={17} y2={22} />
    </>
  ),
  coffee: (
    <>
      <Path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <Path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <Line x1={6} y1={1.5} x2={6} y2={4} />
      <Line x1={10} y1={1.5} x2={10} y2={4} />
      <Line x1={14} y1={1.5} x2={14} y2={4} />
    </>
  ),
  glass: (
    <>
      <Path d="M19 3H5l7 8z" />
      <Line x1={12} y1={11} x2={12} y2={22} />
      <Line x1={8} y1={22} x2={16} y2={22} />
    </>
  ),
  ticket: (
    <>
      <Path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <Line x1={13} y1={6} x2={13} y2={18} strokeDasharray="2 2.5" />
    </>
  ),
  bag: (
    <>
      <Path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <Line x1={3} y1={6} x2={21} y2={6} />
      <Path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  pin: (
    <>
      <Path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <Circle cx={12} cy={10} r={3} />
    </>
  ),
  'chevron-down': <Polyline points="6 9 12 15 18 9" />,
  check: <Polyline points="20 6 9 17 4 12" />,
  play: (
    <Polygon points="6 4 20 12 6 20 6 4" fill="currentFill" stroke="none" />
  ),
  locate: (
    <>
      <Line x1={12} y1={2} x2={12} y2={5} />
      <Line x1={12} y1={19} x2={12} y2={22} />
      <Line x1={2} y1={12} x2={5} y2={12} />
      <Line x1={19} y1={12} x2={22} y2={12} />
      <Circle cx={12} cy={12} r={7} />
      <Circle cx={12} cy={12} r={1.5} fill="currentFill" stroke="none" />
    </>
  ),
  directions: <Polygon points="3 11 22 2 13 21 11 13 3 11" />,
  camera: (
    <>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx={12} cy={13} r={4} />
    </>
  ),
  close: (
    <>
      <Line x1={18} y1={6} x2={6} y2={18} />
      <Line x1={6} y1={6} x2={18} y2={18} />
    </>
  ),
  plus: (
    <>
      <Line x1={12} y1={5} x2={12} y2={19} />
      <Line x1={5} y1={12} x2={19} y2={12} />
    </>
  ),
};

interface IconProps {
  name: IconName;
  /** Square size in points. */
  size?: number;
  /** Stroke colour (and fill for the solid glyphs). Defaults to ink. */
  color?: string;
  strokeWidth?: number;
}

export function Icon({
  name,
  size = 24,
  color = colors.ink,
  strokeWidth = 1.75,
}: IconProps): React.JSX.Element {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {/* Solid glyphs read `currentFill`; swap it for the live colour. */}
      {replaceFill(PATHS[name], color)}
    </Svg>
  );
}

/**
 * react-native-svg has no `currentColor` fill inheritance, so any child that
 * declared `fill="currentFill"` gets the real colour injected here.
 */
function replaceFill(node: React.ReactNode, color: string): React.ReactNode {
  return React.Children.map(node, child => {
    if (!React.isValidElement(child)) {
      return child;
    }
    const props = child.props as {fill?: string; children?: React.ReactNode};
    const next: Record<string, unknown> = {};
    if (props.fill === 'currentFill') {
      next.fill = color;
    }
    if (props.children) {
      next.children = replaceFill(props.children, color);
    }
    return Object.keys(next).length > 0
      ? React.cloneElement(child, next)
      : child;
  });
}
