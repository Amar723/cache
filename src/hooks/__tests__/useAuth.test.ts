import {handleRecoveryLink, signUp} from '../useAuth';
import {supabase} from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {auth: {setSession: jest.fn(), signUp: jest.fn()}},
}));
jest.mock('../../lib/storage', () => ({uploadAvatar: jest.fn()}));

const mockSetSession = supabase.auth.setSession as jest.Mock;
const mockSignUp = supabase.auth.signUp as jest.Mock;

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

describe('signUp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns confirmEmail when email confirmation is required', async () => {
    mockSignUp.mockResolvedValue({data: {session: null}, error: null});

    await expect(signUp(' user@example.com ', 'password')).resolves.toBe(
      'confirmEmail',
    );
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password',
    });
  });

  it('returns signedIn when Supabase creates a session immediately', async () => {
    mockSignUp.mockResolvedValue({
      data: {session: {user: {id: 'user-1'}}},
      error: null,
    });

    await expect(signUp('user@example.com', 'password')).resolves.toBe(
      'signedIn',
    );
  });
});
