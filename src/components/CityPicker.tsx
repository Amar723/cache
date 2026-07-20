import React, {useMemo} from 'react';
import {StyleSheet} from 'react-native';
import {
  GooglePlacesAutocomplete,
  type GooglePlaceData,
  type GooglePlaceDetail,
} from 'react-native-google-places-autocomplete';

import {ENV} from '../lib/config';
import {
  fonts,
  radius,
  spacing,
  useAppTheme,
  type AppColors,
} from '../lib/theme';
import {AppText} from './Themed';

export interface City {
  name: string;
  lat: number;
  lng: number;
}

interface CityPickerProps {
  value: City | null;
  onSelect: (city: City) => void;
}

/**
 * Home-city search box (onboarding + edit profile). Predictions are restricted
 * to cities and proxied through the Supabase Edge Function, which injects the
 * Google key server-side. The current selection renders as a caption below.
 */
export function CityPicker({
  value,
  onSelect,
}: CityPickerProps): React.JSX.Element {
  const {colors} = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleCitySelected = (
    data: GooglePlaceData,
    details: GooglePlaceDetail | null,
  ) => {
    const location = details?.geometry?.location;
    if (!location) {
      return;
    }
    onSelect({
      name: details?.formatted_address ?? data.description,
      lat: location.lat,
      lng: location.lng,
    });
  };

  return (
    <>
      <GooglePlacesAutocomplete
        placeholder="Search for your city"
        fetchDetails
        onPress={handleCitySelected}
        // Wait for a real query and pace requests, matching AddStashForm.
        minLength={3}
        debounce={300}
        onFail={err => console.warn('[places] city autocomplete failed', err)}
        onTimeout={() => console.warn('[places] city autocomplete timed out')}
        // `types=(cities)` restricts predictions to cities. No Google key
        // here: requests go to our Supabase Edge Function, which injects it.
        query={{key: '', language: 'en', types: '(cities)'}}
        requestUrl={{
          useOnPlatform: 'all',
          url: `${ENV.SUPABASE_URL}/functions/v1/places`,
          headers: {
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
            apikey: ENV.SUPABASE_ANON_KEY,
          },
        }}
        GooglePlacesDetailsQuery={{fields: 'geometry,formatted_address'}}
        enablePoweredByContainer={false}
        disableScroll
        keyboardShouldPersistTaps="handled"
        textInputProps={{placeholderTextColor: colors.textMuted}}
        styles={{
          textInput: styles.input,
          listView: styles.placesList,
          row: styles.placesRow,
          description: styles.placesDescription,
          separator: styles.placesSeparator,
          container: styles.placesContainer,
        }}
      />
      {value ? (
        <AppText variant="caption" style={styles.selectedCity}>
          {value.name}
        </AppText>
      ) : null}
    </>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    input: {
      minHeight: 50,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      paddingHorizontal: spacing.md,
      fontFamily: fonts.regular,
      fontSize: 15,
      color: c.text,
    },
    // Google Places overrides (mirrors AddStashForm).
    placesContainer: {
      flex: 0,
    },
    placesList: {
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
      marginTop: spacing.xs,
    },
    placesRow: {
      backgroundColor: c.surface,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    placesDescription: {
      color: c.text,
      fontFamily: fonts.regular,
    },
    placesSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    selectedCity: {
      marginTop: spacing.sm,
      color: c.success,
    },
  });
}
