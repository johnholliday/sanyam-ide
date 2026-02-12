/**
 * Unit tests for OAuthHandler
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OAuthConfig, OAuthProvider } from '../../src/oauth-handler.js';

// Mock Supabase client
const mockSignInWithPassword = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockRefreshSession = vi.fn();
const mockExchangeCodeForSession = vi.fn();

const mockSupabaseClient = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signInWithOtp: mockSignInWithOtp,
    signInWithOAuth: mockSignInWithOAuth,
    signUp: mockSignUp,
    signOut: mockSignOut,
    refreshSession: mockRefreshSession,
    exchangeCodeForSession: mockExchangeCodeForSession,
  },
};

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Import after mocking
import { OAuthHandlerImpl, type OAuthHandler } from '../../src/oauth-handler.js';

const testConfig: OAuthConfig = {
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-anon-key',
  providers: ['github', 'google', 'email'],
  isDesktop: false,
};

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.png',
  },
  app_metadata: {
    tier: 'pro',
  },
};

const mockSession = {
  access_token: 'access-token-123',
  refresh_token: 'refresh-token-123',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
};

describe('OAuthHandler', () => {
  let handler: OAuthHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OAuthHandlerImpl(testConfig as any);
  });

  describe('availableProviders', () => {
    it('should return configured providers', () => {
      expect(handler.availableProviders).toEqual(['github', 'google', 'email']);
    });
  });

  describe('isDesktop', () => {
    it('should return false for browser config', () => {
      expect(handler.isDesktop).toBe(false);
    });

    it('should return true for desktop config', () => {
      const desktopHandler = new OAuthHandlerImpl({
        ...testConfig,
        isDesktop: true,
      } as any);

      expect(desktopHandler.isDesktop).toBe(true);
    });
  });

  describe('signInWithPassword', () => {
    it('should return success with session on valid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await handler.signInWithPassword('test@example.com', 'password');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.accessToken).toBe('access-token-123');
      expect(result.session?.user.email).toBe('test@example.com');
    });

    it('should return error for invalid credentials', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid credentials' },
      });

      const result = await handler.signInWithPassword('test@example.com', 'wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should return error when no session returned', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: null,
      });

      const result = await handler.signInWithPassword('test@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No session returned');
    });

    it('should handle thrown errors', async () => {
      mockSignInWithPassword.mockRejectedValue(new Error('Network error'));

      const result = await handler.signInWithPassword('test@example.com', 'password');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('signInWithMagicLink', () => {
    it('should return success when magic link sent', async () => {
      mockSignInWithOtp.mockResolvedValue({
        data: {},
        error: null,
      });

      const result = await handler.signInWithMagicLink('test@example.com');

      expect(result.success).toBe(true);
      expect(result.session).toBeUndefined(); // No session until user clicks link
    });

    it('should return error when OTP fails', async () => {
      mockSignInWithOtp.mockResolvedValue({
        data: {},
        error: { message: 'Rate limit exceeded' },
      });

      const result = await handler.signInWithMagicLink('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });
  });

  describe('signInWithOAuth', () => {
    it('should return error for email provider', async () => {
      const result = await handler.signInWithOAuth('email');

      expect(result.success).toBe(false);
      expect(result.error).toContain('signInWithPassword');
    });

    describe('browser mode', () => {
      it('should initiate OAuth redirect for github', async () => {
        mockSignInWithOAuth.mockResolvedValue({
          data: {},
          error: null,
        });

        const result = await handler.signInWithOAuth('github');

        expect(result.success).toBe(true);
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'github',
          options: expect.objectContaining({
            redirectTo: expect.any(String),
          }),
        });
      });

      it('should return error when OAuth fails', async () => {
        mockSignInWithOAuth.mockResolvedValue({
          data: {},
          error: { message: 'Provider error' },
        });

        const result = await handler.signInWithOAuth('github');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Provider error');
      });
    });

    describe('desktop mode', () => {
      let desktopHandler: OAuthHandler;

      beforeEach(() => {
        desktopHandler = new OAuthHandlerImpl({
          ...testConfig,
          isDesktop: true,
        } as any);
      });

      it('should return OAuth URL for desktop flow', async () => {
        mockSignInWithOAuth.mockResolvedValue({
          data: { url: 'https://supabase.com/oauth/github' },
          error: null,
        });

        const result = await desktopHandler.signInWithOAuth('github');

        expect(result.success).toBe(true);
        expect(result.error).toContain('OAUTH_URL:');
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'github',
          options: expect.objectContaining({
            skipBrowserRedirect: true,
          }),
        });
      });

      it('should return error when no URL returned', async () => {
        mockSignInWithOAuth.mockResolvedValue({
          data: { url: null },
          error: null,
        });

        const result = await desktopHandler.signInWithOAuth('github');

        expect(result.success).toBe(false);
        expect(result.error).toBe('No OAuth URL returned');
      });
    });
  });

  describe('signUp', () => {
    it('should return success with session on immediate signup', async () => {
      mockSignUp.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await handler.signUp('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
    });

    it('should return success without session when email confirmation required', async () => {
      mockSignUp.mockResolvedValue({
        data: { session: null, user: mockUser },
        error: null,
      });

      const result = await handler.signUp('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.session).toBeUndefined();
    });

    it('should return error for invalid signup', async () => {
      mockSignUp.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'User already exists' },
      });

      const result = await handler.signUp('test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User already exists');
    });
  });

  describe('signOut', () => {
    it('should sign out successfully', async () => {
      mockSignOut.mockResolvedValue({});

      await expect(handler.signOut()).resolves.not.toThrow();
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('refreshSession', () => {
    it('should return new session on successful refresh', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await handler.refreshSession('refresh-token');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(mockRefreshSession).toHaveBeenCalledWith({
        refresh_token: 'refresh-token',
      });
    });

    it('should return error on failed refresh', async () => {
      mockRefreshSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid refresh token' },
      });

      const result = await handler.refreshSession('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });
  });

  describe('exchangeCodeForSession', () => {
    it('should return session on successful code exchange', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await handler.exchangeCodeForSession('auth-code-123');

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
    });

    it('should return error on failed code exchange', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid code' },
      });

      const result = await handler.exchangeCodeForSession('invalid-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid code');
    });
  });

  describe('getClient', () => {
    it('should return Supabase client', () => {
      const client = handler.getClient();

      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });
  });

  describe('session mapping', () => {
    it('should map user metadata correctly', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: mockSession, user: mockUser },
        error: null,
      });

      const result = await handler.signInWithPassword('test@example.com', 'password');

      expect(result.session?.user.display_name).toBe('Test User');
      expect(result.session?.user.avatar_url).toBe('https://example.com/avatar.png');
      expect(result.session?.user.tier).toBe('pro');
    });

    it('should handle missing user metadata', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          session: mockSession,
          user: { id: 'user-123', email: 'test@example.com' },
        },
        error: null,
      });

      const result = await handler.signInWithPassword('test@example.com', 'password');

      expect(result.session?.user.display_name).toBeNull();
      expect(result.session?.user.avatar_url).toBeNull();
      expect(result.session?.user.tier).toBe('free');
    });

    it('should convert expires_at to milliseconds', async () => {
      const expiresAtSeconds = Math.floor(Date.now() / 1000) + 3600;
      mockSignInWithPassword.mockResolvedValue({
        data: {
          session: { ...mockSession, expires_at: expiresAtSeconds },
          user: mockUser,
        },
        error: null,
      });

      const result = await handler.signInWithPassword('test@example.com', 'password');

      expect(result.session?.expiresAt).toBe(expiresAtSeconds * 1000);
    });
  });
});

describe('provider mapping', () => {
  const providerMappings: [OAuthProvider, string][] = [
    ['github', 'github'],
    ['google', 'google'],
    ['azure', 'azure'],
  ];

  it.each(providerMappings)(
    'should map %s to Supabase provider %s',
    async (ourProvider) => {
      const handler = new OAuthHandlerImpl(testConfig as any);
      mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });

      await handler.signInWithOAuth(ourProvider);

      expect(mockSignInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: ourProvider,
        })
      );
    }
  );
});
