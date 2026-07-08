import {createStash} from '../useStashes';
import {supabase} from '../../lib/supabase';
import {currentUserId} from '../useAuth';
import type {StashDraft} from '../../types';

jest.mock('../../lib/supabase', () => ({supabase: {from: jest.fn()}}));
jest.mock('../useAuth', () => ({currentUserId: jest.fn(() => 'me')}));

const mockFrom = supabase.from as jest.Mock;

function draft(overrides: Partial<StashDraft> = {}): StashDraft {
  return {
    place_name: 'Joe’s Pizza',
    address: '1 Main St',
    lat: 1,
    lng: 2,
    category: 'Food',
    notes: '',
    tiktok_url: 'https://vm.tiktok.com/x/',
    thumbnail_url: null,
    opening_hours: null,
    place_id: 'p1',
    visibility: 'friends',
    ...overrides,
  };
}

describe('createStash visibility threading', () => {
  it('sends the chosen visibility in the insert payload', async () => {
    const insert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({data: {id: 's1'}, error: null}),
      })),
    }));
    mockFrom.mockReturnValue({insert});
    (currentUserId as jest.Mock).mockReturnValue('me');

    await createStash(draft({visibility: 'friends'}));

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({user_id: 'me', visibility: 'friends'}),
    );
  });

  it('defaults through whatever the draft carries (private)', async () => {
    const insert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({data: {id: 's2'}, error: null}),
      })),
    }));
    mockFrom.mockReturnValue({insert});

    await createStash(draft({visibility: 'private'}));

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({visibility: 'private'}),
    );
  });
});

describe('createStash video link', () => {
  function mockInsert() {
    const insert = jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({data: {id: 's3'}, error: null}),
      })),
    }));
    mockFrom.mockReturnValue({insert});
    return insert;
  }

  it('stores an empty link as null (video-less stash)', async () => {
    const insert = mockInsert();

    await createStash(draft({tiktok_url: ''}));

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({tiktok_url: null}),
    );
  });

  it('keeps a real link as-is', async () => {
    const insert = mockInsert();

    await createStash(draft({tiktok_url: 'https://vm.tiktok.com/x/'}));

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({tiktok_url: 'https://vm.tiktok.com/x/'}),
    );
  });
});
