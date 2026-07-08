import {changePassword, handleRecoveryLink, signUp} from '../useAuth';
import {supabase} from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      setSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}));
jest.mock('../../lib/storage', () => ({uploadAvatar: jest.fn()}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockSetSession = supabase.auth.setSession as jest.Mock;
const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;
const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;

const session = {
  access_token: 'OLD_ACCESS',
  refresh_token: 'OLD_REFRESH',
  user: {id: 'user-1', email: 'user@example.com'},
} as any;

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

  it('ignores token links that are not password recovery links', async () => {
    const url =
      'cache://auth/recovery#access_token=AAA&refresh_token=BBB&type=signup';

    expect(await handleRecoveryLink(url)).toBe(false);
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

describe('changePassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetSession.mockResolvedValue({error: null});
    mockUpdateUser.mockResolvedValue({error: null});
  });

  it('fails without a current session', async () => {
    mockGetSession.mockResolvedValue({data: {session: null}, error: null});

    await expect(
      changePassword('old-password', 'new-password'),
    ).rejects.toThrow('Your session expired. Please log in again.');
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('fails if the new password is too short', async () => {
    await expect(changePassword('old-password', 'short')).rejects.toThrow(
      'Choose a password of at least 6 characters.',
    );
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('fails if the current password cannot reauthenticate the account', async () => {
    mockGetSession.mockResolvedValue({data: {session}, error: null});
    mockSignInWithPassword.mockResolvedValue({
      data: {user: null},
      error: {message: 'invalid login'},
    });

    await expect(
      changePassword('wrong-password', 'new-password'),
    ).rejects.toThrow('Current password is incorrect.');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'wrong-password',
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('fails if reauthentication returns a different user', async () => {
    mockGetSession.mockResolvedValue({data: {session}, error: null});
    mockSignInWithPassword.mockResolvedValue({
      data: {user: {id: 'user-2'}},
      error: null,
    });

    await expect(
      changePassword('old-password', 'new-password'),
    ).rejects.toThrow('Could not verify this account. Please log in again.');
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'OLD_ACCESS',
      refresh_token: 'OLD_REFRESH',
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('updates the password after successful ownership verification', async () => {
    mockGetSession.mockResolvedValue({data: {session}, error: null});
    mockSignInWithPassword.mockResolvedValue({
      data: {user: {id: 'user-1'}},
      error: null,
    });

    await expect(
      changePassword('old-password', 'new-password'),
    ).resolves.toBeUndefined();
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'old-password',
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({password: 'new-password'});
  });
});
