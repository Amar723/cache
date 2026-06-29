import {handleRecoveryLink} from '../useAuth';
import {supabase} from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {auth: {setSession: jest.fn()}},
}));
jest.mock('../../lib/storage', () => ({uploadAvatar: jest.fn()}));

const mockSetSession = supabase.auth.setSession as jest.Mock;

describe('handleRecoveryLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetSession.mockResolvedValue({error: null});
  });

  it('ignores links that are not recovery links', async () => {
    expect(await handleRecoveryLink('cache://share?url=x')).toBe(false);
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('ignores a recovery link missing its tokens', async () => {
    expect(await handleRecoveryLink('cache://auth/recovery')).toBe(false);
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('establishes the recovery session from the URL fragment', async () => {
    const url =
      'cache://auth/recovery#access_token=AAA&refresh_token=BBB&type=recovery';

    expect(await handleRecoveryLink(url)).toBe(true);
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'AAA',
      refresh_token: 'BBB',
    });
  });

  it('reports failure when setSession errors', async () => {
    mockSetSession.mockResolvedValue({error: {message: 'bad token'}});
    const url =
      'cache://auth/recovery#access_token=AAA&refresh_token=BBB&type=recovery';

    expect(await handleRecoveryLink(url)).toBe(false);
  });
});
