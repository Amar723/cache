import React, {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {spacing, useAppTheme, type AppColors} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import {AppText} from '../components/Themed';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {Icon} from '../components/Icon';
import {SettingRow} from '../components/SettingRow';
import {version} from '../../package.json';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/** Settings hub: account management and sign out, with the app version below. */
export function SettingsScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {signOut} = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    // signOut flips auth status to signedOut and RootNavigator swaps the whole
    // tree, so there is no navigation to do here.
    await signOut();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">Settings</AppText>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({pressed}) => [styles.close, pressed && styles.closePressed]}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Icon name="close" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <SettingRow
          icon="user"
          label="Account"
          onPress={() => navigation.navigate('Account')}
        />
        <SettingRow
          label="Sign out"
          chevron={false}
          onPress={() => setConfirmSignOut(true)}
        />

        <AppText variant="caption" style={styles.version}>
          Cache v{version}
        </AppText>
      </ScrollView>

      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out?"
        message="You can sign back in anytime."
        confirmLabel="Sign out"
        destructive={false}
        loading={signingOut}
        onConfirm={handleSignOut}
        onCancel={() => setConfirmSignOut(false)}
      />
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: {flex: 1, backgroundColor: c.background},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    close: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closePressed: {
      opacity: 0.6,
    },
    content: {
      flexGrow: 1,
      padding: spacing.xl,
      paddingTop: spacing.lg,
    },
    version: {
      textAlign: 'center',
      marginTop: 'auto',
      paddingTop: spacing.xxl,
    },
  });
}
