import React, {useEffect, useMemo, useRef} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';
import {
  DefaultTheme,
  NavigationContainer,
  type Theme,
} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {useAppTheme} from '../lib/theme';
import {handleInitialShare, subscribeToShares} from '../lib/share';
import {useAuth} from '../hooks/useAuth';
import {AuthScreen} from '../screens/AuthScreen';
import {OnboardingScreen} from '../screens/OnboardingScreen';
import {AddStashScreen} from '../screens/AddStashScreen';
import {ChangePasswordScreen} from '../screens/ChangePasswordScreen';
import {FriendMapScreen} from '../screens/FriendMapScreen';
import {UpdatePasswordScreen} from '../screens/UpdatePasswordScreen';
import {TabNavigator} from './TabNavigator';
import {navigationRef} from './navigationRef';
import {AppText} from '../components/Themed';
import type {RootStackParamList} from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const {status, recovering} = useAuth();
  const {colors, isDark} = useAppTheme();
  const navTheme = useMemo<Theme>(
    () => ({
      ...DefaultTheme,
      dark: isDark,
      colors: {
        ...DefaultTheme.colors,
        background: colors.background,
        card: colors.background,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
      },
    }),
    [colors, isDark],
  );
  // A share that arrives before the user is signed-in/onboarded is held here
  // and replayed the moment they reach the "ready" state.
  const pendingShare = useRef<string | null>(null);
  // Keep the latest status readable from the (once-registered) share callbacks
  // without re-subscribing or re-delivering the initial share.
  const statusRef = useRef(status);
  statusRef.current = status;

  const openAddStash = (url: string) => {
    if (statusRef.current === 'ready' && navigationRef.isReady()) {
      navigationRef.navigate('AddStash', {sharedUrl: url});
      pendingShare.current = null;
    } else {
      pendingShare.current = url;
    }
  };

  // Wire share intents exactly once. `openAddStash` reads `statusRef`, so the
  // first registered instance stays correct for the app's lifetime.
  useEffect(() => {
    handleInitialShare(openAddStash);
    const unsubscribe = subscribeToShares(openAddStash);
    return unsubscribe;
  }, []);

  // Replay a held share when the user becomes ready.
  useEffect(() => {
    if (status === 'ready' && pendingShare.current && navigationRef.isReady()) {
      const url = pendingShare.current;
      pendingShare.current = null;
      navigationRef.navigate('AddStash', {sharedUrl: url});
    }
  }, [status]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {recovering ? (
        // A recovery link is being completed — collect a new password no matter
        // what the underlying auth status is.
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen
            name="UpdatePassword"
            component={UpdatePasswordScreen}
          />
        </Stack.Navigator>
      ) : status === 'loading' ? (
        <Splash />
      ) : status === 'signedOut' ? (
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      ) : status === 'needsOnboarding' ? (
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{headerShown: false}}>
          <Stack.Screen name="Tabs" component={TabNavigator} />
          <Stack.Screen
            name="AddStash"
            component={AddStashScreen}
            options={{animation: 'slide_from_bottom'}}
          />
          <Stack.Screen
            name="FriendMap"
            component={FriendMapScreen}
            options={{animation: 'slide_from_right'}}
          />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
            options={{animation: 'slide_from_right'}}
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

function Splash(): React.JSX.Element {
  const {colors} = useAppTheme();

  return (
    <View style={[styles.splash, {backgroundColor: colors.background}]}>
      <AppText variant="serifLarge" style={styles.splashTitle}>
        Cache
      </AppText>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  splashTitle: {
    marginBottom: 8,
  },
});
