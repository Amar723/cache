import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotification from 'react-native-push-notification';

import {
  clearSuppression,
  hasFiredTier1,
  hasFiredTier2Today,
  notifyArrived,
  notifyNearby,
} from '../notifications';
import type {Stash} from '../../types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-push-notification', () => ({
  __esModule: true,
  default: {
    localNotification: jest.fn(),
    configure: jest.fn(),
    createChannel: jest.fn(),
    requestPermissions: jest.fn(),
  },
  Importance: {HIGH: 4},
}));
jest.mock('../../navigation/navigationRef', () => ({
  requestOpenStash: jest.fn(),
}));

function stash(id: string): Stash {
  return {id, place_name: `Place ${id}`} as unknown as Stash;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('tier 1 (arrived) suppression', () => {
  it('is unfired until notifyArrived runs, then stays fired', async () => {
    expect(await hasFiredTier1('s1')).toBe(false);

    await notifyArrived(stash('s1'));

    expect(PushNotification.localNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userInfo: expect.objectContaining({stashId: 's1', tier: 'arrived'}),
      }),
    );
    expect(await hasFiredTier1('s1')).toBe(true);
  });

  it('is tracked per stash', async () => {
    await notifyArrived(stash('s1'));
    expect(await hasFiredTier1('s1')).toBe(true);
    expect(await hasFiredTier1('s2')).toBe(false);
  });
});

describe('tier 2 (nearby) suppression', () => {
  it('is unfired until notifyNearby runs, then fired for today', async () => {
    expect(await hasFiredTier2Today('s1')).toBe(false);

    await notifyNearby(stash('s1'));

    expect(PushNotification.localNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userInfo: expect.objectContaining({stashId: 's1', tier: 'nearby'}),
      }),
    );
    expect(await hasFiredTier2Today('s1')).toBe(true);
  });
});

describe('clearSuppression', () => {
  it('resets both tiers for a stash', async () => {
    await notifyArrived(stash('s1'));
    await notifyNearby(stash('s1'));
    expect(await hasFiredTier1('s1')).toBe(true);
    expect(await hasFiredTier2Today('s1')).toBe(true);

    await clearSuppression('s1');

    expect(await hasFiredTier1('s1')).toBe(false);
    expect(await hasFiredTier2Today('s1')).toBe(false);
  });

  it('leaves other stashes untouched', async () => {
    await notifyArrived(stash('s1'));
    await notifyArrived(stash('s2'));

    await clearSuppression('s1');

    expect(await hasFiredTier1('s1')).toBe(false);
    expect(await hasFiredTier1('s2')).toBe(true);
  });
});
