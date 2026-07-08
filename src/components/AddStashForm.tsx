import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  GooglePlacesAutocomplete,
  type GooglePlaceData,
  type GooglePlaceDetail,
} from 'react-native-google-places-autocomplete';

import {ENV} from '../lib/config';
import {colors, fonts, radius, spacing} from '../lib/theme';
import {
  fetchInstagramThumbnail,
  fetchTikTokThumbnail,
  isInstagramUrl,
  isTikTokUrl,
} from '../lib/tiktok';
import {loadLastLocation} from '../lib/lastLocation';
import type {LatLng} from '../lib/distance';
import {createStash, updateStash, useStashes} from '../hooks/useStashes';
import {
  type Category,
  type OpeningHours,
  type Stash,
  type StashDraft,
  type Visibility,
} from '../types';
import {CategoryPicker} from './CategoryPicker';
import {AppText, PrimaryButton} from './Themed';

interface AddStashFormProps {
  sharedUrl: string;
  /**
   * Manual entry (reached via the "+" on Saved) rather than a share. The video
   * link becomes optional and the place details lead the form.
   */
  manual?: boolean;
  /**
   * When set, the form edits this stash instead of creating a new one: every
   * field is pre-filled and Save writes back via `updateStash`.
   */
  editStash?: Stash | null;
  onSubmitted: () => void;
}

interface PlaceSelection {
  placeId: string | null;
  address: string;
  lat: number;
  lng: number;
  openingHours: OpeningHours | null;
}

/**
 * The tagging form that writes a stash. Three shapes:
 *   - share mode: leads with the video link and fetches an oEmbed thumbnail for
 *     a preview, then collects the place details;
 *   - manual mode (`manual`): leads with the place details and treats the video
 *     link as optional;
 *   - edit mode (`editStash`): pre-fills every field and saves via updateStash.
 */
