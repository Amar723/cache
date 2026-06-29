import {Platform} from 'react-native';

import {runProximityCheck} from '../proximity';
import {supabase} from '../supabase';
import {getCurrentPosition} from '../geo';
import {isOpenNow} from '../openingHours';
import {
  hasFiredTier1,
  hasFiredTier2Today,
  notifyArrived,
  notifyNearby,
} from '../notifications';
import type {Stash} from '../../types';

jest.mock('react-native', () => ({Platform: {OS: 'android', Version: 33}}));
jest.mock('../supabase', () => ({
  supabase: {auth: {getSession: jest.fn()}, from: jest.fn()},
}));
jest.mock('../geo', () => ({getCurrentPosition: jest.fn()}));
jest.mock('../openingHours', () => ({isOpenNow: jest.fn(() => true)}));
jest.mock('../notifications', () => ({
  hasFiredTier1: jest.fn(),
  hasFiredTier2Today: jest.fn(),
  notifyArrived: jest.fn(),
  notifyNearby: jest.fn(),
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockGetPosition = getCurrentPosition as jest.Mock;

/** A stash carrying only the fields runProximityCheck reads. */
function stash(id: string, lat: number, lng: number): Stash {
  return {id, lat, lng, place_name: `Place ${id}`} as unknown as Stash;
}

/** Point the supabase query chain at a fixed result set. */
function withStashes(data: Stash[] | null, error: unknown = null): void {
  const is = jest.fn().mockResolvedValue({data, error});
  const eq = jest.fn(() => ({is}));
  const select = jest.fn(() => ({eq}));
  mockFrom.mockReturnValue({select});
}

// Distances from the device fix at {0,0}: same point = 0 m (arrived),
// 0.005° lng ≈ 556 m (nearby), 0.05° lng ≈ 5.5 km (far).
const ARRIVED = stash('arrived', 0, 0);
const NEARBY = stash('nearby', 0, 0.005);
const FAR = stash('far', 0, 0.05);

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  mockGetSession.mockResolvedValue({data: {session: {user: {id: 'u1'}}}});
  mockGetPosition.mockResolvedValue({lat: 0, lng: 0});
  (hasFiredTier1 as jest.Mock).mockResolvedValue(false);
  (hasFiredTier2Today as jest.Mock).mockResolvedValue(false);
  (notifyArrived as jest.Mock).mockResolvedValue(undefined);
  (notifyNearby as jest.Mock).mockResolvedValue(undefined);
  (isOpenNow as jest.Mock).mockReturnValue(true);
  withStashes([ARRIVED]);
});

describe('runProximityCheck — bail-outs', () => {
  it('does nothing on iOS (native geofencing owns proximity there)', async () => {
    Platform.OS = 'ios';
    await runProximityCheck();
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('bails when there is no session', async () => {
    mockGetSession.mockResolvedValue({data: {session: null}});
    await runProximityCheck();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(notifyArrived).not.toHaveBeenCalled();
  });

  it('bails on a query error without reading location', async () => {
    withStashes(null, {message: 'boom'});
    await runProximityCheck();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('bails when there are no unvisited stashes', async () => {
    withStashes([]);
    await runProximityCheck();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('fires nothing when there is no location fix', async () => {
    mockGetPosition.mockRejectedValue(new Error('no fix'));
    await runProximityCheck();
    expect(notifyArrived).not.toHaveBeenCalled();
    expect(notifyNearby).not.toHaveBeenCalled();
  });
});

describe('runProximityCheck — tiers and suppression', () => {
  it('fires the arrival notification within 100 m, but not the nearby one', async () => {
    withStashes([ARRIVED]);
    await runProximityCheck();
    expect(notifyArrived).toHaveBeenCalledTimes(1);
    expect(notifyArrived).toHaveBeenCalledWith(ARRIVED);
    expect(notifyNearby).not.toHaveBeenCalled();
  });

  it('suppresses a re-fire of tier 1 once it has fired before', async () => {
    (hasFiredTier1 as jest.Mock).mockResolvedValue(true);
    withStashes([ARRIVED]);
    await runProximityCheck();
    expect(notifyArrived).not.toHaveBeenCalled();
  });

  it('fires the nearby notification between 100 m and 1 km', async () => {
    withStashes([NEARBY]);
    await runProximityCheck();
    expect(notifyNearby).toHaveBeenCalledTimes(1);
    expect(notifyNearby).toHaveBeenCalledWith(NEARBY);
    expect(notifyArrived).not.toHaveBeenCalled();
  });

  it('suppresses tier 2 when it already fired today', async () => {
    (hasFiredTier2Today as jest.Mock).mockResolvedValue(true);
    withStashes([NEARBY]);
    await runProximityCheck();
    expect(notifyNearby).not.toHaveBeenCalled();
  });

  it('suppresses the nearby nudge when the place is closed', async () => {
    (isOpenNow as jest.Mock).mockReturnValue(false);
    withStashes([NEARBY]);
    await runProximityCheck();
    expect(notifyNearby).not.toHaveBeenCalled();
  });

  it('fires nothing beyond 1 km', async () => {
    withStashes([FAR]);
    await runProximityCheck();
    expect(notifyArrived).not.toHaveBeenCalled();
    expect(notifyNearby).not.toHaveBeenCalled();
  });

  it('classifies each stash independently in a single pass', async () => {
    withStashes([ARRIVED, NEARBY, FAR]);
    await runProximityCheck();
    expect(notifyArrived).toHaveBeenCalledTimes(1);
    expect(notifyArrived).toHaveBeenCalledWith(ARRIVED);
    expect(notifyNearby).toHaveBeenCalledTimes(1);
    expect(notifyNearby).toHaveBeenCalledWith(NEARBY);
  });
});
