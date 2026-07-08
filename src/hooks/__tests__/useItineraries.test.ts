import {inviteToTrip, partitionTrips} from '../useItineraries';
import {supabase} from '../../lib/supabase';
import {currentUserId} from '../useAuth';
import type {Profile} from '../../types';

jest.mock('../../lib/supabase', () => ({supabase: {from: jest.fn()}}));
jest.mock('../useAuth', () => ({currentUserId: jest.fn(() => 'me')}));

const mockFrom = supabase.from as jest.Mock;

function prof(id: string): Profile {
  return {
    id,
    username: `user_${id}`,
    display_name: `User ${id}`,
    avatar_url: null,
    created_at: '2026-01-01',
  };
}

function tripRow(overrides: {
  id?: string;
  owner_id?: string;
  owner?: Profile | null;
  members?: {
    id: string;
    user_id: string;
    status: 'pending' | 'accepted';
    profile: Profile | null;
  }[];
}) {
  return {
    id: 't1',
    owner_id: 'me',
    name: 'Sydney trip',
    created_at: '2026-07-01',
    updated_at: '2026-07-01',
    owner: prof('me'),
    members: [],
    ...overrides,
  };
}

describe('partitionTrips', () => {
  const ME = 'me';

  it('marks my own itinerary as an owned trip with its members', () => {
    const {trips, invites} = partitionTrips(
      [
        tripRow({
          members: [
            {id: 'm1', user_id: 'u2', status: 'accepted', profile: prof('u2')},
            {id: 'm2', user_id: 'u3', status: 'pending', profile: prof('u3')},
          ],
        }),
      ],
      ME,
    );
    expect(invites).toHaveLength(0);
    expect(trips).toHaveLength(1);
    expect(trips[0].isOwner).toBe(true);
    expect(trips[0].members).toEqual([
      {memberId: 'm1', profile: prof('u2'), status: 'accepted'},
      {memberId: 'm2', profile: prof('u3'), status: 'pending'},
    ]);
  });

  it('lists a trip I accepted as a (non-owned) trip', () => {
    const {trips, invites} = partitionTrips(
      [
        tripRow({
          owner_id: 'u2',
          owner: prof('u2'),
          members: [
            {id: 'm1', user_id: ME, status: 'accepted', profile: prof(ME)},
          ],
        }),
      ],
      ME,
    );
    expect(invites).toHaveLength(0);
    expect(trips).toHaveLength(1);
    expect(trips[0].isOwner).toBe(false);
    expect(trips[0].owner).toEqual(prof('u2'));
  });

  it('turns my pending membership into an invite, not a trip', () => {
    const {trips, invites} = partitionTrips(
      [
        tripRow({
          owner_id: 'u2',
          owner: prof('u2'),
          members: [
            {id: 'm1', user_id: ME, status: 'pending', profile: prof(ME)},
          ],
        }),
      ],
      ME,
    );
    expect(trips).toHaveLength(0);
    expect(invites).toHaveLength(1);
    expect(invites[0].memberId).toBe('m1');
    expect(invites[0].owner).toEqual(prof('u2'));
    expect(invites[0].itinerary.name).toBe('Sydney trip');
  });

  it('skips rows with a missing owner, and members with a missing profile', () => {
    const {trips, invites} = partitionTrips(
      [
        tripRow({id: 'broken', owner: null}),
        tripRow({
          id: 'ok',
          members: [
            {id: 'm1', user_id: 'u9', status: 'accepted', profile: null},
          ],
        }),
      ],
      ME,
    );
    expect(invites).toHaveLength(0);
    expect(trips).toHaveLength(1);
    expect(trips[0].itinerary.id).toBe('ok');
    expect(trips[0].members).toHaveLength(0);
  });
});

describe('inviteToTrip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (currentUserId as jest.Mock).mockReturnValue('me');
  });

  function mockTables(insertResult: {error: unknown}) {
    const insert = jest.fn().mockResolvedValue(insertResult);
    mockFrom.mockImplementation((table: string) =>
      table === 'itinerary_members'
        ? {insert}
        : {
            select: jest.fn(() => ({
              order: jest.fn().mockResolvedValue({data: [], error: null}),
            })),
          },
    );
    return insert;
  }

  it('inserts a pending membership for the invitee', async () => {
    const insert = mockTables({error: null});

    await inviteToTrip('t1', 'u2');

    expect(insert).toHaveBeenCalledWith({
      itinerary_id: 't1',
      user_id: 'u2',
      status: 'pending',
    });
  });

  it('turns a duplicate (23505) into a friendly error', async () => {
    mockTables({error: {code: '23505'}});

    await expect(inviteToTrip('t1', 'u2')).rejects.toThrow(
      'already invited or a member',
    );
  });
});