export function AddStashForm({
  sharedUrl,
  manual = false,
  editStash = null,
  onSubmitted,
}: AddStashFormProps): React.JSX.Element {
  const editing = editStash != null;
  // Editing keeps the place details up top and the link optional, same as a
  // manual add.
  const detailsFirst = manual || editing;

  const [url, setUrl] = useState(editStash?.tiktok_url ?? sharedUrl);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    editStash?.thumbnail_url ?? null,
  );
  const [thumbLoading, setThumbLoading] = useState(
    !editing && sharedUrl.length > 0,
  );

  const {stashes} = useStashes();

  const [placeName, setPlaceName] = useState(editStash?.place_name ?? '');
  const [place, setPlace] = useState<PlaceSelection | null>(
    editStash
      ? {
          placeId: editStash.place_id,
          address: editStash.address ?? '',
          lat: editStash.lat,
          lng: editStash.lng,
          openingHours: editStash.opening_hours,
        }
      : null,
  );
  const [category, setCategory] = useState<Category | null>(
    editStash?.category ?? null,
  );
  const [notes, setNotes] = useState(editStash?.notes ?? '');
  // New saves default to "Friends" so the social features (shared map +
  // same-place overlaps) work out of the box; editing keeps the saved choice.
  const [visibility, setVisibility] = useState<Visibility>(
    editStash?.visibility ?? 'friends',
  );

  // The user's last known location, used to bias address search toward nearby
  // places. Read from cache (no permission prompt); null until/unless available.
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  useEffect(() => {
    loadLastLocation().then(setUserLoc);
  }, []);

  // Autocomplete params. With a location we add `location`+`radius` (a soft bias,
  // not a hard limit, so places in other cities are still findable) and `origin`
  // — the latter makes Google attach `distance_meters` to each prediction, which
  // the Edge Function uses to sort results closest-first.
  const placesQuery = useMemo<Record<string, string>>(() => {
    const base: Record<string, string> = {key: '', language: 'en'};
    if (userLoc) {
      const here = `${userLoc.lat},${userLoc.lng}`;
      base.location = here;
      base.radius = '50000'; // 50 km bias
      base.origin = here;
    }
    return base;
  }, [userLoc]);

  // If the chosen place is already saved, warn the user (local check against the
  // in-memory store — no API/DB call).
  const [duplicateName, setDuplicateName] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // In edit mode we already have a thumbnail and don't want a flaky oEmbed call
  // to wipe it on mount — only refetch once the user actually changes the URL.
  const skipNextFetch = useRef(editing);

  // Fetch the oEmbed thumbnail for the current URL, debounced so manual typing
  // doesn't hammer the endpoint. The share path lands here immediately with a
  // pre-filled URL; the manual path re-fetches as the user finishes pasting.
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      setThumbnailUrl(null);
      setThumbLoading(false);
      return;
    }

    // TikTok and Instagram are the only hosts we can fetch a thumbnail for.
    // Anything else goes straight to the placeholder — no wasted request.
    const fetchThumbnail = isTikTokUrl(trimmed)
      ? fetchTikTokThumbnail
      : isInstagramUrl(trimmed)
      ? fetchInstagramThumbnail
      : null;
    if (!fetchThumbnail) {
      setThumbnailUrl(null);
      setThumbLoading(false);
      return;
    }

    let active = true;
    setThumbLoading(true);
    const handle = setTimeout(() => {
      fetchThumbnail(trimmed).then(result => {
        if (active) {
          setThumbnailUrl(result.thumbnail_url);
          setThumbLoading(false);
        }
      });
    }, 500);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [url]);

  const handlePlaceSelected = (
    data: GooglePlaceData,
    details: GooglePlaceDetail | null,
  ) => {
    const location = details?.geometry?.location;
    if (!location) {
      return;
    }
    const placeId = data.place_id;

    // Local, free dedup — the whole stash list is already in memory.
    const existing = stashes.find(s => s.place_id === placeId);
    setDuplicateName(existing ? existing.place_name : null);

    // `opening_hours` isn't in the library's typings but is in the response when
    // requested via the `fields` query below.
    const withHours = details as
      | (GooglePlaceDetail & {
          opening_hours?: {periods?: OpeningHours['periods']};
        })
      | null;
    const periods = withHours?.opening_hours?.periods;
    const openingHours: OpeningHours | null =
      periods && periods.length > 0
        ? {periods, utc_offset_minutes: details?.utc_offset ?? 0}
        : null;

    setPlace({
      placeId,
      address: details?.formatted_address ?? data.description,
      lat: location.lat,
      lng: location.lng,
      openingHours,
    });
    setError(null);
  };

  const validate = (): StashDraft | null => {
    if (!detailsFirst && url.trim().length === 0) {
      setError('Please add the TikTok or Reel link.');
      return null;
    }
    if (placeName.trim().length === 0) {
      setError('Please enter a place name.');
      return null;
    }
    if (!place) {
      setError('Please choose an address from the suggestions.');
      return null;
    }
    if (!category) {
      setError('Please choose a category.');
      return null;
    }
    return {
      place_name: placeName.trim(),
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      category,
      notes: notes.trim(),
      tiktok_url: url.trim(),
      thumbnail_url: thumbnailUrl,
      opening_hours: place.openingHours,
      place_id: place.placeId,
      visibility,
    };
  };

  const handleSubmit = async () => {
    const draft = validate();
    if (!draft) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (editStash) {
        await updateStash(editStash.id, draft);
      } else {
        await createStash(draft);
      }
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // The thumbnail preview only makes sense once there's a link to preview. In
  // share mode we always show it (a URL arrived with the share); in manual mode
  // it appears only after the user pastes a link that resolves to a thumbnail.
  const showPreview = !detailsFirst || thumbLoading || thumbnailUrl !== null;

  const previewBlock = (
    <View style={styles.preview}>
      {thumbLoading ? (
        <ActivityIndicator color={colors.ink} />
      ) : thumbnailUrl ? (
        <Image
          source={{uri: thumbnailUrl}}
          style={styles.previewImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.previewFallback}>
          <AppText variant="medium">No preview available</AppText>
          <AppText
            variant="caption"
            numberOfLines={2}
            style={styles.previewUrl}>
            {url.trim().length > 0 ? url : 'Paste a TikTok or Reel link below'}
          </AppText>
        </View>
      )}
    </View>
  );

  const linkField = (
    <Field label={detailsFirst ? 'Video link (optional)' : 'Video link'}>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="Paste a TikTok or Instagram Reel link"
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        style={styles.input}
      />
    </Field>
  );

  const nameField = (
    <Field label="Place name">
      <TextInput
        value={placeName}
        onChangeText={setPlaceName}
        placeholder="e.g. Joe's Pizza"
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
        returnKeyType="next"
      />
    </Field>
  );

  const addressField = (
    <Field label="Address">
      <GooglePlacesAutocomplete
        placeholder="Search for the place"
        fetchDetails
        onPress={handlePlaceSelected}
        // Wait for a real query and pace requests: keeps Places API spend down
        // and avoids a call on every keystroke.
        minLength={3}
        debounce={300}
        // Surface proxy/network failures instead of silently showing nothing.
        onFail={err => console.warn('[places] autocomplete failed', err)}
        onTimeout={() => console.warn('[places] autocomplete timed out')}
        // No Google key here on purpose: requests go to our Supabase Edge
        // Function, which injects the key server-side. The client only carries
        // the (already-public) Supabase anon key, in the Authorization header.
        // `placesQuery` adds location bias + origin when we know where the user is.
        query={placesQuery}
        requestUrl={{
          useOnPlatform: 'all',
          url: `${ENV.SUPABASE_URL}/functions/v1/places`,
          headers: {
            Authorization: `Bearer ${ENV.SUPABASE_ANON_KEY}`,
            apikey: ENV.SUPABASE_ANON_KEY,
          },
        }}
        // Pull opening hours + the place's UTC offset so the geofence can decide
        // whether a place is open before notifying.
        GooglePlacesDetailsQuery={{
          fields: 'geometry,formatted_address,opening_hours,utc_offset',
        }}
        enablePoweredByContainer={false}
        disableScroll
        keyboardShouldPersistTaps="handled"
        textInputProps={{
          placeholderTextColor: colors.inkMuted,
        }}
        styles={{
          textInput: styles.input,
          listView: styles.placesList,
          row: styles.placesRow,
          description: styles.placesDescription,
          separator: styles.placesSeparator,
          container: styles.placesContainer,
        }}
      />
      {place ? (
        <AppText variant="caption" style={styles.selectedAddress}>
          {place.address}
        </AppText>
      ) : null}
      {duplicateName ? (
        <AppText variant="caption" style={styles.duplicate}>
          You've already saved {duplicateName}.
        </AppText>
      ) : null}
    </Field>
  );

  const categoryField = (
    <Field label="Category">
      <CategoryPicker value={category} onChange={setCategory} />
    </Field>
  );

  const notesField = (
    <Field label="Notes (optional)">
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Why you saved it, what to order, who recommended it…"
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, styles.multiline]}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </Field>
  );

  const visibilityField = (
    <Field label="Who can see this?">
      <View style={styles.segment}>
        {(['private', 'friends'] as const).map(option => {
          const active = visibility === option;
          return (
            <Pressable
              key={option}
              onPress={() => setVisibility(option)}
              style={[styles.segmentItem, active && styles.segmentItemActive]}
              accessibilityRole="button"
              accessibilityState={{selected: active}}>
              <AppText
                variant={active ? 'bold' : 'medium'}
                style={active ? styles.segmentTextActive : undefined}>
                {option === 'private' ? 'Only me' : 'Friends'}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" style={styles.segmentHint}>
        {visibility === 'private'
          ? 'Private — only you can see this pin.'
          : 'Friends can see this on your map, and you’ll both get a nudge if you save the same place.'}
      </AppText>
    </Field>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        {showPreview ? previewBlock : null}

        {detailsFirst ? (
          <>
            {nameField}
            {addressField}
            {categoryField}
            {notesField}
            {visibilityField}
            {linkField}
          </>
        ) : (
          <>
            {linkField}
            {nameField}
            {addressField}
            {categoryField}
            {notesField}
            {visibilityField}
          </>
        )}

        {error ? (
          <AppText variant="medium" style={styles.error}>
            {error}
          </AppText>
        ) : null}

        <PrimaryButton
          title={editing ? 'Save changes' : 'Save to Cache'}
          onPress={handleSubmit}
          loading={submitting}
          style={styles.submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <View style={styles.field}>
      <AppText variant="bold" style={styles.label}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl * 2,
  },
  preview: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewFallback: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  previewUrl: {
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  multiline: {
    minHeight: 96,
    paddingTop: spacing.md,
  },
  // Google Places overrides
  placesContainer: {
    flex: 0,
  },
  placesList: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
  },
  placesRow: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  placesDescription: {
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  placesSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  selectedAddress: {
    marginTop: spacing.sm,
    color: colors.success,
  },
  duplicate: {
    marginTop: spacing.xs,
    color: colors.danger,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submit: {
    marginTop: spacing.sm,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  segmentItemActive: {
    backgroundColor: colors.ink,
  },
  segmentTextActive: {
    color: colors.background,
  },
  segmentHint: {
    marginTop: spacing.sm,
  },
});
