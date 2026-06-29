import React from 'react';
import {Platform, StyleSheet} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

import {colors, elevation, fonts, radius} from '../lib/theme';
import {MapScreen} from '../screens/MapScreen';
import {SavedScreen} from '../screens/SavedScreen';
import {FriendsScreen} from '../screens/FriendsScreen';
import {ProfileScreen} from '../screens/ProfileScreen';
import {useIncomingRequestCount} from '../hooks/useFriends';
import {Icon, type IconName} from '../components/Icon';
import type {TabParamList} from '../types';

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, IconName> = {
  Map: 'map',
  Saved: 'bookmark',
  Friends: 'users',
  Profile: 'user',
};

/** Module-scope so the tab bar doesn't remount a fresh component each render. */
function TabBarIcon({
  routeName,
  focused,
}: {
  routeName: keyof TabParamList;
  focused: boolean;
}): React.JSX.Element {
  return (
    <Icon
      name={ICONS[routeName]}
      size={23}
      color={focused ? colors.ink : colors.inkMuted}
      strokeWidth={focused ? 2 : 1.6}
    />
  );
}

/**
 * Floating parchment tab bar. It is absolutely positioned so the map renders
 * full-bleed behind it, satisfying "the map fills the entire screen behind the
 * tab bar".
 */
export function TabNavigator(): React.JSX.Element {
  const incomingRequests = useIncomingRequestCount();
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarIcon: ({focused}) => (
          <TabBarIcon routeName={route.name} focused={focused} />
        ),
      })}>
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          tabBarBadge: incomingRequests > 0 ? incomingRequests : undefined,
        }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: Platform.OS === 'ios' ? 28 : 16,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
    paddingBottom: 8,
    ...elevation.high,
  },
  tabItem: {
    paddingVertical: 4,
  },
  tabLabel: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
  },
});
