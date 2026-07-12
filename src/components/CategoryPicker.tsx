import React, {useMemo, useState} from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';

import {radius, spacing, useAppTheme, type AppColors} from '../lib/theme';
import {CATEGORIES, type Category} from '../types';
import {AppText} from './Themed';
import {CATEGORY_ICON, Icon} from './Icon';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CategoryPickerProps {
  value: Category | null;
  onChange: (category: Category) => void;
}

/**
 * Inline expanding dropdown (no modal — the app uses sheets/inline surfaces
 * only). Collapsed it shows the current selection; tapping reveals the options.
 */
export function CategoryPicker({
  value,
  onChange,
}: CategoryPickerProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(o => !o);
  };

  const select = (category: Category) => {
    onChange(category);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(false);
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        onPress={toggle}
        style={({pressed}) => [styles.control, pressed && styles.pressed]}>
        <View style={styles.controlLabel}>
          {value ? (
            <Icon name={CATEGORY_ICON[value]} size={19} color={colors.text} />
          ) : null}
          <AppText
            variant={value ? 'medium' : 'body'}
            style={!value && styles.placeholder}>
            {value ?? 'Select a category'}
          </AppText>
        </View>
        <View style={[styles.chevron, open && styles.chevronOpen]}>
          <Icon name="chevron-down" size={18} color={colors.textMuted} />
        </View>
      </Pressable>

      {open && (
        <View style={styles.menu}>
          {CATEGORIES.map((category, index) => {
            const selected = category === value;
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityState={{selected}}
                onPress={() => select(category)}
                style={({pressed}) => [
                  styles.option,
                  index < CATEGORIES.length - 1 && styles.optionDivider,
                  selected && styles.optionSelected,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.optionLabel}>
                  <Icon
                    name={CATEGORY_ICON[category]}
                    size={19}
                    color={selected ? colors.text : colors.textMuted}
                  />
                  <AppText variant={selected ? 'bold' : 'body'}>
                    {category}
                  </AppText>
                </View>
                {selected && (
                  <Icon name="check" size={18} color={colors.success} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    control: {
      minHeight: 50,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    controlLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flexShrink: 1,
    },
    placeholder: {
      color: c.textMuted,
    },
    pressed: {
      opacity: 0.7,
    },
    chevron: {
      transform: [{rotate: '0deg'}],
    },
    chevronOpen: {
      transform: [{rotate: '180deg'}],
    },
    menu: {
      marginTop: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    option: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    optionDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    optionSelected: {
      backgroundColor: c.surfaceElevated,
    },
    optionLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
  });
}
