import {
  changePassword,
  confirmPasswordResetCode,
  deleteAccount,
  signUp,
  updateProfile,
} from '../useAuth';
import {supabase} from '../../lib/supabase';
import {uploadAvatar} from '../../lib/storage';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      setSession: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      signUp: jest.fn(),
      updateUser: jest.fn(),
      verifyOtp: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));
jest.mock('../../lib/storage', () => ({uploadAvatar: jest.fn()}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockSetSession = supabase.auth.setSession as jest.Mock;
const mockSignInWithPassword = supabase.auth.signInWithPassword as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;
const mockSignUp = supabase.auth.signUp as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;
const mockVerifyOtp = supabase.auth.verifyOtp as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockUploadAvatar = uploadAvatar as jest.Mock;

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

describe('updateProfile', () => {
  const profileRow = {
    id: 'user-1',
    username: 'newname',
    display_name: 'New Name',
    avatar_url: null,
  };

  let single: jest.Mock;
  let update: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({data: {session}, error: null});
    single = jest.fn().mockResolvedValue({data: profileRow, error: null});
    update = jest.fn(() => ({
      eq: jest.fn(() => ({select: jest.fn(() => ({single}))})),
    }));
    mockFrom.mockReturnValue({update});
  });

  it('fails without a session', async () => {
    mockGetSession.mockResolvedValue({data: {session: null}, error: null});

    await expect(
      updateProfile({displayName: 'New Name', username: 'newname'}),
    ).rejects.toThrow('Your session expired. Please log in again.');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('updates the row with a normalised username and no avatar churn', async () => {
    await expect(
      updateProfile({displayName: ' New Name ', username: ' NewName '}),
    ).resolves.toBeUndefined();

    expect(mockUploadAvatar).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'newname',
        display_name: 'New Name',
      }),
    );
    // Untouched avatar must stay untouched: the key must be absent entirely.
    expect(update.mock.calls[0][0]).not.toHaveProperty('avatar_url');
  });

  it('uploads a newly picked avatar and saves its URL', async () => {
    mockUploadAvatar.mockResolvedValue('https://cdn/avatars/user-1.jpg?v=1');

    await updateProfile({
      displayName: 'New Name',
      username: 'newname',
      avatar: {base64: 'abc', mimeType: 'image/jpeg', fileName: 'a.jpg'},
    });

    expect(mockUploadAvatar).toHaveBeenCalledWith('user-1', {
      base64: 'abc',
      mimeType: 'image/jpeg',
      fileName: 'a.jpg',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar_url: 'https://cdn/avatars/user-1.jpg?v=1',
      }),
    );
  });

  it('translates a unique violation into the taken-username message', async () => {
    single.mockResolvedValue({data: null, error: {code: '23505'}});

    await expect(
      updateProfile({displayName: 'New Name', username: 'taken'}),
    ).rejects.toThrow('That username is already taken. Try another.');
  });
});

describe('deleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({data: {session}, error: null});
    mockSetSession.mockResolvedValue({error: null});
    mockRpc.mockResolvedValue({error: null});
    mockSignOut.mockResolvedValue({error: null});
  });

  it('fails without a password and never touches the network', async () => {
    await expect(deleteAccount('')).rejects.toThrow('Enter your password.');
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('fails on a wrong password and never calls the RPC', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {user: null},
      error: {message: 'invalid login'},
    });

    await expect(deleteAccount('wrong-password')).rejects.toThrow(
      'Password is incorrect.',
    );
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('restores the session and aborts when reauth returns a different user', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {user: {id: 'user-2'}},
      error: null,
    });

    await expect(deleteAccount('password')).rejects.toThrow(
      'Could not verify this account. Please log in again.',
    );
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'OLD_ACCESS',
      refresh_token: 'OLD_REFRESH',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('deletes the account and signs out after verification', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: {user: {id: 'user-1'}},
      error: null,
    });

    await expect(deleteAccount('correct-password')).resolves.toBeUndefined();
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'correct-password',
    });
    expect(mockRpc).toHaveBeenCalledWith('delete_account');
    expect(mockSignOut).toHaveBeenCalled();
  });
});
