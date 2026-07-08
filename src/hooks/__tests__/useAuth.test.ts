import {changePassword, confirmPasswordResetCode, signUp} from '../useAuth';
import {supabase} from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      setSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      updateUser: jest.fn(),
      verifyOtp: jest.fn(),
    },
  },
}));
jest.mock('../../lib/storage', () => ({uploadAvatar: jest.fn()}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockSetSession = supabase.auth.setSession as jest.Mock;
const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;
const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockVerifyOtp = supabase.auth.verifyOtp as jest.Mock;

const session = {
  access_token: 'OLD_ACCESS',
  refresh_token: 'OLD_REFRESH',
  user: {id: 'user-1', email: 'user@example.com'},
} as any;

describe('confirmPasswordResetCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyOtp.mockResolvedValue({error: null});
  });

  it('verifies the code and establishes the recovery session', async () => {
    await expect(
      confirmPasswordResetCode(' user@example.com ', ' 123456 '),
    ).resolves.toBeUndefined();
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      token: '123456',
      type: 'recovery',
    });
  });

  it('throws when the code is invalid or expired', async () => {
    mockVerifyOtp.mockResolvedValue({
      error: {message: 'Token has expired or is invalid'},
    });

    await expect(
      confirmPasswordResetCode('user@example.com', '000000'),
    ).rejects.toThrow('Token has expired or is invalid');
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
