/**
 * Unit tests for Supabase Client Factory
 *
 * Tests that verify Supabase client creation from environment configuration.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Container } from 'inversify';
import {
  createSupabaseAuthModule,
  OAuthHandler,
  SupabaseAuthProvider,
  AuthStateEmitter,
  AuthSessionStorage,
  type OAuthConfig,
} from '../../src/index.js';

describe('Supabase Client Factory', () => {
  describe('createSupabaseAuthModule', () => {
    it('should create module without OAuth config', () => {
      const module = createSupabaseAuthModule();

      expect(module).toBeDefined();

      // Verify module binds required services
      const container = new Container();
      container.load(module);

      expect(container.isBound(AuthStateEmitter)).toBe(true);
      expect(container.isBound(AuthSessionStorage)).toBe(true);
      expect(container.isBound(SupabaseAuthProvider)).toBe(true);
    });

    it('should create module with OAuth config', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email', 'github'],
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      expect(container.isBound(OAuthHandler)).toBe(true);
      expect(container.isBound('OAuthConfig')).toBe(true);
    });

    it('should not bind OAuthHandler when config is undefined', () => {
      const module = createSupabaseAuthModule();
      const container = new Container();
      container.load(module);

      expect(container.isBound(OAuthHandler)).toBe(false);
      expect(container.isBound('OAuthConfig')).toBe(false);
    });

    it('should bind services as singletons', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email'],
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      // Resolve the same service twice
      const emitter1 = container.get(AuthStateEmitter);
      const emitter2 = container.get(AuthStateEmitter);

      expect(emitter1).toBe(emitter2);
    });

    it('should bind OAuthConfig as constant value', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email', 'github', 'google'],
        isDesktop: true,
        redirectUrl: 'https://custom.example.com/callback',
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      const boundConfig = container.get<OAuthConfig>('OAuthConfig');

      expect(boundConfig.supabaseUrl).toBe(config.supabaseUrl);
      expect(boundConfig.supabaseAnonKey).toBe(config.supabaseAnonKey);
      expect(boundConfig.providers).toEqual(config.providers);
      expect(boundConfig.isDesktop).toBe(true);
      expect(boundConfig.redirectUrl).toBe(config.redirectUrl);
    });
  });

  describe('OAuthHandler creation from config', () => {
    it('should create OAuthHandler with minimal config', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email'],
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      const handler = container.get<typeof OAuthHandler>(OAuthHandler);

      expect(handler).toBeDefined();
      expect(handler.availableProviders).toEqual(['email']);
      expect(handler.isDesktop).toBe(false);
    });

    it('should create OAuthHandler with full config', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email', 'github', 'google', 'azure'],
        isDesktop: true,
        redirectUrl: 'http://localhost:54321/auth/callback',
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      const handler = container.get<typeof OAuthHandler>(OAuthHandler);

      expect(handler.availableProviders).toHaveLength(4);
      expect(handler.isDesktop).toBe(true);
    });

    it('should provide Supabase client via getClient()', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email'],
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      const handler = container.get<typeof OAuthHandler>(OAuthHandler);
      const client = handler.getClient();

      expect(client).toBeDefined();
      expect(typeof client.auth).toBe('object');
    });
  });

  describe('SupabaseAuthProvider configuration', () => {
    it('should mark provider as not configured without OAuthHandler', () => {
      const module = createSupabaseAuthModule();
      const container = new Container();
      container.load(module);

      const provider = container.get<typeof SupabaseAuthProvider>(SupabaseAuthProvider);

      expect(provider.isConfigured).toBe(false);
      expect(provider.availableProviders).toEqual([]);
    });

    it('should mark provider as configured with OAuthHandler', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email', 'github'],
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      const provider = container.get<typeof SupabaseAuthProvider>(SupabaseAuthProvider);

      expect(provider.isConfigured).toBe(true);
      expect(provider.availableProviders).toHaveLength(2);
    });

    it('should have correct provider metadata', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email'],
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      const provider = container.get<typeof SupabaseAuthProvider>(SupabaseAuthProvider);

      expect(provider.id).toBe('supabase');
      expect(provider.label).toBe('Sanyam Cloud');
    });

    it('should start with no session', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email'],
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      const provider = container.get<typeof SupabaseAuthProvider>(SupabaseAuthProvider);

      expect(provider.session).toBeNull();
      expect(provider.isAuthenticated).toBe(false);
    });
  });

  describe('AuthStateEmitter initialization', () => {
    it('should start with no current session', () => {
      const module = createSupabaseAuthModule();
      const container = new Container();
      container.load(module);

      const emitter = container.get<typeof AuthStateEmitter>(AuthStateEmitter);

      expect(emitter.currentSession).toBeNull();
      expect(emitter.isAuthenticated).toBe(false);
    });

    it('should support event subscription', () => {
      const module = createSupabaseAuthModule();
      const container = new Container();
      container.load(module);

      const emitter = container.get<typeof AuthStateEmitter>(AuthStateEmitter);
      const listener = vi.fn();

      const subscription = emitter.onAuthStateChange(listener);

      expect(subscription).toBeDefined();
      expect(typeof subscription.dispose).toBe('function');
    });
  });

  describe('Module isolation', () => {
    it('should create independent instances in different containers', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email'],
      };

      const module1 = createSupabaseAuthModule(config);
      const module2 = createSupabaseAuthModule(config);

      const container1 = new Container();
      const container2 = new Container();

      container1.load(module1);
      container2.load(module2);

      const emitter1 = container1.get(AuthStateEmitter);
      const emitter2 = container2.get(AuthStateEmitter);

      expect(emitter1).not.toBe(emitter2);
    });

    it('should not share state between modules', () => {
      const config: OAuthConfig = {
        supabaseUrl: 'https://test.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        providers: ['email'],
      };

      const module = createSupabaseAuthModule(config);
      const container = new Container();
      container.load(module);

      const emitter = container.get<typeof AuthStateEmitter>(AuthStateEmitter);
      const mockSession = {
        id: 'test-session',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: Date.now() + 3600000,
        user: {
          id: 'test-user',
          email: 'test@example.com',
          display_name: null,
          avatar_url: null,
          tier: 'free' as const,
          storage_used_bytes: 0,
          document_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      // Emit state in first emitter
      emitter.emit('SIGNED_IN', mockSession);

      // Create a new container and verify it doesn't have the session
      const module2 = createSupabaseAuthModule(config);
      const container2 = new Container();
      container2.load(module2);

      const emitter2 = container2.get<typeof AuthStateEmitter>(AuthStateEmitter);

      expect(emitter.currentSession).not.toBeNull();
      expect(emitter2.currentSession).toBeNull();
    });
  });
});
