import React, {useMemo} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {spacing, useAppTheme, type AppColors} from '../lib/theme';
import {useAuth} from '../hooks/useAuth';
import {AppText} from '../components/Themed';
import {Icon} from '../components/Icon';
import {SettingRow} from '../components/SettingRow';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Account'>;

/**
 * Account details: the login email, password change, and — deliberately quiet
 * and at the very bottom — the way into the guarded delete-account flow.
 */
export function AccountScreen({navigation}: Props): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {session} = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">Account</AppText>
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
        <SettingRow label="Email" value={session?.user.email ?? '—'} />
        <SettingRow
          label="Change password"
          onPress={() => navigation.navigate('ChangePassword')}
        />

        <Pressable
          onPress={() => navigation.navigate('DeleteAccount')}
          style={styles.deleteLink}
          accessibilityRole="button">
          <AppText variant="medium" style={styles.deleteLinkText}>
            Delete account
          </AppText>
        </Pressable>
      </ScrollView>
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
    deleteLink: {
      marginTop: 'auto',
      paddingTop: spacing.xxl,
      alignItems: 'center',
    },
    deleteLinkText: {
      color: c.textMuted,
    },
  });
}
