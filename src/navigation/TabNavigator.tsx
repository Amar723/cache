import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, Platform, StyleSheet} from 'react-native';
import {
  BottomTabBar,
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';

import {
  fonts,
  fontWeights,
  radius,
  useAppTheme,
  type AppColors,
  type AppTheme,
} from '../lib/theme';
import {MapScreen} from '../screens/MapScreen';
import {SavedScreen} from '../screens/SavedScreen';
import {FriendsScreen} from '../screens/FriendsScreen';
import {ProfileScreen} from '../screens/ProfileScreen';
import {useIncomingRequestCount} from '../hooks/useFriends';
import {Icon, type IconName} from '../components/Icon';
import {
  TabBarVisibilityProvider,
  useTabBarVisibility,
} from './tabBarVisibility';
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
  const {colors} = useAppTheme();

  return (
    <Icon
      name={ICONS[routeName]}
      size={23}
      color={focused ? colors.primary : colors.textMuted}
      strokeWidth={focused ? 2 : 1.6}
    />
  );
}

function FloatingTabBar(props: BottomTabBarProps): React.JSX.Element {
  const {visible} = useTabBarVisibility();
  const {colors, elevation} = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, elevation),
    [colors, elevation],
  );
  const hiddenProgress = useRef(new Animated.Value(visible ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(hiddenProgress, {
      toValue: visible ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [hiddenProgress, visible]);

  const animatedStyle = {
    opacity: hiddenProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 0],
    }),
    transform: [
      {
        translateY: hiddenProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 96],
        }),
      },
    ],
  };

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.tabBar, animatedStyle]}>
      <BottomTabBar {...props} />
    </Animated.View>
  );
}

/** Floating tab bar so the map renders full-bleed behind the controls. */
export function TabNavigator(): React.JSX.Element {
  const incomingRequests = useIncomingRequestCount();
  const {colors, elevation} = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, elevation),
    [colors, elevation],
  );
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const tabBarVisibility = useMemo(
    () => ({visible: tabBarVisible, setVisible: setTabBarVisible}),
    [tabBarVisible],
  );

  return (
    <TabBarVisibilityProvider value={tabBarVisibility}>
      <Tab.Navigator
        tabBar={props => <FloatingTabBar {...props} />}
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: styles.tabBarInner,
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
    </TabBarVisibilityProvider>
  );
}

function createStyles(c: AppColors, appElevation: AppTheme['elevation']) {
  return StyleSheet.create({
    tabBar: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: Platform.OS === 'ios' ? 28 : 16,
      height: 64,
      borderRadius: radius.xl,
      backgroundColor: c.glass,
      borderTopWidth: 0,
      borderWidth: 1,
      borderColor: c.glassBorder,
      ...appElevation.high,
    },
    tabBarInner: {
      height: 64,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      elevation: 0,
      shadowOpacity: 0,
      paddingTop: 8,
      paddingBottom: 8,
    },
    tabItem: {
      paddingVertical: 4,
    },
    tabLabel: {
      fontFamily: fonts.medium,
      fontWeight: fontWeights.medium,
      fontSize: 11.5,
    },
  });
}
