import React from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';

import {colors, elevation, radius, spacing} from '../lib/theme';
import {AppText, PrimaryButton} from './Themed';
import {dismissOverlapAlert, useOverlapAlert} from '../hooks/useOverlaps';

/**
 * Parchment-styled stand-in for the OS alert that used to fire when you and a
 * friend save the same place. Mount once at the app root — it renders off
 * `useOverlaps` store state rather than being called imperatively, so it
 * shows up reliably even when queued during cold launch (see the comment atop
 * hooks/useOverlaps.ts for why that matters).
 */
export function OverlapAlertDialog(): React.JSX.Element {
  const alert = useOverlapAlert();

  return (
    <Modal
      visible={alert !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissOverlapAlert}>
      <Pressable style={styles.backdrop} onPress={dismissOverlapAlert}>
        <Pressable style={styles.card} onPress={() => {}}>
          <AppText variant="serifTitle" style={styles.title}>
            {alert?.title}
          </AppText>
          <AppText variant="body" style={styles.message}>
            {alert?.message}
          </AppText>
          <View style={styles.actions}>
            <PrimaryButton
              title="Nice!"
              onPress={dismissOverlapAlert}
              style={styles.button}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(63, 53, 38, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    ...elevation.high,
  },
  title: {
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
  },
});
