import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {colors, spacing} from '../lib/theme';
import {useStash} from '../hooks/useStashes';
import {AddStashForm} from '../components/AddStashForm';
import {AppText} from '../components/Themed';
import {Icon} from '../components/Icon';
import type {RootStackParamList} from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AddStash'>;

/**
 * Hosts the tagging form. Reached two ways:
 *   - from a share (params carry the shared URL) — the form leads with the
 *     video link and a thumbnail preview, or
 *   - manually via the "+" on the Saved screen (no URL) — the form leads with
 *     the place details and the video link becomes optional.
 * On a successful save we reset to the Map so the new pin is visible.
 */
export function AddStashScreen({route, navigation}: Props): React.JSX.Element {
  const sharedUrl = route.params?.sharedUrl ?? '';
  const editStash = useStash(route.params?.stashId ?? null);
  const editing = editStash != null;
  const manual = sharedUrl.length === 0;

  const handleSubmitted = () => {
    // After an edit, return to wherever the user opened the sheet from (the
    // store already updated in place). A new save lands them on the Map.
    if (editing && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{name: 'Tabs', params: {screen: 'Map'}}],
    });
  };

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{name: 'Tabs', params: {screen: 'Map'}}],
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <AppText variant="serifTitle">
          {editing ? 'Edit place' : manual ? 'Add a place' : 'Add to Cache'}
        </AppText>
        <Pressable
          onPress={handleClose}
          hitSlop={12}
          style={({pressed}) => [styles.close, pressed && styles.closePressed]}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Icon name="close" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <AddStashForm
        sharedUrl={sharedUrl}
        manual={manual}
        editStash={editStash}
        onSubmitted={handleSubmitted}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.background},
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
});
