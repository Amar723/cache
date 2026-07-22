// Global test setup. AsyncStorage has no native module under Jest, so swap in
// the library's official in-memory mock for every suite (several modules import
// it transitively: supabase, authCache, lastLocation, useOverlaps, …).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
