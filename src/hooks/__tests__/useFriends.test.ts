import {partitionFriendships, sendRequest} from '../useFriends';
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
    default_city: null,
    default_city_lat: null,
    default_city_lng: null,
    created_at: '2026-01-01',
  };
}

describe('partitionFriendships', () => {
  const ME = 'me';

  it('lists accepted relationships as friends, with the other person', () => {
    const {friends, incoming, outgoing} = partitionFriendships(
      [
        {
          id: 'f1',
          status: 'accepted',
          requester_id: ME,
          addressee_id: 'u2',
          requester: prof(ME),
          addressee: prof('u2'),
        },
      ],
      ME,
    );
    expect(friends).toHaveLength(1);
    expect(friends[0]).toEqual({friendshipId: 'f1', profile: prof('u2')});
    expect(incoming).toHaveLength(0);
    expect(outgoing).toHaveLength(0);
  });

  it('splits pending requests into incoming vs outgoing by who is addressed', () => {
    const {incoming, outgoing} = partitionFriendships(
      [
        {
          id: 'in',
          status: 'pending',
          requester_id: 'u2',
          addressee_id: ME, // someone asked me
          requester: prof('u2'),
          addressee: prof(ME),
        },
        {
          id: 'out',
          status: 'pending',
          requester_id: ME, // I asked someone
          addressee_id: 'u3',
          requester: prof(ME),
          addressee: prof('u3'),
        },
      ],
      ME,
    );
    expect(incoming).toEqual([{friendshipId: 'in', profile: prof('u2')}]);
    expect(outgoing).toEqual([{friendshipId: 'out', profile: prof('u3')}]);
  });

  it('drops declined rows and skips rows with a missing profile', () => {
    const {friends, incoming, outgoing} = partitionFriendships(
      [
        {
          id: 'd',
          status: 'declined',
          requester_id: ME,
          addressee_id: 'u2',
          requester: prof(ME),
          addressee: prof('u2'),
        },
        {
          id: 'broken',
          status: 'accepted',
          requester_id: ME,
          addressee_id: 'u9',
          requester: prof(ME),
          addressee: null,
        },
      ],
      ME,
    );
    expect(friends).toHaveLength(0);
    expect(incoming).toHaveLength(0);
    expect(outgoing).toHaveLength(0);
  });
});

describe('sendRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (currentUserId as jest.Mock).mockReturnValue('me');
    // from('friendships') supports .insert(...) and .select(...).or(...).
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({error: null}),
      select: jest.fn(() => ({
        or: jest.fn().mockResolvedValue({data: [], error: null}),
      })),
    });
  });

  it('inserts a pending request from the current user', async () => {
    const insert = jest.fn().mockResolvedValue({error: null});
    mockFrom.mockReturnValue({
      insert,
      select: jest.fn(() => ({
        or: jest.fn().mockResolvedValue({data: [], error: null}),
      })),
    });

    await sendRequest('u2');

    expect(insert).toHaveBeenCalledWith({
      requester_id: 'me',
      addressee_id: 'u2',
      status: 'pending',
    });
  });

  it('turns a duplicate (23505) into a friendly error', async () => {
    mockFrom.mockReturnValue({
      insert: jest.fn().mockResolvedValue({error: {code: '23505'}}),
    });

    await expect(sendRequest('u2')).rejects.toThrow(
      'already have a connection',
    );
  });
});
