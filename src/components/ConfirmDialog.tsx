import React, {useMemo} from 'react';
import {Modal, Pressable, StyleSheet, View} from 'react-native';

import {
  radius,
  spacing,
  useAppTheme,
  type AppColors,
  type AppTheme,
} from '../lib/theme';
import {AppText, PrimaryButton} from './Themed';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A themed stand-in for `Alert.alert` so confirmations match the app. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element {
  const {colors, elevation} = useAppTheme();
  const styles = useMemo(
    () => createStyles(colors, elevation),
    [colors, elevation],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}>
      <Pressable
        style={styles.backdrop}
        onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <AppText variant="serifTitle" style={styles.title}>
            {title}
          </AppText>
          <AppText variant="body" style={styles.message}>
            {message}
          </AppText>
          <View style={styles.actions}>
            <PrimaryButton
              title={cancelLabel}
              variant="secondary"
              onPress={onCancel}
              disabled={loading}
              style={styles.button}
            />
            <PrimaryButton
              title={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              style={styles.button}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(c: AppColors, appElevation: AppTheme['elevation']) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.border,
      padding: spacing.xl,
      ...appElevation.high,
    },
    title: {
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    message: {
      color: c.textMuted,
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
}
