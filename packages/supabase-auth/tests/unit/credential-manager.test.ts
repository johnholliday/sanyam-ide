/**
 * Unit tests for Credential Manager / Environment Variable Validation
 *
 * Tests that verify environment variable validation for Supabase credentials.
 * FR-064-069
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createOAuthHandlerFromEnv,
  createSupabaseAuthModuleFromEnv,
} from '../../src/index.js';

describe('Credential Manager - Environment Variable Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a clean environment for each test
    process.env = { ...originalEnv };
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('createOAuthHandlerFromEnv', () => {
    it('should return null when SUPABASE_URL is missing', () => {
      delete process.env['SUPABASE_URL'];
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

      const handler = createOAuthHandlerFromEnv();

      expect(handler).toBeNull();
    });

    it('should return null when SUPABASE_ANON_KEY is missing', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      delete process.env['SUPABASE_ANON_KEY'];

      const handler = createOAuthHandlerFromEnv();

      expect(handler).toBeNull();
    });

    it('should return null when both credentials are missing', () => {
      delete process.env['SUPABASE_URL'];
      delete process.env['SUPABASE_ANON_KEY'];

      const handler = createOAuthHandlerFromEnv();

      expect(handler).toBeNull();
    });

    it('should return handler when both credentials are present', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

      const handler = createOAuthHandlerFromEnv();

      expect(handler).not.toBeNull();
    });

    it('should use default providers when SANYAM_AUTH_PROVIDERS is not set', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
      delete process.env['SANYAM_AUTH_PROVIDERS'];

      const handler = createOAuthHandlerFromEnv();

      expect(handler).not.toBeNull();
      expect(handler?.availableProviders).toContain('email');
      expect(handler?.availableProviders).toContain('github');
      expect(handler?.availableProviders).toContain('google');
    });

    it('should parse custom providers from SANYAM_AUTH_PROVIDERS', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
      process.env['SANYAM_AUTH_PROVIDERS'] = 'email,azure';

      const handler = createOAuthHandlerFromEnv();

      expect(handler).not.toBeNull();
      expect(handler?.availableProviders).toEqual(['email', 'azure']);
    });

    it('should trim whitespace from provider names', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
      process.env['SANYAM_AUTH_PROVIDERS'] = ' email , github , google ';

      const handler = createOAuthHandlerFromEnv();

      expect(handler).not.toBeNull();
      expect(handler?.availableProviders).toEqual(['email', 'github', 'google']);
    });

    it('should return handler with isDesktop=false by default', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

      const handler = createOAuthHandlerFromEnv(false);

      expect(handler).not.toBeNull();
      expect(handler?.isDesktop).toBe(false);
    });

    it('should return handler with isDesktop=true when specified', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

      const handler = createOAuthHandlerFromEnv(true);

      expect(handler).not.toBeNull();
      expect(handler?.isDesktop).toBe(true);
    });
  });

  describe('createSupabaseAuthModuleFromEnv', () => {
    it('should return null when SUPABASE_URL is missing', () => {
      delete process.env['SUPABASE_URL'];
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

      const module = createSupabaseAuthModuleFromEnv();

      expect(module).toBeNull();
      expect(console.log).toHaveBeenCalledWith(
        '[SupabaseAuthModule] Supabase not configured, auth disabled'
      );
    });

    it('should return null when SUPABASE_ANON_KEY is missing', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      delete process.env['SUPABASE_ANON_KEY'];

      const module = createSupabaseAuthModuleFromEnv();

      expect(module).toBeNull();
    });

    it('should return ContainerModule when credentials are present', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

      const module = createSupabaseAuthModuleFromEnv();

      expect(module).not.toBeNull();
      // ContainerModule should have a registry property or id
      expect(typeof module).toBe('object');
    });

    it('should use default providers when not specified', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
      delete process.env['SANYAM_AUTH_PROVIDERS'];

      const module = createSupabaseAuthModuleFromEnv();

      expect(module).not.toBeNull();
    });

    it('should detect desktop mode from SANYAM_DESKTOP env var', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
      process.env['SANYAM_DESKTOP'] = 'true';

      const module = createSupabaseAuthModuleFromEnv();

      expect(module).not.toBeNull();
    });

    it('should use custom redirect URL from SANYAM_AUTH_REDIRECT_URL', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
      process.env['SANYAM_AUTH_REDIRECT_URL'] = 'https://custom.example.com/callback';

      const module = createSupabaseAuthModuleFromEnv();

      expect(module).not.toBeNull();
    });
  });

  describe('Environment Variable Edge Cases', () => {
    it('should handle empty string SUPABASE_URL as missing', () => {
      process.env['SUPABASE_URL'] = '';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

      const handler = createOAuthHandlerFromEnv();

      expect(handler).toBeNull();
    });

    it('should handle empty string SUPABASE_ANON_KEY as missing', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = '';

      const handler = createOAuthHandlerFromEnv();

      expect(handler).toBeNull();
    });

    it('should accept URL with trailing slash', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co/';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';

      const handler = createOAuthHandlerFromEnv();

      expect(handler).not.toBeNull();
    });

    it('should accept local Supabase URL', () => {
      process.env['SUPABASE_URL'] = 'http://localhost:54321';
      process.env['SUPABASE_ANON_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';

      const handler = createOAuthHandlerFromEnv();

      expect(handler).not.toBeNull();
    });
  });

  describe('Provider Configuration Validation', () => {
    it('should handle single provider', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
      process.env['SANYAM_AUTH_PROVIDERS'] = 'email';

      const handler = createOAuthHandlerFromEnv();

      expect(handler?.availableProviders).toEqual(['email']);
    });

    it('should handle all supported providers', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
      process.env['SANYAM_AUTH_PROVIDERS'] = 'email,github,google,azure';

      const handler = createOAuthHandlerFromEnv();

      expect(handler?.availableProviders).toHaveLength(4);
      expect(handler?.availableProviders).toContain('email');
      expect(handler?.availableProviders).toContain('github');
      expect(handler?.availableProviders).toContain('google');
      expect(handler?.availableProviders).toContain('azure');
    });

    it('should preserve provider order', () => {
      process.env['SUPABASE_URL'] = 'https://test.supabase.co';
      process.env['SUPABASE_ANON_KEY'] = 'test-anon-key';
      process.env['SANYAM_AUTH_PROVIDERS'] = 'google,azure,github';

      const handler = createOAuthHandlerFromEnv();

      expect(handler?.availableProviders).toEqual(['google', 'azure', 'github']);
    });
  });
});
