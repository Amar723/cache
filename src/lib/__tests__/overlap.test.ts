import {computeOverlaps, friendLabel, samePlace} from '../overlap';
import type {Profile} from '../../types';

const profile = (id: string, username: string): Profile =>
  ({
    id,
    username,
    display_name: username,
    avatar_url: null,
    created_at: null,
  } as unknown as Profile);

describe('samePlace', () => {
  it('matches on identical Google place_id', () => {
    expect(
      samePlace(
        {place_id: 'p1', lat: 0, lng: 0},
        {place_id: 'p1', lat: 10, lng: 10},
      ),
    ).toBe(true);
  });

  it('rejects different place_ids even when physically close', () => {
    expect(
      samePlace(
        {place_id: 'p1', lat: 40.0, lng: -74.0},
        {place_id: 'p2', lat: 40.0, lng: -74.0},
      ),
    ).toBe(false);
  });

  it('falls back to proximity when a place_id is missing', () => {
    // ~14 m apart → same place.
    expect(
      samePlace(
        {place_id: null, lat: 40.0, lng: -74.0},
        {place_id: 'p2', lat: 40.0001, lng: -74.0001},
      ),
    ).toBe(true);
  });

  it('rejects far-apart places without place_ids', () => {
    expect(
      samePlace(
        {place_id: null, lat: 40.0, lng: -74.0},
        {place_id: null, lat: 41.0, lng: -75.0},
      ),
    ).toBe(false);
  });
});

describe('computeOverlaps', () => {
  const profiles = new Map([
    ['b', profile('b', 'bea')],
    ['c', profile('c', 'cy')],
  ]);

  it('maps my stash to the friends who also saved that place', () => {
    const mine = [{id: 's1', place_id: 'p1', lat: 0, lng: 0}];
    const friendStashes = [
      {user_id: 'b', place_id: 'p1', lat: 0, lng: 0},
      {user_id: 'c', place_id: 'p1', lat: 0, lng: 0},
    ];
    expect(computeOverlaps(mine, friendStashes, profiles)).toEqual({
      s1: [profiles.get('b'), profiles.get('c')],
    });
  });

  it('counts each friend once even if they saved it twice', () => {
    const mine = [{id: 's1', place_id: 'p1', lat: 0, lng: 0}];
    const friendStashes = [
      {user_id: 'b', place_id: 'p1', lat: 0, lng: 0},
      {user_id: 'b', place_id: 'p1', lat: 0, lng: 0},
    ];
    expect(computeOverlaps(mine, friendStashes, profiles).s1).toHaveLength(1);
  });

  it('omits stashes with no overlap', () => {
    const mine = [{id: 's1', place_id: 'p1', lat: 0, lng: 0}];
    const friendStashes = [{user_id: 'b', place_id: 'pX', lat: 5, lng: 5}];
    expect(computeOverlaps(mine, friendStashes, profiles)).toEqual({});
  });
});

describe('friendLabel', () => {
  it('reads one, two, then summarizes', () => {
    const a = profile('a', 'al');
    const b = profile('b', 'bea');
    const c = profile('c', 'cy');
    expect(friendLabel([a])).toBe('al');
    expect(friendLabel([a, b])).toBe('al and bea');
    expect(friendLabel([a, b, c])).toBe('al and 2 others');
  });
});
